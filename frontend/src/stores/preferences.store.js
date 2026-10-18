import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Tailles de vignettes de la grille (largeur minimale d'une colonne, en px)
export const GRID_SIZES = [112, 140, 172, 212, 264, 330]

export const DEFAULT_PREFERENCES = {
  viewMode: 'grid',           // 'grid' | 'list'
  gridSize: 2,                // index dans GRID_SIZES
  groupByDate: true,          // regrouper les fichiers par date (tri par date)
  sortBy: 'created_at',       // 'created_at' | 'original_name' | 'size'
  sortDir: 'desc',
  defaultQuality: 'original', // préréglage d'upload par défaut
  askQuality: true,           // afficher la fenêtre de préparation avant l'envoi
  clickToOpen: false,         // simple clic = ouvrir (sinon simple clic = sélectionner)
  showNames: true,            // noms sous les vignettes
  reduceMotion: false,
  sidebarCollapsed: false,
}

export const SYNCED_KEYS = Object.keys(DEFAULT_PREFERENCES)

export const usePreferencesStore = create(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      set: (patch) => set(patch),
      setViewMode: (v) => set({ viewMode: v }),
      setDefaultQuality: (v) => set({ defaultQuality: v }),
      setGridSize: (v) => set({ gridSize: Math.max(0, Math.min(GRID_SIZES.length - 1, v)) }),
      setSort: (sortBy, sortDir) => set({ sortBy, sortDir }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'obscura-prefs', version: 2 }
  )
)
