import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const ACCENTS = [
  { value: 'violet', label: 'Violet', hex: '#7c3aed' },
  { value: 'blue', label: 'Bleu', hex: '#2563eb' },
  { value: 'cyan', label: 'Cyan', hex: '#0891b2' },
  { value: 'emerald', label: 'Émeraude', hex: '#059669' },
  { value: 'amber', label: 'Ambre', hex: '#d97706' },
  { value: 'rose', label: 'Rose', hex: '#e11d48' },
]

const getSystemPreference = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const applyTheme = (resolved) => {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#09090b' : '#f5f5f7')
}

const applyAccent = (accent) => {
  document.documentElement.dataset.accent = accent
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // thème sombre par défaut (modifiable dans Paramètres → Apparence)
      resolvedTheme: 'dark',
      accent: 'violet',

      init() {
        const { theme, accent } = get()
        const resolved = theme === 'system' ? getSystemPreference() : theme
        applyTheme(resolved)
        applyAccent(accent)
        set({ resolvedTheme: resolved })

        window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
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

      setAccent(accent) {
        if (!ACCENTS.some((a) => a.value === accent)) return
        applyAccent(accent)
        set({ accent })
      },
    }),
    {
      name: 'obscura-theme',
      partialize: (s) => ({ theme: s.theme, accent: s.accent }),
    }
  )
)
