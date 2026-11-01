import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticPlugin from '@fastify/static'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import { join } from 'path'
import { existsSync } from 'fs'
import { redis } from './config/redis.js'
import pool from './config/database.js'
import { config } from './config/env.js'
import { initStorage } from './config/storage.js'
import { ensureStorageDirs } from './services/storage.service.js'
import { startCronJobs } from './utils/cron.js'
import { startUpdateCheck, updateState } from './services/update.service.js'
import { registerWebsocketRoutes } from './websocket/notifications.js'
import authRoutes from './routes/auth/index.js'
import userRoutes from './routes/users/index.js'
import roleRoutes from './routes/roles/index.js'
import fileRoutes from './routes/files/index.js'
import adminRoutes from './routes/admin/index.js'
import { authenticate } from './middleware/auth.js'
import { seedPermissions } from './models/seed.js'
import { runMigrations } from './models/migrate.js'
import { initMasterKey } from './services/secrets.service.js'
import {
  importLegacyEnvSettings,
  encryptPlaintextSecrets,
  verifyMasterKey,
  resetEncryptedSecrets,
  ensureJwtSecret,
  getAppUrl,
} from './services/config.service.js'

// ── Attente de la base ───────────────────────────────────────────────────────
// Au premier démarrage, PostgreSQL redémarre après son initialisation : réessayer
// plutôt que quitter au premier refus (le conteneur serait marqué « unhealthy »).
async function waitForDatabase({ attempts = 30, delayMs = 2000 } = {}) {
  for (let i = 1; ; i++) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (err) {
      // Identifiants / base invalides : inutile de réessayer
      if (err.code === '28P01' || err.code === '28000' || err.code === '3D000') {
        console.error(
          '❌ PostgreSQL refuse la connexion (identifiants ou base invalides).\n' +
          '   → DB_PASSWORD / DB_USER / DB_NAME doivent être identiques pour les services postgres et backend.\n' +
          '   → Le volume postgres_data garde le mot de passe de sa création : changer DB_PASSWORD\n' +
          '     ensuite ne le modifie pas (ALTER USER dans le conteneur, ou supprimer le volume si vide).'
        )
        throw err
      }
      if (i >= attempts) throw err
      console.log(`⏳ Base de données indisponible (${err.code || err.message}), nouvelle tentative ${i}/${attempts}…`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

// ── Initialisation (avant les plugins : le secret JWT vient de la base) ───────
try {
  await waitForDatabase()
  console.log('✅ Base de données connectée')

  // Appliquer les migrations manquantes (idempotent)
  await runMigrations()

  // Clé maître (chiffrement des secrets) puis paramètres
  await initMasterKey()
  if (!(await verifyMasterKey())) {
    if (process.env.MASTER_KEY_RESET === 'true') {
      await resetEncryptedSecrets()
    } else {
      console.error(
        '❌ La clé maître ne correspond pas aux secrets chiffrés en base.\n' +
        '   → Restaurez le fichier master.key (volume backend_data) ou la variable MASTER_KEY d\'origine.\n' +
        '   → Clé définitivement perdue ? Démarrez une fois avec MASTER_KEY_RESET=true : les secrets\n' +
        '     (email, Discord, B2…) seront à ressaisir et la 2FA des utilisateurs sera désactivée.'
      )
      process.exit(1)
    }
  }
  await importLegacyEnvSettings()
  await encryptPlaintextSecrets()
  config.jwt.accessSecret = await ensureJwtSecret()
} catch (err) {
  console.error('❌ Échec de l\'initialisation :', err)
  process.exit(1)
}

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
  },
  // Ne faire confiance qu'aux proxys du réseau privé (tunnel Cloudflare, Traefik…) pour X-Forwarded-For.
  // `true` ferait confiance à l'en-tête envoyé par n'importe quel client (usurpation d'IP).
  trustProxy: process.env.TRUST_PROXY || 'loopback,linklocal,uniquelocal',
  // Liens publics : /media/<jeton> → /api/files/public/<jeton>
  rewriteUrl: (req) => req.url.replace(/^\/media\//, '/api/files/public/'),
})

// En-têtes de sécurité sur toutes les réponses
fastify.addHook('onSend', async (request, reply) => {
  reply.header('X-Frame-Options', 'SAMEORIGIN')
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
})

// ── Gestion centralisée des erreurs ──────────────────────────────────────────
fastify.setErrorHandler((err, request, reply) => {
  // Erreurs PostgreSQL courantes → réponses client propres
  if (err.code === '22P02') return reply.code(400).send({ error: 'Identifiant ou valeur invalide' })
  if (err.code === '23505') return reply.code(409).send({ error: 'Cette valeur existe déjà' })
  if (err.code === '23503') return reply.code(400).send({ error: 'Référence invalide' })
  if (err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ error: 'Fichier trop volumineux (500 Mo maximum)' })

  const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500
  if (status >= 500) request.log.error(err)
  // Ne jamais exposer les détails internes (SQL, chemins…) au client
  return reply.code(status).send({ error: status >= 500 ? 'Erreur interne du serveur' : err.message })
})

// ── Plugins ──────────────────────────────────────────────────────────────────
// Le frontend est servi sur la même origine (par Fastify) : CORS seulement pour l'URL publique configurée
await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, false)
    getAppUrl().then((appUrl) => cb(null, !!appUrl && origin === appUrl)).catch(() => cb(null, false))
  },
  credentials: true,
})

await fastify.register(cookie, {
  secret: config.jwt.accessSecret,
})

await fastify.register(jwt, {
  secret: config.jwt.accessSecret,
})

// Compteurs dans Redis : partagés entre instances et conservés au redémarrage
await fastify.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute',
  redis: redis ?? undefined,
  skipOnError: true,
  // Miniatures, avatars et interface : pas de limite (une galerie en charge des centaines)
  allowList: (request) => !request.url.startsWith('/api/') && !request.url.startsWith('/ws'),
  // Levée comme une erreur : sans statusCode, le gestionnaire d'erreurs répondrait 500
  errorResponseBuilder: (request, context) =>
    Object.assign(new Error('Trop de requêtes. Veuillez réessayer dans quelques instants.'), { statusCode: context.statusCode }),
})

await fastify.register(multipart, {
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 Mo
  },
})

await fastify.register(staticPlugin, {
  root: config.storage.path,
  prefix: '/storage/',
  // Seuls les miniatures et avatars sont publics. Les originaux passent par
  // /api/files/:id/view (authentifié) ou /media/:token (liste blanche IP), et les
  // sauvegardes / zips ne doivent jamais être servis.
  // (reply.sendFile() avec une racine explicite n'est pas concerné par ce filtre.)
  allowedPath: (pathName, root) =>
    root !== config.storage.path || /^\/(thumbnails|avatars)\/[^/]+$/.test(pathName),
  // Miniatures et avatars en cache 7 jours (navigateur et Cloudflare). Pas les autres
  // fichiers envoyés par reply.sendFile() : ce sont des originaux privés.
  setHeaders: (res, path) => {
    if (/[/\\](thumbnails|avatars)[/\\][^/\\]+$/.test(path)) res.setHeader('Cache-Control', 'public, max-age=604800')
  },
})

await fastify.register(websocket)

// ── Routes ────────────────────────────────────────────────────────────────────
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(userRoutes, { prefix: '/api/users' })
await fastify.register(roleRoutes, { prefix: '/api/roles' })
await fastify.register(fileRoutes, { prefix: '/api/files' })
await fastify.register(adminRoutes, { prefix: '/api/admin' })

// ── WebSocket ─────────────────────────────────────────────────────────────────
fastify.register(async (instance) => {
  instance.addHook('preHandler', authenticate)
  registerWebsocketRoutes(instance)
})

// ── Interface (build Vite copié dans l'image) ─────────────────────────────────
// Absente en développement : c'est Vite qui sert l'interface.
const publicDir = process.env.PUBLIC_DIR || join(process.cwd(), 'public')
if (existsSync(publicDir)) {
  await fastify.register(staticPlugin, {
    root: publicDir,
    prefix: '/',
    decorateReply: false,
    wildcard: false,
    index: false,
    preCompressed: true, // fichiers .br/.gz générés au build
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600')
    },
  })
  // Routes React : toute page inconnue renvoie index.html (jamais mis en cache)
  fastify.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || /^\/(api|ws|storage)(\/|$)/.test(request.url)) {
      return reply.code(404).send({ error: 'Introuvable' })
    }
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html', publicDir)
  })
}

// ── Health check ──────────────────────────────────────────────────────────────
fastify.get('/api/health', async () => ({ status: 'ok', version: updateState.current, timestamp: new Date().toISOString() }))

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Auto-seed permissions au démarrage
    await seedPermissions()

    // Initialiser le stockage
    await ensureStorageDirs()
    await initStorage()

    // Démarrer les cron jobs
    startCronJobs()
    startUpdateCheck()

    await fastify.listen({ port: config.port, host: '0.0.0.0' })
    console.log(`🚀 Obscura backend démarré sur le port ${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// ── Arrêt propre (redéploiement, docker stop) ────────────────────────────────
// Sans ce handler, node en PID 1 ignore SIGTERM et Docker le tue au bout de 10 s.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    try {
      await fastify.close()
      await pool.end()
      redis?.disconnect()
    } finally {
      process.exit(0)
    }
  })
}

start()
