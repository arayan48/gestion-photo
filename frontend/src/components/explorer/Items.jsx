import { memo, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Folder, FileImage, FileVideo, Heart, Link2Off, Play, MoreHorizontal, Check, Clock } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { formatSize, formatDuration, formatRelative, formatDate, trashRemaining, pluralize } from '../../lib/format.js'
import { isVideo, fileExt } from '../../lib/media.js'
import { ContextMenu, DropdownMenu } from '../ui/Menu.jsx'

/*
  Éléments de l'explorateur (grille et liste). Chaque élément est :
  - sélectionnable (clic, Ctrl/Cmd+clic, Maj+clic, lasso, case à cocher) ;
  - glissable vers un dossier (souris / pavé tactile) ;
  - un dossier est aussi une cible de dépôt ;
  - doté d'un menu contextuel (clic droit, appui long) et d'un menu « ⋯ ».
*/

function mergeRefs(...refs) {
  return (node) => refs.forEach((r) => (typeof r === 'function' ? r(node) : r && (r.current = node)))
}

function useItemDnd(item, { draggable, droppable }) {
  const drag = useDraggable({ id: item.key, data: { type: 'item', key: item.key }, disabled: !draggable })
  const drop = useDroppable({
    id: `drop-${item.key}`,
    data: { type: 'folder', folderId: item.id, name: item.name },
    disabled: !droppable || item.kind !== 'folder',
  })
  return {
    ref: mergeRefs(drag.setNodeRef, drop.setNodeRef),
    dragProps: draggable ? { ...drag.listeners, ...drag.attributes, tabIndex: -1, role: undefined } : {},
    isDragging: drag.isDragging,
    isOver: drop.isOver && !drag.isDragging,
  }
}

function Thumb({ file, className, iconSize = 28 }) {
  const [error, setError] = useState(false)
  if (file.thumbnail_path && !error) {
    return (
      <img
        src={file.thumbnail_path}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setError(true)}
        className={cn('h-full w-full object-cover', className)}
      />
    )
  }
  const Icon = isVideo(file) ? FileVideo : FileImage
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-overlay to-line/50">
      <Icon size={iconSize} className="text-subtle" strokeWidth={1.5} />
      <span className="text-[10px] font-semibold tracking-wider text-subtle">{fileExt(file)}</span>
    </div>
  )
}

function SelectCircle({ selected, visible, onToggle, className }) {
  return (
    <button
      type="button"
      data-no-lasso
      aria-label={selected ? 'Désélectionner' : 'Sélectionner'}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-150',
        selected
          ? 'scale-100 border-accent-500 bg-accent-500 text-white shadow-glow'
          : 'border-white/90 bg-black/25 text-transparent backdrop-blur-sm hover:bg-black/40',
        visible || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        className
      )}
    >
      <Check size={14} strokeWidth={3} />
    </button>
  )
}

function MoreButton({ items, className, onOpen }) {
  return (
    <DropdownMenu
      items={items}
      onOpenChange={(o) => o && onOpen?.()}
      trigger={
        <button
          type="button"
          data-no-lasso
          aria-label="Plus d'actions"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-all', className)}
        >
          <MoreHorizontal size={17} />
        </button>
      }
    />
  )
}

// ── Grille ────────────────────────────────────────────────────────────────────

export const FileCard = memo(function FileCard({ item, selected, focused, selectionMode, dimmed, showNames, isTrash, handlers, getMenu, draggable }) {
  const { ref, dragProps, isDragging } = useItemDnd(item, { draggable, droppable: false })
  const menu = () => getMenu(item)
  const video = isVideo(item)
  return (
    <ContextMenu items={menu} onOpenChange={(o) => o && handlers.onContext(item)}>
      <div
        ref={ref}
        data-key={item.key}
        {...dragProps}
        {...handlers.bind(item)}
        className={cn(
          'group relative touch-callout-none select-none outline-none',
          (isDragging || dimmed) && 'opacity-40'
        )}
      >
        <div
          className={cn(
            'relative aspect-square overflow-hidden rounded-2xl bg-overlay ring-1 ring-line transition-all duration-200',
            selected ? 'scale-[0.92] rounded-xl ring-[3px] ring-accent-500' : 'group-hover:ring-line-strong',
            focused && !selected && 'ring-2 ring-accent-400'
          )}
        >
          <Thumb file={item} className="transition-transform duration-500 group-hover:scale-[1.04]" />

          {/* Voile de survol */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          {selected && <div className="pointer-events-none absolute inset-0 bg-accent-500/15" />}

          <SelectCircle className="absolute left-2 top-2" selected={selected} visible={selectionMode} onToggle={() => handlers.toggle(item)} />

          {!isTrash && (
            <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <MoreButton items={menu} onOpen={() => handlers.onContext(item)} className="bg-black/35 text-white backdrop-blur-md hover:bg-black/55" />
            </div>
          )}

          {/* Badges */}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-1">
            <div className="flex items-center gap-1">
              {item.is_favorite && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><Heart size={12} className="fill-pink-500 text-pink-500" /></span>}
              {item.link_active === false && !isTrash && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/40 backdrop-blur-md" title="Lien public désactivé"><Link2Off size={12} className="text-white" /></span>}
            </div>
            {video && (
              <span className="flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                <Play size={9} className="fill-white" />
                {item.duration ? formatDuration(item.duration) : 'Vidéo'}
              </span>
            )}
          </div>
          {isTrash && (
            <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
              <Clock size={10} /> {trashRemaining(item.deleted_at)}
            </span>
          )}
        </div>

        {showNames && (
          <div className="px-1 pb-1 pt-2">
            <p className={cn('truncate text-[13px] font-medium', selected ? 'text-accent-600 dark:text-accent-300' : 'text-fg')}>{item.original_name}</p>
            <p className="truncate text-[11px] text-subtle">
              {formatSize(item.size)}
              {item.owner_pseudo && handlers.showOwner && ` · ${item.owner_pseudo}`}
            </p>
          </div>
        )}
      </div>
    </ContextMenu>
  )
})

export const FolderCard = memo(function FolderCard({ item, selected, focused, selectionMode, dimmed, handlers, getMenu, draggable }) {
  const { ref, dragProps, isDragging, isOver } = useItemDnd(item, { draggable, droppable: true })
  const menu = () => getMenu(item)
  const covers = (item.covers || []).filter(Boolean)
  const counts = [item.file_count > 0 && pluralize(item.file_count, 'fichier'), item.folder_count > 0 && pluralize(item.folder_count, 'dossier')].filter(Boolean).join(' · ')
  return (
    <ContextMenu items={menu} onOpenChange={(o) => o && handlers.onContext(item)}>
      <div
        ref={ref}
        data-key={item.key}
        {...dragProps}
        {...handlers.bind(item)}
        className={cn(
          'group relative touch-callout-none select-none rounded-2xl border bg-surface p-2 outline-none transition-all duration-200',
          selected ? 'border-accent-500 bg-accent-500/[0.07] ring-2 ring-accent-500/40' : 'border-line hover:border-line-strong hover:shadow-soft',
          focused && !selected && 'ring-2 ring-accent-400',
          isOver && 'scale-[1.03] border-accent-500 bg-accent-500/10 ring-4 ring-accent-500/25',
          (isDragging || dimmed) && 'opacity-40'
        )}
      >
        <div className="relative grid aspect-[16/10] grid-cols-3 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-overlay">
          {covers.length > 0 ? (
            <>
              <img src={covers[0]} alt="" loading="lazy" draggable={false} className={cn('h-full w-full object-cover', covers.length === 1 ? 'col-span-3 row-span-2' : 'col-span-2 row-span-2')} />
              {covers[1] && <img src={covers[1]} alt="" loading="lazy" draggable={false} className={cn('h-full w-full object-cover', !covers[2] && 'row-span-2')} />}
              {covers[2] && <img src={covers[2]} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />}
            </>
          ) : (
            <div className="col-span-3 row-span-2 flex items-center justify-center">
              <Folder size={42} strokeWidth={1.3} className={cn('transition-colors', isOver ? 'text-accent-500' : 'text-amber-500/80')} fill="currentColor" fillOpacity={0.12} />
            </div>
          )}
          {isOver && <div className="absolute inset-0 flex items-center justify-center bg-accent-600/40 text-sm font-semibold text-white backdrop-blur-[2px]">Déposer ici</div>}
          <SelectCircle className="absolute left-2 top-2" selected={selected} visible={selectionMode} onToggle={() => handlers.toggle(item)} />
        </div>
        <div className="flex items-center gap-2.5 px-1.5 pb-0.5 pt-2.5">
          <Folder size={18} className={cn('shrink-0', isOver || selected ? 'text-accent-500' : 'text-amber-500')} fill="currentColor" fillOpacity={0.2} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-fg">{item.name}</p>
            <p className="truncate text-[11px] text-subtle">{counts || 'Vide'}</p>
          </div>
          <MoreButton items={menu} onOpen={() => handlers.onContext(item)} className="-mr-1 text-subtle opacity-0 hover:bg-overlay hover:text-fg group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
        </div>
      </div>
    </ContextMenu>
  )
})

// ── Liste ─────────────────────────────────────────────────────────────────────

export const LIST_COLUMNS = 'grid-cols-[28px_minmax(0,1fr)_36px] sm:grid-cols-[28px_minmax(0,1fr)_90px_36px] md:grid-cols-[28px_minmax(0,1fr)_140px_90px_36px] xl:grid-cols-[28px_minmax(0,1fr)_140px_150px_90px_70px_36px]'

export const ItemRow = memo(function ItemRow({ item, selected, focused, selectionMode, dimmed, isTrash, handlers, getMenu, draggable }) {
  const isFolder = item.kind === 'folder'
  const menu = () => getMenu(item)
  const { ref, dragProps, isDragging, isOver } = useItemDnd(item, { draggable, droppable: isFolder })
  return (
    <ContextMenu items={menu} onOpenChange={(o) => o && handlers.onContext(item)}>
      <div
        ref={ref}
        data-key={item.key}
        {...dragProps}
        {...handlers.bind(item)}
        className={cn(
          'group grid touch-callout-none select-none items-center gap-3 rounded-xl px-2 py-1.5 outline-none transition-colors',
          LIST_COLUMNS,
          selected ? 'bg-accent-500/10' : 'hover:bg-overlay/70',
          focused && !selected && 'ring-2 ring-inset ring-accent-400',
          isOver && 'bg-accent-500/15 ring-2 ring-inset ring-accent-500',
          (isDragging || dimmed) && 'opacity-40'
        )}
      >
        <span className="flex justify-center">
          <span
            data-no-lasso
            onClick={(e) => { e.stopPropagation(); handlers.toggle(item) }}
            className={cn(
              'flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] transition-all',
              selected ? 'border-accent-600 bg-accent-600 text-white' : 'border-line-strong text-transparent hover:border-accent-400',
              !selected && !selectionMode && 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
            )}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        </span>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-overlay ring-1 ring-line">
            {isFolder
              ? <Folder size={20} className={isOver ? 'text-accent-500' : 'text-amber-500'} fill="currentColor" fillOpacity={0.2} />
              : <Thumb file={item} iconSize={16} />}
            {!isFolder && isVideo(item) && <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5"><Play size={7} className="fill-white text-white" /></span>}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={cn('truncate text-[13.5px] font-medium', selected ? 'text-accent-700 dark:text-accent-300' : 'text-fg')}>{isFolder ? item.name : item.original_name}</p>
              {item.is_favorite && <Heart size={12} className="shrink-0 fill-pink-500 text-pink-500" />}
              {item.link_active === false && !isTrash && <Link2Off size={12} className="shrink-0 text-subtle" />}
            </div>
            <p className="truncate text-[11px] text-subtle md:hidden">
              {isFolder ? pluralize(item.file_count || 0, 'fichier') : `${formatSize(item.size)} · ${formatRelative(item.created_at)}`}
            </p>
          </div>
        </div>

        <span className="hidden truncate text-xs text-muted xl:block">{isFolder || item.owner_id === handlers.userId ? 'Moi' : item.owner_pseudo || '—'}</span>
        <span className="hidden truncate text-xs text-muted md:block" title={formatDate(item.created_at, 'Pp')}>
          {isTrash ? trashRemaining(item.deleted_at) : formatRelative(item.created_at)}
        </span>
        <span className="hidden text-right text-xs tabular-nums text-muted sm:block">{isFolder ? (item.total_size > 0 ? formatSize(item.total_size) : '—') : formatSize(item.size)}</span>
        <span className="hidden xl:block">
          <span className="rounded-md bg-overlay px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-subtle">{isFolder ? 'DOSSIER' : fileExt(item)}</span>
        </span>
        <span className="flex justify-end">
          <MoreButton items={menu} onOpen={() => handlers.onContext(item)} className="text-subtle opacity-0 hover:bg-overlay hover:text-fg group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
        </span>
      </div>
    </ContextMenu>
  )
})
