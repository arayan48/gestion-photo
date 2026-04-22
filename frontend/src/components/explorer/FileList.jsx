import { Folder, FileImage, FileVideo, File, Heart, Unlink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export default function FileList({ files, folders, onFileClick, onContextMenu, isTrash, selectedFiles = [], onToggleSelect }) {
  const navigate = useNavigate()

  return (
    <div className="space-y-0.5">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
          onDoubleClick={() => navigate(`/explorer/${folder.id}`)}
          onContextMenu={(e) => onContextMenu(e, { ...folder, type: 'folder' })}
        >
          <Folder size={18} className="text-yellow-500/80 shrink-0" />
          <span className="text-sm text-slate-700 dark:text-gray-300 flex-1 truncate">{folder.name}</span>
          <span className="text-xs text-slate-400 dark:text-gray-500">Dossier</span>
        </div>
      ))}

      {files.map((file) => {
        const isSelected = selectedFiles.includes(file.id)
        return (
          <div
            key={file.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
              isSelected
                ? 'bg-violet-50 dark:bg-violet-900/10 ring-1 ring-violet-400 dark:ring-violet-600'
                : 'hover:bg-slate-100 dark:hover:bg-gray-800'
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

            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              {file.thumbnail_path ? (
                <img src={file.thumbnail_path} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : file.mime_type?.startsWith('image/') ? (
                <FileImage size={16} className="text-blue-400" />
              ) : file.mime_type?.startsWith('video/') ? (
                <FileVideo size={16} className="text-purple-400" />
              ) : (
                <File size={16} className="text-slate-400" />
              )}
            </div>

            <span className="text-sm text-slate-700 dark:text-gray-300 flex-1 truncate">{file.original_name}</span>

            <div className="flex items-center gap-3 shrink-0">
              {file.is_favorite && <Heart size={12} className="text-pink-400 fill-pink-400" />}
              {file.link_active === false && <Unlink size={12} className="text-red-400" />}
              <span className="text-xs text-slate-400 dark:text-gray-500 w-20 text-right">{formatSize(file.size)}</span>
              <span className="text-xs text-slate-400 dark:text-gray-600 w-28 text-right hidden sm:block">
                {formatDistanceToNow(new Date(file.created_at), { locale: fr, addSuffix: true })}
              </span>
              <span className="text-xs text-slate-400 dark:text-gray-500 w-24 truncate hidden md:block">{file.owner_pseudo}</span>
            </div>
          </div>
        )
      })}

      {files.length === 0 && folders.length === 0 && (
        <p className="text-center text-slate-400 dark:text-gray-500 text-sm py-16">Aucun fichier ici</p>
      )}
    </div>
  )
}
