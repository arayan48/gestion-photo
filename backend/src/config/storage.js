import { join } from 'path'
import os from 'os'
import checkDiskSpace from 'check-disk-space'
import { config } from './env.js'
import pool from './database.js'
import {
  GB, MIN_FREE_BYTES, DISK_MARGIN_PCT, computeAutoSafe, computeLimits, dirSize,
  readDisk as statDisk, detectDiskDevice, readCgroupLimits, detectContainer, readOsInfo, detectTool, detectGpu,
} from '../utils/infra.js'

// Réglages modifiables depuis Paramètres admin → Général (table system_config)
const OVERRIDE_KEYS = ['storage.total_gb', 'storage.media_pct', 'storage.backup_pct', 'storage.logs_gb']

async function readDisk(path) {
  try {
    return await statDisk(path)
  } catch {
    const { size, free } = await checkDiskSpace(path)
    return { size, free, fsType: null }
  }
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

async function readOverrides() {
  const { rows } = await pool.query('SELECT key, value FROM system_config WHERE key = ANY($1)', [OVERRIDE_KEYS])
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

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
  const [disk, device, usage, overrides, cgroup, container, osInfo, ffmpeg, ffprobe, rclone, gpu, pg] = await Promise.all([
    readDisk(path), detectDiskDevice(path).catch(() => null), readObscuraUsage(), readOverrides(), readCgroupLimits(),
    detectContainer(), readOsInfo(), detectTool('ffmpeg'), detectTool('ffprobe'), detectTool('rclone', ['version']), detectGpu(),
    pool.query('SHOW server_version').then((r) => r.rows[0].server_version.split(' ')[0]).catch(() => null),
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
  if (device?.kind === 'HDD') warnings.push('Disque mécanique (HDD) : les miniatures et le streaming vidéo seront plus lents qu\'avec un SSD.')
  if (['nfs', 'cifs', 'fuse'].includes(disk.fsType)) warnings.push(`Stockage réseau (${disk.fsType}) : vérifiez la latence et la fiabilité du montage.`)
  if (!ffmpeg.available || !ffprobe.available) warnings.push('FFmpeg introuvable : les vidéos ne pourront pas être traitées (miniatures, métadonnées).')
  if (!rclone.available) warnings.push('Rclone introuvable : l\'envoi des sauvegardes vers Backblaze B2 est impossible.')
  if (memTotal < 1 * GB) warnings.push('Moins de 1 Go de RAM : le traitement des vidéos et des grandes images risque d\'échouer.')
  if (cores < 2) warnings.push('Un seul cœur CPU disponible : le traitement des vidéos sera lent.')
  if (os.loadavg()[0] > cpuList.length) warnings.push('Le processeur est saturé (charge supérieure au nombre de cœurs).')
  if (container && !osInfo.fromHost) warnings.push('OS de la machine non détecté : montez /etc/os-release de l\'hôte (voir docker-compose.yml).')

  return {
    detectedAt: new Date().toISOString(),
    disk: {
      path,
      size: disk.size,
      free: disk.free,
      used: disk.size - disk.free,
      fsType: disk.fsType || device?.fsType || null,
      device,
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
      os: osInfo.name,
      image: osInfo.image,
      hostname: osInfo.hostname,
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
    gpu,
    tools: { ffmpeg, ffprobe, rclone },
    warnings,
  }
}
