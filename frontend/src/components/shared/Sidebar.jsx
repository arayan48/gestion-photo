import { Link, useLocation } from 'react-router-dom'
import { FolderOpen, Clock, Heart, Trash2, Globe, LayoutDashboard, Wrench } from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store.js'

const navItems = [
  { view: null,         to: '/explorer',                icon: FolderOpen, label: 'Mon espace' },
  { view: 'others',    to: '/explorer?view=others',    icon: Globe,      label: 'Espace commun' },
  { view: 'recent',    to: '/explorer?view=recent',    icon: Clock,      label: 'Récents' },
  { view: 'favorites', to: '/explorer?view=favorites', icon: Heart,      label: 'Favoris' },
  { view: 'trash',     to: '/explorer?view=trash',     icon: Trash2,     label: 'Corbeille' },
]

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`
}

export default function Sidebar() {
  const { user } = useAuthStore()
  const { pathname, search } = useLocation()
  const currentView = new URLSearchParams(search).get('view')

  const isNavActive = ({ view }) => {
    if (pathname !== '/explorer') return false
    return view === null ? !currentView : currentView === view
  }

  const isAdmin = user?.is_super_admin || user?.role_id

  const linkClass = (to) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
      pathname === to
        ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
    }`

  // Quota
  const used = user?.storage_used ?? 0
  const quota = user?.storage_quota ?? 1
  const pct = Math.min(100, Math.round((used / quota) * 100))
  const quotaColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-violet-500'

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

      {/* Section admin */}
      {isAdmin && (
        <div className="px-3 pt-3 mt-2 border-t border-slate-100 dark:border-gray-800 space-y-0.5">
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-600">
            Admin
          </p>
          <Link to="/dashboard" className={linkClass('/dashboard')}>
            <LayoutDashboard size={15} strokeWidth={pathname === '/dashboard' ? 2.5 : 1.75} />
            Dashboard
          </Link>
          <Link to="/admin/settings" className={linkClass('/admin/settings')}>
            <Wrench size={15} strokeWidth={pathname === '/admin/settings' ? 2.5 : 1.75} />
            Configuration
          </Link>
        </div>
      )}

      {/* Quota stockage + copyright */}
      <div className="px-4 pt-3 mt-2 border-t border-slate-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-gray-500">Stockage</span>
          <span className={`text-xs font-semibold ${pct >= 90 ? 'text-red-500' : 'text-slate-500 dark:text-gray-500'}`}>
            {pct}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${quotaColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 dark:text-gray-600 mt-1.5">
          {formatBytes(used)} / {formatBytes(quota)}
        </p>
        <p className="text-[9px] text-slate-300 dark:text-gray-700 mt-3 text-center">
          by <a href="https://arayan.fr" target="_blank" rel="noreferrer" className="hover:text-violet-400 transition-colors">arayan.fr</a>
          {' '}© {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  )
}
