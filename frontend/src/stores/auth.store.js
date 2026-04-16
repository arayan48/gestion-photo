import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
        try { await api.post('/auth/logout') } catch {}
        set({ user: null, accessToken: null })
      },

      fetchMe: async () => {
        const { data } = await api.get('/auth/me')
        set({ user: data })
        return data
      },
    }),
    {
      name: 'wubalstore-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
)
