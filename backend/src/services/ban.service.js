import { nanoid } from 'nanoid'
import pool from '../config/database.js'
import { log } from '../utils/logger.js'
import { buildFingerprint } from '../utils/fingerprint.js'

const BAN_DURATIONS = [0, 2 * 60, 15 * 60, 60 * 60, 24 * 60 * 60]
// niveau 0 = pas banni, 1 = 2min, 2 = 15min, 3 = 1h, 4 = 24h, 5 = permanent
const MAX_AUTO_BAN_LEVEL = 4 // le ban permanent (5) est uniquement manuel
const MAX_ATTEMPTS = 5

// Sans empreinte navigateur fournie par le client, le hash ne contiendrait que le
// User-Agent : tous les utilisateurs d'un même navigateur partageraient la même
// "empreinte" et seraient bannis ensemble. On ne l'utilise donc que si elle est fournie.
function computeFingerprint({ ip, userAgent, jwtHint, browserFingerprint }) {
  if (!browserFingerprint && !jwtHint) return null
  return buildFingerprint({ ip, userAgent, jwtHint, browserFingerprint })
}

export async function checkBan({ ip, identifier, userAgent = '', jwtHint = '', browserFingerprint = '' }) {
  const fingerprint = computeFingerprint({ ip, userAgent, jwtHint, browserFingerprint })

  // Vérifier par IP ou identifiant ou fingerprint
  const { rows } = await pool.query(
    `SELECT * FROM login_attempts
     WHERE (identifier = $1 OR ip_address = $2 OR fingerprint = $3)
       AND (banned_until > NOW() OR ban_level = 5)
     ORDER BY ban_level DESC
     LIMIT 1`,
    [identifier, ip, fingerprint]
  )

  if (rows.length) {
    const record = rows[0]
    if (record.ban_level === 5) {
      return { banned: true, permanent: true, banId: record.ban_id }
    }
    if (record.banned_until && new Date(record.banned_until) > new Date()) {
      return {
        banned: true,
        permanent: false,
        bannedUntil: record.banned_until,
        banId: record.ban_id,
      }
    }
  }

  return { banned: false }
}

export async function recordFailedAttempt({ ip, identifier, userAgent = '', jwtHint = '', browserFingerprint = '' }) {
  const fingerprint = computeFingerprint({ ip, userAgent, jwtHint, browserFingerprint })

  const { rows } = await pool.query(
    `SELECT * FROM login_attempts WHERE identifier = $1 OR ip_address = $2 OR fingerprint = $3
     ORDER BY ban_level DESC LIMIT 1`,
    [identifier, ip, fingerprint]
  )

  if (!rows.length) {
    await pool.query(
      `INSERT INTO login_attempts (identifier, ip_address, user_agent, fingerprint, jwt_hint, attempt_count)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [identifier, ip, userAgent, fingerprint, jwtHint]
    )
    return
  }

  const record = rows[0]
  const newCount = record.attempt_count + 1

  if (newCount >= MAX_ATTEMPTS) {
    // Un ban permanent manuel n'est jamais rétrogradé
    const newLevel = record.ban_level >= 5 ? 5 : Math.min(record.ban_level + 1, MAX_AUTO_BAN_LEVEL)
    const durationSec = BAN_DURATIONS[newLevel] || 0
    const bannedUntil = durationSec
      ? new Date(Date.now() + durationSec * 1000)
      : null
    const banId = nanoid(12)

    // Le compteur repart à 0 : la récidive (5 nouveaux échecs) fait passer au niveau suivant
    await pool.query(
      `UPDATE login_attempts
       SET attempt_count = 0, ban_level = $1, banned_until = $2, ban_id = $3,
           fingerprint = COALESCE($4, fingerprint), ip_address = $5, updated_at = NOW()
       WHERE id = $6`,
      [newLevel, bannedUntil, banId, fingerprint, ip, record.id]
    )

    await log({
      category: 'security',
      level: 'warning',
      action: 'ban_automatique',
      ipAddress: ip,
      metadata: { identifier, banLevel: newLevel, bannedUntil, banId },
    })
  } else {
    await pool.query(
      `UPDATE login_attempts
       SET attempt_count = $1, ip_address = $2, fingerprint = COALESCE($3, fingerprint), updated_at = NOW()
       WHERE id = $4`,
      [newCount, ip, fingerprint, record.id]
    )
  }
}

// Uniquement le compte connecté : remettre aussi à zéro par IP permettrait à un attaquant
// d'effacer ses échecs sur un autre compte en se connectant au sien depuis la même IP
export async function resetAttempts({ identifier }) {
  await pool.query(
    `UPDATE login_attempts SET attempt_count = 0, ban_level = 0, banned_until = NULL
     WHERE identifier = $1`,
    [identifier]
  )
}

export async function unban(banId) {
  const { rows } = await pool.query(
    `UPDATE login_attempts
     SET banned_until = NULL, ban_level = 0, attempt_count = 0
     WHERE ban_id = $1
     RETURNING *`,
    [banId]
  )
  return rows[0] || null
}
