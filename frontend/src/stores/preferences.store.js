import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const usePreferencesStore = create(
  persist(
    (set) => ({
      // Explorer
      viewMode: 'grid',          // 'grid' | 'list'
      defaultQuality: 'original', // preset upload par défaut

      setViewMode:      (v) => set({ viewMode: v }),
      setDefaultQuality:(v) => set({ defaultQuality: v }),
    }),
    {
      name: 'obscura-prefs',
    }
  )
)
