import { Bell, Search, Sun, Moon, User, Settings, LogOut, ChevronDown } from 'lucide-react'
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
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore()
  const { resolvedTheme, toggle: toggleTheme } = useThemeStore()
  const navigate = useNavigate()

  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const notifRef = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

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

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0 dark:bg-gray-900 dark:border-gray-800">

      {/* Recherche */}
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 w-72 transition-colors dark:bg-gray-800">
        <Search size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
        <input
          placeholder="Rechercher un fichier..."
          className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full dark:text-gray-300 dark:placeholder:text-gray-500"
        />
      </div>

      <div className="flex items-center gap-1">

        {/* Toggle thème */}
        <button
          onClick={toggleTheme}
          title={resolvedTheme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Cloche notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif((v) => !v)}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-violet-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-slate-800 dark:text-gray-200">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                    Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800">
                {notifications.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-gray-500 text-sm py-10">Aucune notification</p>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors flex items-start gap-2 ${!n.is_read ? 'bg-violet-50/50 dark:bg-violet-900/10' : ''}`}
                    >
                      {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
                      <div className={!n.is_read ? '' : 'pl-4'}>
                        <p className="text-sm text-slate-700 dark:text-gray-300 text-left">{n.message}</p>
                        <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { locale: fr, addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Séparateur */}
        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 mx-1" />

        {/* Menu utilisateur */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUser((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            {user?.avatar_path || user?.discord_avatar ? (
              <img
                src={user.avatar_path || user.discord_avatar}
                alt={user.pseudo}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-violet-500/20"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-violet-500/20">
                {user?.pseudo?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm text-slate-700 dark:text-gray-300 font-medium">{user?.pseudo}</span>
            <ChevronDown
              size={13}
              className={`text-slate-400 dark:text-gray-500 transition-transform duration-200 ${showUser ? 'rotate-180' : ''}`}
            />
          </button>

          {showUser && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
              {/* En-tête utilisateur */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-gray-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{user?.pseudo}</p>
                <p className="text-xs text-slate-500 dark:text-gray-500 truncate mt-0.5">{user?.email}</p>
              </div>

              {/* Actions */}
              <div className="p-1.5 space-y-0.5">
                <Link
                  to="/profile"
                  onClick={() => setShowUser(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <User size={14} className="text-slate-400 dark:text-gray-500" />
                  Mon profil
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setShowUser(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Settings size={14} className="text-slate-400 dark:text-gray-500" />
                  Paramètres
                </Link>
              </div>

              <div className="p-1.5 border-t border-slate-100 dark:border-gray-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
