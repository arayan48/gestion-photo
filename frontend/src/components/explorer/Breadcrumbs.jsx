import { Link, useNavigate } from 'react-router-dom'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight, ChevronDown, HardDrive, Folder, MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { DropdownMenu, ContextMenu } from '../ui/Menu.jsx'

// Fil d'Ariane : chaque niveau est une cible de dépôt et a son menu contextuel
function Crumb({ id, name, to, isLast, icon: Icon, menu }) {
  const { setNodeRef, isOver } = useDroppable({ id: `crumb-${id ?? 'root'}`, data: { type: 'folder', folderId: id, name } })
  const base = cn(
    'flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors',
    isOver && 'bg-accent-500/15 text-accent-600 ring-2 ring-accent-500/50 dark:text-accent-300'
  )
  if (isLast) {
    const trigger = (
      <button ref={setNodeRef} className={cn(base, 'text-fg hover:bg-overlay', 'text-lg font-semibold tracking-tight sm:text-xl')}>
        {Icon && <Icon size={20} className="shrink-0 text-accent-500" />}
        <span className="truncate">{name}</span>
        {menu && <ChevronDown size={16} className="shrink-0 text-subtle" />}
      </button>
    )
    return menu ? <DropdownMenu align="start" items={menu} trigger={trigger} /> : <span ref={setNodeRef} className={cn(base, 'text-lg font-semibold tracking-tight text-fg sm:text-xl')}>{Icon && <Icon size={20} className="shrink-0 text-accent-500" />}<span className="truncate">{name}</span></span>
  }
  const link = (
    <Link ref={setNodeRef} to={to} className={cn(base, 'text-muted hover:bg-overlay hover:text-fg', 'text-lg font-medium sm:text-xl')}>
      {Icon && <Icon size={18} className="shrink-0" />}
      <span className="max-w-[180px] truncate">{name}</span>
    </Link>
  )
  return menu ? <ContextMenu items={menu}>{link}</ContextMenu> : link
}

export default function Breadcrumbs({ chain, rootLabel = 'Mon espace', currentMenu, folderMenuFor }) {
  const navigate = useNavigate()
  // Chemin long : on replie les niveaux intermédiaires dans un menu « … »
  const collapsed = chain.length > 3 ? chain.slice(0, chain.length - 2) : []
  const visible = chain.length > 3 ? chain.slice(-2) : chain

  return (
    <nav className="flex min-w-0 items-center gap-0.5" aria-label="Fil d'Ariane">
      <Crumb id={null} name={rootLabel} to="/explorer" icon={HardDrive} isLast={chain.length === 0} menu={chain.length === 0 ? currentMenu : undefined} />
      {collapsed.length > 0 && (
        <>
          <ChevronRight size={16} className="shrink-0 text-subtle" />
          <DropdownMenu
            align="start"
            items={collapsed.map((c) => ({ label: c.name, icon: Folder, onSelect: () => navigate(`/explorer/${c.id}`) }))}
            trigger={<button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-overlay hover:text-fg" aria-label="Dossiers parents"><MoreHorizontal size={18} /></button>}
          />
        </>
      )}
      {visible.map((c, i) => {
        const isLast = i === visible.length - 1
        return (
          <span key={c.id} className="flex min-w-0 items-center gap-0.5">
            <ChevronRight size={16} className="shrink-0 text-subtle" />
            <Crumb id={c.id} name={c.name} to={`/explorer/${c.id}`} isLast={isLast} menu={isLast ? currentMenu : folderMenuFor?.(c)} />
          </span>
        )
      })}
    </nav>
  )
}
