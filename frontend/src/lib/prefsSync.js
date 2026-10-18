import api from '../utils/api.js'
import { usePreferencesStore, SYNCED_KEYS } from '../stores/preferences.store.js'
import { useThemeStore } from '../stores/theme.store.js'

// Préférences d'interface enregistrées en base (users.preferences.ui) :
// on retrouve son thème, son accent et sa vue sur tous ses appareils.
let hydrating = false
let timer = null
let started = false

// Modifications locales pas encore envoyées : elles priment sur la version du serveur
// (ex. thème changé puis page rechargée avant la fin du délai d'envoi)
const DIRTY_KEY = 'obscura-prefs-dirty'
const isDirty = () => { try { return localStorage.getItem(DIRTY_KEY) === '1' } catch { return false } }
const setDirty = (v) => { try { v ? localStorage.setItem(DIRTY_KEY, '1') : localStorage.removeItem(DIRTY_KEY) } catch {} }

function snapshot() {
  const prefs = usePreferencesStore.getState()
  const theme = useThemeStore.getState()
  const ui = { theme: theme.theme, accent: theme.accent }
  for (const k of SYNCED_KEYS) ui[k] = prefs[k]
  return ui
}

function push() {
  // Importé dynamiquement : évite une dépendance circulaire avec auth.store
  return import('../stores/auth.store.js').then(({ useAuthStore }) => {
    if (!useAuthStore.getState().accessToken) return
    return api.patch('/users/me/preferences', { ui: snapshot() }).then(() => setDirty(false)).catch(() => {})
  })
}

function schedulePush() {
  if (hydrating) return
  setDirty(true)
  clearTimeout(timer)
  timer = setTimeout(push, 900)
}

export function applyServerPreferences(preferences) {
  const ui = preferences?.ui
  if (isDirty()) { push(); return }
  if (!ui || typeof ui !== 'object') return
  hydrating = true
  try {
    const patch = {}
    for (const k of SYNCED_KEYS) if (ui[k] !== undefined) patch[k] = ui[k]
    usePreferencesStore.setState(patch)
    if (ui.theme) useThemeStore.getState().setTheme(ui.theme)
    if (ui.accent) useThemeStore.getState().setAccent(ui.accent)
  } finally {
    hydrating = false
  }
}

// À la déconnexion : envoyer ce qui reste en attente, puis ne rien reporter sur le compte suivant
export async function flushPendingPreferences() {
  clearTimeout(timer)
  if (isDirty()) await push()
  setDirty(false)
}

export function startPreferencesSync() {
  if (started) return
  started = true
  usePreferencesStore.subscribe(schedulePush)
  useThemeStore.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.accent !== prev.accent) schedulePush()
  })
}

// Préférences de notifications (respectées côté serveur par notify())
export async function saveNotificationPreferences(notifications) {
  const { data } = await api.patch('/users/me/preferences', { notifications })
  return data
}
