import { Folder, FileImage, FileVideo, File, Unlink, Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function FileIcon({ mime }) {
  if (mime?.startsWith('image/')) return <FileImage size={20} className="text-blue-400" />
  if (mime?.startsWith('video/')) return <FileVideo size={20} className="text-purple-400" />
  return <File size={20} className="text-slate-400" />
}

export default function FileGrid({ files, folders, onFileClick, onContextMenu, isTrash, selectedFiles = [], onToggleSelect }) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {/* Dossiers */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-800 rounded-xl p-3 cursor-pointer transition-colors"
          onDoubleClick={() => navigate(`/explorer/${folder.id}`)}
          onContextMenu={(e) => onContextMenu(e, { ...folder, type: 'folder' })}
        >
          <div className="flex items-center justify-center h-16 mb-2">
            <Folder size={36} className="text-yellow-500/80" />
          </div>
          <p className="text-xs text-slate-700 dark:text-gray-300 truncate text-center font-medium">{folder.name}</p>
        </div>
      ))}

      {/* Fichiers */}
      {files.map((file) => {
        const isSelected = selectedFiles.includes(file.id)
        return (
          <div
            key={file.id}
            className={`relative rounded-xl overflow-hidden cursor-pointer transition-all group border ${
              isSelected
                ? 'ring-2 ring-violet-500 border-violet-400 dark:border-violet-500 bg-violet-50/50 dark:bg-violet-900/10'
                : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
            }`}
            onClick={() => onFileClick(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
          >
            {/* Checkbox multi-select */}
            {onToggleSelect && (
              <div
                className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id) }}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                  isSelected
                    ? 'bg-violet-600 border-violet-600'
                    : 'bg-white/90 dark:bg-gray-900/90 border-slate-300 dark:border-gray-600'
                }`}>
                  {isSelected && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-white fill-current">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* Thumbnail ou icône */}
            <div className="h-28 bg-slate-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
              {file.thumbnail_path ? (
                <img
                  src={file.thumbnail_path}
                  alt={file.original_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <FileIcon mime={file.mime_type} />
              )}

              {/* Badges */}
              <div className="absolute top-1 right-1 flex gap-1">
                {file.is_favorite && <Heart size={12} className="text-pink-400 fill-pink-400" />}
                {file.link_active === false && <Unlink size={12} className="text-red-400" />}
              </div>
            </div>

            <div className="p-2">
              <p className="text-xs text-slate-700 dark:text-gray-300 truncate font-medium">{file.original_name}</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{formatSize(file.size)}</p>
            </div>
          </div>
        )
      })}

      {files.length === 0 && folders.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-gray-500">
          <FileImage size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Aucun fichier ici</p>
        </div>
      )}
    </div>
  )
}
