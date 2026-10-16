import checkDiskSpace from 'check-disk-space'
import { config } from './env.js'
import pool from './database.js'

const GB = 1024 * 1024 * 1024

// Réglages modifiables depuis Paramètres admin → Général (table system_config)
const OVERRIDE_KEYS = ['storage.total_gb', 'storage.media_pct', 'storage.backup_pct', 'storage.logs_gb']

function computeLimits(diskSize, overrides) {
  const totalGb = parseFloat(overrides['storage.total_gb'])
  // Sans valeur explicite : 95% du disque (marge de sécurité de 5%)
  const safeBytes = totalGb > 0
    ? Math.min(Math.floor(totalGb * GB), diskSize)
    : Math.floor(diskSize * 0.95)

  const mediaPct = Math.min(Math.max(parseInt(overrides['storage.media_pct']) || 70, 1), 95)
  const backupPct = Math.min(Math.max(parseInt(overrides['storage.backup_pct']) || 10, 0), 95)
  const logsGb = parseFloat(overrides['storage.logs_gb']) > 0 ? parseFloat(overrides['storage.logs_gb']) : 2

  return {
    safeBytes,
    mediaLimit: Math.floor(safeBytes * (mediaPct / 100)),
    backupLimit: Math.floor(safeBytes * (backupPct / 100)),
    zipLimit: 5 * GB, // 5 Go fixe
    logLimit: Math.floor(logsGb * GB),
  }
}

async function readOverrides() {
  const { rows } = await pool.query('SELECT key, value FROM system_config WHERE key = ANY($1)', [OVERRIDE_KEYS])
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function initStorage() {
  const { size } = await checkDiskSpace(config.storage.path)
  const { safeBytes, mediaLimit, backupLimit, zipLimit, logLimit } = computeLimits(size, await readOverrides())

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
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  console.log(`💾 Stockage : ${Math.round(size / 1e9)}Go total, ${Math.round(mediaLimit / 1e9)}Go pour les médias`)

  return { size, safeBytes, mediaLimit, backupLimit, zipLimit, logLimit }
}

export async function getStorageConfig() {
  const res = await pool.query('SELECT key, value FROM system_config WHERE key LIKE $1', ['storage.%'])
  return Object.fromEntries(res.rows.map((r) => [r.key, parseFloat(r.value)]))
}

export async function checkMediaStorageLimit() {
  const cfg = await getStorageConfig()
  // Recalculer avec les réglages actuels : une modification depuis le dashboard
  // s'applique immédiatement, sans redémarrage du backend
  const overrides = Object.fromEntries(OVERRIDE_KEYS.map((k) => [k, cfg[k]]))
  const { mediaLimit } = computeLimits(cfg['storage.total_bytes'] || 0, overrides)

  const res = await pool.query('SELECT COALESCE(SUM(size), 0) AS used FROM files WHERE is_deleted = false')
  const used = parseInt(res.rows[0].used)
  const limit = mediaLimit
  return { used, limit, percent: limit > 0 ? Math.round((used / limit) * 100) : 100 }
}
