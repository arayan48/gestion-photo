import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const getSystemPreference = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const applyTheme = (resolved) => {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: 'dark',

      init() {
        const { theme } = get()
        const resolved = theme === 'system' ? getSystemPreference() : theme
        applyTheme(resolved)
        set({ resolvedTheme: resolved })

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (get().theme === 'system') {
            const r = e.matches ? 'dark' : 'light'
            applyTheme(r)
            set({ resolvedTheme: r })
          }
        })
      },

      toggle() {
        const next = get().resolvedTheme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next, resolvedTheme: next })
      },

      setTheme(theme) {
        const resolved = theme === 'system' ? getSystemPreference() : theme
        applyTheme(resolved)
        set({ theme, resolvedTheme: resolved })
      },
    }),
    {
      name: 'wubal-theme',
      partialize: (s) => ({ theme: s.theme }),
    }
  )
)
