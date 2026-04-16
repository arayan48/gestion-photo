import { Folder, FileImage, FileVideo, File, Heart, LinkOff } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export default function FileList({ files, folders, onFileClick, onContextMenu, isTrash }) {
  const navigate = useNavigate()

  return (
    <div className="space-y-1">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
          onDoubleClick={() => navigate(`/explorer/${folder.id}`)}
          onContextMenu={(e) => onContextMenu(e, { ...folder, type: 'folder' })}
        >
          <Folder size={18} className="text-yellow-500/80 shrink-0" />
          <span className="text-sm text-gray-300 flex-1 truncate">{folder.name}</span>
          <span className="text-xs text-gray-500">Dossier</span>
        </div>
      ))}

      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
          onClick={() => onFileClick(file)}
          onContextMenu={(e) => onContextMenu(e, file)}
        >
          <div className="w-8 h-8 rounded overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
            {file.thumbnail_path ? (
              <img src={file.thumbnail_path} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : file.mime_type?.startsWith('image/') ? (
              <FileImage size={16} className="text-blue-400" />
            ) : file.mime_type?.startsWith('video/') ? (
              <FileVideo size={16} className="text-purple-400" />
            ) : (
              <File size={16} className="text-gray-400" />
            )}
          </div>

          <span className="text-sm text-gray-300 flex-1 truncate">{file.original_name}</span>

          <div className="flex items-center gap-2 shrink-0">
            {file.is_favorite && <Heart size={12} className="text-pink-400 fill-pink-400" />}
            {file.link_active === false && <LinkOff size={12} className="text-red-400" />}
            <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
            <span className="text-xs text-gray-600 w-28 text-right">
              {formatDistanceToNow(new Date(file.created_at), { locale: fr, addSuffix: true })}
            </span>
            <span className="text-xs text-gray-500 w-24 truncate">{file.owner_pseudo}</span>
          </div>
        </div>
      ))}

      {files.length === 0 && folders.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-16">Aucun fichier ici</p>
      )}
    </div>
  )
}
