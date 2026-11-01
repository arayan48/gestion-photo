import { create } from 'zustand'

// État d'interface global (hors préférences persistées)
export const useUiStore = create((set) => ({
  commandOpen: false,
  shortcutsOpen: false,
  mobileNavOpen: false,
  createSheetOpen: false,
  // Dossier courant de l'explorateur : destination des uploads et des nouveaux dossiers
  currentFolder: { id: null, name: 'Mon espace', writable: true },
  // Fichiers en attente de préparation (fenêtre d'upload)
  pendingUpload: null, // { files: File[], folderId, folderName }
  moveDialog: null,    // { items: [{ kind: 'file' | 'folder', ... }] }
  folderDelete: null,  // { folders, stats: { fileCount, folderCount } }
  folderShare: null,   // dossier dont on gère le partage

  setCommandOpen: (v) => set({ commandOpen: v }),
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
  setCreateSheetOpen: (v) => set({ createSheetOpen: v }),
  setCurrentFolder: (f) => set({ currentFolder: f }),
  setPendingUpload: (p) => set({ pendingUpload: p }),
}))
