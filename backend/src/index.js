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
import { initStorage, ensureStorageDirs } from './config/storage.js'
import { startCronJobs } from './utils/cron.js'
import { registerWebsocketRoutes } from './websocket/notifications.js'
import authRoutes from './routes/auth/index.js'
import userRoutes from './routes/users/index.js'
import roleRoutes from './routes/roles/index.js'
import fileRoutes from './routes/files/index.js'
import adminRoutes from './routes/admin/index.js'
import { authenticate } from './middleware/auth.js'

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
    transport: config.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  trustProxy: true,
})

// ── Plugins ──────────────────────────────────────────────────────────────────
await fastify.register(cors, {
  origin: config.appUrl,
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
    // Vérifier la connexion DB
    await pool.query('SELECT 1')
    console.log('✅ Base de données connectée')

    // Initialiser le stockage
    await ensureStorageDirs()
    await initStorage()

    // Démarrer les cron jobs
    startCronJobs()

    await fastify.listen({ port: config.port, host: '0.0.0.0' })
    console.log(`🚀 WubalStore backend démarré sur le port ${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
