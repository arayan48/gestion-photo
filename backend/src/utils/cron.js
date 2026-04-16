import cron from 'node-cron'
import { join } from 'path'
import { unlink, readdir } from 'fs/promises'
import pool from '../config/database.js'
import { config } from '../config/env.js'
import { log } from './logger.js'

export function startCronJobs() {
  // Nettoyage corbeille : toutes les heures, supprimer les fichiers > 48h
  cron.schedule('0 * * * *', async () => {
    try {
      const { rows } = await pool.query(
        `SELECT id, stored_name, mime_type, size, owner_id FROM files
         WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '48 hours'`
      )

      for (const file of rows) {
        const subdir = file.mime_type.startsWith('video/') ? 'videos' : 'images'
        try {
          await unlink(join(config.storage.path, subdir, file.stored_name))
        } catch {}

        await pool.query('DELETE FROM files WHERE id = $1', [file.id])
        await pool.query('UPDATE users SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2', [file.size, file.owner_id])
      }

      if (rows.length > 0) {
        await log({ category: 'system', level: 'info', action: 'trash_cleaned', metadata: { count: rows.length } })
      }
    } catch (err) {
      console.error('Erreur nettoyage corbeille:', err)
    }
  })

  // Nettoyage zips temporaires : toutes les 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { rows } = await pool.query(
        'DELETE FROM temp_zips WHERE expires_at < NOW() RETURNING path'
      )

      for (const zip of rows) {
        try { await unlink(zip.path) } catch {}
      }
    } catch (err) {
      console.error('Erreur nettoyage zips:', err)
    }
  })

  // Rotation des logs : tous les jours à 3h, supprimer les logs > 30 jours
  cron.schedule('0 3 * * *', async () => {
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'`
      )
      if (rowCount > 0) {
        await log({ category: 'system', level: 'info', action: 'logs_rotated', metadata: { deleted: rowCount } })
      }
    } catch (err) {
      console.error('Erreur rotation logs:', err)
    }
  })

  // Nettoyage refresh tokens expirés : tous les jours à 4h
  cron.schedule('0 4 * * *', async () => {
    try {
      await pool.query('DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true')
    } catch {}
  })

  console.log('✅ Cron jobs démarrés')
}
