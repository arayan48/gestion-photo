export const PASSWORD_MIN_LENGTH = 8

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isNonEmptyString(value, maxLength = 255) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

export function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 255 && EMAIL_RE.test(value.trim())
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isValidPassword(value) {
  return typeof value === 'string' && value.length >= PASSWORD_MIN_LENGTH && value.length <= 256
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function optionalString(value, maxLength = 100) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.substring(0, maxLength) : null
}

// Pagination sûre (évite NaN, valeurs négatives et LIMIT démesurés)
export function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const page = Math.max(parseInt(query?.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query?.limit) || defaultLimit, 1), maxLimit)
  return { page, limit, offset: (page - 1) * limit }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
