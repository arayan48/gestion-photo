import { execFile } from 'child_process'
import { promisify } from 'util'
import { join, relative } from 'path'
import { stat, mkdir, rm, readdir, unlink } from 'fs/promises'
import { nanoid } from 'nanoid'
import pool from '../config/database.js'
import { config } from '../config/env.js'
import { log, notifyAdmins } from '../utils/logger.js'
import { getConfigValues } from './config.service.js'

// execFile (et non exec) : aucun passage par un shell, donc pas d'injection possible
// via les variables d'environnement ou la configuration
const execFileAsync = promisify(execFile)

const BACKUP_DIR = join(config.storage.path, 'backups')
const BACKUP_TYPES = ['local', 'backblaze']
const MEDIA_DIRS = ['images', 'videos', 'thumbnails', 'avatars']

async function getB2Config() {
  const db = await getConfigValues(['b2.key_id', 'b2.key', 'b2.bucket'])
  return {
    keyId: db['b2.key_id'] || process.env.B2_APPLICATION_KEY_ID || '',
    key: db['b2.key'] || process.env.B2_APPLICATION_KEY || '',
    bucket: db['b2.bucket'] || process.env.B2_BUCKET_NAME || '',
  }
}

// Crée l'archive locale : dump PostgreSQL + médias
async function createArchive() {
  await mkdir(BACKUP_DIR, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup_${timestamp}_${nanoid(6)}.tar.gz`
  const backupPath = join(BACKUP_DIR, filename)

  const stagingDir = join(config.storage.path, 'temp', `backup_${nanoid(8)}`)
  await mkdir(stagingDir, { recursive: true })
  const dumpPath = join(stagingDir, 'wubalstore_db.sql.gz')

  try {
    // -Z : compression gzip intégrée (pas de pipe shell qui masquerait un échec de pg_dump)
    await execFileAsync('pg_dump', [
      '-h', process.env.DB_HOST || 'localhost',
      '-p', String(process.env.DB_PORT || 5432),
      '-U', process.env.DB_USER || 'wubalstore',
      '-d', process.env.DB_NAME || 'wubalstore',
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

async function uploadToBackblaze(backupPath) {
  const b2 = await getB2Config()
  if (!b2.keyId || !b2.key || !b2.bucket) {
    throw new Error('Backblaze B2 non configuré (Key ID, clé et bucket requis)')
  }
  // Remote rclone défini par variables d'environnement : aucun fichier rclone.conf nécessaire
  await execFileAsync('rclone', ['copy', backupPath, `wubalb2:${b2.bucket}/backups/`], {
    env: {
      ...process.env,
      RCLONE_CONFIG_WUBALB2_TYPE: 'b2',
      RCLONE_CONFIG_WUBALB2_ACCOUNT: b2.keyId,
      RCLONE_CONFIG_WUBALB2_KEY: b2.key,
    },
    maxBuffer: 10 * 1024 * 1024,
  })
}

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
    archive = await createArchive()
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
