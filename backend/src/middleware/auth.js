import pool from '../config/database.js'

export async function authenticate(request, reply) {
  try {
    // WebSocket et autres clients passent le token en query param (?token=...)
    if (!request.headers.authorization && request.query?.token) {
      request.headers.authorization = `Bearer ${request.query.token}`
    }
    await request.jwtVerify()

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.pseudo, u.role_id, u.is_active, u.is_banned,
              u.storage_quota, u.storage_used, u.totp_enabled,
              r.name AS role_name, r.is_super_admin
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [request.user.id]
    )

    if (!rows.length) {
      return reply.code(401).send({ error: 'Utilisateur introuvable' })
    }

    const user = rows[0]
    if (!user.is_active) {
      return reply.code(403).send({ error: 'Compte inactif ou en attente de validation' })
    }
    if (user.is_banned) {
      return reply.code(403).send({ error: 'Compte suspendu' })
    }

    request.currentUser = user
  } catch (err) {
    return reply.code(401).send({ error: 'Token invalide ou expiré' })
  }
}

// Vérifie une permission pour l'utilisateur courant (le Super Admin a tout)
export async function userHasPermission(user, permissionKey) {
  if (!user) return false
  if (user.is_super_admin) return true
  if (!user.role_id) return false

  const { rows } = await pool.query(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = $1 AND p.key = $2`,
    [user.role_id, permissionKey]
  )
  return rows.length > 0
}

export function requirePermission(permissionKey) {
  return async function (request, reply) {
    const user = request.currentUser
    if (!user) return reply.code(401).send({ error: 'Non authentifié' })

    if (!(await userHasPermission(user, permissionKey))) {
      return reply.code(403).send({ error: 'Permission refusée' })
    }
  }
}

export async function requireSuperAdmin(request, reply) {
  const user = request.currentUser
  if (!user?.is_super_admin) {
    return reply.code(403).send({ error: 'Accès réservé au Super Admin' })
  }
}
