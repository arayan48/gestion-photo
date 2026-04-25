import { create } from 'zustand'

// Map pour gérer plusieurs confirms en parallèle sans race condition
const _resolvers = new Map()
let _nextId = 0

export const useConfirmStore = create((set, get) => ({
  open: false,
  title: 'Confirmer',
  message: '',
  confirmLabel: 'Confirmer',
  danger: false,
  _id: null,

  show(message, opts = {}) {
    // Si un confirm est déjà ouvert, le fermer proprement (réponse "non")
    const current = get()
    if (current._id !== null && _resolvers.has(current._id)) {
      _resolvers.get(current._id)(false)
      _resolvers.delete(current._id)
    }

    const id = ++_nextId
    set({
      open: true,
      message,
      title: opts.title ?? 'Confirmer',
      confirmLabel: opts.confirmLabel ?? 'Confirmer',
      danger: opts.danger ?? false,
      _id: id,
    })

    return new Promise((resolve) => {
      _resolvers.set(id, resolve)
    })
  },

  close(result) {
    const id = get()._id
    set({ open: false, _id: null })
    if (id !== null && _resolvers.has(id)) {
      _resolvers.get(id)(result)
      _resolvers.delete(id)
    }
  },
}))

export const confirm = (message, opts) => useConfirmStore.getState().show(message, opts)
