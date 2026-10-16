import { createHash } from 'crypto'

export function buildFingerprint({ ip, userAgent, jwtHint = '', browserFingerprint = '' }) {
  const raw = `${userAgent}|${jwtHint}|${browserFingerprint}`
  return createHash('sha256').update(raw).digest('hex')
}

// Normalise les IPv4 encapsulées en IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
export function normalizeIp(ip) {
  if (!ip) return ip
  return ip.startsWith('::ffff:') && ip.includes('.') ? ip.slice(7) : ip
}

// L'IP client est résolue par Fastify (option trustProxy) : seuls les proxys de confiance
// (Nginx sur le réseau Docker) peuvent la fournir via X-Forwarded-For. Lire l'en-tête
// directement permettrait à n'importe quel client d'usurper une IP (whitelist, bans…).
export function extractIp(request) {
  return normalizeIp(request.ip)
}
