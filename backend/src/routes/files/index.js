import { join, extname } from 'path'
import { readFile, unlink, mkdir } from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { nanoid } from 'nanoid'
import pool from '../../config/database.js'
import { authenticate } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/auth.js'
import { checkIpWhitelist } from '../../middleware/ipWhitelist.js'
import { log } from '../../utils/logger.js'
import { notify, notifyAdmins } from '../../utils/logger.js'
import { getFolderBreadcrumb } from './breadcrumb.js'
import {
  sanitizeFilename,
  generateStoredName,
  validateMime,
  processImage,
  generateImageThumbnail,
  getVideoMetadata,
  generateVideoThumbnail,
  getFilePath,
  ensureStorageDirs,
} from '../../services/storage.service.js'
import { checkMediaStorageLimit } from '../../config/storage.js'
import { config } from '../../config/env.js'
import { extractIp } from '../../utils/fingerprint.js'

export default async function fileRoutes(fastify) {
  // ─── Upload ───────────────────────────────────────────────────────────────
  fastify.post('/upload', {
    preHandler: [authenticate, requirePermission('files.upload')],
  }, async (request, reply) => {
    const user = request.currentUser

    // Vérifier la limite de stockage serveur
    const storageStatus = await checkMediaStorageLimit()
    if (storageStatus.percent >= 100) {
      return reply.code(507).send({ error: 'Le serveur a atteint sa limite de stockage. Veuillez contacter l\'administrateur.' })
    }

    const parts = request.parts()
    const fields = {}
    const fileBuffer = { buffer: null, filename: null, mimetype: null }

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks = []
        for await (const chunk of part.file) chunks.push(chunk)
        fileBuffer.buffer = Buffer.concat(chunks)
        fileBuffer.filename = part.filename
        fileBuffer.mimetype = part.mimetype
      } else {
        fields[part.fieldname] = part.value
      }
    }

    if (!fileBuffer.buffer) {
      await log({ category: 'files', level: 'warning', action: 'upload_failed', userId: user.id, ipAddress: extractIp(request), metadata: { reason: 'Fichier manquant' } })
      return reply.code(400).send({ error: 'Fichier requis' })
    }
    if (!validateMime(fileBuffer.mimetype)) {
      await log({ category: 'files', level: 'warning', action: 'upload_failed', userId: user.id, ipAddress: extractIp(request), metadata: { reason: 'Type MIME refusé', mime: fileBuffer.mimetype, filename: fileBuffer.filename } })
      return reply.code(400).send({ error: 'Type de fichier non supporté' })
    }

    // Vérifier quota utilisateur
    const fileSize = fileBuffer.buffer.length
    if (user.storage_used + fileSize > user.storage_quota) {
      return reply.code(400).send({ error: 'Quota de stockage dépassé' })
    }

    const qualityPreset = fields.qualityPreset || 'original'
    const originalName = sanitizeFilename(fields.name || fileBuffer.filename)
    const folderId = fields.folderId || null
    const linkToken = nanoid(32)

    const isImage = fileBuffer.mimetype.startsWith('image/')
    const isVideo = fileBuffer.mimetype.startsWith('video/')

    let storedName, subdir, metadata = {}

    if (isImage) {
      subdir = 'images'
      const { info, data } = await processImage(fileBuffer.buffer, qualityPreset)
      storedName = generateStoredName(originalName.replace(/\.[^.]+$/, '') + '.jpg')
      const path = getFilePath(subdir, storedName)
      const { writeFile } = await import('fs/promises')
      await writeFile(path, data)
      metadata = { width: info.width, height: info.height, format: info.format }

      if (qualityPreset !== 'thumbnail') {
        const thumbPath = await generateImageThumbnail(path)
        metadata.thumbnailPath = thumbPath.replace(config.storage.path, '/storage')
      }
    } else if (isVideo) {
      subdir = 'videos'
      storedName = generateStoredName(originalName)
      const path = getFilePath(subdir, storedName)
      const { writeFile } = await import('fs/promises')
      await writeFile(path, fileBuffer.buffer)

      const videoMeta = await getVideoMetadata(path)
      metadata = videoMeta
      const thumbPath = await generateVideoThumbnail(path)
      metadata.thumbnailPath = thumbPath.replace(config.storage.path, '/storage')
    }

    const { rows: fileRows } = await pool.query(
      `INSERT INTO files (original_name, stored_name, folder_id, owner_id, mime_type, size,
                          width, height, fps, duration, codec, format, quality_preset,
                          thumbnail_path, link_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        originalName, storedName, folderId, user.id, fileBuffer.mimetype, fileSize,
        metadata.width || null, metadata.height || null, metadata.fps || null,
        metadata.duration || null, metadata.codec || null, metadata.format || null,
        qualityPreset, metadata.thumbnailPath || null, linkToken,
      ]
    )

    // Mettre à jour le storage_used
    await pool.query('UPDATE users SET storage_used = storage_used + $1 WHERE id = $2', [fileSize, user.id])

    // Alerte si 90% de la limite serveur
    if (storageStatus.percent >= 90) {
      await notifyAdmins({ type: 'storage_warning', message: `Stockage serveur à ${storageStatus.percent}%` })
    }

    await notify({ userId: user.id, type: 'upload_done', message: `Fichier "${originalName}" uploadé avec succès` })
    await log({ category: 'files', level: 'info', action: 'file_uploaded', userId: user.id, ipAddress: extractIp(request), metadata: { fileId: fileRows[0].id, name: originalName, size: fileSize, mime: fileBuffer.mimetype, qualityPreset } })

    return reply.code(201).send(fileRows[0])
  })

  // ─── Liste des fichiers ────────────────────────────────────────────────────
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { folderId, view = 'mine', page = 1, limit = 50, search, tag, sortBy = 'created_at', sortDir = 'desc' } = request.query
    const offset = (page - 1) * limit

    let where = 'WHERE f.is_deleted = false'
    const params = []

    if (view === 'mine') {
      params.push(user.id)
      where += ` AND f.owner_id = $${params.length}`
    } else if (view === 'others') {
      // Vérifier permission
      const { rows: permRows } = await pool.query(
        `SELECT 1 FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = $1 AND p.key = 'files.view_others'`,
        [user.role_id]
      )
      if (!user.is_super_admin && !permRows.length) {
        return reply.code(403).send({ error: 'Permission refusée' })
      }
    }

    if (folderId) {
      params.push(folderId)
      where += ` AND f.folder_id = $${params.length}`
    } else if (!folderId && view === 'mine') {
      where += ` AND f.folder_id IS NULL`
    }

    if (search) {
      params.push(`%${search}%`)
      where += ` AND f.original_name ILIKE $${params.length}`
    }

    if (tag) {
      params.push(tag)
      where += ` AND EXISTS (SELECT 1 FROM file_tags ft JOIN tags t ON ft.tag_id = t.id WHERE ft.file_id = f.id AND t.name = $${params.length})`
    }

    const allowed = ['created_at', 'original_name', 'size', 'updated_at']
    const col = allowed.includes(sortBy) ? sortBy : 'created_at'
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC'

    const { rows } = await pool.query(
      `SELECT f.*, u.pseudo AS owner_pseudo,
              COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
              EXISTS(SELECT 1 FROM favorites fav WHERE fav.file_id = f.id AND fav.user_id = $${params.length + 3}) AS is_favorite
       FROM files f
       JOIN users u ON f.owner_id = u.id
       LEFT JOIN file_tags ft ON f.id = ft.file_id
       LEFT JOIN tags t ON ft.tag_id = t.id
       ${where}
       GROUP BY f.id, u.pseudo
       ORDER BY f.${col} ${dir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset, user.id]
    )

    return reply.send({ files: rows, page: parseInt(page), limit: parseInt(limit) })
  })

  // ─── Fichiers récents ─────────────────────────────────────────────────────
  fastify.get('/recent', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT f.*, u.pseudo AS owner_pseudo FROM files f JOIN users u ON f.owner_id = u.id
       WHERE f.owner_id = $1 AND f.is_deleted = false
       ORDER BY f.updated_at DESC LIMIT 20`,
      [request.currentUser.id]
    )
    return reply.send(rows)
  })

  // ─── Favoris ──────────────────────────────────────────────────────────────
  fastify.get('/favorites', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT f.*, u.pseudo AS owner_pseudo FROM files f
       JOIN users u ON f.owner_id = u.id
       JOIN favorites fav ON fav.file_id = f.id
       WHERE fav.user_id = $1 AND f.is_deleted = false
       ORDER BY fav.created_at DESC`,
      [request.currentUser.id]
    )
    return reply.send(rows)
  })

  fastify.post('/:id/favorite', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params
    await pool.query(
      'INSERT INTO favorites (user_id, file_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [request.currentUser.id, id]
    )
    return reply.send({ message: 'Ajouté aux favoris' })
  })

  fastify.delete('/:id/favorite', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND file_id = $2', [request.currentUser.id, request.params.id])
    return reply.send({ message: 'Retiré des favoris' })
  })

  // ─── Corbeille ────────────────────────────────────────────────────────────
  fastify.get('/trash', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM files WHERE owner_id = $1 AND is_deleted = true ORDER BY deleted_at DESC`,
      [request.currentUser.id]
    )
    return reply.send(rows)
  })

  fastify.post('/:id/restore', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query(
      `UPDATE files SET is_deleted = false, deleted_at = NULL WHERE id = $1 AND owner_id = $2`,
      [request.params.id, request.currentUser.id]
    )
    return reply.send({ message: 'Fichier restauré' })
  })

  // ─── Vider la corbeille ───────────────────────────────────────────────────
  fastify.delete('/trash', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { rows: files } = await pool.query(
      'SELECT id, stored_name, mime_type, size FROM files WHERE owner_id = $1 AND is_deleted = true',
      [user.id]
    )

    const { deleteFile } = await import('../../services/storage.service.js')
    for (const file of files) {
      const subdir = file.mime_type.startsWith('video/') ? 'videos' : 'images'
      await deleteFile(file.stored_name, subdir).catch(() => {})
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    await pool.query('DELETE FROM files WHERE owner_id = $1 AND is_deleted = true', [user.id])
    if (totalSize > 0) {
      await pool.query('UPDATE users SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2', [totalSize, user.id])
    }

    await log({ category: 'files', level: 'info', action: 'trash_emptied', userId: user.id, metadata: { count: files.length } })
    return reply.send({ message: `Corbeille vidée (${files.length} fichier(s))` })
  })

  // ─── Infos d'un fichier ───────────────────────────────────────────────────
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT f.*, u.pseudo AS owner_pseudo,
              COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM files f JOIN users u ON f.owner_id = u.id
       LEFT JOIN file_tags ft ON f.id = ft.file_id
       LEFT JOIN tags t ON ft.tag_id = t.id
       WHERE f.id = $1
       GROUP BY f.id, u.pseudo`,
      [request.params.id]
    )
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable' })
    return reply.send(rows[0])
  })

  // ─── Renommer / déplacer ──────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [authenticate, requirePermission('files.rename_move')],
  }, async (request, reply) => {
    const { id } = request.params
    const { name, folderId } = request.body
    const user = request.currentUser

    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable' })

    const file = rows[0]
    if (file.owner_id !== user.id && !user.is_super_admin) {
      return reply.code(403).send({ error: 'Permission refusée' })
    }

    const updates = []
    const params = []
    if (name) { params.push(sanitizeFilename(name)); updates.push(`original_name = $${params.length}`) }
    if (folderId !== undefined) { params.push(folderId); updates.push(`folder_id = $${params.length}`) }

    if (updates.length) {
      params.push(id)
      await pool.query(`UPDATE files SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)
    }

    await log({ category: 'files', level: 'info', action: 'file_renamed_moved', userId: user.id, metadata: { fileId: id } })
    return reply.send({ message: 'Fichier modifié.' })
  })

  // ─── Supprimer (corbeille) ────────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params
    const user = request.currentUser

    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1 AND is_deleted = false', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable' })

    const file = rows[0]
    const isOwner = file.owner_id === user.id

    if (!isOwner) {
      const { rows: permRows } = await pool.query(
        `SELECT 1 FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = $1 AND p.key = 'files.delete_others'`,
        [user.role_id]
      )
      if (!user.is_super_admin && !permRows.length) {
        return reply.code(403).send({ error: 'Permission refusée' })
      }
    }

    await pool.query(
      'UPDATE files SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
      [id]
    )

    await notify({ userId: file.owner_id, type: 'file_deleted', message: `Fichier "${file.original_name}" supprimé` })
    await log({ category: 'files', level: 'info', action: 'file_deleted', userId: user.id, metadata: { fileId: id, name: file.original_name } })

    return reply.send({ message: 'Fichier déplacé dans la corbeille.' })
  })

  // ─── Suppression permanente ───────────────────────────────────────────────
  fastify.delete('/:id/permanent', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params
    const user = request.currentUser

    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1 AND is_deleted = true', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable dans la corbeille' })

    const file = rows[0]
    if (file.owner_id !== user.id && !user.is_super_admin) {
      return reply.code(403).send({ error: 'Permission refusée' })
    }

    const subdir = file.mime_type.startsWith('video/') ? 'videos' : 'images'
    const { deleteFile } = await import('../../services/storage.service.js')
    await deleteFile(file.stored_name, subdir)
    if (file.thumbnail_path) {
      const thumbName = file.thumbnail_path.split('/').pop()
      await deleteFile(thumbName, 'thumbnails')
    }

    await pool.query('DELETE FROM files WHERE id = $1', [id])
    await pool.query('UPDATE users SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2', [file.size, file.owner_id])
    await log({ category: 'files', level: 'warning', action: 'file_permanently_deleted', userId: user.id, metadata: { fileId: id, name: file.original_name } })

    return reply.send({ message: 'Fichier supprimé définitivement.' })
  })

  // ─── Toggle lien ──────────────────────────────────────────────────────────
  fastify.post('/:id/toggle-link', {
    preHandler: [authenticate, requirePermission('files.toggle_link')],
  }, async (request, reply) => {
    const { rows } = await pool.query('SELECT link_active FROM files WHERE id = $1', [request.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable' })

    const newState = !rows[0].link_active
    await pool.query('UPDATE files SET link_active = $1 WHERE id = $2', [newState, request.params.id])

    return reply.send({ linkActive: newState })
  })

  // ─── Accès public au média via token (protégé par IP whitelist) ───────────
  fastify.get('/public/:token', { preHandler: [checkIpWhitelist] }, async (request, reply) => {
    const { token } = request.params

    const { rows } = await pool.query(
      'SELECT * FROM files WHERE link_token = $1 AND link_active = true AND is_deleted = false',
      [token]
    )

    if (!rows.length) return reply.code(404).send({ error: 'Média introuvable ou lien désactivé' })

    const file = rows[0]
    const isVideo = file.mime_type.startsWith('video/')
    const subdir = isVideo ? 'videos' : 'images'
    const filePath = getFilePath(subdir, file.stored_name)

    await pool.query('UPDATE files SET link_access_count = link_access_count + 1 WHERE id = $1', [file.id])
    await log({ category: 'security', level: 'info', action: 'media_accessed', metadata: { token, fileId: file.id } })

    return reply.sendFile(file.stored_name, join(config.storage.path, subdir))
  })

  // ─── Visionner un fichier (authentifié, sans whitelist IP) ──────────────
  fastify.get('/:id/view', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1 AND is_deleted = false', [request.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable' })

    const file = rows[0]
    const isVideo = file.mime_type.startsWith('video/')
    const subdir = isVideo ? 'videos' : 'images'
    const filePath = getFilePath(subdir, file.stored_name)

    reply.header('Content-Disposition', `inline; filename="${file.original_name}"`)
    reply.header('Content-Type', file.mime_type)
    reply.header('Cache-Control', 'private, max-age=3600')

    return reply.send(createReadStream(filePath))
  })

  // ─── Télécharger un fichier ───────────────────────────────────────────────
  fastify.get('/:id/download', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1 AND is_deleted = false', [request.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable' })

    const file = rows[0]
    const isVideo = file.mime_type.startsWith('video/')
    const subdir = isVideo ? 'videos' : 'images'
    const filePath = getFilePath(subdir, file.stored_name)

    reply.header('Content-Disposition', `attachment; filename="${file.original_name}"`)
    reply.header('Content-Type', file.mime_type)

    const stream = createReadStream(filePath)
    return reply.send(stream)
  })

  // ─── Dossiers ─────────────────────────────────────────────────────────────
  fastify.get('/folders', { preHandler: [authenticate] }, async (request, reply) => {
    const { parentId } = request.query
    let where = 'WHERE owner_id = $1'
    const params = [request.currentUser.id]

    if (parentId) {
      params.push(parentId)
      where += ` AND parent_id = $${params.length}`
    } else {
      where += ' AND parent_id IS NULL'
    }

    const { rows } = await pool.query(
      `SELECT * FROM folders ${where} ORDER BY name`,
      params
    )
    return reply.send(rows)
  })

  fastify.post('/folders', {
    preHandler: [authenticate, requirePermission('files.create_folder')],
  }, async (request, reply) => {
    const { name, parentId } = request.body
    if (!name) return reply.code(400).send({ error: 'Nom requis' })

    const { rows } = await pool.query(
      'INSERT INTO folders (name, parent_id, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [sanitizeFilename(name), parentId || null, request.currentUser.id]
    )

    return reply.code(201).send(rows[0])
  })

  fastify.delete('/folders/:id', {
    preHandler: [authenticate, requirePermission('files.create_folder')],
  }, async (request, reply) => {
    await pool.query('DELETE FROM folders WHERE id = $1 AND owner_id = $2', [request.params.id, request.currentUser.id])
    return reply.send({ message: 'Dossier supprimé.' })
  })

  fastify.get('/folders/:id/breadcrumb', { preHandler: [authenticate] }, async (request, reply) => {
    const chain = await getFolderBreadcrumb(request.params.id)
    return reply.send(chain)
  })

  // ─── Téléchargement ZIP de plusieurs fichiers ─────────────────────────────
  fastify.post('/zip', { preHandler: [authenticate] }, async (request, reply) => {
    const { fileIds } = request.body
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return reply.code(400).send({ error: 'Liste de fichiers requise' })
    }

    const user = request.currentUser
    const { rows: files } = await pool.query(
      `SELECT * FROM files WHERE id = ANY($1) AND is_deleted = false AND owner_id = $2`,
      [fileIds, user.id]
    )
    if (!files.length) return reply.code(404).send({ error: 'Aucun fichier trouvé' })

    const zipDir = join(config.storage.path, 'zips')
    await mkdir(zipDir, { recursive: true })
    const zipName = `archive_${nanoid(12)}.zip`
    const zipPath = join(zipDir, zipName)

    let archiverLib
    try {
      archiverLib = (await import('archiver')).default
    } catch {
      return reply.code(501).send({ error: 'Fonctionnalité ZIP non disponible. Redémarrez le serveur après mise à jour.' })
    }

    await new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiverLib('zip', { zlib: { level: 6 } })

      output.on('close', resolve)
      archive.on('error', reject)
      archive.pipe(output)

      for (const file of files) {
        const subdir = file.mime_type.startsWith('video/') ? 'videos' : 'images'
        const filePath = getFilePath(subdir, file.stored_name)
        archive.file(filePath, { name: file.original_name })
      }

      archive.finalize()
    })

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await pool.query(
      'INSERT INTO temp_zips (path, user_id, expires_at) VALUES ($1, $2, $3)',
      [zipPath, user.id, expiresAt]
    )

    reply.header('Content-Disposition', `attachment; filename="archive.zip"`)
    reply.header('Content-Type', 'application/zip')

    // Supprimer le zip dès que le téléchargement est terminé
    reply.raw.on('finish', () => {
      unlink(zipPath).catch(() => {})
      pool.query('DELETE FROM temp_zips WHERE path = $1', [zipPath]).catch(() => {})
    })

    return reply.send(createReadStream(zipPath))
  })

  // ─── Tags ──────────────────────────────────────────────────────────────────
  fastify.get('/tags', { preHandler: [authenticate] }, async (_, reply) => {
    const { rows } = await pool.query('SELECT * FROM tags ORDER BY name')
    return reply.send(rows)
  })

  fastify.post('/tags', {
    preHandler: [authenticate, requirePermission('files.create_tags')],
  }, async (request, reply) => {
    const { name } = request.body
    if (!name) return reply.code(400).send({ error: 'Nom requis' })

    const { rows } = await pool.query(
      'INSERT INTO tags (name, created_by) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [name.toLowerCase(), request.currentUser.id]
    )
    return reply.send(rows[0])
  })

  fastify.post('/:id/tags', { preHandler: [authenticate] }, async (request, reply) => {
    const { tagIds } = request.body
    for (const tagId of tagIds) {
      await pool.query('INSERT INTO file_tags (file_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [request.params.id, tagId])
    }
    return reply.send({ message: 'Tags ajoutés.' })
  })

  fastify.delete('/:id/tags/:tagId', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query('DELETE FROM file_tags WHERE file_id = $1 AND tag_id = $2', [request.params.id, request.params.tagId])
    return reply.send({ message: 'Tag retiré.' })
  })
}
