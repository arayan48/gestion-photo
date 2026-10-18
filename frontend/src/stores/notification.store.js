import { create } from 'zustand'
import { toast } from './toast.store.js'

// Connexion WebSocket avec reconnexion progressive (1 s → 30 s)
let retryTimer = null
let retryDelay = 1000
let getToken = () => null

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  ws: null,
  connected: false,

  connect: (tokenGetter) => {
    getToken = tokenGetter
    get().disconnect()
    const open = () => {
      const token = getToken()
      if (!token) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`)

      ws.onopen = () => {
        retryDelay = 1000
        set({ connected: true })
      }

      ws.onmessage = (event) => {
        let data
        try { data = JSON.parse(event.data) } catch { return }
        if (data.type === 'notification' && data.notification) {
          set((state) => ({
            notifications: [data.notification, ...state.notifications].slice(0, 100),
            unreadCount: state.unreadCount + 1,
          }))
          // Les fins d'upload sont déjà signalées par le gestionnaire d'envoi
          if (data.notification.type !== 'upload_done') toast.message(data.notification.message)
        }
      }

      ws.onclose = () => {
        set({ connected: false })
        if (get().ws !== ws) return // fermeture volontaire
        clearTimeout(retryTimer)
        retryTimer = setTimeout(open, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30_000)
      }

      set({ ws })
    }
    open()
  },

  disconnect: () => {
    clearTimeout(retryTimer)
    const ws = get().ws
    set({ ws: null, connected: false })
    ws?.close()
  },

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
  }),

  markRead: (id) => set((state) => {
    const target = state.notifications.find((n) => n.id === id)
    return {
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: target && !target.is_read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }
  }),

  markAllRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
    unreadCount: 0,
  })),

  remove: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
    unreadCount: Math.max(0, state.unreadCount - (state.notifications.find((n) => n.id === id && !n.is_read) ? 1 : 0)),
  })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))
