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
  upload_done: { icon: CloudUpload, tone: 'text-subtle' },
  file_deleted: { icon: FileX, tone: 'text-red-500' },
  storage_warning: { icon: HardDrive, tone: 'text-amber-500' },
  new_account_request: { icon: UserPlus, tone: 'text-accent-500' },
  backup_success: { icon: Database, tone: 'text-subtle' },
  backup_failed: { icon: ShieldAlert, tone: 'text-red-500' },
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
          <p className="text-sm font-medium text-fg">Notifications</p>
          <p className="font-mono text-[11px] text-subtle">{unreadCount ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}</p>
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'Toutes' }, { value: 'unread', label: 'Non lues' }]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm text-muted">{filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {list.slice(0, 50).map((n) => {
              const meta = NOTIF_ICONS[n.type] || { icon: Bell, tone: 'text-subtle' }
              const Icon = meta.icon
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0 }}
                  className={cn('group relative flex cursor-pointer items-start gap-3 border-b border-line px-4 py-3 transition-colors hover:bg-overlay', !n.is_read && 'border-l-2 border-l-accent-500')}
                  onClick={() => open(n)}
                >
                  <Icon size={15} strokeWidth={1.75} className={cn('mt-0.5 shrink-0', meta.tone)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[13px] leading-snug', n.is_read ? 'text-muted' : 'text-fg')}>{n.message}</p>
                    <p className="mt-1 font-mono text-[10.5px] text-subtle">{formatRelative(n.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(n.id); api.delete(`/admin/notifications/${n.id}`).catch(() => {}) }}
                    aria-label="Supprimer la notification"
                    className="hidden h-6 w-6 shrink-0 items-center justify-center text-subtle hover:text-red-500 group-hover:flex"
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
          <Button variant="ghost" size="sm" disabled={!unreadCount}
            onClick={() => { markAllRead(); api.post('/admin/notifications/read-all').catch(() => {}) }}>
            Tout marquer comme lu
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-5">
      <IconButton icon={Menu} label="Menu" className="lg:hidden" onClick={() => setMobileNavOpen(true)} tooltip={false} />

      {/* Recherche → palette de commandes */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-sm border border-line px-3 text-left text-[13px] text-subtle transition-colors hover:border-line-strong hover:text-muted md:max-w-md"
      >
        <Search size={15} strokeWidth={1.75} className="shrink-0" />
        <span className="flex-1 truncate">Rechercher</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>{MOD}</Kbd><Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1">

        <IconButton
          icon={resolvedTheme === 'dark' ? Sun : Moon}
          label={resolvedTheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          onClick={toggleTheme}
          className="hidden sm:inline-flex"
        />

        <Popover
          trigger={
            <button className="relative flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-fg data-[state=open]:text-fg" aria-label="Notifications">
              <Bell size={16} strokeWidth={1.75} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute right-0.5 top-1 flex h-[15px] min-w-[15px] items-center justify-center bg-accent-600 px-1 font-mono text-[9px] text-white"
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
            <div className="mb-1 flex items-center gap-3 border-b border-line px-3 pb-3 pt-2">
              <Avatar src={userAvatar(user)} name={user?.pseudo} size={38} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{user?.pseudo}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
                {user?.role_name && <p className="label-mono mt-1 truncate">{user.role_name}</p>}
              </div>
            </div>
          }
          trigger={
            <button className="ml-1 flex items-center gap-2 p-0.5 text-muted transition-colors hover:text-fg sm:pr-1" aria-label="Menu utilisateur">
              <Avatar src={userAvatar(user)} name={user?.pseudo} size={28} />
              <span className="hidden max-w-[120px] truncate text-[13px] sm:block">{user?.pseudo}</span>
            </button>
          }
        />
      </div>
    </header>
  )
}

