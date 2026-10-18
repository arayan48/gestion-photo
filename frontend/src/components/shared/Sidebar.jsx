import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useMatch } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDroppable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FolderOpen, Clock, Heart, Trash2, Globe, LayoutDashboard, Wrench, HardDrive, Plus, Upload,
  FolderPlus, ChevronRight, Folder, PanelLeftClose, PanelLeftOpen, Camera,
} from 'lucide-react'
import api from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatSize } from '../../lib/format.js'
import { useAuthStore, usePermission } from '../../stores/auth.store.js'
import { usePreferencesStore } from '../../stores/preferences.store.js'
import { useUiStore } from '../../stores/ui.store.js'
import { pickFiles, createFolder } from '../../lib/actions.js'
import { folderMenu } from '../explorer/itemActions.js'
import Logo, { LogoMark } from './Logo.jsx'
import { Tooltip } from '../ui/Tooltip.jsx'
import { DropdownMenu, ContextMenu } from '../ui/Menu.jsx'
import { Progress } from '../ui/Progress.jsx'

export const NAV_ITEMS = [
  { view: null, to: '/explorer', icon: FolderOpen, label: 'Mon espace' },
  { view: 'others', to: '/explorer?view=others', icon: Globe, label: 'Espace commun', permission: 'files.view_others' },
  { view: 'recent', to: '/explorer?view=recent', icon: Clock, label: 'Récents' },
  { view: 'favorites', to: '/explorer?view=favorites', icon: Heart, label: 'Favoris' },
  { view: 'trash', to: '/explorer?view=trash', icon: Trash2, label: 'Corbeille' },
]

export function useAdminLinks() {
  const user = useAuthStore((s) => s.user)
  const permissions = user?.permissions || []
  const hasAdminPermission = permissions.some((p) => !p.startsWith('files.'))
  return [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Administration', show: user?.is_super_admin || hasAdminPermission },
    { to: '/admin/settings', icon: Wrench, label: 'Configuration', show: user?.is_super_admin || permissions.includes('system.manage_config') },
  ].filter((l) => l.show)
}

// Lien de navigation ; « Mon espace » accepte aussi les fichiers glissés (= racine)
function NavLink({ item, active, collapsed, onNavigate, droppable }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `nav-${item.to}`,
    data: { type: 'folder', folderId: null, name: 'Mon espace' },
    disabled: !droppable,
  })
  const Icon = item.icon
  const link = (
    <Link
      ref={setNodeRef}
      to={item.to}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-[7px] text-[13.5px] transition-colors',
        collapsed && 'justify-center px-0 py-2.5',
        active ? 'bg-overlay text-fg' : 'text-muted hover:text-fg',
        isOver && 'bg-accent-600 text-white'
      )}
    >
      {active && <span className="absolute inset-y-0 left-0 w-[2px] bg-accent-500" />}
      <Icon size={16} strokeWidth={1.75} className={cn('relative shrink-0', active ? 'text-fg' : 'text-subtle group-hover:text-fg', isOver && 'text-white')} />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
    </Link>
  )
  return collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link
}

// ── Arborescence des dossiers (cible de dépôt + menu contextuel) ─────────────
function TreeNode({ node, depth, childrenMap, expanded, toggle, activeId, onNavigate, menuCtx }) {
  const navigate = useNavigate()
  const children = childrenMap.get(node.id) || []
  const isOpen = expanded.has(node.id)
  const active = activeId === node.id
  const { setNodeRef, isOver } = useDroppable({ id: `tree-${node.id}`, data: { type: 'folder', folderId: node.id, name: node.name } })

  // Survol prolongé pendant un glisser : déplier le dossier
  useEffect(() => {
    if (!isOver || isOpen || !children.length) return
    const t = setTimeout(() => toggle(node.id, true), 650)
    return () => clearTimeout(t)
  }, [isOver, isOpen, children.length])

  return (
    <div>
      <ContextMenu items={() => folderMenu({ ...node, kind: 'folder' }, menuCtx)}>
        <div
          ref={setNodeRef}
          onClick={() => { navigate(`/explorer/${node.id}`); onNavigate?.() }}
          className={cn(
            'group flex cursor-pointer items-center gap-1 py-[5px] pr-2 text-[13px] transition-colors',
            active ? 'bg-overlay text-fg' : 'text-muted hover:text-fg',
            isOver && 'bg-accent-600 text-white'
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle(node.id) }}
            className={cn('flex h-5 w-5 shrink-0 items-center justify-center hover:text-fg', !children.length && 'invisible')}
            aria-label={isOpen ? 'Replier' : 'Déplier'}
          >
            <ChevronRight size={13} className={cn('transition-transform duration-200', isOpen && 'rotate-90')} />
          </button>
          <Folder size={14} strokeWidth={1.75} className={cn('shrink-0', isOver ? 'text-white' : active ? 'text-fg' : 'text-subtle')} />
          <span className="truncate">{node.name}</span>
        </div>
      </ContextMenu>
      <AnimatePresence initial={false}>
        {isOpen && children.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            {children.map((c) => (
              <TreeNode key={c.id} node={c} depth={depth + 1} childrenMap={childrenMap} expanded={expanded} toggle={toggle} activeId={activeId} onNavigate={onNavigate} menuCtx={menuCtx} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FolderTree({ onNavigate }) {
  // La barre latérale est hors de la route enfant : useParams ne verrait pas :folderId
  const folderId = useMatch('/explorer/:folderId')?.params.folderId
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const can = usePermission()
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState(() => new Set())
  const { data: folders = [] } = useQuery({
    queryKey: ['folder-tree'],
    queryFn: () => api.get('/files/folders/tree').then((r) => r.data),
    staleTime: 30_000,
  })

  const childrenMap = useMemo(() => {
    const map = new Map()
    for (const f of folders) {
      const key = f.parent_id || 'root'
      map.set(key, [...(map.get(key) || []), f])
    }
    return map
  }, [folders])

  // Déplier automatiquement les parents du dossier ouvert
  useEffect(() => {
    if (!folderId || !folders.length) return
    const byId = new Map(folders.map((f) => [f.id, f]))
    const chain = []
    let cur = byId.get(folderId)
    while (cur?.parent_id) { chain.push(cur.parent_id); cur = byId.get(cur.parent_id) }
    if (chain.length) setExpanded((prev) => new Set([...prev, ...chain]))
  }, [folderId, folders])

  const toggle = (id, force) => setExpanded((prev) => {
    const next = new Set(prev)
    const shouldOpen = force ?? !next.has(id)
    shouldOpen ? next.add(id) : next.delete(id)
    return next
  })

  const menuCtx = {
    can,
    userId: user?.id,
    openFolder: (f) => { navigate(`/explorer/${f.id}`); onNavigate?.() },
  }

  const roots = childrenMap.get('root') || []
  if (!roots.length) return null

  return (
    <div className="mt-4">
      <button onClick={() => setOpen((v) => !v)} className="label-mono flex w-full items-center gap-1 px-3 pb-2 hover:text-muted">
        <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
        Dossiers
      </button>
      {open && (
        <div className="space-y-px">
          {roots.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} childrenMap={childrenMap} expanded={expanded} toggle={toggle} activeId={folderId} onNavigate={onNavigate} menuCtx={menuCtx} />
          ))}
        </div>
      )}
    </div>
  )
}

export function StorageMeter({ collapsed }) {
  const user = useAuthStore((s) => s.user)
  const used = Number(user?.storage_used ?? 0)
  const quota = Number(user?.storage_quota ?? 1)
  const pct = Math.min(100, Math.round((used / quota) * 100))
  if (collapsed) {
    return (
      <Tooltip content={`Stockage : ${formatSize(used)} / ${formatSize(quota)}`} side="right">
        <Link to="/settings?tab=storage" className="mx-auto flex h-10 w-10 items-center justify-center text-subtle hover:text-fg">
          <HardDrive size={16} strokeWidth={1.75} />
        </Link>
      </Tooltip>
    )
  }
  return (
    <Link to="/settings?tab=storage" className="group block px-1">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label-mono group-hover:text-muted">Stockage</span>
        <span className={cn('font-mono text-[11px]', pct >= 90 ? 'text-red-500' : 'text-muted')}>{pct} %</span>
      </div>
      <Progress value={pct} />
      <p className="mt-2 font-mono text-[11px] text-subtle">{formatSize(used)} / {formatSize(quota)}</p>
    </Link>
  )
}

export function SidebarContent({ collapsed = false, onNavigate }) {
  const { pathname, search } = useLocation()
  const currentView = new URLSearchParams(search).get('view')
  const can = usePermission()
  const adminLinks = useAdminLinks()
  const toggleSidebar = usePreferencesStore((s) => s.toggleSidebar)

  const isActive = (view) => pathname.startsWith('/explorer') && (view === null ? !currentView || currentView === 'search' : currentView === view)

  const newItems = [
    can('files.upload') && { label: 'Importer des fichiers', icon: Upload, shortcut: 'U', onSelect: () => pickFiles() },
    can('files.upload') && { label: 'Prendre une photo', icon: Camera, onSelect: () => pickFiles({ capture: true }) },
    can('files.create_folder') && { label: 'Nouveau dossier', icon: FolderPlus, shortcut: 'N', onSelect: () => createFolder() },
  ].filter(Boolean)

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center border-b border-line', collapsed ? 'justify-center' : 'justify-between pl-5 pr-3')}>
        <Link to="/explorer" onClick={onNavigate} className="text-fg">{collapsed ? <LogoMark size={22} /> : <Logo />}</Link>
        {!collapsed && onNavigate === undefined && (
          <Tooltip content="Réduire la barre latérale" shortcut="[" side="right">
            <button onClick={toggleSidebar} className="flex h-8 w-8 items-center justify-center text-subtle hover:text-fg" aria-label="Réduire la barre latérale">
              <PanelLeftClose size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        )}
      </div>

      {newItems.length > 0 && (
        <div className={cn('mb-3 mt-4', collapsed ? 'px-3' : 'px-4')}>
          <DropdownMenu
            align="start"
            items={newItems}
            trigger={
              <button className={cn(
                'group flex w-full items-center gap-2 rounded-sm border border-line-strong text-[13px] text-fg transition-colors hover:border-fg/40 hover:bg-overlay data-[state=open]:bg-overlay',
                collapsed ? 'h-10 justify-center' : 'h-9 justify-between px-3'
              )} aria-label="Nouveau">
                {!collapsed && 'Nouveau'}
                <Plus size={15} strokeWidth={1.75} className="text-subtle transition-transform duration-200 group-data-[state=open]:rotate-45" />
              </button>
            }
          />
        </div>
      )}

      <nav className={cn('min-h-0 flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-2')}>
        <div className="space-y-0.5">
          {NAV_ITEMS.filter((i) => !i.permission || can(i.permission)).map((item) => (
            <NavLink key={item.to} item={item} active={isActive(item.view)} collapsed={collapsed} onNavigate={onNavigate} droppable={item.view === null} />
          ))}
        </div>

        {!collapsed && <FolderTree onNavigate={onNavigate} />}

        {adminLinks.length > 0 && (
          <div className="mt-5">
            {!collapsed && <p className="label-mono px-3 pb-2">Administration</p>}
            {collapsed && <div className="mx-auto mb-3 h-px w-6 bg-line" />}
            <div className="space-y-0.5">
              {adminLinks.map((item) => (
                <NavLink key={item.to} item={{ ...item, view: '__admin' }} active={pathname === item.to} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className={cn('shrink-0 space-y-4 border-t border-line py-4', collapsed ? 'px-2' : 'px-4')}>
        <StorageMeter collapsed={collapsed} />
        {collapsed ? (
          <Tooltip content="Agrandir la barre latérale" shortcut="[" side="right">
            <button onClick={toggleSidebar} className="mx-auto flex h-10 w-10 items-center justify-center text-subtle hover:text-fg" aria-label="Agrandir la barre latérale">
              <PanelLeftOpen size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        ) : (
          <p className="px-1 font-mono text-[10px] text-subtle/70">
            <a href="https://arayan.fr" target="_blank" rel="noreferrer" className="hover:text-fg">arayan.fr</a> · {new Date().getFullYear()}
          </p>
        )}
      </div>
    </div>
  )
}

export default function Sidebar() {
  const collapsed = usePreferencesStore((s) => s.sidebarCollapsed)
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative hidden shrink-0 overflow-hidden border-r border-line bg-surface lg:block"
    >
      <SidebarContent collapsed={collapsed} />
    </motion.aside>
  )
}

// Tiroir latéral mobile / tablette
export function MobileSidebar() {
  const open = useUiStore((s) => s.mobileNavOpen)
  const setOpen = useUiStore((s) => s.setMobileNavOpen)
  const { pathname, search } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname, search])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[240] bg-black/60 lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-[241] w-[272px] max-w-[85vw] border-r border-line bg-surface lg:hidden"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.4, right: 0 }}
            onDragEnd={(_, info) => { if (info.offset.x < -80 || info.velocity.x < -400) setOpen(false) }}
          >
            <SidebarContent onNavigate={() => setOpen(false)} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
