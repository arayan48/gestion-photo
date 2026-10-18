import pool from '../../config/database.js'
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js'
import { log } from '../../utils/logger.js'
import { extractIp } from '../../utils/fingerprint.js'
import { isNonEmptyString, isUuid } from '../../utils/validation.js'

async function roleNameTaken(name, excludeId = null) {
  const { rows } = await pool.query(
    'SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1) AND ($2::uuid IS NULL OR id != $2)',
    [name, excludeId]
  )
  return rows.length > 0
}

// Remplace les permissions d'un rôle dans une transaction
async function setRolePermissions(client, roleId, permissionKeys) {
  await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId])
  const keys = Array.isArray(permissionKeys) ? permissionKeys.filter((k) => typeof k === 'string') : []
  if (keys.length) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, id FROM permissions WHERE key = ANY($2)`,
      [roleId, keys]
    )
  }
}

export default async function roleRoutes(fastify) {
  // ─── Liste des rôles ──────────────────────────────────────────────────────
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_super_admin, r.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id)::int AS user_count,
              json_agg(json_build_object('key', p.key, 'label', p.label, 'category', p.category))
                FILTER (WHERE p.id IS NOT NULL) AS permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       GROUP BY r.id ORDER BY r.is_super_admin DESC, r.name`
    )
    return reply.send(rows)
  })

  // ─── Toutes les permissions disponibles ──────────────────────────────────
  fastify.get('/permissions', { preHandler: [authenticate] }, async (_, reply) => {
    const { rows } = await pool.query('SELECT * FROM permissions ORDER BY category, key')
    return reply.send(rows)
  })

  // ─── Créer un rôle ────────────────────────────────────────────────────────
  fastify.post('/', { preHandler: [authenticate, requireSuperAdmin] }, async (request, reply) => {
    const { name, permissionKeys = [] } = request.body || {}
    if (!isNonEmptyString(name, 100)) return reply.code(400).send({ error: 'Nom du rôle requis' })
    const cleanName = name.trim()
    if (await roleNameTaken(cleanName)) return reply.code(409).send({ error: 'Un rôle porte déjà ce nom' })

    const client = await pool.connect()
    let role
    try {
      await client.query('BEGIN')
      const { rows } = await client.query('INSERT INTO roles (name) VALUES ($1) RETURNING *', [cleanName])
      role = rows[0]
      await setRolePermissions(client, role.id, permissionKeys)
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    await log({ category: 'users', level: 'info', action: 'role_created', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { name: cleanName, permissionKeys } })
    return reply.code(201).send(role)
  })

  // ─── Mettre à jour un rôle ────────────────────────────────────────────────
  fastify.put('/:id', { preHandler: [authenticate, requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params
    const { name, permissionKeys = [] } = request.body || {}
    if (!isUuid(id)) return reply.code(404).send({ error: 'Rôle introuvable' })

    const { rows } = await pool.query('SELECT * FROM roles WHERE id = $1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Rôle introuvable' })
    if (rows[0].is_super_admin) return reply.code(403).send({ error: 'Impossible de modifier le rôle Super Admin' })

    if (name !== undefined) {
      if (!isNonEmptyString(name, 100)) return reply.code(400).send({ error: 'Nom du rôle invalide' })
      if (await roleNameTaken(name.trim(), id)) return reply.code(409).send({ error: 'Un rôle porte déjà ce nom' })
    }

    // Nom + permissions dans la même transaction (pas de rôle à moitié mis à jour)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (name !== undefined) await client.query('UPDATE roles SET name = $1 WHERE id = $2', [name.trim(), id])
      await setRolePermissions(client, id, permissionKeys)
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    await log({ category: 'users', level: 'info', action: 'role_updated', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { roleId: id, permissionKeys } })
    return reply.send({ message: 'Rôle mis à jour.' })
  })

  // ─── Supprimer un rôle ────────────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [authenticate, requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params
    if (!isUuid(id)) return reply.code(404).send({ error: 'Rôle introuvable' })
    const { rows } = await pool.query('SELECT is_super_admin FROM roles WHERE id = $1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Rôle introuvable' })
    if (rows[0].is_super_admin) return reply.code(403).send({ error: 'Impossible de supprimer le rôle Super Admin' })

    await pool.query('DELETE FROM roles WHERE id = $1', [id])
    await log({ category: 'users', level: 'warning', action: 'role_deleted', userId: request.currentUser.id, ipAddress: extractIp(request), metadata: { roleId: id } })
    return reply.send({ message: 'Rôle supprimé.' })
  })
}
