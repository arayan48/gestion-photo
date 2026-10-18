import { memo, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Folder, FileImage, FileVideo, Heart, Link2Off, Play, MoreHorizontal, Check } from 'lucide-react'
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-overlay">
      <Icon size={iconSize} className="text-subtle" strokeWidth={1.25} />
      <span className="font-mono text-[10px] tracking-[0.1em] text-subtle">{fileExt(file)}</span>
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
        'flex h-[18px] w-[18px] items-center justify-center rounded-[2px] border transition-colors duration-100',
        selected
          ? 'border-accent-500 bg-accent-500 text-white'
          : 'border-white/80 bg-black/30 text-transparent hover:bg-black/50',
        visible || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        className
      )}
    >
      <Check size={12} strokeWidth={3} />
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
          className={cn('flex h-7 w-7 items-center justify-center rounded-sm transition-colors', className)}
        >
          <MoreHorizontal size={16} />
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
        <div className={cn('relative aspect-square overflow-hidden bg-overlay', focused && !selected && 'outline outline-1 outline-offset-2 outline-fg/50')}>
          <Thumb file={item} className={cn('transition-[filter,opacity] duration-150', selected ? 'opacity-80' : 'group-hover:brightness-[1.08]')} />

          {/* Filet de sélection, à l'intérieur de l'image */}
          {selected && <div className="pointer-events-none absolute inset-0 outline outline-[3px] -outline-offset-[3px] outline-accent-500" />}

          <SelectCircle className="absolute left-2 top-2" selected={selected} visible={selectionMode} onToggle={() => handlers.toggle(item)} />

          {!isTrash && (
            <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:hidden">
              <MoreButton items={menu} onOpen={() => handlers.onContext(item)} className="bg-black/50 text-white hover:bg-black/75" />
            </div>
          )}

          {/* Marquages en bas de l'image */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-1.5">
            <div className="flex items-center gap-1">
              {item.is_favorite && <span className="flex h-5 w-5 items-center justify-center bg-black/60"><Heart size={11} className="fill-white text-white" /></span>}
              {item.link_active === false && !isTrash && <span className="flex h-5 w-5 items-center justify-center bg-black/60" title="Lien public désactivé"><Link2Off size={11} className="text-white" /></span>}
            </div>
            {video && (
              <span className="flex items-center gap-1 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                <Play size={8} className="fill-white" />
                {item.duration ? formatDuration(item.duration) : 'VID'}
              </span>
            )}
          </div>
          {isTrash && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
              {trashRemaining(item.deleted_at)}
            </span>
          )}
        </div>

        {showNames && (
          <div className="pt-1.5">
            <p className={cn('truncate text-[12.5px]', selected ? 'text-accent-600 dark:text-accent-400' : 'text-fg')}>{item.original_name}</p>
            <p className="truncate font-mono text-[10.5px] text-subtle">
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
          'group relative touch-callout-none select-none border bg-surface outline-none transition-colors duration-100',
          selected ? 'border-accent-500' : 'border-line hover:border-line-strong',
          focused && !selected && 'border-fg/50',
          isOver && 'border-accent-500 bg-accent-600/10',
          (isDragging || dimmed) && 'opacity-40'
        )}
      >
        <div className="relative grid aspect-[16/10] grid-cols-3 grid-rows-2 gap-px overflow-hidden bg-overlay">
          {covers.length > 0 ? (
            <>
              <img src={covers[0]} alt="" loading="lazy" draggable={false} className={cn('h-full w-full object-cover', covers.length === 1 ? 'col-span-3 row-span-2' : 'col-span-2 row-span-2')} />
              {covers[1] && <img src={covers[1]} alt="" loading="lazy" draggable={false} className={cn('h-full w-full object-cover', !covers[2] && 'row-span-2')} />}
              {covers[2] && <img src={covers[2]} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />}
            </>
          ) : (
            <div className="col-span-3 row-span-2 flex items-center justify-center">
              <Folder size={30} strokeWidth={1} className={cn('transition-colors', isOver ? 'text-accent-500' : 'text-subtle')} />
            </div>
          )}
          {isOver && <div className="label-mono absolute inset-0 flex items-center justify-center bg-accent-600 !text-white">Déposer ici</div>}
          <SelectCircle className="absolute left-2 top-2" selected={selected} visible={selectionMode} onToggle={() => handlers.toggle(item)} />
        </div>
        <div className="flex items-center gap-2.5 border-t border-line px-2.5 py-2">
          <Folder size={15} strokeWidth={1.75} className={cn('shrink-0', isOver || selected ? 'text-accent-500' : 'text-subtle')} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-fg">{item.name}</p>
            <p className="truncate font-mono text-[10.5px] text-subtle">{counts || 'vide'}</p>
          </div>
          <MoreButton items={menu} onOpen={() => handlers.onContext(item)} className="-mr-1 text-subtle opacity-0 hover:text-fg group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
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
          'group grid touch-callout-none select-none items-center gap-3 border-b border-line px-2 py-1.5 outline-none transition-colors',
          LIST_COLUMNS,
          selected ? 'bg-accent-600/10' : 'hover:bg-overlay/70',
          focused && !selected && 'bg-overlay/70',
          isOver && 'bg-accent-600 text-white',
          (isDragging || dimmed) && 'opacity-40'
        )}
      >
        <span className="flex justify-center">
          <span
            data-no-lasso
            onClick={(e) => { e.stopPropagation(); handlers.toggle(item) }}
            className={cn(
              'flex h-4 w-4 cursor-pointer items-center justify-center rounded-[2px] border transition-colors',
              selected ? 'border-accent-600 bg-accent-600 text-white' : 'border-line-strong text-transparent hover:border-fg/50',
              !selected && !selectionMode && 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
            )}
          >
            <Check size={11} strokeWidth={3} />
          </span>
        </span>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-overlay">
            {isFolder
              ? <Folder size={17} strokeWidth={1.5} className="text-subtle" />
              : <Thumb file={item} iconSize={16} />}
            {!isFolder && isVideo(item) && <span className="absolute bottom-0 right-0 bg-black/70 p-0.5"><Play size={7} className="fill-white text-white" /></span>}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={cn('truncate text-[13.5px]', selected ? 'text-accent-600 dark:text-accent-400' : 'text-fg')}>{isFolder ? item.name : item.original_name}</p>
              {item.is_favorite && <Heart size={11} className="shrink-0 fill-current text-muted" />}
              {item.link_active === false && !isTrash && <Link2Off size={12} className="shrink-0 text-subtle" />}
            </div>
            <p className="truncate font-mono text-[10.5px] text-subtle md:hidden">
              {isFolder ? pluralize(item.file_count || 0, 'fichier') : `${formatSize(item.size)} · ${formatRelative(item.created_at)}`}
            </p>
          </div>
        </div>

        <span className="hidden truncate text-xs text-muted xl:block">{isFolder || item.owner_id === handlers.userId ? 'Moi' : item.owner_pseudo || '—'}</span>
        <span className="hidden truncate font-mono text-[11.5px] text-muted md:block" title={formatDate(item.created_at, 'Pp')}>
          {isTrash ? trashRemaining(item.deleted_at) : formatRelative(item.created_at)}
        </span>
        <span className="hidden text-right font-mono text-[11.5px] text-muted sm:block">{isFolder ? (item.total_size > 0 ? formatSize(item.total_size) : '—') : formatSize(item.size)}</span>
        <span className="hidden xl:block">
          <span className="font-mono text-[10.5px] tracking-[0.08em] text-subtle">{isFolder ? 'DOSSIER' : fileExt(item)}</span>
        </span>
        <span className="flex justify-end">
          <MoreButton items={menu} onOpen={() => handlers.onContext(item)} className="text-subtle opacity-0 hover:text-fg group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
        </span>
      </div>
    </ContextMenu>
  )
})
