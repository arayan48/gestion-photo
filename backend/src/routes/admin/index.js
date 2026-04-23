import pool from '../../config/database.js'
import { authenticate, requirePermission, requireSuperAdmin } from '../../middleware/auth.js'
import { log } from '../../utils/logger.js'
import { unban } from '../../services/ban.service.js'
import { revokeAllUserTokens } from '../../services/auth.service.js'
import { checkMediaStorageLimit, getStorageConfig } from '../../config/storage.js'

export default async function adminRoutes(fastify) {
  // ─── Statistiques globales ────────────────────────────────────────────────
  fastify.get('/stats', {
    preHandler: [authenticate, requirePermission('system.view_stats')],
  }, async (_, reply) => {
    const [users, files, storage, requests] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active, COUNT(*) FILTER (WHERE is_banned) AS banned FROM users'),
      pool.query('SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS total_size FROM files WHERE is_deleted = false'),
      checkMediaStorageLimit(),
      pool.query('SELECT COUNT(*) FROM account_requests WHERE status = $1', ['pending']),
    ])

    return reply.send({
      users: users.rows[0],
      files: files.rows[0],
      storage,
      pendingRequests: parseInt(requests.rows[0].count),
    })
  })

  // ─── Liste blanche IP ─────────────────────────────────────────────────────
  fastify.get('/whitelist', {
    preHandler: [authenticate, requirePermission('security.view_whitelist')],
  }, async (_, reply) => {
    const { rows } = await pool.query(
      `SELECT w.*, u.pseudo AS added_by_pseudo FROM ip_whitelist w
       LEFT JOIN users u ON w.added_by = u.id ORDER BY w.created_at DESC`
    )
    return reply.send(rows)
  })

  fastify.post('/whitelist', {
    preHandler: [authenticate, requirePermission('security.manage_whitelist')],
  }, async (request, reply) => {
    const { ip, label } = request.body
    if (!ip) return reply.code(400).send({ error: 'IP requise' })

    const { rows } = await pool.query(
      'INSERT INTO ip_whitelist (ip_address, label, added_by) VALUES ($1, $2, $3) ON CONFLICT (ip_address) DO NOTHING RETURNING *',
      [ip, label || null, request.currentUser.id]
    )

    await log({ category: 'security', level: 'info', action: 'ip_whitelisted', userId: request.currentUser.id, metadata: { ip, label } })
    return reply.code(201).send(rows[0] || { message: 'IP déjà présente' })
  })

  fastify.put('/whitelist/:id', {
    preHandler: [authenticate, requirePermission('security.manage_whitelist')],
  }, async (request, reply) => {
    const { ip, label } = request.body
    const { id } = request.params
    if (!ip) return reply.code(400).send({ error: 'IP requise' })

    await pool.query(
      'UPDATE ip_whitelist SET ip_address = $1, label = $2 WHERE id = $3',
      [ip, label || null, id]
    )
    await log({ category: 'security', level: 'info', action: 'ip_whitelist_updated', userId: request.currentUser.id, metadata: { id, ip, label } })
    return reply.send({ message: 'Entrée mise à jour.' })
  })

  fastify.delete('/whitelist/:id', {
    preHandler: [authenticate, requirePermission('security.manage_whitelist')],
  }, async (request, reply) => {
    await pool.query('DELETE FROM ip_whitelist WHERE id = $1', [request.params.id])
    await log({ category: 'security', level: 'warning', action: 'ip_removed_whitelist', userId: request.currentUser.id })
    return reply.send({ message: 'IP retirée de la liste blanche.' })
  })

  // ─── Débannissement ────────────────────────────────────────────────────────
  fastify.post('/unban/:banId', {
    preHandler: [authenticate, requirePermission('security.unban')],
  }, async (request, reply) => {
    const result = await unban(request.params.banId)
    if (!result) return reply.code(404).send({ error: 'Ban introuvable' })

    await log({ category: 'security', level: 'info', action: 'user_unbanned', userId: request.currentUser.id, metadata: { banId: request.params.banId } })
    return reply.send({ message: 'Utilisateur débanni.' })
  })

  // ─── Révoquer tokens d'un utilisateur ────────────────────────────────────
  fastify.post('/revoke-tokens/:userId', {
    preHandler: [authenticate, requirePermission('security.revoke_tokens')],
  }, async (request, reply) => {
    await revokeAllUserTokens(request.params.userId)
    await log({ category: 'security', level: 'warning', action: 'tokens_revoked', userId: request.currentUser.id, metadata: { targetId: request.params.userId } })
    return reply.send({ message: 'Tokens révoqués.' })
  })

  // ─── Logs ─────────────────────────────────────────────────────────────────
  fastify.get('/logs', {
    preHandler: [authenticate, requirePermission('system.view_logs')],
  }, async (request, reply) => {
    const { category, level, userId, search, from, to, page = 1, limit = 100 } = request.query
    const offset = (page - 1) * limit

    let where = 'WHERE 1=1'
    const params = []

    if (category) { params.push(category); where += ` AND l.category = $${params.length}` }
    if (level) { params.push(level); where += ` AND l.level = $${params.length}` }
    if (userId) { params.push(userId); where += ` AND l.user_id = $${params.length}` }
    if (search) { params.push(`%${search}%`); where += ` AND (l.action ILIKE $${params.length} OR l.metadata::text ILIKE $${params.length})` }
    if (from) { params.push(from); where += ` AND l.created_at >= $${params.length}` }
    if (to) { params.push(to); where += ` AND l.created_at <= $${params.length}` }

    const { rows } = await pool.query(
      `SELECT l.*, u.pseudo AS user_pseudo, u.email AS user_email FROM logs l
       LEFT JOIN users u ON l.user_id = u.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM logs l ${where}`,
      params
    )

    return reply.send({ logs: rows, total: parseInt(countRows[0].count), page: parseInt(page), limit: parseInt(limit) })
  })

  // ─── Notifications ─────────────────────────────────────────────────────────
  fastify.get('/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [request.currentUser.id]
    )
    return reply.send(rows)
  })

  fastify.post('/notifications/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [request.params.id, request.currentUser.id])
    return reply.send({ message: 'Notification marquée lue.' })
  })

  fastify.post('/notifications/read-all', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [request.currentUser.id])
    return reply.send({ message: 'Toutes les notifications marquées lues.' })
  })

  fastify.delete('/notifications/:id', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [request.params.id, request.currentUser.id])
    return reply.send({ message: 'Notification supprimée.' })
  })

  fastify.delete('/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [request.currentUser.id])
    return reply.send({ message: 'Toutes les notifications supprimées.' })
  })

  // ─── Configuration système ────────────────────────────────────────────────
  fastify.get('/config', {
    preHandler: [authenticate, requirePermission('system.manage_config')],
  }, async (_, reply) => {
    const { rows } = await pool.query('SELECT key, value FROM system_config ORDER BY key')
    return reply.send(Object.fromEntries(rows.map((r) => [r.key, r.value])))
  })

  fastify.patch('/config', {
    preHandler: [authenticate, requirePermission('system.manage_config')],
  }, async (request, reply) => {
    const updates = request.body
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        'INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
        [key, String(value)]
      )
    }
    await log({ category: 'system', level: 'info', action: 'config_updated', userId: request.currentUser.id })
    return reply.send({ message: 'Configuration mise à jour.' })
  })

  // ─── Sauvegardes ─────────────────────────────────────────────────────────
  fastify.get('/backups', {
    preHandler: [authenticate, requirePermission('system.manage_backups')],
  }, async (_, reply) => {
    const { rows } = await pool.query('SELECT * FROM backups ORDER BY created_at DESC LIMIT 50')
    return reply.send(rows)
  })

  fastify.post('/backups/run', {
    preHandler: [authenticate, requirePermission('system.manage_backups')],
  }, async (request, reply) => {
    const { type = 'local' } = request.body
    const { runBackup } = await import('../../services/backup.service.js')
    const result = await runBackup(type)
    return reply.send(result)
  })
}
