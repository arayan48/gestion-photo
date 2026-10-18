import { statfs, readFile, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import os from 'os'
import checkDiskSpace from 'check-disk-space'
import { config } from './env.js'
import pool from './database.js'

const execFileAsync = promisify(execFile)
const GB = 1024 * 1024 * 1024
// Marge laissée libre sur le disque pour l'OS et PostgreSQL
const DISK_MARGIN_PCT = 0.05
// En dessous de cet espace libre réel, les uploads sont bloqués quoi qu'il arrive
const MIN_FREE_BYTES = 512 * 1024 * 1024

// Réglages modifiables depuis Paramètres admin → Général (table system_config)
const OVERRIDE_KEYS = ['storage.total_gb', 'storage.media_pct', 'storage.backup_pct', 'storage.logs_gb']

// ─── Détection disque ─────────────────────────────────────────────────────────

// statfs est un appel système direct (pas de `df` lancé à chaque upload)
async function readDisk(path) {
  try {
    const s = await statfs(path)
    return { size: s.blocks * s.bsize, free: s.bavail * s.bsize }
  } catch {
    const { size, free } = await checkDiskSpace(path)
    return { size, free }
  }
}

async function dirSize(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  let total = 0
  for (const e of entries) {
    if (e.isFile()) total += (await stat(join(dir, e.name)).catch(() => ({ size: 0 }))).size
  }
  return total
}

// Ce qu'Obscura occupe déjà sur le disque (corbeille incluse : encore présente physiquement)
async function readObscuraUsage() {
  const [{ rows }, backups] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(size), 0) AS total,
                       COALESCE(SUM(size) FILTER (WHERE is_deleted = false), 0) AS active
                FROM files`),
    dirSize(join(config.storage.path, 'backups')),
  ])
  return { media: parseInt(rows[0].total), mediaActive: parseInt(rows[0].active), backups }
}

// Espace réellement atteignable : le libre + ce qu'Obscura occupe déjà, moins la marge.
// Un disque partagé avec d'autres services ne donne donc plus 95% de sa taille totale.
function computeAutoSafe(size, free, obscuraBytes) {
  const reachable = free + obscuraBytes - size * DISK_MARGIN_PCT
  return Math.max(0, Math.floor(Math.min(size * (1 - DISK_MARGIN_PCT), reachable)))
}

function computeLimits({ size, autoSafe }, overrides) {
  const totalGb = parseFloat(overrides['storage.total_gb'])
  const safeBytes = totalGb > 0
    ? Math.min(Math.floor(totalGb * GB), size)
    : autoSafe

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

// ─── Détection hôte / conteneur ───────────────────────────────────────────────

async function readText(path) {
  return (await readFile(path, 'utf8').catch(() => '')).trim()
}

// Dans Docker, os.totalmem() renvoie la RAM de l'hôte : la vraie limite est dans le cgroup
async function readCgroupLimits() {
  const memV2 = await readText('/sys/fs/cgroup/memory.max')
  const memV1 = await readText('/sys/fs/cgroup/memory/memory.limit_in_bytes')
  const memRaw = memV2 || memV1
  let memLimit = /^\d+$/.test(memRaw) ? parseInt(memRaw) : null
  if (memLimit && memLimit >= os.totalmem()) memLimit = null // "illimité" en v1 = valeur géante
  const memUsed = parseInt(await readText('/sys/fs/cgroup/memory.current') || await readText('/sys/fs/cgroup/memory/memory.usage_in_bytes')) || null

  let cpuLimit = null
  const cpuV2 = await readText('/sys/fs/cgroup/cpu.max') // "quota période" ou "max période"
  if (cpuV2) {
    const [quota, period] = cpuV2.split(' ')
    if (quota !== 'max') cpuLimit = parseInt(quota) / parseInt(period)
  } else {
    const quota = parseInt(await readText('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'))
    const period = parseInt(await readText('/sys/fs/cgroup/cpu/cpu.cfs_period_us'))
    if (quota > 0 && period > 0) cpuLimit = quota / period
  }
  return { memLimit, memUsed, cpuLimit: cpuLimit ? Math.round(cpuLimit * 100) / 100 : null }
}

async function detectContainer() {
  if (existsSync('/.dockerenv')) return 'docker'
  const cgroup = await readText('/proc/1/cgroup')
  if (/docker|containerd/.test(cgroup)) return 'docker'
  if (/kubepods/.test(cgroup)) return 'kubernetes'
  if (process.env.container) return process.env.container // podman, lxc…
  return null
}

async function readOsName() {
  const release = await readText('/etc/os-release')
  const match = release.match(/^PRETTY_NAME="?([^"\n]+)"?/m)
  return match ? match[1] : `${os.type()} ${os.release()}`
}

// Les outils externes indispensables (traitement vidéo, envoi Backblaze)
async function detectTool(cmd, args = ['-version']) {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 3000 })
    const first = stdout.split('\n')[0]
    const version = first.match(/v?(\d+\.\d+(?:\.\d+)?)/)
    return { available: true, version: version ? version[1] : null }
  } catch {
    return { available: false, version: null }
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function initStorage() {
  const [{ size, free }, usage, overrides] = await Promise.all([
    readDisk(config.storage.path), readObscuraUsage(), readOverrides(),
  ])
  const autoSafe = computeAutoSafe(size, free, usage.media + usage.backups)
  const { safeBytes, mediaLimit, backupLimit, zipLimit, logLimit } = computeLimits({ size, autoSafe }, overrides)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const upsert = `
      INSERT INTO system_config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `

    await client.query(upsert, ['storage.total_bytes', String(size)])
    await client.query(upsert, ['storage.free_bytes', String(free)])
    await client.query(upsert, ['storage.auto_safe_bytes', String(autoSafe)])
    await client.query(upsert, ['storage.safe_bytes', String(safeBytes)])
    await client.query(upsert, ['storage.media_limit', String(mediaLimit)])
    await client.query(upsert, ['storage.backup_limit', String(backupLimit)])
    await client.query(upsert, ['storage.zip_limit', String(zipLimit)])
    await client.query(upsert, ['storage.log_limit', String(logLimit)])
    await client.query(upsert, ['storage.detected_at', new Date().toISOString()])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  console.log(`💾 Stockage : ${Math.round(size / 1e9)}Go total, ${Math.round(free / 1e9)}Go libres, ${Math.round(mediaLimit / 1e9)}Go pour les médias`)

  return { size, free, autoSafe, safeBytes, mediaLimit, backupLimit, zipLimit, logLimit }
}

export async function getStorageConfig() {
  const res = await pool.query('SELECT key, value FROM system_config WHERE key LIKE $1', ['storage.%'])
  return Object.fromEntries(res.rows.map((r) => [r.key, parseFloat(r.value)]))
}

export async function checkMediaStorageLimit() {
  const [cfg, disk] = await Promise.all([getStorageConfig(), readDisk(config.storage.path)])
  // Recalculer avec les réglages actuels : une modification depuis le dashboard
  // s'applique immédiatement, sans redémarrage du backend
  const overrides = Object.fromEntries(OVERRIDE_KEYS.map((k) => [k, cfg[k]]))
  const size = cfg['storage.total_bytes'] || disk.size
  const autoSafe = cfg['storage.auto_safe_bytes'] ?? Math.floor(size * (1 - DISK_MARGIN_PCT))
  const { mediaLimit } = computeLimits({ size, autoSafe }, overrides)

  const res = await pool.query('SELECT COALESCE(SUM(size), 0) AS used FROM files WHERE is_deleted = false')
  const used = parseInt(res.rows[0].used)
  const limit = mediaLimit
  // Garde-fou : un disque plein (autre service, logs…) bloque même sous la limite configurée
  const diskFull = disk.free < MIN_FREE_BYTES
  const percent = diskFull ? 100 : limit > 0 ? Math.round((used / limit) * 100) : 100
  return { used, limit, percent, diskFree: disk.free, diskFull }
}

// Rapport complet pour Paramètres admin → Général
export async function detectInfrastructure() {
  const path = config.storage.path
  const [disk, usage, overrides, cgroup, container, osName, ffmpeg, ffprobe, rclone, pg] = await Promise.all([
    readDisk(path), readObscuraUsage(), readOverrides(), readCgroupLimits(), detectContainer(), readOsName(),
    detectTool('ffmpeg'), detectTool('ffprobe'), detectTool('rclone', ['version']),
    pool.query('SHOW server_version').then((r) => r.rows[0].server_version).catch(() => null),
  ])

  const obscuraBytes = usage.media + usage.backups
  const autoSafe = computeAutoSafe(disk.size, disk.free, obscuraBytes)
  const limits = computeLimits({ size: disk.size, autoSafe }, overrides)
  const otherBytes = Math.max(0, disk.size - disk.free - obscuraBytes)

  const hostMem = os.totalmem()
  const memTotal = cgroup.memLimit || hostMem
  const cpuList = os.cpus()
  const cores = cgroup.cpuLimit || cpuList.length

  // Avertissements calculés côté serveur, affichés tels quels
  const warnings = []
  const totalGb = parseFloat(overrides['storage.total_gb'])
  if (totalGb > 0 && totalGb * GB > disk.free + obscuraBytes) {
    warnings.push(`L'espace alloué (${totalGb} Go) dépasse l'espace réellement disponible (${((disk.free + obscuraBytes) / GB).toFixed(1)} Go) : le disque saturera avant la limite.`)
  }
  if (disk.free < MIN_FREE_BYTES) warnings.push('Moins de 512 Mo libres sur le disque : les uploads sont bloqués.')
  else if (disk.free / disk.size < 0.1) warnings.push('Moins de 10% d\'espace libre sur le disque.')
  if (otherBytes > disk.size * 0.3) warnings.push(`D'autres données occupent ${(otherBytes / GB).toFixed(1)} Go sur ce disque : l'auto-détection en tient compte.`)
  if (!ffmpeg.available || !ffprobe.available) warnings.push('FFmpeg introuvable : les vidéos ne pourront pas être traitées (miniatures, métadonnées).')
  if (memTotal < 1 * GB) warnings.push('Moins de 1 Go de RAM : le traitement des vidéos et des grandes images risque d\'échouer.')
  if (cores < 2) warnings.push('Un seul cœur CPU disponible : le traitement des vidéos sera lent.')

  return {
    detectedAt: new Date().toISOString(),
    disk: {
      path,
      size: disk.size,
      free: disk.free,
      used: disk.size - disk.free,
      obscura: { media: usage.media, mediaActive: usage.mediaActive, backups: usage.backups },
      other: otherBytes,
    },
    allocation: {
      autoSafe,
      recommendedTotalGb: Math.floor(autoSafe / GB),
      overridden: totalGb > 0,
      ...limits,
    },
    host: {
      os: osName,
      kernel: os.release(),
      arch: os.arch(),
      container,
      uptime: Math.round(os.uptime()),
      node: process.version,
      postgres: pg,
    },
    cpu: {
      model: cpuList[0]?.model?.trim() || 'Inconnu',
      cores: cpuList.length,
      limit: cgroup.cpuLimit,
      load: os.loadavg().map((l) => Math.round(l * 100) / 100),
    },
    memory: {
      total: memTotal,
      host: hostMem,
      limited: Boolean(cgroup.memLimit),
      free: cgroup.memLimit && cgroup.memUsed ? Math.max(0, cgroup.memLimit - cgroup.memUsed) : os.freemem(),
      process: process.memoryUsage().rss,
    },
    tools: { ffmpeg, ffprobe, rclone },
    warnings,
  }
}
