import { isIP } from 'net'
import pool from '../../config/database.js'
import { authenticate, requirePermission, userHasPermission } from '../../middleware/auth.js'
import { log } from '../../utils/logger.js'
import { extractIp, normalizeIp } from '../../utils/fingerprint.js'
import { isUuid, parsePagination } from '../../utils/validation.js'
import { unban } from '../../services/ban.service.js'
import { revokeAllUserTokens } from '../../services/auth.service.js'
import { checkMediaStorageLimit } from '../../config/storage.js'

const CONFIG_KEY_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/
// Valeurs calculées automatiquement au démarrage : non modifiables à la main
const READONLY_CONFIG_KEYS = new Set([
  'storage.total_bytes', 'storage.safe_bytes', 'storage.media_limit',
  'storage.backup_limit', 'storage.zip_limit', 'storage.log_limit',
])

function parseIp(value) {
  if (typeof value !== 'string') return null
  const ip = normalizeIp(value.trim())
  return isIP(ip) ? ip : null
}

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
    const { label } = request.body || {}
    const ip = parseIp(request.body?.ip)
    if (!ip) return reply.code(400).send({ error: 'Adresse IP invalide' })

    const { rows } = await pool.query(
      'INSERT INTO ip_whitelist (ip_address, label, added_by) VALUES ($1, $2, $3) ON CONFLICT (ip_address) DO NOTHING RETURNING *',
      [ip, label || null, request.currentUser.id]
    )
    if (!rows.length) return reply.code(409).send({ error: 'Cette IP est déjà dans la liste blanche' })

    await log({ category: 'security', level: 'info', action: 'ip_whitelisted', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { ip, label } })
    return reply.code(201).send(rows[0])
  })

  fastify.put('/whitelist/:id', {
    preHandler: [authenticate, requirePermission('security.manage_whitelist')],
  }, async (request, reply) => {
    const { label } = request.body || {}
    const { id } = request.params
    const ip = parseIp(request.body?.ip)
    if (!ip) return reply.code(400).send({ error: 'Adresse IP invalide' })
    if (!isUuid(id)) return reply.code(404).send({ error: 'Entrée introuvable' })

    const { rowCount } = await pool.query(
      'UPDATE ip_whitelist SET ip_address = $1, label = $2 WHERE id = $3',
      [ip, label || null, id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Entrée introuvable' })
    await log({ category: 'security', level: 'info', action: 'ip_whitelist_updated', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { id, ip, label } })
    return reply.send({ message: 'Entrée mise à jour.' })
  })

  fastify.delete('/whitelist/:id', {
    preHandler: [authenticate, requirePermission('security.manage_whitelist')],
  }, async (request, reply) => {
    if (!isUuid(request.params.id)) return reply.code(404).send({ error: 'Entrée introuvable' })
    const { rows } = await pool.query('DELETE FROM ip_whitelist WHERE id = $1 RETURNING ip_address', [request.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Entrée introuvable' })
    await log({ category: 'security', level: 'warning', action: 'ip_removed_whitelist', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { ip: rows[0].ip_address } })
    return reply.send({ message: 'IP retirée de la liste blanche.' })
  })

  // ─── Débannissement ────────────────────────────────────────────────────────
  fastify.post('/unban/:banId', {
    preHandler: [authenticate, requirePermission('security.unban')],
  }, async (request, reply) => {
    const result = await unban(request.params.banId)
    if (!result) return reply.code(404).send({ error: 'Ban introuvable' })

    await log({ category: 'security', level: 'info', action: 'user_unbanned', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { banId: request.params.banId } })
    return reply.send({ message: 'Utilisateur débanni.' })
  })

  // ─── Révoquer tokens d'un utilisateur ────────────────────────────────────
  fastify.post('/revoke-tokens/:userId', {
    preHandler: [authenticate, requirePermission('security.revoke_tokens')],
  }, async (request, reply) => {
    if (!isUuid(request.params.userId)) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    await revokeAllUserTokens(request.params.userId)
    await log({ category: 'security', level: 'warning', action: 'tokens_revoked', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { targetId: request.params.userId } })
    return reply.send({ message: 'Tokens révoqués.' })
  })

  // ─── Logs ─────────────────────────────────────────────────────────────────
  fastify.get('/logs', {
    preHandler: [authenticate, requirePermission('system.view_logs')],
  }, async (request, reply) => {
    const { category, level, userId, search, from, to } = request.query
    const { page, limit, offset } = parsePagination(request.query, { defaultLimit: 100, maxLimit: 500 })

    let where = 'WHERE 1=1'
    const params = []

    if (category) { params.push(category); where += ` AND l.category = $${params.length}` }
    if (level) { params.push(level); where += ` AND l.level = $${params.length}` }
    if (userId && isUuid(userId)) { params.push(userId); where += ` AND l.user_id = $${params.length}` }
    if (search) { params.push(`%${search}%`); where += ` AND (l.action ILIKE $${params.length} OR l.metadata::text ILIKE $${params.length})` }
    if (from && !Number.isNaN(Date.parse(from))) { params.push(from); where += ` AND l.created_at >= $${params.length}::timestamp` }
    if (to && !Number.isNaN(Date.parse(to))) {
      params.push(to)
      // Une date seule (AAAA-MM-JJ) inclut toute la journée
      where += /^\d{4}-\d{2}-\d{2}$/.test(to)
        ? ` AND l.created_at < ($${params.length}::date + INTERVAL '1 day')`
        : ` AND l.created_at <= $${params.length}::timestamp`
    }

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

    return reply.send({ logs: rows, total: parseInt(countRows[0].count), page, limit })
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
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return reply.code(400).send({ error: 'Configuration invalide' })
    }

    const entries = Object.entries(updates)
    for (const [key] of entries) {
      if (!CONFIG_KEY_RE.test(key) || key.length > 100) return reply.code(400).send({ error: `Clé de configuration invalide : ${key}` })
      if (READONLY_CONFIG_KEYS.has(key)) return reply.code(400).send({ error: `Clé en lecture seule : ${key}` })
    }

    // Les seuils de stockage relèvent d'une permission dédiée
    const touchesStorage = entries.some(([key]) => key.startsWith('storage.'))
    if (touchesStorage && !(await userHasPermission(request.currentUser, 'system.manage_storage'))) {
      return reply.code(403).send({ error: 'Permission refusée pour modifier le stockage' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const [key, value] of entries) {
        await client.query(
          'INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
          [key, value === null || value === undefined ? '' : String(value)]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    // Ne jamais journaliser les valeurs (clés API, mots de passe…)
    await log({ category: 'system', level: 'info', action: 'config_updated', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { keys: entries.map(([key]) => key) } })
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
    const { type = 'local' } = request.body || {}
    const { runBackup } = await import('../../services/backup.service.js')
    const result = await runBackup(type)
    if (!result.success) return reply.code(500).send({ error: `Échec de la sauvegarde : ${result.error}` })
    await log({ category: 'system', level: 'info', action: 'backup_manual', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { type } })
    return reply.send(result)
  })
}
