// Détection de l'infrastructure (disque, CPU, RAM, OS, GPU, outils).
// Aucune dépendance à la base : testable seul avec `node --test`.
import { statfs, readFile, readdir, stat, realpath, access } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join, dirname, basename } from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)
export const GB = 1024 * 1024 * 1024
// Marge laissée libre sur le disque pour l'OS et PostgreSQL
export const DISK_MARGIN_PCT = 0.05
// En dessous de cet espace libre réel, les uploads sont bloqués quoi qu'il arrive
export const MIN_FREE_BYTES = 512 * 1024 * 1024
// Fichiers de l'hôte montés en lecture seule par docker-compose
const HOST_OS_RELEASE = '/host/os-release'
const HOST_HOSTNAME = '/host/hostname'

// Nombres magiques de statfs(2) → nom lisible
const FS_TYPES = {
  0xef53: 'ext4', 0x58465342: 'xfs', 0x9123683e: 'btrfs', 0x2fc12fc1: 'zfs',
  0x794c7630: 'overlay', 0x01021994: 'tmpfs', 0x6969: 'nfs', 0xff534d42: 'cifs',
  0x65735546: 'fuse', 0x4d44: 'vfat', 0x5346544e: 'ntfs', 0x2011bab0: 'exfat',
  0x6a656a63: 'fakeowner', 0x858458f6: 'ramfs',
}

export async function readText(path) {
  return (await readFile(path, 'utf8').catch(() => '')).trim()
}

// ─── Calculs (purs) ───────────────────────────────────────────────────────────

// Espace réellement atteignable : le libre + ce qu'Obscura occupe déjà, moins la marge.
// Un disque partagé avec d'autres services ne donne donc pas 95% de sa taille totale.
export function computeAutoSafe(size, free, obscuraBytes) {
  const reachable = free + obscuraBytes - size * DISK_MARGIN_PCT
  return Math.max(0, Math.floor(Math.min(size * (1 - DISK_MARGIN_PCT), reachable)))
}

export function computeLimits({ size, autoSafe }, overrides) {
  const totalGb = parseFloat(overrides['storage.total_gb'])
  // Mode auto : suit l'espace disponible, sans jamais dépasser le plafond s'il est défini
  const maxGb = parseFloat(overrides['storage.max_gb'])
  const safeBytes = totalGb > 0
    ? Math.min(Math.floor(totalGb * GB), size)
    : maxGb > 0 ? Math.min(autoSafe, Math.floor(maxGb * GB)) : autoSafe

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

// ─── Disque ───────────────────────────────────────────────────────────────────

// statfs est un appel système direct (pas de `df` lancé à chaque upload)
export async function readDisk(path) {
  const s = await statfs(path)
  return { size: s.blocks * s.bsize, free: s.bavail * s.bsize, fsType: FS_TYPES[s.type] || null }
}

export async function dirSize(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  let total = 0
  for (const e of entries) {
    if (e.isFile()) total += (await stat(join(dir, e.name)).catch(() => ({ size: 0 }))).size
  }
  return total
}

// Point de montage le plus spécifique contenant `path` (ligne de /proc/self/mountinfo)
export function findMount(mountinfo, path) {
  let best = null
  for (const line of mountinfo.split('\n')) {
    const f = line.split(' ')
    if (f.length < 10) continue
    const point = f[4].replace(/\\040/g, ' ')
    const inside = path === point || path.startsWith(point.endsWith('/') ? point : `${point}/`)
    if (inside && (!best || point.length >= best.point.length)) {
      const sep = f.indexOf('-')
      best = { point, devId: f[2], fsType: f[sep + 1], source: f[sep + 2] }
    }
  }
  return best
}

// Type (NVMe / SSD / HDD) et modèle du disque physique qui porte `path`
export async function detectDiskDevice(path) {
  const mount = findMount(await readText('/proc/self/mountinfo'), path)
  if (!mount) return null
  const result = { mount: mount.point, source: mount.source, fsType: mount.fsType, kind: null, model: null }

  let dev = await realpath(`/sys/dev/block/${mount.devId}`).catch(() => null)
  if (!dev) return result // overlay, volume réseau, macOS/Windows…
  if (existsSync(join(dev, 'partition'))) dev = dirname(dev) // sda1 → sda
  // Device-mapper / LVM : remonter au premier disque esclave
  const slaves = await readdir(join(dev, 'slaves')).catch(() => [])
  if (slaves.length) dev = (await realpath(join(dev, 'slaves', slaves[0])).catch(() => dev))
  if (existsSync(join(dev, 'partition'))) dev = dirname(dev)

  const name = basename(dev)
  const rotational = await readText(join(dev, 'queue/rotational'))
  if (name.startsWith('nvme')) result.kind = 'NVMe'
  else if (rotational === '0') result.kind = 'SSD'
  else if (rotational === '1') result.kind = 'HDD'
  // VirtIO / Xen : la valeur "rotational" est arbitraire, le vrai support est inconnu
  if (/^(vd|xvd)/.test(name)) result.kind = 'Disque virtuel'

  result.model = (await readText(join(dev, 'device/model'))) || null
  result.device = name
  return result
}

// ─── Mémoire / CPU (cgroups) ──────────────────────────────────────────────────

// Dans Docker, os.totalmem() renvoie la RAM de l'hôte : la vraie limite est dans le cgroup
export async function readCgroupLimits() {
  const memRaw = await readText('/sys/fs/cgroup/memory.max') || await readText('/sys/fs/cgroup/memory/memory.limit_in_bytes')
  let memLimit = /^\d+$/.test(memRaw) ? parseInt(memRaw) : null
  if (memLimit && memLimit >= os.totalmem()) memLimit = null // "illimité" en v1 = valeur géante

  // Utilisation hors cache disque (comme `docker stats`)
  let memUsed = parseInt(await readText('/sys/fs/cgroup/memory.current') || await readText('/sys/fs/cgroup/memory/memory.usage_in_bytes')) || null
  if (memUsed) {
    const memStat = await readText('/sys/fs/cgroup/memory.stat') || await readText('/sys/fs/cgroup/memory/memory.stat')
    const cache = memStat.match(/^(?:inactive_file|total_inactive_file) (\d+)$/m)
    if (cache) memUsed = Math.max(0, memUsed - parseInt(cache[1]))
  }

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

// ─── Système ──────────────────────────────────────────────────────────────────

export async function detectContainer() {
  if (existsSync('/.dockerenv')) return 'docker'
  const cgroup = await readText('/proc/1/cgroup')
  if (/docker|containerd/.test(cgroup)) return 'docker'
  if (/kubepods/.test(cgroup)) return 'kubernetes'
  if (process.env.container) return process.env.container // podman, lxc…
  return null
}

function prettyName(osRelease) {
  const match = osRelease.match(/^PRETTY_NAME="?([^"\n]+)"?/m)
  return match ? match[1] : null
}

// L'OS de la machine (monté depuis l'hôte) prime sur celui de l'image Docker
export async function readOsInfo() {
  const host = prettyName(await readText(HOST_OS_RELEASE))
  const local = prettyName(await readText('/etc/os-release'))
  const hostname = (await readText(HOST_HOSTNAME)) || os.hostname()
  return { name: host || local || `${os.type()} ${os.release()}`, image: host ? local : null, hostname, fromHost: Boolean(host) }
}

// ─── Outils & GPU ─────────────────────────────────────────────────────────────

export async function detectTool(cmd, args = ['-version']) {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 3000 })
    const version = stdout.split('\n')[0].match(/v?(\d+\.\d+(?:\.\d+)?)/)
    return { available: true, version: version ? version[1] : null }
  } catch {
    return { available: false, version: null }
  }
}

// GPU visibles par le conteneur + accélérations matérielles compilées dans FFmpeg
export async function detectGpu() {
  const dri = (await readdir('/dev/dri').catch(() => [])).filter((d) => d.startsWith('renderD'))
  const nvidia = await access('/dev/nvidia0').then(() => true).catch(() => false)
  let hwaccels = []
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-hide_banner', '-hwaccels'], { timeout: 3000 })
    hwaccels = stdout.split('\n').slice(1).map((l) => l.trim()).filter(Boolean)
  } catch { /* FFmpeg absent : signalé ailleurs */ }
  return { renderNodes: dri, nvidia, hwaccels }
}
