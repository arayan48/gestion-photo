import { Link, useNavigate } from 'react-router-dom'
import { useDroppable } from '@dnd-kit/core'
import { ChevronDown, Folder, MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { DropdownMenu, ContextMenu } from '../ui/Menu.jsx'

// Fil d'Ariane : chaque niveau est une cible de dépôt et a son menu contextuel
function Crumb({ id, name, to, isLast, menu }) {
  const { setNodeRef, isOver } = useDroppable({ id: `crumb-${id ?? 'root'}`, data: { type: 'folder', folderId: id, name } })
  const base = cn(
    'flex min-w-0 items-center gap-1.5 px-1.5 py-0.5 transition-colors',
    isOver && 'bg-accent-600 !text-white'
  )
  if (isLast) {
    const trigger = (
      <button ref={setNodeRef} className={cn(base, 'text-xl font-medium tracking-[-0.01em] text-fg hover:bg-overlay')}>
        <span className="truncate">{name}</span>
        {menu && <ChevronDown size={15} className="shrink-0 text-subtle" />}
      </button>
    )
    return menu ? <DropdownMenu align="start" items={menu} trigger={trigger} /> : <span ref={setNodeRef} className={cn(base, 'text-xl font-medium tracking-[-0.01em] text-fg')}><span className="truncate">{name}</span></span>
  }
  const link = (
    <Link ref={setNodeRef} to={to} className={cn(base, 'text-xl text-subtle hover:text-fg')}>
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
      <Crumb id={null} name={rootLabel} to="/explorer" isLast={chain.length === 0} menu={chain.length === 0 ? currentMenu : undefined} />
      {collapsed.length > 0 && (
        <>
          <span className="shrink-0 px-0.5 text-xl font-light text-line-strong">/</span>
          <DropdownMenu
            align="start"
            items={collapsed.map((c) => ({ label: c.name, icon: Folder, onSelect: () => navigate(`/explorer/${c.id}`) }))}
            trigger={<button className="flex h-8 w-8 items-center justify-center text-subtle hover:text-fg" aria-label="Dossiers parents"><MoreHorizontal size={17} /></button>}
          />
        </>
      )}
      {visible.map((c, i) => {
        const isLast = i === visible.length - 1
        return (
          <span key={c.id} className="flex min-w-0 items-center gap-0.5">
            <span className="shrink-0 px-0.5 text-xl font-light text-line-strong">/</span>
            <Crumb id={c.id} name={c.name} to={`/explorer/${c.id}`} isLast={isLast} menu={isLast ? currentMenu : folderMenuFor?.(c)} />
          </span>
        )
      })}
    </nav>
  )
}
