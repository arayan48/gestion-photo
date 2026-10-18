import { useAuthStore } from '../stores/auth.store.js'

export const isImage = (f) => !!f?.mime_type?.startsWith('image/')
export const isVideo = (f) => !!f?.mime_type?.startsWith('video/')

export function fileExt(file) {
  const fromName = file?.original_name?.match(/\.([a-z0-9]+)$/i)?.[1]
  if (fromName) return fromName.toUpperCase()
  return file?.mime_type?.split('/')[1]?.split(';')[0]?.toUpperCase() || '?'
}

// URL authentifiée de l'original (le token passe en query : <img>/<video> n'envoient pas d'en-tête)
export function mediaUrl(file) {
  const token = useAuthStore.getState().accessToken || ''
  return `/api/files/${file.id}/view?token=${encodeURIComponent(token)}`
}

export function publicLink(file) {
  return `${window.location.origin}/media/${file.link_token}`
}

export const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'image/avif': ['.avif'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
}

export const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(',')

export function isAcceptedFile(file) {
  if (ACCEPTED_TYPES[file.type]) return true
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase()
  return Object.values(ACCEPTED_TYPES).some((exts) => exts.includes(ext))
}

export const QUALITY_PRESETS = [
  { value: 'original', label: 'Originale', desc: 'Fichier conservé tel quel' },
  { value: 'standard', label: 'Standard', desc: 'Optimisation légère (~85 %)' },
  { value: 'thumbnail', label: 'Miniature', desc: 'Compression forte, icônes' },
]

export const QUALITY_LABELS = Object.fromEntries(QUALITY_PRESETS.map((q) => [q.value, q.label]))
