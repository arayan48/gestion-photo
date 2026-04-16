import pool from '../../config/database.js'
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js'
import { log } from '../../utils/logger.js'

export default async function roleRoutes(fastify) {
  // ─── Liste des rôles ──────────────────────────────────────────────────────
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_super_admin, r.created_at,
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
    const { name, permissionKeys = [] } = request.body
    if (!name) return reply.code(400).send({ error: 'Nom du rôle requis' })

    const { rows: role } = await pool.query(
      'INSERT INTO roles (name) VALUES ($1) RETURNING *',
      [name]
    )

    if (permissionKeys.length) {
      const { rows: perms } = await pool.query(
        'SELECT id FROM permissions WHERE key = ANY($1)',
        [permissionKeys]
      )
      for (const perm of perms) {
        await pool.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [role[0].id, perm.id]
        )
      }
    }

    await log({ category: 'users', level: 'info', action: 'role_created', userId: request.currentUser.id, metadata: { name } })
    return reply.code(201).send(role[0])
  })

  // ─── Mettre à jour un rôle ────────────────────────────────────────────────
  fastify.put('/:id', { preHandler: [authenticate, requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params
    const { name, permissionKeys = [] } = request.body

    const { rows } = await pool.query('SELECT * FROM roles WHERE id = $1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Rôle introuvable' })
    if (rows[0].is_super_admin) return reply.code(403).send({ error: 'Impossible de modifier le rôle Super Admin' })

    if (name) await pool.query('UPDATE roles SET name = $1 WHERE id = $2', [name, id])

    // Remplacer les permissions
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [id])
    if (permissionKeys.length) {
      const { rows: perms } = await pool.query('SELECT id FROM permissions WHERE key = ANY($1)', [permissionKeys])
      for (const perm of perms) {
        await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [id, perm.id])
      }
    }

    await log({ category: 'users', level: 'info', action: 'role_updated', userId: request.currentUser.id, metadata: { roleId: id } })
    return reply.send({ message: 'Rôle mis à jour.' })
  })

  // ─── Supprimer un rôle ────────────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [authenticate, requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params
    const { rows } = await pool.query('SELECT is_super_admin FROM roles WHERE id = $1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Rôle introuvable' })
    if (rows[0].is_super_admin) return reply.code(403).send({ error: 'Impossible de supprimer le rôle Super Admin' })

    await pool.query('DELETE FROM roles WHERE id = $1', [id])
    await log({ category: 'users', level: 'warning', action: 'role_deleted', userId: request.currentUser.id, metadata: { roleId: id } })
    return reply.send({ message: 'Rôle supprimé.' })
  })
}
