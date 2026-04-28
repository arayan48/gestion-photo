import { Folder, FileImage, FileVideo, File, Heart, Unlink, CornerLeftUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { formatSize } from '../../utils/format.js'

export function ListSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
      <div className="h-8 bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-gray-800 last:border-0 animate-pulse">
          <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-gray-800 shrink-0" />
          <div className="flex-1 h-3 bg-slate-200 dark:bg-gray-800 rounded w-2/5" />
          <div className="w-14 h-2.5 bg-slate-200 dark:bg-gray-800 rounded hidden sm:block" />
          <div className="w-10 h-2.5 bg-slate-200 dark:bg-gray-800 rounded hidden sm:block" />
          <div className="w-20 h-2.5 bg-slate-200 dark:bg-gray-800 rounded hidden lg:block" />
        </div>
      ))}
    </div>
  )
}

function TypeIcon({ mime }) {
  if (mime?.startsWith('image/')) return <FileImage size={15} className="text-blue-400 shrink-0" />
  if (mime?.startsWith('video/')) return <FileVideo size={15} className="text-purple-400 shrink-0" />
  return <File size={15} className="text-slate-400 shrink-0" />
}

function TypeBadge({ mime }) {
  if (!mime) return null
  const ext = mime.split('/')[1]?.split(';')[0]?.toUpperCase() || '?'
  return (
    <span className="text-[10px] font-mono bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500 px-1.5 py-0.5 rounded">
      {ext}
    </span>
  )
}

// Ligne ".." dossier parent — droppable
function ParentFolderRow({ parentFolderId, onNavigate, showCheckbox }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'drop-parent',
    data: { type: 'folder', folderId: parentFolderId },
  })
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150 border-b border-slate-100 dark:border-gray-800 ${
        isOver ? 'bg-violet-50 dark:bg-violet-950/50 border-l-2 border-l-violet-500' : 'hover:bg-slate-50 dark:hover:bg-gray-800'
      }`}
      onDoubleClick={onNavigate}
      title="Dossier parent (double-clic pour remonter)"
    >
      {showCheckbox && <div className="w-4 shrink-0" />}
      <div className="w-7 shrink-0 flex items-center justify-center">
        <div className="relative">
          <Folder size={15} className={`transition-colors duration-150 ${isOver ? 'text-violet-500' : 'text-slate-300 dark:text-gray-600'}`} />
          <CornerLeftUp size={9} className="absolute -top-1 -right-1 text-slate-400 dark:text-gray-500" />
        </div>
      </div>
      <span className={`text-sm flex-1 truncate font-medium select-none transition-colors duration-150 ${isOver ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500'}`}>..</span>
      <span className="w-20 hidden sm:block" />
      <span className="w-16 text-center hidden sm:block">
        <span className="text-[10px] bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600 px-1.5 py-0.5 rounded font-mono">DIR</span>
      </span>
      <span className="w-28 hidden md:block" />
      <span className="w-32 hidden lg:block" />
    </div>
  )
}

// Ligne dossier droppable
function DroppableFolderRow({ folder, onContextMenu, showCheckbox }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  })
  const navigate = useNavigate()
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150 border-b border-slate-100 dark:border-gray-800 ${
        isOver ? 'bg-violet-50 dark:bg-violet-950/50 border-l-2 border-l-violet-500' : 'hover:bg-slate-50 dark:hover:bg-gray-800'
      }`}
      onDoubleClick={() => navigate(`/explorer/${folder.id}`)}
      onContextMenu={(e) => onContextMenu(e, { ...folder, type: 'folder' })}
    >
      {showCheckbox && <div className="w-4 shrink-0" />}
      <Folder size={15} className={`shrink-0 w-7 transition-colors duration-150 ${isOver ? 'text-violet-500' : 'text-yellow-500/80'}`} />
      <span className={`text-sm flex-1 truncate font-medium transition-colors duration-150 ${isOver ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-gray-300'}`}>
        {folder.name}
      </span>
      <span className="w-20 hidden sm:block" />
      <span className="w-16 text-center hidden sm:block">
        <span className="text-[10px] bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500 px-1.5 py-0.5 rounded font-mono">DIR</span>
      </span>
      <span className="w-28 hidden md:block" />
      <span className="w-32 hidden lg:block" />
    </div>
  )
}

// Ligne fichier draggable
function DraggableFileRow({ file, isSelected, onToggleSelect, onFileClick, onContextMenu, isTrash, isDraggingGroup }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `file-${file.id}`,
    data: { type: 'file', fileId: file.id },
    disabled: isTrash,
  })

  // Même principe : ne pas appliquer le transform, juste masquer l'original
  const style = isDragging
    ? { opacity: 0 }
    : isDraggingGroup ? { opacity: 0.4 } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 transition-all border-b border-slate-100 dark:border-gray-800 group last:border-0 ${
        isDragging
          ? 'cursor-grabbing'
          : isTrash ? 'cursor-pointer' : 'cursor-grab'
      } ${
        isSelected ? 'bg-violet-50 dark:bg-violet-900/10' : 'hover:bg-slate-50 dark:hover:bg-gray-800'
      }`}
      onClick={() => !isDragging && onFileClick(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
      {...(!isTrash ? listeners : {})}
      {...(!isTrash ? attributes : {})}
    >
      {/* Checkbox */}
      {onToggleSelect && (
        <div
          className={`shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id) }}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-gray-600'
          }`}>
            {isSelected && (
              <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white fill-current">
                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
        {file.thumbnail_path
          ? <img src={file.thumbnail_path} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <TypeIcon mime={file.mime_type} />
        }
      </div>

      {/* Nom */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-sm text-slate-700 dark:text-gray-300 truncate">{file.original_name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {file.is_favorite && <Heart size={11} className="text-pink-400 fill-pink-400" />}
          {file.link_active === false && <Unlink size={11} className="text-red-400" />}
        </div>
      </div>

      <span className="text-xs text-slate-400 dark:text-gray-500 w-20 text-right hidden sm:block shrink-0">{formatSize(file.size)}</span>
      <span className="w-16 text-center hidden sm:block shrink-0"><TypeBadge mime={file.mime_type} /></span>
      <span className="text-xs text-slate-400 dark:text-gray-500 w-28 text-right truncate hidden md:block shrink-0">{file.owner_pseudo || '—'}</span>
      <span className="text-xs text-slate-400 dark:text-gray-600 w-32 text-right hidden lg:block shrink-0">
        {formatDistanceToNow(new Date(file.created_at), { locale: fr, addSuffix: true })}
      </span>
    </div>
  )
}

export default function FileList({
  files, folders, onFileClick, onContextMenu, isTrash,
  selectedFiles = [], onToggleSelect,
  parentFolderId, onNavigateUp,
  draggingIds = [],
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
      {(files.length > 0 || folders.length > 0 || parentFolderId !== undefined) && (
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-600">
          {onToggleSelect && <div className="w-4 shrink-0" />}
          <div className="w-7 shrink-0" />
          <span className="flex-1">Nom</span>
          <span className="w-20 text-right hidden sm:block">Taille</span>
          <span className="w-16 text-center hidden sm:block">Type</span>
          <span className="w-28 text-right hidden md:block">Propriétaire</span>
          <span className="w-32 text-right hidden lg:block">Date d'ajout</span>
        </div>
      )}

      {parentFolderId !== undefined && onNavigateUp && !isTrash && (
        <ParentFolderRow parentFolderId={parentFolderId} onNavigate={onNavigateUp} showCheckbox={!!onToggleSelect} />
      )}

      {folders.map((folder) => (
        <DroppableFolderRow key={folder.id} folder={folder} onContextMenu={onContextMenu} showCheckbox={!!onToggleSelect} />
      ))}

      {files.map((file) => (
        <DraggableFileRow
          key={file.id}
          file={file}
          isSelected={selectedFiles.includes(file.id)}
          onToggleSelect={onToggleSelect}
          onFileClick={onFileClick}
          onContextMenu={onContextMenu}
          isTrash={isTrash}
          isDraggingGroup={draggingIds.includes(file.id)}
        />
      ))}

      {files.length === 0 && folders.length === 0 && (
        <div className="text-center py-16">
          <FileImage size={36} className="mx-auto text-slate-200 dark:text-gray-700 mb-2" />
          <p className="text-sm text-slate-400 dark:text-gray-500">Aucun fichier ici</p>
        </div>
      )}
    </div>
  )
}
