import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// Injected by main.jsx after both modules are initialized — breaks circular dep
let store

export const injectStore = (_store) => { store = _store }

// Injecter le token dans chaque requête
api.interceptors.request.use((config) => {
  const token = store?.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh token automatique si 401
let isRefreshing = false
let refreshQueue = []

// Un 401 sur ces routes est une vraie erreur (mauvais mot de passe, code TOTP…) :
// tenter un refresh puis rediriger masquerait le message à l'utilisateur
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/setup', '/auth/register', '/auth/reset-password', '/auth/forgot-password', '/auth/otp']

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const skipRefresh = !original || NO_REFRESH_URLS.some((u) => original.url?.startsWith(u))
    if (error.response?.status === 401 && !skipRefresh && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        const newToken = data.accessToken
        store?.getState().setAccessToken(newToken)
        refreshQueue.forEach((p) => p.resolve(newToken))
        refreshQueue = []
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        refreshQueue.forEach((p) => p.reject(refreshError))
        refreshQueue = []
        store?.getState().logout()
        window.location.href = '/login'
        // Toujours rejeter : sinon l'appelant reçoit `undefined` comme réponse
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
