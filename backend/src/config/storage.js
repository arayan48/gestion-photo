import checkDiskSpace from 'check-disk-space'
import { config } from './env.js'
import pool from './database.js'

export async function initStorage() {
  const { free, size } = await checkDiskSpace(config.storage.path)
  const safeBytes = Math.floor(size * 0.95)

  const mediaLimit = Math.floor(safeBytes * 0.70)
  const backupLimit = Math.floor(safeBytes * 0.10)
  const zipLimit = 5 * 1024 * 1024 * 1024   // 5 Go fixe
  const logLimit = 2 * 1024 * 1024 * 1024   // 2 Go fixe

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const upsert = `
      INSERT INTO system_config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `

    await client.query(upsert, ['storage.total_bytes', String(size)])
    await client.query(upsert, ['storage.safe_bytes', String(safeBytes)])
    await client.query(upsert, ['storage.media_limit', String(mediaLimit)])
    await client.query(upsert, ['storage.backup_limit', String(backupLimit)])
    await client.query(upsert, ['storage.zip_limit', String(zipLimit)])
    await client.query(upsert, ['storage.log_limit', String(logLimit)])

    await client.query('COMMIT')
  } finally {
    client.release()
  }

  console.log(`💾 Stockage : ${Math.round(size / 1e9)}Go total, ${Math.round(mediaLimit / 1e9)}Go pour les médias`)

  return { size, safeBytes, mediaLimit, backupLimit, zipLimit, logLimit }
}

export async function getStorageConfig() {
  const res = await pool.query('SELECT key, value FROM system_config WHERE key LIKE $1', ['storage.%'])
  return Object.fromEntries(res.rows.map((r) => [r.key, parseInt(r.value)]))
}

export async function checkMediaStorageLimit() {
  const cfg = await getStorageConfig()
  const res = await pool.query('SELECT COALESCE(SUM(size), 0) AS used FROM files WHERE is_deleted = false')
  const used = parseInt(res.rows[0].used)
  const limit = cfg['storage.media_limit']
  return { used, limit, percent: Math.round((used / limit) * 100) }
}
