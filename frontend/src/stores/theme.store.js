import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Teintes inspirées du labo photo ; « inactinique » = la lampe rouge de la chambre noire
export const ACCENTS = [
  { value: 'safelight', label: 'Inactinique', hex: '#d63a0d' },
  { value: 'amber', label: 'Sodium', hex: '#ca7604' },
  { value: 'silver', label: 'Argentique', hex: '#78716c' },
  { value: 'cyan', label: 'Cyanotype', hex: '#0891b2' },
  { value: 'green', label: 'Minuterie', hex: '#16a34a' },
  { value: 'violet', label: 'Violet', hex: '#7c3aed' },
]
const DEFAULT_ACCENT = 'safelight'
const validAccent = (a) => (ACCENTS.some((x) => x.value === a) ? a : DEFAULT_ACCENT)

const getSystemPreference = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const applyTheme = (resolved) => {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b0a09' : '#f1eee8')
}

const applyAccent = (accent) => {
  document.documentElement.dataset.accent = accent
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // thème sombre par défaut (modifiable dans Paramètres → Apparence)
      resolvedTheme: 'dark',
      accent: DEFAULT_ACCENT,

      init() {
        const { theme } = get()
        // Anciennes teintes (V2 : bleu, émeraude, rose…) ramenées à la teinte par défaut
        const accent = validAccent(get().accent)
        const resolved = theme === 'system' ? getSystemPreference() : theme
        applyTheme(resolved)
        applyAccent(accent)
        set({ resolvedTheme: resolved, accent })

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
