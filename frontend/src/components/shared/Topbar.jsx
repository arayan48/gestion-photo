import { Bell, Search } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth.store.js'
import { useNotificationStore } from '../../stores/notification.store.js'
import api from '../../utils/api.js'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Topbar() {
  const { user } = useAuthStore()
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore()
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleMarkRead = async (id) => {
    await api.post(`/admin/notifications/${id}/read`)
    markRead(id)
  }

  const handleMarkAllRead = async () => {
    await api.post('/admin/notifications/read-all')
    markAllRead()
  }

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 w-72">
        <Search size={14} className="text-gray-500" />
        <input
          placeholder="Rechercher un fichier..."
          className="bg-transparent text-sm text-gray-300 placeholder:text-gray-500 outline-none w-full"
        />
      </div>

      <div className="flex items-center gap-4">
        {/* Cloche notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif((v) => !v)}
            className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-100"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-violet-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-semibold text-gray-200">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-violet-400 hover:text-violet-300">
                    Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-8">Aucune notification</p>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors ${!n.is_read ? 'bg-gray-800/50' : ''}`}
                    >
                      <p className="text-sm text-gray-300">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { locale: fr, addSuffix: true })}
                      </p>
                      {!n.is_read && <span className="inline-block w-2 h-2 rounded-full bg-violet-500 mt-1" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Utilisateur */}
        <div className="flex items-center gap-2">
          {user?.avatar_path || user?.discord_avatar ? (
            <img
              src={user.avatar_path || user.discord_avatar}
              alt={user.pseudo}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.pseudo?.[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-sm text-gray-300 font-medium">{user?.pseudo}</span>
        </div>
      </div>
    </header>
  )
}
