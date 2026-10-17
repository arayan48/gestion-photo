import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import api from '../utils/api.js'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      setAccessToken: (token) => set({ accessToken: token }),

      login: async ({ email, password, totp, browserFingerprint }) => {
        const { data } = await api.post('/auth/login', { email, password, totp, browserFingerprint })
        if (data.requireTotp) return { requireTotp: true }
        set({ user: data.user, accessToken: data.accessToken })
        return { success: true }
      },

      logout: async () => {
        set({ user: null, accessToken: null })
        try { await api.post('/auth/logout') } catch {}
      },

      fetchMe: async () => {
        const { data } = await api.get('/auth/me')
        set({ user: data })
        return data
      },

      // Restaure la session depuis le cookie httpOnly refresh_token sans passer par /auth/me sans token
      // (évite le 401 console noise au rechargement de page)
      initAuth: async () => {
        if (get().accessToken) return true
        try {
          const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
          set({ accessToken: data.accessToken })
          await get().fetchMe()
          return true
        } catch {
          set({ user: null, accessToken: null })
          return false
        }
      },
    }),
    {
      name: 'obscura-auth',
      // Persister le token évite un flash de redirection au rechargement
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
)
