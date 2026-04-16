import pool from '../config/database.js'
import { extractIp } from '../utils/fingerprint.js'

export async function checkIpWhitelist(request, reply) {
  const ip = extractIp(request)

  const { rows } = await pool.query(
    'SELECT 1 FROM ip_whitelist WHERE ip_address = $1',
    [ip]
  )

  if (!rows.length) {
    return reply.code(403).send({ error: 'Accès refusé : IP non autorisée' })
  }
}
