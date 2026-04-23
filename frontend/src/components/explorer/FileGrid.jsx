import { Folder, FileImage, FileVideo, File, Unlink, Heart, Download, Copy, Eye, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../../stores/toast.store.js'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
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
      className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
        danger
          ? 'bg-black/40 text-red-400 hover:bg-red-500 hover:text-white'
          : 'bg-black/40 text-white/80 hover:bg-white/20 hover:text-white'
      }`}
    >
      <Icon size={13} />
    </button>
  )
}

export default function FileGrid({ files, folders, onFileClick, onContextMenu, isTrash, selectedFiles = [], onToggleSelect, onAction }) {
  const navigate = useNavigate()

  const copyLink = (file) => {
    navigator.clipboard.writeText(`${window.location.origin}/media/${file.link_token}`)
    toast.success('Lien copié dans le presse-papiers')
  }

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
                ? 'ring-2 ring-violet-500 border-violet-400 dark:border-violet-500'
                : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 hover:shadow-md'
            }`}
            onClick={() => onFileClick(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
          >
            {/* Checkbox */}
            {onToggleSelect && (
              <div
                className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id) }}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                  isSelected ? 'bg-violet-600 border-violet-600' : 'bg-white/90 dark:bg-gray-900/90 border-slate-300 dark:border-gray-600'
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
              {file.thumbnail_path ? (
                <img src={file.thumbnail_path} alt={file.original_name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <FileTypeIcon mime={file.mime_type} size={28} />
              )}

              {/* Overlay actions rapides */}
              {!isTrash && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                  <QuickAction icon={Eye}      title="Ouvrir"          onClick={() => onFileClick(file)} />
                  <QuickAction icon={Download} title="Télécharger"     onClick={() => window.open(`/api/files/${file.id}/download`, '_blank')} />
                  <QuickAction icon={Copy}     title="Copier le lien"  onClick={() => copyLink(file)} />
                  {onAction && (
                    <QuickAction icon={Trash2} title="Supprimer"       onClick={() => onAction('delete', file)} danger />
                  )}
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-1 right-1 flex gap-1 z-10">
                {file.is_favorite && <Heart size={12} className="text-pink-400 fill-pink-400 drop-shadow" />}
                {file.link_active === false && <Unlink size={12} className="text-red-400 drop-shadow" />}
              </div>
            </div>

            <div className="p-2">
              <p className="text-xs text-slate-700 dark:text-gray-300 truncate font-medium">{file.original_name}</p>
              <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">{formatSize(file.size)}</p>
            </div>
          </div>
        )
      })}

      {files.length === 0 && folders.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-gray-500">
          <FileImage size={48} className="mb-3 opacity-20" />
          <p className="text-sm font-medium">Aucun fichier ici</p>
          <p className="text-xs mt-1 opacity-60">Glissez des fichiers ou cliquez sur Uploader</p>
        </div>
      )}
    </div>
  )
}
