import { format, formatDistanceToNowStrict, isToday, isYesterday, isThisWeek, isThisYear, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatSize(bytes) {
  bytes = Number(bytes) || 0 // les BIGINT PostgreSQL arrivent sous forme de chaîne
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1).replace('.0', '')} Ko`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace('.0', '')} Mo`
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} Go`
  return `${(bytes / 1024 ** 4).toFixed(2)} To`
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function formatRelative(date) {
  if (!date) return '—'
  return formatDistanceToNowStrict(new Date(date), { locale: fr, addSuffix: true })
}

export function formatDate(date, pattern = 'd MMM yyyy') {
  if (!date) return '—'
  return format(new Date(date), pattern, { locale: fr })
}

export function formatDateTime(date) {
  return formatDate(date, "d MMM yyyy 'à' HH:mm")
}

// Libellé de groupe façon galerie photo : Aujourd'hui, Hier, Cette semaine, octobre 2026…
export function dateGroupLabel(date) {
  const d = new Date(date)
  if (isToday(d)) return "Aujourd'hui"
  if (isYesterday(d)) return 'Hier'
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'Cette semaine'
  const label = format(d, isThisYear(d) ? 'MMMM' : 'MMMM yyyy', { locale: fr })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Corbeille vidée après 48 h (cron backend)
export const TRASH_RETENTION_HOURS = 48
export function trashRemaining(deletedAt) {
  if (!deletedAt) return null
  const left = TRASH_RETENTION_HOURS - differenceInHours(new Date(), new Date(deletedAt))
  if (left <= 0) return 'Suppression imminente'
  if (left < 1) return "Moins d'une heure"
  return `Supprimé dans ${left} h`
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`
}

export function initials(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}
