import { create } from 'zustand'

let _id = 0

export const useToastStore = create((set, get) => ({
  toasts: [],

  add(message, type = 'info', duration = 4000) {
    const id = ++_id
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    if (duration > 0) setTimeout(() => get().remove(id), duration)
    return id
  },

  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export const toast = {
  success: (msg, d) => useToastStore.getState().add(msg, 'success', d),
  error:   (msg, d) => useToastStore.getState().add(msg, 'error',   d ?? 6000),
  warn:    (msg, d) => useToastStore.getState().add(msg, 'warn',    d),
  info:    (msg, d) => useToastStore.getState().add(msg, 'info',    d),
}
