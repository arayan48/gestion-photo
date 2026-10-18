import { unlink } from 'fs/promises'
import { join } from 'path'
import { nanoid } from 'nanoid'
import pool from '../../config/database.js'
import { authenticate, requirePermission, userHasPermission } from '../../middleware/auth.js'
import { log } from '../../utils/logger.js'
import { extractIp } from '../../utils/fingerprint.js'
import { hashPassword, verifyPassword, revokeAllUserTokens } from '../../services/auth.service.js'
import { sendEmail } from '../../services/email/email.service.js'
import { deleteMediaFiles } from '../../services/storage.service.js'
import { config } from '../../config/env.js'
import {
  PASSWORD_MIN_LENGTH,
  isNonEmptyString,
  isUuid,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  optionalString,
  parsePagination,
} from '../../utils/validation.js'

const DEFAULT_QUOTA = 1073741824 // 1 Go
const MAX_AVATAR_SIZE = 10 * 1024 * 1024

async function getDefaultRoleId() {
  const { rows } = await pool.query('SELECT id FROM roles WHERE is_super_admin = false ORDER BY created_at LIMIT 1')
  return rows[0]?.id || null
}

// Seul un Super Admin peut attribuer le rôle Super Admin (sinon : élévation de privilèges)
async function validateRoleAssignment(roleId, currentUser) {
  if (!isUuid(roleId)) return { error: 'Rôle invalide' }
  const { rows } = await pool.query('SELECT is_super_admin FROM roles WHERE id = $1', [roleId])
  if (!rows.length) return { error: 'Rôle introuvable' }
  if (rows[0].is_super_admin && !currentUser.is_super_admin) {
    return { error: 'Seul un Super Admin peut attribuer ce rôle', status: 403 }
  }
  return {}
}

function parseQuota(value) {
  const quota = Number(value)
  return Number.isFinite(quota) && quota >= 0 ? Math.floor(quota) : null
}

async function getTarget(id) {
  if (!isUuid(id)) return null
  const { rows } = await pool.query(
    'SELECT u.id, u.email, r.is_super_admin FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
    [id]
  )
  return rows[0] || null
}

export default async function userRoutes(fastify) {
  // ─── Liste des utilisateurs ──────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [authenticate, requirePermission('users.view_list')],
  }, async (request, reply) => {
    const { search } = request.query
    const { page, limit, offset } = parsePagination(request.query, { defaultLimit: 100, maxLimit: 500 })
    let where = 'WHERE 1=1'
    const params = []

    if (search) {
      params.push(`%${search}%`)
      where += ` AND (u.email ILIKE $${params.length} OR u.pseudo ILIKE $${params.length})`
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.pseudo, u.first_name, u.last_name, u.avatar_path,
              u.is_active, u.is_banned, u.storage_quota, u.storage_used,
              u.created_at, r.name AS role_name, r.id AS role_id, r.is_super_admin
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params)

    return reply.send({ users: rows, total: parseInt(countRows[0].count), page, limit })
  })

  // ─── Demandes en attente ─────────────────────────────────────────────────
  fastify.get('/requests', {
    preHandler: [authenticate, requirePermission('users.accept_requests')],
  }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT id, email, pseudo, first_name, last_name, reason, created_at
       FROM account_requests WHERE status = 'pending'
       ORDER BY created_at ASC`
    )
    return reply.send(rows)
  })

  // ─── Accepter / refuser une demande ──────────────────────────────────────
  fastify.post('/requests/:id/review', {
    preHandler: [authenticate, requirePermission('users.accept_requests')],
  }, async (request, reply) => {
    const { id } = request.params
    const { action, roleId } = request.body || {} // action: 'accept' | 'refuse'
    if (!['accept', 'refuse'].includes(action)) return reply.code(400).send({ error: 'Action invalide' })
    if (!isUuid(id)) return reply.code(404).send({ error: 'Demande introuvable ou déjà traitée' })

    if (roleId) {
      const check = await validateRoleAssignment(roleId, request.currentUser)
      if (check.error) return reply.code(check.status || 400).send({ error: check.error })
    }

    const client = await pool.connect()
    let req
    try {
      await client.query('BEGIN')
      // FOR UPDATE : deux admins qui acceptent en même temps ne créent pas deux comptes
      const { rows } = await client.query(
        'SELECT * FROM account_requests WHERE id = $1 AND status = $2 FOR UPDATE',
        [id, 'pending']
      )
      if (!rows.length) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'Demande introuvable ou déjà traitée' })
      }
      req = rows[0]

      if (action === 'accept') {
        const { rows: taken } = await client.query(
          'SELECT 1 FROM users WHERE email = $1 OR pseudo = $2',
          [req.email, req.pseudo]
        )
        if (taken.length) {
          await client.query('ROLLBACK')
          return reply.code(409).send({ error: 'Un compte avec cet email ou ce pseudo existe déjà' })
        }

        await client.query(
          `INSERT INTO users (email, pseudo, first_name, last_name, avatar_path, password_hash, role_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
          [req.email, req.pseudo, req.first_name, req.last_name, req.avatar_path, req.password_hash, roleId || await getDefaultRoleId()]
        )
      }

      await client.query(
        'UPDATE account_requests SET status = $1, reviewed_by = $2 WHERE id = $3',
        [action === 'accept' ? 'accepted' : 'refused', request.currentUser.id, id]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    const ip = extractIp(request)
    if (action === 'accept') {
      // Un échec d'envoi d'email ne doit pas annuler la création du compte
      try {
        await sendEmail({ type: 'accountAccepted', to: req.email, data: { pseudo: req.pseudo } })
      } catch (err) {
        await log({ category: 'system', level: 'error', action: 'email_failed', metadata: { type: 'accountAccepted', error: err.message } })
      }
      await log({ category: 'users', level: 'info', action: 'account_accepted', userId: request.currentUser.id, ipAddress: ip, metadata: { email: req.email } })
      return reply.send({ message: 'Demande acceptée et utilisateur créé.' })
    }

    await log({ category: 'users', level: 'info', action: 'account_refused', userId: request.currentUser.id, ipAddress: ip, metadata: { email: req.email } })
    return reply.send({ message: 'Demande refusée.' })
  })

  // ─── Créer un utilisateur manuellement (admin) ───────────────────────────
  fastify.post('/', {
    preHandler: [authenticate, requirePermission('users.accept_requests')],
  }, async (request, reply) => {
    const { email, pseudo, password, firstName, lastName, roleId, storageQuota } = request.body || {}
    if (!isValidEmail(email) || !isNonEmptyString(pseudo, 100) || typeof password !== 'string') {
      return reply.code(400).send({ error: 'Email, pseudo et mot de passe requis' })
    }
    if (!isValidPassword(password)) {
      return reply.code(400).send({ error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` })
    }

    const normalizedEmail = normalizeEmail(email)
    const cleanPseudo = pseudo.trim()
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1 OR pseudo = $2', [normalizedEmail, cleanPseudo])
    if (existing.length) return reply.code(409).send({ error: 'Email ou pseudo déjà utilisé' })

    if (roleId) {
      const check = await validateRoleAssignment(roleId, request.currentUser)
      if (check.error) return reply.code(check.status || 400).send({ error: check.error })
    }

    // Un quota personnalisé nécessite la permission dédiée
    let quota = DEFAULT_QUOTA
    if (storageQuota !== undefined && storageQuota !== null && storageQuota !== '') {
      const parsed = parseQuota(storageQuota)
      if (parsed === null) return reply.code(400).send({ error: 'Quota invalide' })
      if (parsed !== DEFAULT_QUOTA && !(await userHasPermission(request.currentUser, 'users.change_quota'))) {
        return reply.code(403).send({ error: 'Permission refusée pour modifier le quota' })
      }
      quota = parsed
    }

    const hash = await hashPassword(password)
    const { rows } = await pool.query(
      `INSERT INTO users (email, pseudo, first_name, last_name, password_hash, role_id, storage_quota, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
      [normalizedEmail, cleanPseudo, optionalString(firstName), optionalString(lastName), hash, roleId || await getDefaultRoleId(), quota]
    )

    await log({ category: 'users', level: 'info', action: 'user_created_by_admin', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { targetId: rows[0].id, email: normalizedEmail, pseudo: cleanPseudo } })
    return reply.code(201).send({ message: 'Utilisateur créé.' })
  })

  // ─── Modifier un utilisateur ──────────────────────────────────────────────
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params
    const user = request.currentUser
    const { roleId, storageQuota, suspend } = request.body || {}

    const target = await getTarget(id)
    if (!target) return reply.code(404).send({ error: 'Utilisateur introuvable' })

    const updates = []
    const params = []

    if (typeof suspend === 'boolean') {
      if (!(await userHasPermission(user, 'users.suspend'))) return reply.code(403).send({ error: 'Permission refusée' })
      if (target.is_super_admin) return reply.code(403).send({ error: 'Impossible de suspendre le Super Admin' })
      if (target.id === user.id) return reply.code(400).send({ error: 'Impossible de se suspendre soi-même' })
      params.push(suspend); updates.push(`is_banned = $${params.length}`)
    }

    if (roleId !== undefined) {
      if (!(await userHasPermission(user, 'users.change_role'))) return reply.code(403).send({ error: 'Permission refusée' })
      // Retirer son rôle au Super Admin le priverait de tout accès admin
      if (target.is_super_admin) return reply.code(403).send({ error: 'Impossible de modifier le rôle du Super Admin' })
      const check = await validateRoleAssignment(roleId, user)
      if (check.error) return reply.code(check.status || 400).send({ error: check.error })
      params.push(roleId); updates.push(`role_id = $${params.length}`)
    }

    if (storageQuota !== undefined) {
      if (!(await userHasPermission(user, 'users.change_quota'))) return reply.code(403).send({ error: 'Permission refusée' })
      const quota = parseQuota(storageQuota)
      if (quota === null) return reply.code(400).send({ error: 'Quota invalide' })
      params.push(quota); updates.push(`storage_quota = $${params.length}`)
    }

    if (!updates.length) return reply.code(400).send({ error: 'Aucun champ à modifier' })

    params.push(target.id)
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)

    // Un compte suspendu perd immédiatement ses sessions
    if (suspend === true) await revokeAllUserTokens(target.id)

    await log({ category: 'users', level: suspend === true ? 'warning' : 'info', action: 'user_updated', userId: user.id, ipAddress: extractIp(request), metadata: { targetId: target.id, changes: { roleId, storageQuota, suspend } } })

    return reply.send({ message: 'Utilisateur mis à jour.' })
  })

  // ─── Supprimer un utilisateur ─────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [authenticate, requirePermission('users.delete')],
  }, async (request, reply) => {
    const { id } = request.params
    if (id === request.currentUser.id) return reply.code(400).send({ error: 'Impossible de se supprimer soi-même' })

    const target = await getTarget(id)
    if (!target) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    if (target.is_super_admin) {
      return reply.code(403).send({ error: 'Impossible de supprimer le Super Admin' })
    }

    // Les lignes "files" sont supprimées en cascade : récupérer d'abord les fichiers
    // pour les effacer aussi du disque (sinon ils resteraient orphelins)
    const { rows: files } = await pool.query(
      'SELECT stored_name, mime_type, thumbnail_path FROM files WHERE owner_id = $1',
      [target.id]
    )
    const { rows: [deleted] } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING avatar_path', [target.id])

    for (const file of files) await deleteMediaFiles(file)
    if (deleted?.avatar_path?.startsWith('/storage/avatars/')) {
      await unlink(join(config.storage.path, 'avatars', deleted.avatar_path.split('/').pop())).catch(() => {})
    }

    await log({ category: 'users', level: 'warning', action: 'user_deleted', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { targetId: target.id, email: target.email, files: files.length } })

    return reply.send({ message: 'Utilisateur supprimé.' })
  })

  // ─── Profil (modifier le sien) ────────────────────────────────────────────
  fastify.patch('/me/profile', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { pseudo, firstName, lastName, password, currentPassword } = request.body || {}

    const updates = []
    const params = []

    if (pseudo !== undefined) {
      if (!isNonEmptyString(pseudo, 100)) return reply.code(400).send({ error: 'Pseudo invalide' })
      const cleanPseudo = pseudo.trim()
      const { rows } = await pool.query('SELECT 1 FROM users WHERE pseudo = $1 AND id != $2', [cleanPseudo, user.id])
      if (rows.length) return reply.code(409).send({ error: 'Pseudo déjà utilisé' })
      params.push(cleanPseudo); updates.push(`pseudo = $${params.length}`)
    }
    if (firstName !== undefined) { params.push(optionalString(firstName)); updates.push(`first_name = $${params.length}`) }
    if (lastName !== undefined) { params.push(optionalString(lastName)); updates.push(`last_name = $${params.length}`) }

    let passwordChanged = false
    if (password !== undefined) {
      if (!isValidPassword(password)) {
        return reply.code(400).send({ error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` })
      }
      // Exiger le mot de passe actuel : un access token volé ne doit pas suffire à prendre le compte
      const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id])
      const hash = rows[0]?.password_hash
      if (hash && (typeof currentPassword !== 'string' || !(await verifyPassword(hash, currentPassword)))) {
        return reply.code(400).send({ error: 'Mot de passe actuel incorrect' })
      }
      params.push(await hashPassword(password)); updates.push(`password_hash = $${params.length}`)
      passwordChanged = true
    }

    if (!updates.length) return reply.code(400).send({ error: 'Aucun champ à modifier' })

    params.push(user.id)
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)

    if (passwordChanged) {
      await log({ category: 'auth', level: 'info', action: 'password_changed', userId: user.id, ipAddress: extractIp(request) })
    }

    return reply.send({ message: 'Profil mis à jour.' })
  })

  // ─── Préférences d'interface (synchronisées entre appareils) ─────────────
  // Fusion superficielle : le client n'envoie que les clés modifiées.
  // Les sous-objets (ex. notifications) sont fusionnés eux aussi.
  fastify.patch('/me/preferences', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.code(400).send({ error: 'Préférences invalides' })
    }
    const json = JSON.stringify(body)
    if (json.length > 8192) return reply.code(413).send({ error: 'Préférences trop volumineuses' })

    const { rows: [current] } = await pool.query('SELECT preferences FROM users WHERE id = $1', [request.currentUser.id])
    const merged = { ...(current?.preferences || {}) }
    for (const [key, value] of Object.entries(body)) {
      if (!/^[a-zA-Z0-9_]{1,64}$/.test(key)) continue
      const isPlainObject = value && typeof value === 'object' && !Array.isArray(value)
      merged[key] = isPlainObject && merged[key] && typeof merged[key] === 'object'
        ? { ...merged[key], ...value }
        : value
    }

    const { rows: [updated] } = await pool.query(
      'UPDATE users SET preferences = $1::jsonb WHERE id = $2 RETURNING preferences',
      [JSON.stringify(merged), request.currentUser.id]
    )
    return reply.send(updated.preferences)
  })

  // ─── Upload avatar ────────────────────────────────────────────────────────
  fastify.post('/me/avatar', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: MAX_AVATAR_SIZE } })
    if (!data) return reply.code(400).send({ error: 'Fichier requis' })
    if (!data.mimetype?.startsWith('image/') || data.mimetype === 'image/svg+xml') {
      data.file.resume()
      return reply.code(400).send({ error: 'Format d\'image non supporté' })
    }

    const buffer = await data.toBuffer()

    const filename = `avatar_${nanoid(16)}.jpg`
    const filepath = join(config.storage.path, 'avatars', filename)

    const sharp = (await import('sharp')).default
    try {
      await sharp(buffer).rotate().resize(200, 200, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(filepath)
    } catch {
      return reply.code(400).send({ error: 'Le fichier n\'est pas une image valide' })
    }

    const avatarPath = `/storage/avatars/${filename}`
    const { rows: [previous] } = await pool.query('SELECT avatar_path FROM users WHERE id = $1', [request.currentUser.id])
    await pool.query('UPDATE users SET avatar_path = $1, updated_at = NOW() WHERE id = $2', [avatarPath, request.currentUser.id])

    // Supprimer l'ancien avatar du disque
    if (previous?.avatar_path?.startsWith('/storage/avatars/')) {
      await unlink(join(config.storage.path, 'avatars', previous.avatar_path.split('/').pop())).catch(() => {})
    }

    return reply.send({ avatarPath })
  })

  // ─── Délier Discord ───────────────────────────────────────────────────────
  fastify.delete('/me/discord', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query(
      'UPDATE users SET discord_id = NULL, discord_avatar = NULL, discord_pseudo = NULL WHERE id = $1',
      [request.currentUser.id]
    )
    await log({ category: 'auth', level: 'info', action: 'discord_unlinked', userId: request.currentUser.id, ipAddress: extractIp(request) })
    return reply.send({ message: 'Compte Discord délié.' })
  })
}
