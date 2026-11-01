import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// Injected by main.jsx after both modules are initialized — breaks circular dep
let store

export const injectStore = (_store) => {
  store = _store
  scheduleRefresh(store.getState().accessToken)
  store.subscribe((state, prev) => {
    if (state.accessToken !== prev.accessToken) scheduleRefresh(state.accessToken)
  })
}

// Injecter le token dans chaque requête
api.interceptors.request.use((config) => {
  const token = store?.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Renouvellement du token d'accès (15 min) ─────────────────────────────────
// Une seule requête /refresh à la fois : le refresh token change à chaque appel,
// deux appels simultanés avec l'ancien cookie déconnecteraient l'utilisateur.
let refreshPromise = null

export function refreshAccessToken() {
  if (!refreshPromise) {
    const attempt = () => axios.post('/api/auth/refresh', {}, { withCredentials: true })
    refreshPromise = attempt()
      // Un autre onglet a pu renouveler le cookie au même instant : un second essai suffit
      .catch((err) => (err.response?.status === 401
        ? new Promise((resolve) => setTimeout(resolve, 600)).then(attempt)
        : Promise.reject(err)))
      .then(({ data }) => {
        store?.getState().setAccessToken(data.accessToken)
        return data.accessToken
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000
  } catch {
    return 0
  }
}

// Le token voyage aussi dans l'URL des images et vidéos (<img>/<video> n'envoient pas
// d'en-tête) : il est renouvelé une minute avant expiration, pas seulement après un 401,
// sinon la visionneuse n'affiche plus rien après 15 minutes d'inactivité.
let refreshTimer = null
function scheduleRefresh(token) {
  clearTimeout(refreshTimer)
  if (!token) return
  const delay = Math.max(tokenExpiry(token) - Date.now() - 60_000, 0)
  refreshTimer = setTimeout(() => refreshAccessToken().catch(() => {}), delay)
}

// Les minuteurs sont ralentis dans un onglet en arrière-plan : vérifier au retour
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const token = store?.getState().accessToken
    if (document.visibilityState === 'visible' && token && tokenExpiry(token) - Date.now() < 60_000) {
      refreshAccessToken().catch(() => {})
    }
  })
}

// Un 401 sur ces routes est une vraie erreur (mauvais mot de passe, code TOTP…) :
// tenter un refresh puis rediriger masquerait le message à l'utilisateur
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/setup', '/auth/register', '/auth/reset-password', '/auth/forgot-password', '/auth/otp', '/auth/totp']

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const skipRefresh = !original || NO_REFRESH_URLS.some((u) => original.url?.startsWith(u))
    if (error.response?.status !== 401 || skipRefresh || original._retry) return Promise.reject(error)

    original._retry = true
    try {
      const token = await refreshAccessToken()
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch {
      store?.getState().logout()
      window.location.href = '/login'
      // Toujours rejeter : sinon l'appelant reçoit `undefined` comme réponse
      return Promise.reject(error)
    }
  }
)

export default api

// Message d'erreur lisible renvoyé par l'API
export const apiError = (err, fallback = 'Une erreur est survenue') =>
  err?.response?.data?.error || fallback
