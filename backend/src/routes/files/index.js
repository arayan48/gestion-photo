import { join } from 'path'
import { readFile, writeFile, unlink, mkdir, rename, stat } from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { nanoid } from 'nanoid'
import pool from '../../config/database.js'
import { authenticate, requirePermission, userHasPermission } from '../../middleware/auth.js'
import { checkIpWhitelist } from '../../middleware/ipWhitelist.js'
import { log, notify, notifyAdmins } from '../../utils/logger.js'
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
  getMediaSubdir,
  deleteMediaFiles,
  QUALITY_PRESETS,
  MEDIA_EXT_RE,
} from '../../services/storage.service.js'
import { checkMediaStorageLimit } from '../../config/storage.js'
import { config } from '../../config/env.js'
import { extractIp } from '../../utils/fingerprint.js'
import { isUuid, isNonEmptyString, parsePagination, likePattern } from '../../utils/validation.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_ZIP_FILES = 500

// En-tête Content-Disposition sûr (guillemets, caractères non ASCII)
function contentDisposition(type, filename) {
  const fallback = String(filename).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

// Le propriétaire, le Super Admin ou un rôle avec files.view_others peut consulter un fichier
async function canViewFile(user, file) {
  if (file.owner_id === user.id) return true
  return userHasPermission(user, 'files.view_others')
}

// Peut modifier (renommer, déplacer, lien, tags) : propriétaire ou Super Admin
function canEditFile(user, file) {
  return file.owner_id === user.id || user.is_super_admin
}

async function isOwnFolder(folderId, userId) {
  if (!folderId) return true // racine
  if (!isUuid(folderId)) return false
  const { rows } = await pool.query('SELECT 1 FROM folders WHERE id = $1 AND owner_id = $2', [folderId, userId])
  return rows.length > 0
}

async function getActiveFile(id) {
  if (!isUuid(id)) return null
  const { rows } = await pool.query('SELECT * FROM files WHERE id = $1 AND is_deleted = false', [id])
  return rows[0] || null
}

// Fichier consultable (aperçu, téléchargement) : actif, ou dans la corbeille de son
// propriétaire — sinon la visionneuse ne peut rien afficher depuis la Corbeille
async function getViewableFile(id, user) {
  if (!isUuid(id)) return null
  const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [id])
  const file = rows[0]
  if (!file) return null
  if (file.is_deleted) return canEditFile(user, file) ? file : null
  return (await canViewFile(user, file)) ? file : null
}

// Alerte « stockage serveur à 90 % » : une fois toutes les 6 h, pas à chaque envoi
const STORAGE_WARNING_INTERVAL = 6 * 60 * 60 * 1000
let lastStorageWarning = 0

export default async function fileRoutes(fastify) {
  // ─── Upload ───────────────────────────────────────────────────────────────
  fastify.post('/upload', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    preHandler: [authenticate, requirePermission('files.upload')],
  }, async (request, reply) => {
    const user = request.currentUser
    const ip = extractIp(request)

    // Vérifier la limite de stockage serveur
    const storageStatus = await checkMediaStorageLimit()
    if (storageStatus.percent >= 100) {
      return reply.code(507).send({ error: 'Le serveur a atteint sa limite de stockage. Veuillez contacter l\'administrateur.' })
    }

    // Le fichier est écrit en streaming dans storage/temp (pas de buffer de 500 Mo en RAM)
    const fields = {}
    const upload = { tempPath: null, filename: null, mimetype: null, truncated: false }

    try {
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (upload.tempPath) {
            part.file.resume() // un seul fichier par requête
            continue
          }
          upload.tempPath = getFilePath('temp', `upload_${nanoid(16)}`)
          upload.filename = part.filename
          upload.mimetype = part.mimetype
          await pipeline(part.file, createWriteStream(upload.tempPath))
          upload.truncated = part.file.truncated
        } else {
          fields[part.fieldname] = part.value
        }
      }
    } catch (err) {
      if (upload.tempPath) await unlink(upload.tempPath).catch(() => {})
      throw err
    }

    const cleanupTemp = () => (upload.tempPath ? unlink(upload.tempPath).catch(() => {}) : Promise.resolve())
    const fail = async (code, error, reason) => {
      await cleanupTemp()
      await log({ category: 'files', level: 'warning', action: 'upload_failed', userId: user.id, ipAddress: ip, metadata: { reason: reason || error, mime: upload.mimetype, filename: upload.filename } })
      return reply.code(code).send({ error })
    }

    if (!upload.tempPath) return fail(400, 'Fichier requis', 'Fichier manquant')
    if (upload.truncated) return fail(413, 'Fichier trop volumineux (500 Mo maximum)')
    if (!validateMime(upload.mimetype)) return fail(400, 'Type de fichier non supporté', 'Type MIME refusé')

    const qualityPreset = fields.qualityPreset || 'original'
    if (!QUALITY_PRESETS.includes(qualityPreset)) return fail(400, 'Préréglage de qualité invalide')

    const folderId = fields.folderId || null
    if (!(await isOwnFolder(folderId, user.id))) return fail(400, 'Dossier de destination invalide')

    const isImage = upload.mimetype.startsWith('image/')
    // Seule une extension média est retirée : « Fête.2024 » reste « Fête.2024 »
    const baseName = sanitizeFilename(String(fields.name || upload.filename).replace(MEDIA_EXT_RE, ''))

    let storedName, finalPath, mimeType, originalName, fileSize
    let metadata = {}
    const createdPaths = []

    try {
      if (isImage) {
        // Validation du contenu réel par Sharp (pas seulement le MIME envoyé par le client)
        const input = await readFile(upload.tempPath)
        const { data, mime, ext, info } = await processImage(input, qualityPreset)
        mimeType = mime
        originalName = baseName + ext
        storedName = generateStoredName(originalName)
        finalPath = getFilePath('images', storedName)
        await writeFile(finalPath, data)
        createdPaths.push(finalPath)
        fileSize = data.length
        metadata = { width: info.width, height: info.height, format: info.format }

        const thumbPath = await generateImageThumbnail(finalPath)
        createdPaths.push(thumbPath)
        metadata.thumbnailPath = thumbPath.replace(config.storage.path, '/storage')
        await cleanupTemp()
      } else {
        // ffprobe valide qu'il s'agit bien d'une vidéo lisible
        metadata = await getVideoMetadata(upload.tempPath)
        mimeType = upload.mimetype
        const ext = String(upload.filename).match(/\.[a-z0-9]{1,8}$/i)?.[0] || ''
        originalName = baseName + ext.toLowerCase()
        storedName = generateStoredName(originalName)
        finalPath = getFilePath('videos', storedName)
        await rename(upload.tempPath, finalPath)
        createdPaths.push(finalPath)
        fileSize = (await stat(finalPath)).size

        try {
          const thumbPath = await generateVideoThumbnail(finalPath)
          createdPaths.push(thumbPath)
          metadata.thumbnailPath = thumbPath.replace(config.storage.path, '/storage')
        } catch {
          // Pas de miniature (vidéo très courte…) : l'upload reste valide
        }
      }
    } catch (err) {
      await cleanupTemp()
      for (const p of createdPaths) await unlink(p).catch(() => {})
      if (err.statusCode === 400) return fail(400, err.message)
      throw err
    }

    const linkToken = nanoid(32)
    const client = await pool.connect()
    let file
    try {
      await client.query('BEGIN')
      // Réservation atomique du quota (storage_* sont des BIGINT : comparaison faite en SQL)
      const { rowCount } = await client.query(
        `UPDATE users SET storage_used = storage_used + $1
         WHERE id = $2 AND storage_used + $1 <= storage_quota`,
        [fileSize, user.id]
      )
      if (!rowCount) {
        await client.query('ROLLBACK')
        for (const p of createdPaths) await unlink(p).catch(() => {})
        return reply.code(400).send({ error: 'Quota de stockage dépassé' })
      }

      const { rows: fileRows } = await client.query(
        `INSERT INTO files (original_name, stored_name, folder_id, owner_id, mime_type, size,
                            width, height, fps, duration, codec, format, quality_preset,
                            thumbnail_path, link_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          originalName, storedName, folderId, user.id, mimeType, fileSize,
          metadata.width || null, metadata.height || null, metadata.fps || null,
          metadata.duration || null, metadata.codec || null, metadata.format || null,
          qualityPreset, metadata.thumbnailPath || null, linkToken,
        ]
      )
      file = fileRows[0]
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      for (const p of createdPaths) await unlink(p).catch(() => {})
      throw err
    } finally {
      client.release()
    }

    // Alerte si 90% de la limite serveur
    if (storageStatus.percent >= 90 && Date.now() - lastStorageWarning > STORAGE_WARNING_INTERVAL) {
      lastStorageWarning = Date.now()
      await notifyAdmins({ type: 'storage_warning', message: `Stockage serveur à ${storageStatus.percent} %` })
    }

    await notify({ userId: user.id, type: 'upload_done', message: `« ${originalName} » a bien été envoyé` })
    await log({ category: 'files', level: 'info', action: 'file_uploaded', userId: user.id, ipAddress: ip, metadata: { fileId: file.id, name: originalName, size: fileSize, mime: mimeType, qualityPreset } })

    return reply.code(201).send(file)
  })

  // ─── Liste des fichiers ────────────────────────────────────────────────────
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { folderId, search, tag, from, to, type, sortBy = 'created_at', sortDir = 'desc' } = request.query
    // global=true : recherche dans tous les dossiers (barre de recherche, palette de commandes)
    const global = request.query.global === 'true'
    // Toute valeur autre que "others" est traitée comme "mine" : jamais de liste globale par défaut
    const view = request.query.view === 'others' ? 'others' : 'mine'
    const { page, limit, offset } = parsePagination(request.query, { defaultLimit: 50, maxLimit: 200 })

    let where = 'WHERE f.is_deleted = false'
    const params = []

    if (view === 'mine') {
      params.push(user.id)
      where += ` AND f.owner_id = $${params.length}`
    } else if (!(await userHasPermission(user, 'files.view_others'))) {
      return reply.code(403).send({ error: 'Permission refusée' })
    }

    if (folderId) {
      if (!isUuid(folderId)) return reply.code(400).send({ error: 'Dossier invalide' })
      params.push(folderId)
      where += ` AND f.folder_id = $${params.length}`
    } else if (view === 'mine' && !global) {
      where += ` AND f.folder_id IS NULL`
    }

    if (type === 'image' || type === 'video') {
      params.push(`${type}/%`)
      where += ` AND f.mime_type LIKE $${params.length}`
    }

    if (search) {
      params.push(likePattern(search))
      where += ` AND f.original_name ILIKE $${params.length}`
    }

    if (tag) {
      params.push(tag)
      where += ` AND EXISTS (SELECT 1 FROM file_tags ft JOIN tags t ON ft.tag_id = t.id WHERE ft.file_id = f.id AND t.name = $${params.length})`
    }

    if (from && DATE_RE.test(from)) {
      params.push(from)
      where += ` AND f.created_at >= $${params.length}::date`
    }
    if (to && DATE_RE.test(to)) {
      params.push(to)
      // Date de fin incluse (toute la journée)
      where += ` AND f.created_at < ($${params.length}::date + INTERVAL '1 day')`
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

    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM files f ${where}`, params)
    const total = parseInt(count)

    return reply.send({ files: rows, page, limit, total, hasMore: offset + rows.length < total })
  })

  // ─── Fichiers récents ─────────────────────────────────────────────────────
  fastify.get('/recent', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT f.*, u.pseudo AS owner_pseudo,
              EXISTS(SELECT 1 FROM favorites fav WHERE fav.file_id = f.id AND fav.user_id = $1) AS is_favorite
       FROM files f JOIN users u ON f.owner_id = u.id
       WHERE f.owner_id = $1 AND f.is_deleted = false
       ORDER BY f.updated_at DESC LIMIT 20`,
      [request.currentUser.id]
    )
    return reply.send(rows)
  })

  // ─── Favoris ──────────────────────────────────────────────────────────────
  fastify.get('/favorites', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT f.*, u.pseudo AS owner_pseudo, true AS is_favorite FROM files f
       JOIN users u ON f.owner_id = u.id
       JOIN favorites fav ON fav.file_id = f.id
       WHERE fav.user_id = $1 AND f.is_deleted = false
       ORDER BY fav.created_at DESC`,
      [request.currentUser.id]
    )
    return reply.send(rows)
  })

  fastify.post('/:id/favorite', { preHandler: [authenticate] }, async (request, reply) => {
    const file = await getActiveFile(request.params.id)
    if (!file || !(await canViewFile(request.currentUser, file))) {
      return reply.code(404).send({ error: 'Fichier introuvable' })
    }
    await pool.query(
      'INSERT INTO favorites (user_id, file_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [request.currentUser.id, file.id]
    )
    return reply.send({ message: 'Ajouté aux favoris' })
  })

  fastify.delete('/:id/favorite', { preHandler: [authenticate] }, async (request, reply) => {
    if (!isUuid(request.params.id)) return reply.code(400).send({ error: 'Identifiant invalide' })
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
    if (!isUuid(request.params.id)) return reply.code(400).send({ error: 'Identifiant invalide' })
    const { rowCount } = await pool.query(
      `UPDATE files SET is_deleted = false, deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2 AND is_deleted = true`,
      [request.params.id, request.currentUser.id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Fichier introuvable dans la corbeille' })
    await log({ category: 'files', level: 'info', action: 'file_restored', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { fileId: request.params.id } })
    return reply.send({ message: 'Fichier restauré' })
  })

  // ─── Vider la corbeille ───────────────────────────────────────────────────
  fastify.delete('/trash', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { rows: files } = await pool.query(
      'DELETE FROM files WHERE owner_id = $1 AND is_deleted = true RETURNING stored_name, mime_type, size, thumbnail_path',
      [user.id]
    )

    for (const file of files) await deleteMediaFiles(file)

    // size est un BIGINT renvoyé en string par pg : conversion explicite
    const totalSize = files.reduce((sum, f) => sum + Number(f.size), 0)
    if (totalSize > 0) {
      await pool.query('UPDATE users SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2', [totalSize, user.id])
    }

    await log({ category: 'files', level: 'info', action: 'trash_emptied', userId: user.id, ipAddress: extractIp(request), metadata: { count: files.length } })
    return reply.send({ message: `Corbeille vidée (${files.length} fichier(s))` })
  })

  // ─── Infos d'un fichier ───────────────────────────────────────────────────
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    if (!isUuid(request.params.id)) return reply.code(404).send({ error: 'Fichier introuvable' })
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
    if (!rows.length || !(await canViewFile(request.currentUser, rows[0]))) {
      return reply.code(404).send({ error: 'Fichier introuvable' })
    }
    return reply.send(rows[0])
  })

  // ─── Renommer / déplacer ──────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [authenticate, requirePermission('files.rename_move')],
  }, async (request, reply) => {
    const { name, folderId } = request.body || {}
    const user = request.currentUser

    const file = await getActiveFile(request.params.id)
    if (!file) return reply.code(404).send({ error: 'Fichier introuvable' })
    if (!canEditFile(user, file)) return reply.code(403).send({ error: 'Permission refusée' })

    const updates = []
    const params = []
    if (name !== undefined) {
      if (!isNonEmptyString(name, 255)) return reply.code(400).send({ error: 'Nom invalide' })
      params.push(sanitizeFilename(name))
      updates.push(`original_name = $${params.length}`)
    }
    if (folderId !== undefined) {
      // Le dossier cible doit appartenir au propriétaire du fichier
      if (!(await isOwnFolder(folderId, file.owner_id))) return reply.code(400).send({ error: 'Dossier de destination invalide' })
      params.push(folderId || null)
      updates.push(`folder_id = $${params.length}`)
    }

    if (updates.length) {
      params.push(file.id)
      await pool.query(`UPDATE files SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)
    }

    await log({ category: 'files', level: 'info', action: 'file_renamed_moved', userId: user.id, ipAddress: extractIp(request), metadata: { fileId: file.id, name, folderId } })
    return reply.send({ message: 'Fichier modifié.' })
  })

  // ─── Supprimer (corbeille) ────────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser

    const file = await getActiveFile(request.params.id)
    if (!file) return reply.code(404).send({ error: 'Fichier introuvable' })

    const isOwner = file.owner_id === user.id
    const allowed = await userHasPermission(user, isOwner ? 'files.delete_own' : 'files.delete_others')
    if (!allowed) return reply.code(403).send({ error: 'Permission refusée' })

    await pool.query(
      'UPDATE files SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
      [file.id]
    )

    if (!isOwner) {
      await notify({ userId: file.owner_id, type: 'file_deleted', message: `Votre fichier "${file.original_name}" a été supprimé par un administrateur` })
    }
    await log({ category: 'files', level: 'info', action: 'file_deleted', userId: user.id, ipAddress: extractIp(request), metadata: { fileId: file.id, name: file.original_name, ownerId: file.owner_id } })

    return reply.send({ message: 'Fichier déplacé dans la corbeille.' })
  })

  // ─── Suppression permanente ───────────────────────────────────────────────
  fastify.delete('/:id/permanent', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    if (!isUuid(request.params.id)) return reply.code(404).send({ error: 'Fichier introuvable dans la corbeille' })

    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1 AND is_deleted = true', [request.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Fichier introuvable dans la corbeille' })

    const file = rows[0]
    if (!canEditFile(user, file)) return reply.code(403).send({ error: 'Permission refusée' })

    await pool.query('DELETE FROM files WHERE id = $1', [file.id])
    await pool.query('UPDATE users SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2', [file.size, file.owner_id])
    await deleteMediaFiles(file)
    await log({ category: 'files', level: 'warning', action: 'file_permanently_deleted', userId: user.id, ipAddress: extractIp(request), metadata: { fileId: file.id, name: file.original_name } })

    return reply.send({ message: 'Fichier supprimé définitivement.' })
  })

  // ─── Toggle lien ──────────────────────────────────────────────────────────
  fastify.post('/:id/toggle-link', {
    preHandler: [authenticate, requirePermission('files.toggle_link')],
  }, async (request, reply) => {
    const file = await getActiveFile(request.params.id)
    if (!file) return reply.code(404).send({ error: 'Fichier introuvable' })
    if (!canEditFile(request.currentUser, file)) return reply.code(403).send({ error: 'Permission refusée' })

    const newState = !file.link_active
    await pool.query('UPDATE files SET link_active = $1, updated_at = NOW() WHERE id = $2', [newState, file.id])
    await log({ category: 'files', level: 'info', action: newState ? 'link_enabled' : 'link_disabled', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { fileId: file.id } })

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

    // Une vidéo lue émet plusieurs requêtes Range : seule la première (début du fichier) compte
    const range = request.headers.range
    if (!range || /^bytes=0-/.test(range)) {
      await pool.query('UPDATE files SET link_access_count = link_access_count + 1 WHERE id = $1', [file.id])
      await log({ category: 'security', level: 'info', action: 'media_accessed', ipAddress: extractIp(request), metadata: { fileId: file.id } })
    }

    reply.header('X-Content-Type-Options', 'nosniff')
    return reply.sendFile(file.stored_name, join(config.storage.path, getMediaSubdir(file.mime_type)))
  })

  // ─── Visionner un fichier (authentifié, sans whitelist IP) ──────────────
  fastify.get('/:id/view', { preHandler: [authenticate] }, async (request, reply) => {
    const file = await getViewableFile(request.params.id, request.currentUser)
    if (!file) return reply.code(404).send({ error: 'Fichier introuvable' })

    reply.header('Content-Disposition', contentDisposition('inline', file.original_name))
    reply.header('Cache-Control', 'private, max-age=3600')
    reply.header('X-Content-Type-Options', 'nosniff')

    // sendFile gère les requêtes Range : indispensable pour lire/avancer dans une vidéo
    return reply.sendFile(file.stored_name, join(config.storage.path, getMediaSubdir(file.mime_type)), { cacheControl: false })
  })

  // ─── Télécharger un fichier ───────────────────────────────────────────────
  fastify.get('/:id/download', { preHandler: [authenticate] }, async (request, reply) => {
    const file = await getViewableFile(request.params.id, request.currentUser)
    if (!file) return reply.code(404).send({ error: 'Fichier introuvable' })

    reply.header('Content-Disposition', contentDisposition('attachment', file.original_name))
    reply.header('X-Content-Type-Options', 'nosniff')
    await log({ category: 'files', level: 'info', action: 'file_downloaded', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { fileId: file.id } })

    return reply.sendFile(file.stored_name, join(config.storage.path, getMediaSubdir(file.mime_type)), { cacheControl: false })
  })

  // ─── Dossiers ─────────────────────────────────────────────────────────────
  fastify.get('/folders', { preHandler: [authenticate] }, async (request, reply) => {
    const { parentId } = request.query
    let where = 'WHERE fo.owner_id = $1'
    const params = [request.currentUser.id]

    if (parentId) {
      if (!isUuid(parentId)) return reply.code(400).send({ error: 'Dossier invalide' })
      params.push(parentId)
      where += ` AND fo.parent_id = $${params.length}`
    } else {
      where += ' AND fo.parent_id IS NULL'
    }

    const { rows } = await pool.query(
      `SELECT fo.*,
              (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = fo.id AND fi.is_deleted = false)::int AS file_count,
              (SELECT COUNT(*) FROM folders sub WHERE sub.parent_id = fo.id)::int AS folder_count,
              (SELECT COALESCE(SUM(fi.size), 0) FROM files fi WHERE fi.folder_id = fo.id AND fi.is_deleted = false) AS total_size,
              (SELECT COALESCE(json_agg(c.thumbnail_path), '[]') FROM (
                 SELECT fi.thumbnail_path FROM files fi
                 WHERE fi.folder_id = fo.id AND fi.is_deleted = false AND fi.thumbnail_path IS NOT NULL
                 ORDER BY fi.created_at DESC LIMIT 3
               ) c) AS covers
       FROM folders fo ${where}
       ORDER BY fo.name`,
      params
    )
    return reply.send(rows)
  })

  // Arborescence complète des dossiers de l'utilisateur (sélecteur « Déplacer vers »)
  fastify.get('/folders/tree', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT id, name, parent_id FROM folders WHERE owner_id = $1 ORDER BY name',
      [request.currentUser.id]
    )
    return reply.send(rows)
  })

  fastify.post('/folders', {
    preHandler: [authenticate, requirePermission('files.create_folder')],
  }, async (request, reply) => {
    const { name, parentId } = request.body || {}
    if (!isNonEmptyString(name, 255)) return reply.code(400).send({ error: 'Nom requis' })
    if (!(await isOwnFolder(parentId, request.currentUser.id))) {
      return reply.code(400).send({ error: 'Dossier parent invalide' })
    }

    const { rows } = await pool.query(
      'INSERT INTO folders (name, parent_id, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [sanitizeFilename(name, 'Nouveau dossier'), parentId || null, request.currentUser.id]
    )

    await log({ category: 'files', level: 'info', action: 'folder_created', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { folderId: rows[0].id, name: rows[0].name } })
    return reply.code(201).send(rows[0])
  })

  // Renommer un dossier
  fastify.patch('/folders/:id', {
    preHandler: [authenticate, requirePermission('files.rename_move')],
  }, async (request, reply) => {
    const { id } = request.params
    const { name, parentId } = request.body || {}
    const userId = request.currentUser.id
    if (!isUuid(id)) return reply.code(404).send({ error: 'Dossier introuvable' })
    if (name === undefined && parentId === undefined) return reply.code(400).send({ error: 'Aucun champ à modifier' })

    const updates = []
    const params = []
    if (name !== undefined) {
      if (!isNonEmptyString(name, 255)) return reply.code(400).send({ error: 'Nom requis' })
      params.push(sanitizeFilename(name, 'Dossier'))
      updates.push(`name = $${params.length}`)
    }
    if (parentId !== undefined) {
      const target = parentId || null
      if (target === id) return reply.code(400).send({ error: 'Un dossier ne peut pas être déplacé dans lui-même' })
      if (!(await isOwnFolder(target, userId))) return reply.code(400).send({ error: 'Dossier de destination invalide' })
      if (target) {
        // Interdire de déplacer un dossier dans l'un de ses descendants (boucle)
        const { rows: loop } = await pool.query(
          `WITH RECURSIVE sub AS (
             SELECT id FROM folders WHERE id = $1
             UNION SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id
           ) SELECT 1 FROM sub WHERE id = $2`,
          [id, target]
        )
        if (loop.length) return reply.code(400).send({ error: 'Impossible de déplacer un dossier dans l\'un de ses sous-dossiers' })
      }
      params.push(target)
      updates.push(`parent_id = $${params.length}`)
    }

    params.push(id, userId)
    const { rows } = await pool.query(
      `UPDATE folders SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND owner_id = $${params.length} RETURNING *`,
      params
    )
    if (!rows.length) return reply.code(404).send({ error: 'Dossier introuvable' })

    await log({ category: 'files', level: 'info', action: parentId !== undefined ? 'folder_moved' : 'folder_renamed', userId, ipAddress: extractIp(request), metadata: { folderId: id, name: rows[0].name, parentId } })
    return reply.send(rows[0])
  })

  // Statistiques d'un dossier (nombre de fichiers et sous-dossiers directs)
  fastify.get('/folders/:id/stats', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params
    if (!(await isOwnFolder(id, request.currentUser.id)) || !id) {
      return reply.code(404).send({ error: 'Dossier introuvable' })
    }
    const { rows: [fc] } = await pool.query(
      `SELECT COUNT(*) FROM files WHERE folder_id = $1 AND is_deleted = false`,
      [id]
    )
    const { rows: [sc] } = await pool.query(
      `SELECT COUNT(*) FROM folders WHERE parent_id = $1`,
      [id]
    )
    return reply.send({ fileCount: parseInt(fc.count), folderCount: parseInt(sc.count) })
  })

  fastify.delete('/folders/:id', {
    preHandler: [authenticate, requirePermission('files.create_folder')],
  }, async (request, reply) => {
    const { id } = request.params
    const { moveToTrash } = request.query   // 'true' | 'false' | undefined
    const user = request.currentUser
    if (!isUuid(id)) return reply.code(404).send({ error: 'Dossier introuvable' })

    // Récupérer le dossier + tous ses sous-dossiers récursivement
    const { rows: allFolders } = await pool.query(`
      WITH RECURSIVE sub AS (
        SELECT id, parent_id FROM folders WHERE id = $1 AND owner_id = $2
        UNION
        SELECT f.id, f.parent_id FROM folders f JOIN sub s ON f.parent_id = s.id
      )
      SELECT id, parent_id FROM sub
    `, [id, user.id])

    if (!allFolders.length) return reply.code(404).send({ error: 'Dossier introuvable' })

    const allFolderIds = allFolders.map((f) => f.id)
    const parentFolderId = allFolders.find((f) => f.id === id)?.parent_id ?? null // null = racine

    if (moveToTrash === 'true') {
      // Déplacer tous les fichiers vers la corbeille
      await pool.query(
        `UPDATE files SET is_deleted = true, deleted_at = NOW(), folder_id = NULL
         WHERE folder_id = ANY($1) AND owner_id = $2 AND is_deleted = false`,
        [allFolderIds, user.id]
      )
    } else {
      // Remonter les fichiers vers le dossier parent (ou racine si null)
      await pool.query(
        `UPDATE files SET folder_id = $1
         WHERE folder_id = ANY($2) AND owner_id = $3`,
        [parentFolderId, allFolderIds, user.id]
      )
    }

    await pool.query('DELETE FROM folders WHERE id = ANY($1)', [allFolderIds])

    await log({
      category: 'files', level: 'info', action: 'folder_deleted',
      userId: user.id, ipAddress: extractIp(request),
      metadata: { folderId: id, moveToTrash: moveToTrash === 'true', affectedFolders: allFolderIds.length },
    })

    return reply.send({ message: 'Dossier supprimé.' })
  })

  fastify.get('/folders/:id/breadcrumb', { preHandler: [authenticate] }, async (request, reply) => {
    if (!isUuid(request.params.id)) return reply.code(404).send({ error: 'Dossier introuvable' })
    const chain = await getFolderBreadcrumb(request.params.id, request.currentUser.id)
    return reply.send(chain)
  })

  // ─── Téléchargement ZIP de plusieurs fichiers ─────────────────────────────
  fastify.post('/zip', { preHandler: [authenticate] }, async (request, reply) => {
    const { fileIds } = request.body || {}
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return reply.code(400).send({ error: 'Liste de fichiers requise' })
    }
    const ids = [...new Set(fileIds.filter(isUuid))].slice(0, MAX_ZIP_FILES)
    if (!ids.length) return reply.code(400).send({ error: 'Liste de fichiers invalide' })

    const user = request.currentUser
    const canViewOthers = await userHasPermission(user, 'files.view_others')
    const { rows: files } = await pool.query(
      `SELECT * FROM files WHERE id = ANY($1) AND is_deleted = false AND ($2 OR owner_id = $3)`,
      [ids, canViewOthers, user.id]
    )
    if (!files.length) return reply.code(404).send({ error: 'Aucun fichier trouvé' })

    const zipDir = join(config.storage.path, 'zips')
    await mkdir(zipDir, { recursive: true })
    const zipName = `archive_${nanoid(12)}.zip`
    const zipPath = join(zipDir, zipName)

    const archiverLib = (await import('archiver')).default

    // Enregistré avant la création : si le serveur s'arrête en cours de route,
    // le cron de nettoyage supprimera quand même le fichier
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await pool.query(
      'INSERT INTO temp_zips (path, user_id, expires_at) VALUES ($1, $2, $3)',
      [zipPath, user.id, expiresAt]
    )

    const cleanupZip = (() => {
      let done = false
      return () => {
        if (done) return
        done = true
        unlink(zipPath).catch(() => {})
        pool.query('DELETE FROM temp_zips WHERE path = $1', [zipPath]).catch(() => {})
      }
    })()

    try {
      await new Promise((resolve, reject) => {
        const output = createWriteStream(zipPath)
        const archive = archiverLib('zip', { zlib: { level: 6 } })

        output.on('close', resolve)
        output.on('error', reject)
        archive.on('error', reject)
        archive.pipe(output)

        // Noms uniques dans l'archive (deux "photo.jpg" s'écraseraient à l'extraction)
        const usedNames = new Map()
        for (const file of files) {
          let entryName = file.original_name
          const count = usedNames.get(entryName) || 0
          usedNames.set(entryName, count + 1)
          if (count > 0) entryName = entryName.replace(/(\.[^.]+)?$/, (ext) => ` (${count})${ext}`)

          archive.file(getFilePath(getMediaSubdir(file.mime_type), file.stored_name), { name: entryName })
        }

        archive.finalize()
      })
    } catch (err) {
      cleanupZip()
      throw err
    }

    await log({ category: 'files', level: 'info', action: 'zip_downloaded', userId: user.id, ipAddress: extractIp(request), metadata: { count: files.length } })

    reply.header('Content-Disposition', `attachment; filename="archive.zip"`)
    reply.header('Content-Type', 'application/zip')

    // Supprimer le zip après téléchargement (finish) ou abandon de connexion (close)
    reply.raw.on('finish', cleanupZip)
    reply.raw.on('close', cleanupZip)

    return reply.send(createReadStream(zipPath))
  })

  // ─── Actions groupées ─────────────────────────────────────────────────────
  // Une seule requête pour N fichiers (évite de saturer la limite de requêtes)
  const BULK_ACTIONS = ['move', 'trash', 'restore', 'delete_permanent', 'favorite', 'unfavorite', 'link_on', 'link_off']
  fastify.post('/bulk', { preHandler: [authenticate] }, async (request, reply) => {
    const { action, fileIds, folderId } = request.body || {}
    const user = request.currentUser
    const ip = extractIp(request)
    if (!BULK_ACTIONS.includes(action)) return reply.code(400).send({ error: 'Action invalide' })
    if (!Array.isArray(fileIds) || !fileIds.length) return reply.code(400).send({ error: 'Liste de fichiers requise' })
    const ids = [...new Set(fileIds.filter(isUuid))].slice(0, 1000)
    if (!ids.length) return reply.code(400).send({ error: 'Liste de fichiers invalide' })

    const inTrash = action === 'restore' || action === 'delete_permanent'
    const { rows: files } = await pool.query(
      'SELECT * FROM files WHERE id = ANY($1) AND is_deleted = $2',
      [ids, inTrash]
    )

    // Filtrer selon les droits, fichier par fichier (même règles que les routes unitaires)
    const allowed = []
    const can = {
      own: user.is_super_admin || (await userHasPermission(user, 'files.delete_own')),
      others: await userHasPermission(user, 'files.delete_others'),
      view: await userHasPermission(user, 'files.view_others'),
      move: await userHasPermission(user, 'files.rename_move'),
      link: await userHasPermission(user, 'files.toggle_link'),
    }
    for (const f of files) {
      const isOwner = f.owner_id === user.id
      let ok = false
      if (action === 'trash') ok = isOwner ? can.own : can.others
      else if (action === 'favorite' || action === 'unfavorite') ok = isOwner || can.view
      else if (action === 'move') ok = can.move && canEditFile(user, f)
      else if (action === 'link_on' || action === 'link_off') ok = can.link && canEditFile(user, f)
      else if (action === 'restore') ok = isOwner
      else if (action === 'delete_permanent') ok = canEditFile(user, f)
      if (ok) allowed.push(f)
    }
    if (!allowed.length) return reply.code(403).send({ error: 'Aucun fichier modifiable dans la sélection' })
    const allowedIds = allowed.map((f) => f.id)

    switch (action) {
      case 'move': {
        const target = folderId || null
        // Tous les fichiers doivent appartenir au propriétaire du dossier cible
        const owners = new Set(allowed.map((f) => f.owner_id))
        for (const ownerId of owners) {
          if (!(await isOwnFolder(target, ownerId))) return reply.code(400).send({ error: 'Dossier de destination invalide' })
        }
        await pool.query('UPDATE files SET folder_id = $1, updated_at = NOW() WHERE id = ANY($2)', [target, allowedIds])
        break
      }
      case 'trash':
        await pool.query('UPDATE files SET is_deleted = true, deleted_at = NOW() WHERE id = ANY($1)', [allowedIds])
        for (const f of allowed.filter((x) => x.owner_id !== user.id)) {
          await notify({ userId: f.owner_id, type: 'file_deleted', message: `Votre fichier "${f.original_name}" a été supprimé par un administrateur` })
        }
        break
      case 'restore':
        await pool.query('UPDATE files SET is_deleted = false, deleted_at = NULL, updated_at = NOW() WHERE id = ANY($1)', [allowedIds])
        break
      case 'delete_permanent': {
        await pool.query('DELETE FROM files WHERE id = ANY($1)', [allowedIds])
        const byOwner = new Map()
        for (const f of allowed) byOwner.set(f.owner_id, (byOwner.get(f.owner_id) || 0) + Number(f.size))
        for (const [ownerId, size] of byOwner) {
          await pool.query('UPDATE users SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2', [size, ownerId])
        }
        for (const f of allowed) await deleteMediaFiles(f)
        break
      }
      case 'favorite':
        await pool.query(
          `INSERT INTO favorites (user_id, file_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
          [user.id, allowedIds]
        )
        break
      case 'unfavorite':
        await pool.query('DELETE FROM favorites WHERE user_id = $1 AND file_id = ANY($2)', [user.id, allowedIds])
        break
      case 'link_on':
      case 'link_off':
        await pool.query('UPDATE files SET link_active = $1, updated_at = NOW() WHERE id = ANY($2)', [action === 'link_on', allowedIds])
        break
    }

    await log({
      category: 'files', level: action === 'delete_permanent' ? 'warning' : 'info', action: `bulk_${action}`,
      userId: user.id, ipAddress: ip, metadata: { count: allowedIds.length, fileIds: allowedIds.slice(0, 50), folderId },
    })
    return reply.send({ count: allowedIds.length, skipped: ids.length - allowedIds.length })
  })

  // ─── Statistiques de l'utilisateur (page Stockage) ────────────────────────
  fastify.get('/stats', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.currentUser.id
    const [byType, extra] = await Promise.all([
      pool.query(
        `SELECT CASE WHEN mime_type LIKE 'image/%' THEN 'image' WHEN mime_type LIKE 'video/%' THEN 'video' ELSE 'other' END AS type,
                COUNT(*)::int AS count, COALESCE(SUM(size), 0) AS size
         FROM files WHERE owner_id = $1 AND is_deleted = false GROUP BY 1`,
        [userId]
      ),
      pool.query(
        `SELECT (SELECT COUNT(*) FROM favorites WHERE user_id = $1)::int AS favorites,
                (SELECT COUNT(*) FROM folders WHERE owner_id = $1)::int AS folders,
                (SELECT COUNT(*) FROM files WHERE owner_id = $1 AND is_deleted = true)::int AS trash_count,
                (SELECT COALESCE(SUM(size), 0) FROM files WHERE owner_id = $1 AND is_deleted = true) AS trash_size`,
        [userId]
      ),
    ])
    return reply.send({ byType: byType.rows, ...extra.rows[0] })
  })

  // ─── Tags ──────────────────────────────────────────────────────────────────
  fastify.get('/tags', { preHandler: [authenticate] }, async (_, reply) => {
    const { rows } = await pool.query('SELECT * FROM tags ORDER BY name')
    return reply.send(rows)
  })

  fastify.post('/tags', {
    preHandler: [authenticate, requirePermission('files.create_tags')],
  }, async (request, reply) => {
    const { name } = request.body || {}
    if (!isNonEmptyString(name, 100)) return reply.code(400).send({ error: 'Nom requis' })

    const { rows } = await pool.query(
      'INSERT INTO tags (name, created_by) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [name.trim().toLowerCase(), request.currentUser.id]
    )
    return reply.send(rows[0])
  })

  fastify.post('/:id/tags', { preHandler: [authenticate] }, async (request, reply) => {
    const { tagIds } = request.body || {}
    if (!Array.isArray(tagIds)) return reply.code(400).send({ error: 'Liste de tags requise' })

    const file = await getActiveFile(request.params.id)
    if (!file) return reply.code(404).send({ error: 'Fichier introuvable' })
    if (!canEditFile(request.currentUser, file)) return reply.code(403).send({ error: 'Permission refusée' })

    const ids = [...new Set(tagIds.filter(isUuid))]
    if (ids.length) {
      await pool.query(
        `INSERT INTO file_tags (file_id, tag_id)
         SELECT $1, id FROM tags WHERE id = ANY($2)
         ON CONFLICT DO NOTHING`,
        [file.id, ids]
      )
    }
    return reply.send({ message: 'Tags ajoutés.' })
  })

  fastify.delete('/:id/tags/:tagId', { preHandler: [authenticate] }, async (request, reply) => {
    const file = await getActiveFile(request.params.id)
    if (!file) return reply.code(404).send({ error: 'Fichier introuvable' })
    if (!canEditFile(request.currentUser, file)) return reply.code(403).send({ error: 'Permission refusée' })
    if (!isUuid(request.params.tagId)) return reply.code(400).send({ error: 'Tag invalide' })

    await pool.query('DELETE FROM file_tags WHERE file_id = $1 AND tag_id = $2', [file.id, request.params.tagId])
    return reply.send({ message: 'Tag retiré.' })
  })
}
