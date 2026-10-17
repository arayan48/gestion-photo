import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticPlugin from '@fastify/static'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import { join } from 'path'
import pool from './config/database.js'
import { config } from './config/env.js'
import { initStorage } from './config/storage.js'
import { ensureStorageDirs } from './services/storage.service.js'
import { startCronJobs } from './utils/cron.js'
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

// ── Initialisation (avant les plugins : le secret JWT vient de la base) ───────
try {
  await pool.query('SELECT 1')
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
  // Ne faire confiance qu'aux proxys du réseau privé (Nginx dans Docker) pour X-Forwarded-For.
  // `true` ferait confiance à l'en-tête envoyé par n'importe quel client (usurpation d'IP).
  trustProxy: process.env.TRUST_PROXY || 'loopback,linklocal,uniquelocal',
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
// Le frontend est servi sur la même origine (Nginx) : CORS seulement pour l'URL publique configurée
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

await fastify.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.',
  }),
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

// ── Health check ──────────────────────────────────────────────────────────────
fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

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

    await fastify.listen({ port: config.port, host: '0.0.0.0' })
    console.log(`🚀 Obscura backend démarré sur le port ${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
