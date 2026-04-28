import { useState } from 'react'
import { Folder, FileImage, FileVideo, File, Unlink, Heart, Download, Copy, Eye, Trash2, CornerLeftUp, GripVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { toast } from '../../stores/toast.store.js'
import { formatSize } from '../../utils/format.js'

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 animate-pulse">
          <div className="h-28 bg-slate-200 dark:bg-gray-800" />
          <div className="p-2 space-y-1.5">
            <div className="h-2.5 bg-slate-200 dark:bg-gray-800 rounded w-3/4" />
            <div className="h-2 bg-slate-200 dark:bg-gray-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FileTypeIcon({ mime, size = 20 }) {
  if (mime?.startsWith('image/')) return <FileImage size={size} className="text-blue-400" />
  if (mime?.startsWith('video/')) return <FileVideo size={size} className="text-purple-400" />
  return <File size={size} className="text-slate-400" />
}

function QuickAction({ icon: Icon, title, onClick, danger }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-lg backdrop-blur-sm transition-all duration-150 ${
        danger
          ? 'bg-black/50 text-red-400 hover:bg-red-500 hover:text-white hover:scale-110'
          : 'bg-black/50 text-white/80 hover:bg-white/20 hover:text-white hover:scale-110'
      }`}
    >
      <Icon size={13} />
    </button>
  )
}

// ── Dossier parent ".." ───────────────────────────────────────────────────────
function ParentFolder({ parentFolderId, onNavigate }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'drop-parent',
    data: { type: 'folder', folderId: parentFolderId },
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-3 cursor-pointer select-none transition-colors duration-150 border border-dashed ${
        isOver
          ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-400 dark:border-violet-500'
          : 'bg-white/50 dark:bg-gray-900/50 border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800/80 hover:border-slate-400 dark:hover:border-gray-600'
      }`}
      onDoubleClick={onNavigate}
      title="Dossier parent — double-clic pour remonter"
    >
      <div className="relative flex items-center justify-center h-16 mb-2">
        <Folder size={32} className={`transition-colors duration-150 ${isOver ? 'text-violet-500' : 'text-slate-300 dark:text-gray-600'}`} />
        <CornerLeftUp size={12} className={`absolute top-1 right-1 transition-colors duration-150 ${isOver ? 'text-violet-400' : 'text-slate-400 dark:text-gray-600'}`} />
      </div>
      <p className={`text-xs truncate text-center font-medium transition-colors duration-150 ${isOver ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-600'}`}>..</p>
    </div>
  )
}

// ── Dossier droppable ─────────────────────────────────────────────────────────
function DroppableFolder({ folder, onDoubleClick, onContextMenu, isTrash }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
    disabled: isTrash,
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-3 cursor-pointer select-none transition-colors duration-150 border group ${
        isOver
          ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-400 dark:border-violet-500 border-dashed'
          : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800 hover:border-slate-300 dark:hover:border-gray-700 hover:shadow-sm'
      }`}
      onDoubleClick={() => onDoubleClick(folder)}
      onContextMenu={(e) => onContextMenu(e, { ...folder, type: 'folder' })}
    >
      <div className="flex items-center justify-center h-16 mb-2">
        <Folder
          size={36}
          className={`transition-colors duration-150 ${
            isOver ? 'text-violet-500' : 'text-yellow-500/80 group-hover:text-yellow-400'
          }`}
        />
      </div>
      <p className={`text-xs truncate text-center font-medium transition-colors duration-150 ${
        isOver ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-gray-300'
      }`}>{folder.name}</p>
    </div>
  )
}

// ── Fichier draggable ─────────────────────────────────────────────────────────
function DraggableFile({ file, isSelected, onToggleSelect, onFileClick, onContextMenu, onAction, isTrash, isDraggingGroup }) {
  const [thumbError, setThumbError] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `file-${file.id}`,
    data: { type: 'file', fileId: file.id },
    disabled: isTrash,
  })

  // Avec DragOverlay actif : masquer l'original (ne pas appliquer le transform,
  // sinon on voit l'élément EN DOUBLE — l'original qui suit + l'overlay)
  const style = isDragging
    ? { opacity: 0 }
    : isDraggingGroup ? { opacity: 0.4 } : undefined

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/media/${file.link_token}`)
    toast.success('Lien copié dans le presse-papiers')
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-xl overflow-hidden transition-all duration-200 group border ${
        isDragging
          ? 'shadow-2xl shadow-violet-500/20 cursor-grabbing scale-[1.03]'
          : isTrash
            ? 'cursor-pointer'
            : 'cursor-grab hover:scale-[1.02] hover:shadow-lg hover:shadow-black/15 active:cursor-grabbing'
      } ${
        isSelected
          ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-950 border-violet-400 dark:border-violet-500 shadow-md shadow-violet-500/20'
          : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
      }`}
      onClick={() => !isDragging && onFileClick(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
      {...(!isTrash ? listeners : {})}
      {...(!isTrash ? attributes : {})}
    >
      {/* Indicateur drag — coin supérieur droit */}
      {!isTrash && (
        <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-60 transition-opacity duration-150 pointer-events-none">
          <GripVertical size={12} className="text-white drop-shadow" />
        </div>
      )}

      {/* Checkbox multi-select */}
      {onToggleSelect && (
        <div
          className={`absolute top-2 left-2 z-10 transition-opacity duration-150 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id) }}
        >
          <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all duration-150 shadow-sm ${
            isSelected
              ? 'bg-violet-600 border-violet-600 shadow-violet-500/30'
              : 'bg-white/90 dark:bg-gray-900/90 border-slate-300 dark:border-gray-600 hover:border-violet-400'
          }`}>
            {isSelected && (
              <svg viewBox="0 0 12 12" className="w-3 h-3 text-white fill-current">
                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div className="h-28 bg-slate-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden relative">
        {file.thumbnail_path && !thumbError ? (
          <img
            src={file.thumbnail_path}
            alt={file.original_name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
            onError={() => setThumbError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 opacity-50">
            <FileTypeIcon mime={file.mime_type} size={28} />
          </div>
        )}

        {/* Overlay actions rapides */}
        {!isTrash && !isDragging && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-2.5 gap-1.5">
            <QuickAction icon={Eye}      title="Ouvrir"         onClick={() => onFileClick(file)} />
            <QuickAction icon={Download} title="Télécharger"    onClick={() => onAction?.('download', file)} />
            <QuickAction icon={Copy}     title="Copier le lien" onClick={copyLink} />
            {onAction && <QuickAction icon={Trash2} title="Supprimer" onClick={() => onAction('delete', file)} danger />}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-1.5 left-8 flex gap-1 z-10 pointer-events-none">
          {file.is_favorite && <Heart size={12} className="text-pink-400 fill-pink-400 drop-shadow" />}
          {file.link_active === false && <Unlink size={12} className="text-red-400 drop-shadow" />}
        </div>
      </div>

      <div className="p-2.5">
        <p className="text-xs text-slate-700 dark:text-gray-200 truncate font-medium leading-snug">{file.original_name}</p>
        <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">{formatSize(file.size)}</p>
      </div>
    </div>
  )
}

export default function FileGrid({
  files, folders, onFileClick, onContextMenu, isTrash,
  selectedFiles = [], onToggleSelect, onAction,
  parentFolderId, onNavigateUp,
  draggingIds = [],
}) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {/* Dossier parent ".." */}
      {parentFolderId !== undefined && onNavigateUp && !isTrash && (
        <ParentFolder parentFolderId={parentFolderId} onNavigate={onNavigateUp} />
      )}

      {/* Dossiers droppables */}
      {folders.map((folder) => (
        <DroppableFolder
          key={folder.id}
          folder={folder}
          onDoubleClick={(f) => navigate(`/explorer/${f.id}`)}
          onContextMenu={onContextMenu}
          isTrash={isTrash}
        />
      ))}

      {/* Fichiers draggables */}
      {files.map((file) => (
        <DraggableFile
          key={file.id}
          file={file}
          isSelected={selectedFiles.includes(file.id)}
          onToggleSelect={onToggleSelect}
          onFileClick={onFileClick}
          onContextMenu={onContextMenu}
          onAction={onAction}
          isTrash={isTrash}
          isDraggingGroup={draggingIds.includes(file.id)}
        />
      ))}

      {/* Empty state — affiché quel que soit parentFolderId (un dossier peut être vide) */}
      {files.length === 0 && folders.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-400 dark:text-gray-600">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-800/60 flex items-center justify-center mb-4 ring-1 ring-slate-200 dark:ring-gray-700">
            <FileImage size={28} className="opacity-40" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-gray-500">Aucun fichier ici</p>
          <p className="text-xs mt-1 text-slate-400 dark:text-gray-600">Glissez des fichiers ou cliquez sur Uploader</p>
        </div>
      )}
    </div>
  )
}
