import { format, formatDistanceToNowStrict, isToday, isYesterday, isThisWeek, isThisYear, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'

// Virgule décimale à la française, zéros inutiles retirés (« 1,5 Mo », « 12 Mo »)
const decimal = (value, digits) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })

export function formatSize(bytes) {
  bytes = Number(bytes) || 0 // les BIGINT PostgreSQL arrivent sous forme de chaîne
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 ** 2) return `${decimal(bytes / 1024, 1)} Ko`
  if (bytes < 1024 ** 3) return `${decimal(bytes / 1024 ** 2, 1)} Mo`
  if (bytes < 1024 ** 4) return `${decimal(bytes / 1024 ** 3, 2)} Go`
  return `${decimal(bytes / 1024 ** 4, 2)} To`
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
  const minutesLeft = TRASH_RETENTION_HOURS * 60 - differenceInMinutes(new Date(), new Date(deletedAt))
  if (minutesLeft <= 0) return 'Suppression imminente'
  if (minutesLeft < 60) return "Moins d'une heure"
  return `Supprimé dans ${Math.floor(minutesLeft / 60)} h`
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`
}

export function initials(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}
