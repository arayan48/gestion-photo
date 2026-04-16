import { NavLink, useNavigate } from 'react-router-dom'
import {
  FolderOpen, Clock, Heart, Trash2, Globe, LayoutDashboard, User, LogOut,
} from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store.js'

const navItems = [
  { to: '/explorer', icon: FolderOpen, label: 'Mon espace' },
  { to: '/explorer?view=others', icon: Globe, label: 'Espace commun' },
  { to: '/explorer?view=recent', icon: Clock, label: 'Récents' },
  { to: '/explorer?view=favorites', icon: Heart, label: 'Favoris' },
  { to: '/explorer?view=trash', icon: Trash2, label: 'Corbeille' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col py-4 shrink-0">
      <div className="px-4 mb-6">
        <h1 className="text-violet-400 font-bold text-xl tracking-tight">WubalStore</h1>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 pt-2 border-t border-gray-800 space-y-1">
        {(user?.isSuperAdmin || user?.roleId) && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-violet-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`
            }
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
        )}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-violet-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
            }`
          }
        >
          <User size={16} />
          Profil
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors w-full"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
