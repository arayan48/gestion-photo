import { Folder, FileImage, FileVideo, File, Link2, LinkOff, Heart } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function FileIcon({ mime }) {
  if (mime?.startsWith('image/')) return <FileImage size={20} className="text-blue-400" />
  if (mime?.startsWith('video/')) return <FileVideo size={20} className="text-purple-400" />
  return <File size={20} className="text-gray-400" />
}

export default function FileGrid({ files, folders, onFileClick, onContextMenu, isTrash }) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {/* Dossiers */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg p-3 cursor-pointer transition-colors group"
          onDoubleClick={() => navigate(`/explorer/${folder.id}`)}
          onContextMenu={(e) => onContextMenu(e, { ...folder, type: 'folder' })}
        >
          <div className="flex items-center justify-center h-16 mb-2">
            <Folder size={36} className="text-yellow-500/80" />
          </div>
          <p className="text-xs text-gray-300 truncate text-center font-medium">{folder.name}</p>
        </div>
      ))}

      {/* Fichiers */}
      {files.map((file) => (
        <div
          key={file.id}
          className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg overflow-hidden cursor-pointer transition-colors group relative"
          onClick={() => onFileClick(file)}
          onContextMenu={(e) => onContextMenu(e, file)}
        >
          {/* Thumbnail ou icône */}
          <div className="h-28 bg-gray-800 flex items-center justify-center overflow-hidden relative">
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
              {file.link_active === false && <LinkOff size={12} className="text-red-400" />}
            </div>
          </div>

          <div className="p-2">
            <p className="text-xs text-gray-300 truncate font-medium">{file.original_name}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
              <FileIcon mime={file.mime_type} />
            </div>
          </div>
        </div>
      ))}

      {files.length === 0 && folders.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500">
          <FileImage size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Aucun fichier ici</p>
        </div>
      )}
    </div>
  )
}
