import { Link, useLocation } from 'react-router-dom'
import { FolderOpen, Clock, Heart, Trash2, Globe, LayoutDashboard, Wrench, HardDrive } from 'lucide-react'
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

  // Liens admin selon les permissions renvoyées par /auth/me (le backend reste la vraie barrière)
  const permissions = user?.permissions || []
  const hasAdminPermission = permissions.some((p) => !p.startsWith('files.'))
  const adminLinks = [
    { to: '/dashboard',      Icon: LayoutDashboard, label: 'Dashboard',     show: user?.is_super_admin || hasAdminPermission },
    { to: '/admin/settings', Icon: Wrench,          label: 'Configuration', show: user?.is_super_admin || permissions.includes('system.manage_config') },
  ].filter((l) => l.show)
  const isAdmin = adminLinks.length > 0

  const used  = user?.storage_used  ?? 0
  const quota = user?.storage_quota ?? 1
  const pct   = Math.min(100, Math.round((used / quota) * 100))
  const quotaColor    = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-violet-500'
  const quotaTextColor = pct >= 90 ? 'text-red-500' : 'text-slate-500 dark:text-gray-500'

  return (
    <aside className="w-56 bg-white dark:bg-gray-950 border-r border-slate-200 dark:border-gray-800/80 flex flex-col py-4 shrink-0">
      {/* Logo */}
      <div className="px-5 mb-7">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0">
            <HardDrive size={14} className="text-white" />
          </div>
          <span className="text-violet-600 dark:text-violet-400 font-bold text-lg tracking-tight">
            WubalStore
          </span>
        </div>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-600">
          Navigation
        </p>

        {navItems.map(({ to, view, icon: Icon, label }) => {
          const active = isNavActive({ view })
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/25'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/70 hover:text-slate-900 dark:hover:text-gray-100'
              }`}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2.5 : 1.75}
                className={active ? 'text-white' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-600 dark:group-hover:text-gray-300 transition-colors'}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Section admin */}
      {isAdmin && (
        <div className="px-3 pt-3 mt-1 border-t border-slate-100 dark:border-gray-800 space-y-0.5">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-600">
            Admin
          </p>
          {adminLinks.map(({ to, Icon, label }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  active
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/25'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/70 hover:text-slate-900 dark:hover:text-gray-100'
                }`}
              >
                <Icon
                  size={15}
                  strokeWidth={active ? 2.5 : 1.75}
                  className={active ? 'text-white' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-600 dark:group-hover:text-gray-300 transition-colors'}
                />
                {label}
              </Link>
            )
          })}
        </div>
      )}

      {/* Quota stockage */}
      <div className="px-4 pt-4 mt-2 border-t border-slate-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-500 flex items-center gap-1">
            <HardDrive size={11} /> Stockage
          </span>
          <span className={`text-[11px] font-bold ${quotaTextColor}`}>{pct}%</span>
        </div>

        {/* Barre de quota */}
        <div className="h-1.5 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${quotaColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <p className={`text-[10px] ${quotaTextColor}`}>{formatBytes(used)}</p>
          <p className="text-[10px] text-slate-400 dark:text-gray-600">{formatBytes(quota)}</p>
        </div>

        <p className="text-[9px] text-slate-300 dark:text-gray-700 mt-3 text-center">
          by{' '}
          <a
            href="https://arayan.fr"
            target="_blank"
            rel="noreferrer"
            className="hover:text-violet-400 transition-colors cursor-pointer"
          >
            arayan.fr
          </a>
          {' '}© {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  )
}
