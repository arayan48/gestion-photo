import { Bell, Search, Sun, Moon, Settings, LogOut, ChevronDown, Trash2, CheckCheck } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store.js'
import { useNotificationStore } from '../../stores/notification.store.js'
import { useThemeStore } from '../../stores/theme.store.js'
import api from '../../utils/api.js'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Topbar() {
  const { user, logout } = useAuthStore()
  const { notifications, unreadCount, markRead, markAllRead, remove: removeNotif, clearAll } = useNotificationStore()
  const { resolvedTheme, toggle: toggleTheme } = useThemeStore()
  const navigate = useNavigate()

  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const notifRef = useRef(null)
  const userRef  = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
      if (userRef.current  && !userRef.current.contains(e.target))  setShowUser(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => { setAvatarError(false) }, [user?.avatar_path, user?.discord_avatar])

  const handleLogout = async () => {
    setShowUser(false)
    await logout()
    navigate('/login')
  }

  const handleMarkRead = async (id) => {
    await api.post(`/admin/notifications/${id}/read`)
    markRead(id)
  }

  const handleMarkAllRead = async () => {
    await api.post('/admin/notifications/read-all')
    markAllRead()
  }

  const handleDeleteNotif = async (id) => {
    await api.delete(`/admin/notifications/${id}`).catch(() => {})
    removeNotif(id)
  }

  const handleClearAll = async () => {
    await api.delete('/admin/notifications').catch(() => {})
    clearAll()
  }

  const avatarSrc = (user?.avatar_path || user?.discord_avatar) && !avatarError
    ? (user.avatar_path || user.discord_avatar)
    : null

  return (
    <header className="h-14 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-gray-800/80 flex items-center justify-between px-5 shrink-0 sticky top-0 z-30">

      {/* Recherche */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 rounded-xl px-3 py-2 w-72 ring-1 ring-transparent focus-within:ring-violet-500/40 focus-within:bg-white dark:focus-within:bg-gray-800 transition-all duration-200">
        <Search size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
        <input
          placeholder="Rechercher un fichier..."
          className="bg-transparent text-sm text-slate-700 dark:text-gray-300 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none w-full"
          aria-label="Rechercher"
        />
      </div>

      <div className="flex items-center gap-1">

        {/* Toggle thème */}
        <button
          onClick={toggleTheme}
          title={resolvedTheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          aria-label={resolvedTheme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="p-2 rounded-lg text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-gray-100 transition-all duration-150 cursor-pointer"
        >
          {resolvedTheme === 'dark'
            ? <Sun size={17} />
            : <Moon size={17} />
          }
        </button>

        {/* Cloche notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif((v) => !v)}
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-gray-100 transition-all duration-150 cursor-pointer"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-violet-600 text-white text-[9px] rounded-full min-w-[16px] h-4 flex items-center justify-center font-bold leading-none px-0.5 shadow-sm shadow-violet-500/40 animate-in zoom-in-50 duration-200">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl shadow-black/20 z-50 overflow-hidden" style={{ width: 340 }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30">
                <span className="text-sm font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] rounded-full font-bold">
                      {unreadCount}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      title="Tout marquer comme lu"
                      className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors cursor-pointer"
                    >
                      <CheckCheck size={12} /> Tout lire
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      title="Tout supprimer"
                      className="text-xs text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Vider
                    </button>
                  )}
                </div>
              </div>

              {/* Liste */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <Bell size={24} className="text-slate-200 dark:text-gray-700" />
                    <p className="text-sm text-slate-400 dark:text-gray-600">Aucune notification</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-2.5 px-4 py-3 group transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/50 ${
                        !n.is_read ? 'bg-violet-50/40 dark:bg-violet-900/10' : ''
                      }`}
                    >
                      {!n.is_read && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                      )}
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className={`flex-1 text-left cursor-pointer ${!n.is_read ? '' : 'pl-4'}`}
                      >
                        <p className="text-sm text-slate-700 dark:text-gray-300 leading-snug">{n.message}</p>
                        <p className="text-[11px] text-slate-400 dark:text-gray-600 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { locale: fr, addSuffix: true })}
                        </p>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteNotif(n.id) }}
                        aria-label="Supprimer la notification"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-gray-600 dark:hover:text-red-400 transition-all duration-150 cursor-pointer shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700/80 mx-1" />

        {/* Menu utilisateur */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUser((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-150 cursor-pointer"
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={user?.pseudo}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-violet-500/30"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-violet-500/20 shadow-sm">
                {user?.pseudo?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm text-slate-700 dark:text-gray-300 font-medium hidden sm:block">{user?.pseudo}</span>
            <ChevronDown
              size={13}
              className={`text-slate-400 dark:text-gray-500 transition-transform duration-200 ${showUser ? 'rotate-180' : ''}`}
            />
          </button>

          {showUser && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl shadow-black/20 z-50 overflow-hidden">
              {/* En-tête */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={user?.pseudo} className="w-8 h-8 rounded-full object-cover ring-2 ring-violet-500/20" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {user?.pseudo?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{user?.pseudo}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-500 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="p-1.5">
                <Link
                  to="/settings"
                  onClick={() => setShowUser(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors duration-150 cursor-pointer"
                >
                  <Settings size={14} className="text-slate-400 dark:text-gray-500" />
                  Paramètres
                </Link>
              </div>

              <div className="p-1.5 border-t border-slate-100 dark:border-gray-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 cursor-pointer"
                >
                  <LogOut size={14} />
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
