import { createHash } from 'crypto'

export function buildFingerprint({ ip, userAgent, jwtHint = '', browserFingerprint = '' }) {
  const raw = `${userAgent}|${jwtHint}|${browserFingerprint}`
  return createHash('sha256').update(raw).digest('hex')
}

export function extractIp(request) {
  return (
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.headers['x-real-ip'] ||
    request.ip
  )
}
