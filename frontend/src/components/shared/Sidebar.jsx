import { Link, useLocation } from 'react-router-dom'
import { FolderOpen, Clock, Heart, Trash2, Globe, LayoutDashboard, Settings } from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store.js'

const navItems = [
  { view: null,        to: '/explorer',                icon: FolderOpen, label: 'Mon espace' },
  { view: 'others',   to: '/explorer?view=others',    icon: Globe,      label: 'Espace commun' },
  { view: 'recent',   to: '/explorer?view=recent',    icon: Clock,      label: 'Récents' },
  { view: 'favorites',to: '/explorer?view=favorites', icon: Heart,      label: 'Favoris' },
  { view: 'trash',    to: '/explorer?view=trash',     icon: Trash2,     label: 'Corbeille' },
]

export default function Sidebar() {
  const { user } = useAuthStore()
  const { pathname, search } = useLocation()
  const currentView = new URLSearchParams(search).get('view')

  const isNavActive = ({ view }) => {
    if (pathname !== '/explorer') return false
    return view === null ? !currentView : currentView === view
  }

  const isDashActive = pathname === '/dashboard'

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col py-4 shrink-0 dark:bg-gray-900 dark:border-gray-800">
      {/* Logo */}
      <div className="px-5 mb-6">
        <span className="text-violet-600 font-bold text-xl tracking-tight dark:text-violet-400">
          WubalStore
        </span>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-600">
          Navigation
        </p>
        {navItems.map(({ to, view, icon: Icon, label }) => {
          const active = isNavActive({ view })
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 1.75} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Section bas */}
      <div className="px-3 pt-3 mt-2 border-t border-slate-100 dark:border-gray-800 space-y-0.5">
        {(user?.isSuperAdmin || user?.roleId) && (
          <>
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-600">
              Admin
            </p>
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isDashActive
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
              }`}
            >
              <LayoutDashboard size={15} strokeWidth={isDashActive ? 2.5 : 1.75} />
              Dashboard
            </Link>
          </>
        )}
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            pathname === '/settings'
              ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }`}
        >
          <Settings size={15} strokeWidth={pathname === '/settings' ? 2.5 : 1.75} />
          Paramètres
        </Link>
      </div>
    </aside>
  )
}
