import Redis from 'ioredis'

// Cache partagé et compteurs des limites de requêtes. Sans REDIS_URL (développement hors
// Docker), tout fonctionne sans cache : chaque lecture repasse par PostgreSQL.
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
  : null

redis?.on('error', (err) => console.error('Redis :', err.message))

// Lit `key` dans le cache, sinon calcule `load()` et le garde `ttl` secondes.
// Redis indisponible : on lit la base directement, sans jamais bloquer la requête.
export async function cached(key, ttl, load) {
  if (redis?.status === 'ready') {
    try {
      const hit = await redis.get(key)
      if (hit !== null) return JSON.parse(hit)
    } catch { /* cache indisponible : lecture directe */ }
  }
  const value = await load()
  if (redis?.status === 'ready' && value !== undefined) {
    redis.set(key, JSON.stringify(value), 'EX', ttl).catch(() => {})
  }
  return value
}

export async function invalidate(...keys) {
  if (redis?.status === 'ready' && keys.length) await redis.del(...keys).catch(() => {})
}
