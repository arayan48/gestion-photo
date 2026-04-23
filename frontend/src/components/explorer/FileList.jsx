import { Folder, FileImage, FileVideo, File, Heart, Unlink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
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

export default function FileList({ files, folders, onFileClick, onContextMenu, isTrash, selectedFiles = [], onToggleSelect }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
      {/* En-têtes */}
      {(files.length > 0 || folders.length > 0) && (
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

      {/* Dossiers */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b border-slate-100 dark:border-gray-800"
          onDoubleClick={() => navigate(`/explorer/${folder.id}`)}
          onContextMenu={(e) => onContextMenu(e, { ...folder, type: 'folder' })}
        >
          {onToggleSelect && <div className="w-4 shrink-0" />}
          <Folder size={15} className="text-yellow-500/80 shrink-0 w-7" />
          <span className="text-sm text-slate-700 dark:text-gray-300 flex-1 truncate font-medium">{folder.name}</span>
          <span className="w-20 hidden sm:block" />
          <span className="w-16 text-center hidden sm:block">
            <span className="text-[10px] bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500 px-1.5 py-0.5 rounded font-mono">DIR</span>
          </span>
          <span className="w-28 hidden md:block" />
          <span className="w-32 hidden lg:block" />
        </div>
      ))}

      {/* Fichiers */}
      {files.map((file) => {
        const isSelected = selectedFiles.includes(file.id)
        return (
          <div
            key={file.id}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-gray-800 group last:border-0 ${
              isSelected
                ? 'bg-violet-50 dark:bg-violet-900/10'
                : 'hover:bg-slate-50 dark:hover:bg-gray-800'
            }`}
            onClick={() => onFileClick(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
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
              {file.thumbnail_path ? (
                <img src={file.thumbnail_path} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : <TypeIcon mime={file.mime_type} />}
            </div>

            {/* Nom */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-sm text-slate-700 dark:text-gray-300 truncate">{file.original_name}</span>
              <div className="flex items-center gap-1 shrink-0">
                {file.is_favorite && <Heart size={11} className="text-pink-400 fill-pink-400" />}
                {file.link_active === false && <Unlink size={11} className="text-red-400" />}
              </div>
            </div>

            {/* Taille */}
            <span className="text-xs text-slate-400 dark:text-gray-500 w-20 text-right hidden sm:block shrink-0">
              {formatSize(file.size)}
            </span>

            {/* Type */}
            <span className="w-16 text-center hidden sm:block shrink-0">
              <TypeBadge mime={file.mime_type} />
            </span>

            {/* Propriétaire */}
            <span className="text-xs text-slate-400 dark:text-gray-500 w-28 text-right truncate hidden md:block shrink-0">
              {file.owner_pseudo || '—'}
            </span>

            {/* Date */}
            <span className="text-xs text-slate-400 dark:text-gray-600 w-32 text-right hidden lg:block shrink-0">
              {formatDistanceToNow(new Date(file.created_at), { locale: fr, addSuffix: true })}
            </span>
          </div>
        )
      })}

      {files.length === 0 && folders.length === 0 && (
        <div className="text-center py-16">
          <FileImage size={36} className="mx-auto text-slate-200 dark:text-gray-700 mb-2" />
          <p className="text-sm text-slate-400 dark:text-gray-500">Aucun fichier ici</p>
        </div>
      )}
    </div>
  )
}
