import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { nanoid } from 'nanoid'
import pool from '../../config/database.js'
import { authenticate } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/auth.js'
import { log } from '../../utils/logger.js'
import { hashPassword } from '../../services/auth.service.js'
import { sendEmail } from '../../services/email/email.service.js'
import { config } from '../../config/env.js'

export default async function userRoutes(fastify) {
  // ─── Liste des utilisateurs ──────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [authenticate, requirePermission('users.view_list')],
  }, async (request, reply) => {
    const { page = 1, limit = 20, search } = request.query
    const offset = (page - 1) * limit
    let where = 'WHERE 1=1'
    const params = []

    if (search) {
      params.push(`%${search}%`)
      where += ` AND (u.email ILIKE $${params.length} OR u.pseudo ILIKE $${params.length})`
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.pseudo, u.first_name, u.last_name, u.avatar_path,
              u.is_active, u.is_banned, u.storage_quota, u.storage_used,
              u.created_at, r.name AS role_name, r.id AS role_id
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params)

    return reply.send({ users: rows, total: parseInt(countRows[0].count), page: parseInt(page), limit: parseInt(limit) })
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
    const { action, roleId } = request.body // action: 'accept' | 'refuse'

    const { rows } = await pool.query('SELECT * FROM account_requests WHERE id = $1 AND status = $2', [id, 'pending'])
    if (!rows.length) return reply.code(404).send({ error: 'Demande introuvable ou déjà traitée' })

    const req = rows[0]

    if (action === 'accept') {
      // Rôle par défaut si non fourni
      let finalRoleId = roleId
      if (!finalRoleId) {
        const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE is_super_admin = false LIMIT 1')
        finalRoleId = roleRows[0]?.id
      }

      await pool.query(
        `INSERT INTO users (email, pseudo, first_name, last_name, avatar_path, password_hash, role_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [req.email, req.pseudo, req.first_name, req.last_name, req.avatar_path, req.password_hash, finalRoleId]
      )

      await pool.query(
        'UPDATE account_requests SET status = $1, reviewed_by = $2 WHERE id = $3',
        ['accepted', request.currentUser.id, id]
      )

      await sendEmail({ type: 'accountAccepted', to: req.email, data: { pseudo: req.pseudo } })
      await log({ category: 'users', level: 'info', action: 'account_accepted', userId: request.currentUser.id, metadata: { email: req.email } })

      return reply.send({ message: 'Demande acceptée et utilisateur créé.' })
    } else {
      await pool.query(
        'UPDATE account_requests SET status = $1, reviewed_by = $2 WHERE id = $3',
        ['refused', request.currentUser.id, id]
      )
      await log({ category: 'users', level: 'info', action: 'account_refused', userId: request.currentUser.id, metadata: { email: req.email } })
      return reply.send({ message: 'Demande refusée.' })
    }
  })

  // ─── Modifier un utilisateur ──────────────────────────────────────────────
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params
    const user = request.currentUser
    const isSelf = user.id === id

    const { roleId, storageQuota, suspend } = request.body

    if (roleId && !user.is_super_admin) {
      return reply.code(403).send({ error: 'Permission refusée' })
    }

    if (storageQuota !== undefined) {
      const { rows: permRows } = await pool.query(
        `SELECT 1 FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = $1 AND p.key = 'users.change_quota'`,
        [user.role_id]
      )
      if (!user.is_super_admin && !permRows.length) {
        return reply.code(403).send({ error: 'Permission refusée' })
      }
    }

    const updates = []
    const params = []

    if (roleId) { params.push(roleId); updates.push(`role_id = $${params.length}`) }
    if (storageQuota) { params.push(storageQuota); updates.push(`storage_quota = $${params.length}`) }
    if (typeof suspend === 'boolean') {
      params.push(suspend); updates.push(`is_banned = $${params.length}`)
    }

    if (!updates.length) return reply.code(400).send({ error: 'Aucun champ à modifier' })

    params.push(id)
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)

    await log({ category: 'users', level: 'info', action: 'user_updated', userId: user.id, metadata: { targetId: id } })

    return reply.send({ message: 'Utilisateur mis à jour.' })
  })

  // ─── Supprimer un utilisateur ─────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [authenticate, requirePermission('users.delete')],
  }, async (request, reply) => {
    const { id } = request.params
    if (id === request.currentUser.id) return reply.code(400).send({ error: 'Impossible de se supprimer soi-même' })

    await pool.query('DELETE FROM users WHERE id = $1', [id])
    await log({ category: 'users', level: 'warning', action: 'user_deleted', userId: request.currentUser.id, metadata: { targetId: id } })

    return reply.send({ message: 'Utilisateur supprimé.' })
  })

  // ─── Profil (modifier le sien) ────────────────────────────────────────────
  fastify.patch('/me/profile', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { pseudo, firstName, lastName, password } = request.body

    const updates = []
    const params = []

    if (pseudo) {
      const { rows } = await pool.query('SELECT 1 FROM users WHERE pseudo = $1 AND id != $2', [pseudo, user.id])
      if (rows.length) return reply.code(409).send({ error: 'Pseudo déjà utilisé' })
      params.push(pseudo); updates.push(`pseudo = $${params.length}`)
    }
    if (firstName !== undefined) { params.push(firstName); updates.push(`first_name = $${params.length}`) }
    if (lastName !== undefined) { params.push(lastName); updates.push(`last_name = $${params.length}`) }
    if (password) {
      const hash = await hashPassword(password)
      params.push(hash); updates.push(`password_hash = $${params.length}`)
    }

    if (!updates.length) return reply.code(400).send({ error: 'Aucun champ à modifier' })

    params.push(user.id)
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)

    return reply.send({ message: 'Profil mis à jour.' })
  })

  // ─── Upload avatar ────────────────────────────────────────────────────────
  fastify.post('/me/avatar', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Fichier requis' })

    const ext = data.mimetype === 'image/png' ? '.png' : '.jpg'
    const filename = `avatar_${nanoid(16)}${ext}`
    const filepath = join(config.storage.path, 'avatars', filename)

    const chunks = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const sharp = (await import('sharp')).default
    await sharp(buffer).resize(200, 200, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(filepath)

    const avatarPath = `/storage/avatars/${filename}`
    await pool.query('UPDATE users SET avatar_path = $1, updated_at = NOW() WHERE id = $2', [avatarPath, request.currentUser.id])

    return reply.send({ avatarPath })
  })

  // ─── Délier Discord ───────────────────────────────────────────────────────
  fastify.delete('/me/discord', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query(
      'UPDATE users SET discord_id = NULL, discord_avatar = NULL, discord_pseudo = NULL WHERE id = $1',
      [request.currentUser.id]
    )
    return reply.send({ message: 'Compte Discord délié.' })
  })
}
