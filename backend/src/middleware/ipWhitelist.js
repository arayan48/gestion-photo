import pool from '../config/database.js'
import { cached } from '../config/redis.js'
import { extractIp } from '../utils/fingerprint.js'

function isLocalOrPrivateIp(ip) {
  if (!ip) return false
  // Loopback
  if (ip === '127.0.0.1' || ip === '::1') return true
  // Docker bridge et réseaux privés courants (172.16.0.0/12)
  const dockerMatch = ip.match(/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/)
  if (dockerMatch) return true
  // Réseau local 192.168.x.x
  if (ip.startsWith('192.168.')) return true
  // Réseau local 10.x.x.x
  if (ip.startsWith('10.')) return true
  return false
}

export async function checkIpWhitelist(request, reply) {
  const ip = extractIp(request)

  // IPs locales et réseau privé toujours autorisés
  if (isLocalOrPrivateIp(ip)) return

  // Liste entière en cache : chaque lien public la consulte (invalidée à chaque modification)
  const allowed = await cached('ip_whitelist', 300, async () => {
    const { rows } = await pool.query('SELECT ip_address FROM ip_whitelist')
    return rows.map((r) => r.ip_address)
  })

  if (!allowed.includes(ip)) {
    return reply.code(403).send({ error: 'Accès refusé : IP non autorisée' })
  }
}
