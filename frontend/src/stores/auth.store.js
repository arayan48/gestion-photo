import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import api from '../utils/api.js'
import { getBrowserFingerprint } from '../lib/fingerprint.js'
import { applyServerPreferences, flushPendingPreferences } from '../lib/prefsSync.js'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      setAccessToken: (token) => set({ accessToken: token }),

      login: async ({ email, password, totp }) => {
        const browserFingerprint = await getBrowserFingerprint()
        const { data } = await api.post('/auth/login', { email, password, totp: totp || undefined, browserFingerprint })
        if (data.requireTotp) return { requireTotp: true }
        set({ user: data.user, accessToken: data.accessToken })
        applyServerPreferences(data.user?.preferences)
        return { success: true }
      },

      logout: async () => {
        await flushPendingPreferences().catch(() => {})
        set({ user: null, accessToken: null })
        try { await api.post('/auth/logout') } catch {}
      },

      fetchMe: async () => {
        const { data } = await api.get('/auth/me')
        set({ user: data })
        return data
      },

      // Restaure la session depuis le cookie httpOnly refresh_token
      initAuth: async () => {
        if (get().accessToken) return true
        try {
          const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
          set({ accessToken: data.accessToken })
          const me = await get().fetchMe()
          applyServerPreferences(me?.preferences)
          return true
        } catch {
          set({ user: null, accessToken: null })
          return false
        }
      },

      hasPermission: (key) => {
        const u = get().user
        return !!u && (u.is_super_admin || (u.permissions || []).includes(key))
      },
    }),
    {
      name: 'obscura-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
)

// Hook pratique : const can = usePermission(); can('files.upload')
export function usePermission() {
  const user = useAuthStore((s) => s.user)
  return (key) => !!user && (user.is_super_admin || (user.permissions || []).includes(key))
}
