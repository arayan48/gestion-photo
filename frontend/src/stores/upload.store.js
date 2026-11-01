import { create } from 'zustand'
import api from '../utils/api.js'
import { invalidateFiles } from '../lib/queryClient.js'
import { useAuthStore } from './auth.store.js'
import { toast } from './toast.store.js'

// Gestionnaire d'envoi global : file d'attente, 3 envois parallèles, annulation,
// nouvelle tentative automatique si le serveur limite le débit (429 / 503)
const CONCURRENCY = 3
const MAX_RETRIES = 3
const controllers = new Map()
let nextId = 0

const isImageFile = (file) => file.type.startsWith('image/') && file.type !== 'image/svg+xml'

// Rafraîchissements regroupés : un upload de 50 fichiers ne relance pas 50 requêtes
let refreshTimer = null
function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    invalidateFiles()
    useAuthStore.getState().fetchMe().catch(() => {})
  }, 600)
}

export const useUploadStore = create((set, get) => ({
  items: [],
  panelOpen: false,
  collapsed: false,

  setPanelOpen: (v) => set({ panelOpen: v }),
  setCollapsed: (v) => set({ collapsed: v }),

  enqueue(entries) {
    const items = entries.map(({ file, name, quality, folderId, folderName }) => ({
      id: ++nextId,
      file,
      name: name || file.name.replace(/\.[^.]+$/, ''),
      quality: quality || 'original',
      folderId: folderId || null,
      folderName: folderName || 'Mon espace',
      preview: isImageFile(file) ? URL.createObjectURL(file) : null,
      size: file.size,
      status: 'queued', // queued | uploading | processing | done | error | canceled
      progress: 0,
      error: null,
      retries: 0,
      result: null,
    }))
    set((s) => ({ items: [...s.items, ...items], panelOpen: true, collapsed: false }))
    get().pump()
  },

  update(id, patch) {
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  },

  pump() {
    const { items } = get()
    const running = items.filter((i) => i.status === 'uploading' || i.status === 'processing').length
    const slots = CONCURRENCY - running
    if (slots <= 0) return
    items.filter((i) => i.status === 'queued').slice(0, slots).forEach((item) => get().run(item.id))
  },

  async run(id) {
    const item = get().items.find((i) => i.id === id)
    if (!item || item.status !== 'queued') return
    const controller = new AbortController()
    controllers.set(id, controller)
    get().update(id, { status: 'uploading', progress: 0, error: null })

    const form = new FormData()
    form.append('name', item.name)
    form.append('qualityPreset', item.quality)
    if (item.folderId) form.append('folderId', item.folderId)
    form.append('file', item.file) // le fichier en dernier : les champs sont lus avant le flux

    try {
      const { data } = await api.post('/files/upload', form, {
        signal: controller.signal,
        onUploadProgress: (e) => {
          const progress = e.total ? Math.round((e.loaded / e.total) * 100) : 0
          // 100 % envoyé : le serveur traite encore (Sharp / FFmpeg)
          get().update(id, progress >= 100 ? { progress: 100, status: 'processing' } : { progress })
        },
      })
      get().update(id, { status: 'done', progress: 100, result: data })
      scheduleRefresh()
    } catch (err) {
      if (controller.signal.aborted) {
        get().update(id, { status: 'canceled' })
      } else {
        const status = err.response?.status
        const current = get().items.find((i) => i.id === id)
        if ((status === 429 || status === 503) && current && current.retries < MAX_RETRIES) {
          // Limite de débit : patienter puis remettre en file
          get().update(id, { status: 'queued', progress: 0, retries: current.retries + 1 })
          controllers.delete(id)
          setTimeout(() => get().pump(), 2000 * 2 ** current.retries)
          return
        }
        const message = typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : status === 413 ? 'Fichier trop volumineux' : 'Échec de l\'envoi'
        get().update(id, { status: 'error', error: message })
        if (status === 507) toast.error(message)
      }
    } finally {
      controllers.delete(id)
      get().pump()
      get().notifyIfFinished()
    }
  },

  notifyIfFinished() {
    const { items } = get()
    if (items.some((i) => ['queued', 'uploading', 'processing'].includes(i.status))) return
    const done = items.filter((i) => i.status === 'done' && !i.announced)
    if (!done.length) return
    set((s) => ({ items: s.items.map((i) => (i.status === 'done' ? { ...i, announced: true } : i)) }))
    const failed = items.filter((i) => i.status === 'error').length
    if (failed) toast.warn(`${done.length} envoyé(s), ${failed} en échec`)
    else toast.success(done.length > 1 ? `${done.length} fichiers envoyés` : `« ${done[0].name} » envoyé`)
  },

  cancel(id) {
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    if (item.status === 'queued') get().update(id, { status: 'canceled' })
    controllers.get(id)?.abort()
  },

  cancelAll() {
    get().items.forEach((i) => {
      if (['queued', 'uploading', 'processing'].includes(i.status)) get().cancel(i.id)
    })
  },

  retry(id) {
    get().update(id, { status: 'queued', progress: 0, error: null, retries: 0 })
    get().pump()
  },

  retryFailed() {
    get().items.filter((i) => i.status === 'error' || i.status === 'canceled').forEach((i) => get().retry(i.id))
  },

  clearFinished() {
    const { items } = get()
    items.filter((i) => ['done', 'error', 'canceled'].includes(i.status)).forEach((i) => i.preview && URL.revokeObjectURL(i.preview))
    const remaining = items.filter((i) => !['done', 'error', 'canceled'].includes(i.status))
    set({ items: remaining, panelOpen: remaining.length > 0 })
  },
}))

export const isUploading = () =>
  useUploadStore.getState().items.some((i) => ['queued', 'uploading', 'processing'].includes(i.status))

// Prévenir avant de quitter la page pendant un envoi
window.addEventListener('beforeunload', (e) => {
  if (isUploading()) {
    e.preventDefault()
    e.returnValue = ''
  }
})
