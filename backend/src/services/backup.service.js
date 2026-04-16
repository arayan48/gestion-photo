import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { stat } from 'fs/promises'
import { nanoid } from 'nanoid'
import pool from '../config/database.js'
import { config } from '../config/env.js'
import { log, notifyAdmins } from '../utils/logger.js'

const execAsync = promisify(exec)

export async function runBackup(type = 'local') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup_${timestamp}.tar.gz`
  const backupPath = join(config.storage.path, 'backups', filename)

  try {
    // Dump PostgreSQL
    const pgDump = `pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} ${process.env.DB_NAME} | gzip > /tmp/wubal_db.sql.gz`
    await execAsync(pgDump, { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } })

    // Archive storage + dump
    await execAsync(`tar -czf ${backupPath} -C ${config.storage.path} images videos thumbnails -C /tmp wubal_db.sql.gz`)

    const { size } = await stat(backupPath)

    if (type === 'backblaze') {
      await execAsync(`rclone copy ${backupPath} backblaze:${process.env.B2_BUCKET_NAME}/backups/`)
    }

    await pool.query(
      'INSERT INTO backups (type, status, size, path) VALUES ($1, $2, $3, $4)',
      [type, 'success', size, backupPath]
    )

    await notifyAdmins({ type: 'backup_success', message: `Sauvegarde ${type} réussie (${Math.round(size / 1e6)} Mo)` })
    await log({ category: 'system', level: 'info', action: 'backup_success', metadata: { type, size } })

    return { success: true, path: backupPath, size }
  } catch (err) {
    await pool.query(
      'INSERT INTO backups (type, status, error_message) VALUES ($1, $2, $3)',
      [type, 'failed', err.message]
    )
    await notifyAdmins({ type: 'backup_failed', message: `Sauvegarde ${type} échouée : ${err.message}` })
    await log({ category: 'system', level: 'error', action: 'backup_failed', metadata: { type, error: err.message } })

    return { success: false, error: err.message }
  }
}
