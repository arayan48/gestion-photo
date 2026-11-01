import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { join, relative, basename, posix } from 'path'
import { stat, mkdir, rm, readdir, unlink, rename } from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { nanoid } from 'nanoid'
import pool from '../config/database.js'
import { config } from '../config/env.js'
import { log, notifyAdmins } from '../utils/logger.js'
import { getConfigValues } from './config.service.js'
import { redis } from '../config/redis.js'
import { runMigrations } from '../models/migrate.js'
import { initStorage } from '../config/storage.js'

// execFile (et non exec) : aucun passage par un shell, donc pas d'injection possible
// via les variables d'environnement ou la configuration
const execFileAsync = promisify(execFile)

const BACKUP_DIR = join(config.storage.path, 'backups')
const BACKUP_TYPES = ['local', 'backblaze']
const MEDIA_DIRS = ['images', 'videos', 'thumbnails', 'avatars']
const ARCHIVE_NAME_RE = /^backup_[\w-]+\.tar\.gz$/
const DUMP_NAME = 'obscura_db.sql.gz'

// Une seule opération lourde à la fois (sauvegarde, import, restauration)
let busy = false
async function exclusive(fn) {
  if (busy) throw new Error('Une autre opération de sauvegarde est en cours')
  busy = true
  try { return await fn() } finally { busy = false }
}

function newArchiveName() {
  return `backup_${new Date().toISOString().replace(/[:.]/g, '-')}_${nanoid(6)}.tar.gz`
}

async function getB2Config() {
  const db = await getConfigValues(['b2.key_id', 'b2.key', 'b2.bucket'])
  // Paramètres admin → Sauvegardes (identifiants stockés chiffrés)
  return {
    keyId: db['b2.key_id'] || '',
    key: db['b2.key'] || '',
    bucket: db['b2.bucket'] || '',
  }
}

// Crée l'archive locale : dump PostgreSQL + médias
async function createArchive() {
  await mkdir(BACKUP_DIR, { recursive: true })

  const filename = newArchiveName()
  const backupPath = join(BACKUP_DIR, filename)

  const stagingDir = join(config.storage.path, 'temp', `backup_${nanoid(8)}`)
  await mkdir(stagingDir, { recursive: true })
  const dumpPath = join(stagingDir, 'obscura_db.sql.gz')

  try {
    // -Z : compression gzip intégrée (pas de pipe shell qui masquerait un échec de pg_dump)
    await execFileAsync('pg_dump', [
      '-h', process.env.DB_HOST || 'localhost',
      '-p', String(process.env.DB_PORT || 5432),
      '-U', process.env.DB_USER || 'obscura',
      '-d', process.env.DB_NAME || 'obscura',
      '--no-owner',
      '-Z', '6',
      '-f', dumpPath,
    ], { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' }, maxBuffer: 10 * 1024 * 1024 })

    const existingDirs = []
    for (const dir of MEDIA_DIRS) {
      try {
        await stat(join(config.storage.path, dir))
        existingDirs.push(dir)
      } catch {}
    }

    await execFileAsync('tar', [
      '-czf', backupPath,
      '-C', config.storage.path,
      ...existingDirs,
      relative(config.storage.path, dumpPath),
    ], { maxBuffer: 10 * 1024 * 1024 })
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }

  const { size } = await stat(backupPath)
  return { backupPath, filename, size }
}

async function rcloneB2(args) {
  const b2 = await getB2Config()
  if (!b2.keyId || !b2.key || !b2.bucket) {
    throw new Error('Backblaze B2 non configuré (Key ID, clé et bucket requis)')
  }
  // Remote rclone défini par variables d'environnement : aucun fichier rclone.conf nécessaire
  await execFileAsync('rclone', args(`obscurab2:${b2.bucket}/backups/`), {
    env: {
      ...process.env,
      RCLONE_CONFIG_OBSCURAB2_TYPE: 'b2',
      RCLONE_CONFIG_OBSCURAB2_ACCOUNT: b2.keyId,
      RCLONE_CONFIG_OBSCURAB2_KEY: b2.key,
    },
    maxBuffer: 10 * 1024 * 1024,
  })
}

const uploadToBackblaze = (backupPath) => rcloneB2((remote) => ['copy', backupPath, remote])

// Ne garder que les N dernières archives locales (Paramètres → Sauvegardes → Rétention)
async function applyRetention() {
  const cfg = await getConfigValues(['backup.keep_n'])
  const keep = Math.max(parseInt(cfg['backup.keep_n']) || 7, 1)
  const files = (await readdir(BACKUP_DIR).catch(() => []))
    .filter((f) => f.startsWith('backup_') && f.endsWith('.tar.gz'))
    .sort()
    .reverse()
  for (const old of files.slice(keep)) {
    await unlink(join(BACKUP_DIR, old)).catch(() => {})
  }
}

async function recordFailure(type, err) {
  await pool.query(
    'INSERT INTO backups (type, status, error_message) VALUES ($1, $2, $3)',
    [type, 'failed', err.message]
  ).catch(() => {})
  await notifyAdmins({ type: 'backup_failed', message: `Sauvegarde ${type} échouée : ${err.message}` })
  await log({ category: 'system', level: 'error', action: 'backup_failed', metadata: { type, error: err.message } })
}

export async function runBackup(type = 'local') {
  if (!BACKUP_TYPES.includes(type)) {
    return { success: false, error: `Type de sauvegarde inconnu : ${type}` }
  }

  let archive
  try {
    archive = await exclusive(createArchive)
    if (type === 'backblaze') await uploadToBackblaze(archive.backupPath)

    await pool.query(
      'INSERT INTO backups (type, status, size, path) VALUES ($1, $2, $3, $4)',
      [type, 'success', archive.size, type === 'local' ? archive.backupPath : `b2:backups/${archive.filename}`]
    )

    await applyRetention()
    await notifyAdmins({ type: 'backup_success', message: `Sauvegarde ${type} réussie (${Math.round(archive.size / 1e6)} Mo)` })
    await log({ category: 'system', level: 'info', action: 'backup_success', metadata: { type, size: archive.size } })

    return { success: true, size: archive.size }
  } catch (err) {
    await recordFailure(type, err)
    return { success: false, error: err.message }
  }
}

// Sauvegarde planifiée : destinations activées dans la configuration
export async function runConfiguredBackups() {
  const cfg = await getConfigValues(['backup.local.enabled', 'backup.backblaze.enabled'])
  const results = []
  // Local activé par défaut si rien n'est configuré
  if (cfg['backup.local.enabled'] !== 'false') results.push(await runBackup('local'))
  if (cfg['backup.backblaze.enabled'] === 'true') results.push(await runBackup('backblaze'))
  return results
}

// ─── Gestion des archives (télécharger, importer, supprimer, restaurer) ──────

// Copie locale d'une sauvegarde (une sauvegarde B2 garde aussi son archive sur le serveur
// jusqu'à la rétention). null si le nom stocké n'est pas une archive Obscura.
export function localArchivePath(row) {
  const name = row?.path && basename(row.path)
  return name && ARCHIVE_NAME_RE.test(name) ? join(BACKUP_DIR, name) : null
}

export async function isArchiveAvailable(row) {
  const path = row.status === 'success' && localArchivePath(row)
  return path ? stat(path).then(() => true, () => false) : false
}

// Liste le contenu et refuse toute entrée hors des dossiers attendus (anti « tar slip »).
// Renvoie le chemin du dump SQL dans l'archive.
async function inspectArchive(archivePath) {
  let stdout
  try {
    ({ stdout } = await execFileAsync('tar', ['-tzf', archivePath], { maxBuffer: 200 * 1024 * 1024 }))
  } catch {
    throw new Error('Archive illisible : un fichier .tar.gz créé par Obscura est attendu')
  }
  let dump = null
  for (const entry of stdout.split('\n').filter(Boolean)) {
    const clean = posix.normalize(entry)
    const top = clean.split('/')[0]
    if (clean.startsWith('/') || clean.startsWith('..') || !(MEDIA_DIRS.includes(top) || top === 'temp')) {
      throw new Error(`Archive refusée : entrée inattendue « ${entry} »`)
    }
    if (top === 'temp' && posix.basename(clean) === DUMP_NAME) dump = clean
  }
  if (!dump) throw new Error('Archive refusée : aucune base de données à l\'intérieur')
  return dump
}

// Enregistre une archive envoyée par un administrateur (flux multipart)
export async function importArchive(fileStream) {
  return exclusive(async () => {
    await mkdir(BACKUP_DIR, { recursive: true })
    const partPath = join(BACKUP_DIR, `.import_${nanoid(8)}.part`)
    try {
      await pipeline(fileStream, createWriteStream(partPath))
      if (fileStream.truncated) throw Object.assign(new Error('Archive trop volumineuse pour la place réservée aux sauvegardes'), { statusCode: 413 })
      await inspectArchive(partPath)

      const finalPath = join(BACKUP_DIR, newArchiveName())
      await rename(partPath, finalPath)
      const { size } = await stat(finalPath)
      const { rows: [row] } = await pool.query(
        'INSERT INTO backups (type, status, size, path) VALUES ($1, $2, $3, $4) RETURNING *',
        ['local', 'success', size, finalPath]
      ).catch(async (err) => { await unlink(finalPath).catch(() => {}); throw err })
      return row
    } finally {
      await unlink(partPath).catch(() => {})
    }
  })
}

export async function deleteBackup(row) {
  const path = localArchivePath(row)
  if (path) await unlink(path).catch((err) => { if (err.code !== 'ENOENT') throw err })
  if (row.type === 'backblaze' && row.status === 'success' && path) {
    // Best effort : des identifiants B2 retirés ne doivent pas bloquer le ménage de l'historique
    await rcloneB2((remote) => ['deletefile', remote + basename(path)]).catch((err) =>
      log({ category: 'system', level: 'warning', action: 'backup_remote_delete_failed', metadata: { id: row.id, error: err.message } })
    )
  }
  await pool.query('DELETE FROM backups WHERE id = $1', [row.id])
}

// Exécute le dump dans une seule transaction : en cas d'erreur, la base reste intacte
function restoreDatabase(dumpPath) {
  return new Promise((resolve, reject) => {
    const psql = spawn('psql', [
      '-h', process.env.DB_HOST || 'localhost',
      '-p', String(process.env.DB_PORT || 5432),
      '-U', process.env.DB_USER || 'obscura',
      '-d', process.env.DB_NAME || 'obscura',
      '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-f', '-',
    ], { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' }, stdio: ['pipe', 'ignore', 'pipe'] })

    let stderr = ''
    psql.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000) })
    psql.on('error', reject)
    psql.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Restauration de la base échouée : ${stderr.trim() || `code ${code}`}`)))

    psql.stdin.on('error', () => {}) // psql arrêté sur erreur : le code de sortie suffit
    psql.stdin.write('DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n')
    pipeline(createReadStream(dumpPath), createGunzip(), psql.stdin).catch(() => psql.kill())
  })
}

// Remplace la base et les médias par le contenu d'une archive.
// Une sauvegarde de sécurité de l'état actuel est créée juste avant.
export async function restoreBackup(row) {
  const archivePath = localArchivePath(row)
  if (!archivePath || !(await isArchiveAvailable(row))) throw new Error('Archive introuvable sur le serveur')

  return exclusive(async () => {
    const dumpEntry = await inspectArchive(archivePath)

    const safety = await createArchive()
    await pool.query('INSERT INTO backups (type, status, size, path) VALUES ($1, $2, $3, $4)', ['local', 'success', safety.size, safety.backupPath])

    const stagingDir = join(config.storage.path, 'temp', `restore_${nanoid(8)}`)
    await mkdir(stagingDir, { recursive: true })
    try {
      await execFileAsync('tar', ['-xzf', archivePath, '-C', stagingDir, '--no-same-owner'], { maxBuffer: 10 * 1024 * 1024 })
      // Un lien symbolique servi comme média exposerait des fichiers du serveur
      const { stdout: links } = await execFileAsync('find', [stagingDir, '-type', 'l'])
      if (links.trim()) throw new Error('Archive refusée : elle contient des liens symboliques')

      // L'historique des sauvegardes décrit ce qui est sur le disque : on le garde tel quel
      const { rows: history } = await pool.query('SELECT * FROM backups')
      await restoreDatabase(join(stagingDir, dumpEntry))
      await runMigrations()
      await pool.query('DELETE FROM backups')
      await pool.query('INSERT INTO backups SELECT * FROM json_populate_recordset(NULL::backups, $1)', [JSON.stringify(history)])

      for (const dir of MEDIA_DIRS) {
        const target = join(config.storage.path, dir)
        await rm(target, { recursive: true, force: true })
        await rename(join(stagingDir, dir), target).catch(() => mkdir(target, { recursive: true }))
      }
    } finally {
      await rm(stagingDir, { recursive: true, force: true })
    }

    // Sessions, rôles et utilisateurs en cache ne correspondent plus à la base restaurée
    if (redis?.status === 'ready') await redis.flushdb().catch(() => {})
    await initStorage().catch(() => {})
    return { safetyBackup: safety.filename }
  })
}
