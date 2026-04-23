import { create } from 'zustand'

let _resolve = null

export const useConfirmStore = create((set) => ({
  open: false,
  title: 'Confirmer',
  message: '',
  confirmLabel: 'Confirmer',
  danger: false,

  show(message, opts = {}) {
    set({
      open: true,
      message,
      title: opts.title || 'Confirmer',
      confirmLabel: opts.confirmLabel || 'Confirmer',
      danger: opts.danger ?? false,
    })
    return new Promise((resolve) => { _resolve = resolve })
  },

  close(result) {
    set({ open: false })
    _resolve?.(result)
    _resolve = null
  },
}))

export const confirm = (message, opts) => useConfirmStore.getState().show(message, opts)
