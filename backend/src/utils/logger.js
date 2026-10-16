import pool from '../config/database.js'
import { sendToUser } from '../websocket/notifications.js'

export async function log({ category, level, action, userId = null, ipAddress = null, metadata = null }) {
  try {
    await pool.query(
      `INSERT INTO logs (category, level, action, user_id, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [category, level, action, userId, ipAddress, metadata ? JSON.stringify(metadata) : null]
    )
  } catch {
    // Ne jamais crasher l'app à cause d'un log
  }
}

export async function notifyAdmins({ type, message }) {
  try {
    // Récupérer tous les super admins et users avec permissions admin
    const { rows } = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.is_super_admin = true AND u.is_active = true`
    )

    for (const user of rows) {
      await notify({ userId: user.id, type, message })
    }
  } catch {
    // silencieux
  }
}

export async function notify({ userId, type, message }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING *`,
      [userId, type, message]
    )
    // Push temps réel vers la cloche (format attendu par notification.store.js)
    sendToUser(userId, { type: 'notification', notification: rows[0] })
  } catch {
    // silencieux
  }
}
