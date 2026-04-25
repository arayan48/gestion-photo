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

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
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
      } catch {
        refreshQueue.forEach((p) => p.reject())
        refreshQueue = []
        store?.getState().logout()
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
