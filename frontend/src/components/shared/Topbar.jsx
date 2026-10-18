import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Search, Sun, Moon, Monitor, Settings, LogOut, Trash2, CheckCheck, Menu, Upload, Keyboard,
  User, Palette, BellOff, HardDrive, ShieldAlert, CloudUpload, UserPlus, Database, FileX,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import api from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatRelative } from '../../lib/format.js'
import { useAuthStore, usePermission } from '../../stores/auth.store.js'
import { useNotificationStore } from '../../stores/notification.store.js'
import { useThemeStore } from '../../stores/theme.store.js'
import { useUiStore } from '../../stores/ui.store.js'
import { pickFiles } from '../../lib/actions.js'
import { MOD } from '../../hooks/useHotkeys.js'
import { Avatar, userAvatar } from '../ui/Avatar.jsx'
import { Button, IconButton } from '../ui/Button.jsx'
import { DropdownMenu } from '../ui/Menu.jsx'
import { Popover } from '../ui/Popover.jsx'
import { Kbd } from '../ui/Kbd.jsx'
import { Segmented } from '../ui/Form.jsx'

const NOTIF_ICONS = {
  upload_done: { icon: CloudUpload, tone: 'text-emerald-500 bg-emerald-500/10' },
  file_deleted: { icon: FileX, tone: 'text-red-500 bg-red-500/10' },
  storage_warning: { icon: HardDrive, tone: 'text-amber-500 bg-amber-500/10' },
  new_account_request: { icon: UserPlus, tone: 'text-accent-500 bg-accent-500/10' },
  backup_success: { icon: Database, tone: 'text-emerald-500 bg-emerald-500/10' },
  backup_failed: { icon: ShieldAlert, tone: 'text-red-500 bg-red-500/10' },
}

function NotificationsPanel() {
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } = useNotificationStore()
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()
  const list = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications

  const open = async (n) => {
    if (!n.is_read) {
      markRead(n.id)
      api.post(`/admin/notifications/${n.id}/read`).catch(() => {})
    }
    if (n.type === 'new_account_request') navigate('/dashboard?tab=requests')
  }

  return (
    <div className="flex max-h-[min(560px,80vh)] w-[min(380px,calc(100vw-16px))] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-fg">Notifications</p>
          <p className="text-xs text-subtle">{unreadCount ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}</p>
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'Toutes' }, { value: 'unread', label: 'Non lues' }]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <BellOff size={26} className="text-subtle" strokeWidth={1.5} />
            <p className="text-sm text-muted">{filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {list.slice(0, 50).map((n) => {
              const meta = NOTIF_ICONS[n.type] || { icon: Bell, tone: 'text-muted bg-overlay' }
              const Icon = meta.icon
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0 }}
                  className={cn('group relative flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-overlay', !n.is_read && 'bg-accent-500/[0.06]')}
                  onClick={() => open(n)}
                >
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.tone)}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[13px] leading-snug', n.is_read ? 'text-muted' : 'font-medium text-fg')}>{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-subtle">{formatRelative(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-500 group-hover:hidden" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(n.id); api.delete(`/admin/notifications/${n.id}`).catch(() => {}) }}
                    aria-label="Supprimer la notification"
                    className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-red-500/10 hover:text-red-500 group-hover:flex"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="flex items-center justify-between border-t border-line px-2 py-2">
          <Button variant="ghost" size="sm" icon={CheckCheck} disabled={!unreadCount}
            onClick={() => { markAllRead(); api.post('/admin/notifications/read-all').catch(() => {}) }}>
            Tout marquer comme lu
          </Button>
          <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => { clearAll(); api.delete('/admin/notifications').catch(() => {}) }}>
            Vider
          </Button>
        </div>
      )}
    </div>
  )
}

export default function Topbar() {
  const { user, logout } = useAuthStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const { resolvedTheme, theme, setTheme, toggle: toggleTheme } = useThemeStore()
  const { setCommandOpen, setShortcutsOpen, setMobileNavOpen } = useUiStore()
  const can = usePermission()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userItems = [
    { label: 'Mon profil', icon: User, onSelect: () => navigate('/settings?tab=profile') },
    { label: 'Apparence', icon: Palette, onSelect: () => navigate('/settings?tab=appearance') },
    { label: 'Stockage', icon: HardDrive, onSelect: () => navigate('/settings?tab=storage') },
    { label: 'Paramètres', icon: Settings, onSelect: () => navigate('/settings') },
    { type: 'separator' },
    { type: 'sub', label: 'Thème', icon: resolvedTheme === 'dark' ? Moon : Sun, items: [
      { label: 'Clair', icon: Sun, checked: theme === 'light', onSelect: () => setTheme('light') },
      { label: 'Sombre', icon: Moon, checked: theme === 'dark', onSelect: () => setTheme('dark') },
      { label: 'Système', icon: Monitor, checked: theme === 'system', onSelect: () => setTheme('system') },
    ] },
    { label: 'Raccourcis clavier', icon: Keyboard, shortcut: '?', onSelect: () => setShortcutsOpen(true) },
    { type: 'separator' },
    { label: 'Déconnexion', icon: LogOut, danger: true, onSelect: handleLogout },
  ]

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-bg/75 px-3 backdrop-blur-xl sm:gap-3 sm:px-5">
      <IconButton icon={Menu} label="Menu" className="lg:hidden" onClick={() => setMobileNavOpen(true)} tooltip={false} />

      {/* Recherche → palette de commandes */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface/80 px-3.5 text-left text-sm text-subtle shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] transition-all hover:border-line-strong hover:text-muted md:max-w-xl"
      >
        <Search size={16} className="shrink-0 transition-colors group-hover:text-accent-500" />
        <span className="flex-1 truncate">Rechercher des fichiers, dossiers, actions…</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>{MOD}</Kbd><Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {can('files.upload') && (
          <Button size="sm" variant="secondary" icon={Upload} onClick={() => pickFiles()} className="mr-1 hidden md:inline-flex">
            Importer
          </Button>
        )}

        <IconButton
          icon={resolvedTheme === 'dark' ? Sun : Moon}
          label={resolvedTheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          onClick={toggleTheme}
          className="hidden sm:inline-flex"
        />

        <Popover
          trigger={
            <button className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-overlay hover:text-fg" aria-label="Notifications">
              <Bell size={18} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[9px] font-bold text-white ring-2 ring-bg"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          }
        >
          <NotificationsPanel />
        </Popover>

        <DropdownMenu
          items={userItems}
          header={
            <div className="mb-1.5 flex items-center gap-3 rounded-lg bg-overlay/60 p-2.5">
              <Avatar src={userAvatar(user)} name={user?.pseudo} size={38} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{user?.pseudo}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
                {user?.role_name && <p className="mt-0.5 truncate text-[11px] font-medium text-accent-600 dark:text-accent-400">{user.role_name}</p>}
              </div>
            </div>
          }
          trigger={
            <button className="ml-1 flex items-center gap-2 rounded-full p-0.5 pr-0.5 transition-all hover:ring-4 hover:ring-overlay sm:pr-3" aria-label="Menu utilisateur">
              <Avatar src={userAvatar(user)} name={user?.pseudo} size={34} />
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-fg sm:block">{user?.pseudo}</span>
            </button>
          }
        />
      </div>
    </header>
  )
}

