import { useEffect } from 'react'
import { X, Download, Heart, HeartOff, Copy, Link2, Unlink, Trash2, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuthStore } from '../../stores/auth.store.js'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-300 text-right">{value}</span>
    </div>
  )
}

export default function FileViewer({ file, onClose, onAction }) {
  const { accessToken } = useAuthStore()
  const isImage = file.mime_type?.startsWith('image/')
  const isVideo = file.mime_type?.startsWith('video/')
  const mediaUrl = `/api/files/${file.id}/view?token=${encodeURIComponent(accessToken || '')}`

  // Touche Escape pour fermer
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Zone visualiseur */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-w-0 relative">
        {/* Bouton fermer + hint Escape */}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
          <span className="text-xs text-gray-500 bg-black/40 px-2 py-1 rounded-lg">Esc pour fermer</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-900/80 text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Media */}
        {isImage && (
          <img
            src={mediaUrl}
            alt={file.original_name}
            className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-xl shadow-2xl"
          />
        )}

        {isVideo && (
          <video
            controls
            className="max-w-full max-h-[calc(100vh-120px)] rounded-xl shadow-2xl"
            poster={file.thumbnail_path}
          >
            <source src={mediaUrl} type={file.mime_type} />
          </video>
        )}

        {/* Nom du fichier sous le média */}
        <p className="mt-3 text-sm text-gray-400 text-center max-w-md truncate">{file.original_name}</p>
      </div>

      {/* Panel d'infos */}
      <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-100 break-all text-sm">{file.original_name}</h3>
            <p className="text-xs text-gray-500 mt-1">Par {file.owner_pseudo}</p>
          </div>

          {/* Actions rapides */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onAction('download', file)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 flex-1">
              <Download size={13} /> Télécharger
            </button>
            <button onClick={() => onAction('copy-link', file)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 flex-1">
              <Copy size={13} /> Lien
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAction(file.is_favorite ? 'unfavorite' : 'favorite', file)}
              className={`btn-secondary text-xs py-1.5 flex items-center gap-1.5 flex-1 ${file.is_favorite ? 'text-pink-400' : ''}`}
            >
              {file.is_favorite ? <HeartOff size={13} /> : <Heart size={13} />}
              {file.is_favorite ? 'Retirer' : 'Favori'}
            </button>
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"
            >
              <ExternalLink size={13} /> Ouvrir
            </a>
          </div>

          {/* Lien public */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-300">Lien public</span>
              <button
                onClick={() => onAction('toggle-link', file)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  file.link_active
                    ? 'bg-green-900/50 text-green-400 hover:bg-green-900'
                    : 'bg-red-900/50 text-red-400 hover:bg-red-900'
                }`}
              >
                {file.link_active ? 'Actif' : 'Inactif'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 break-all font-mono">/media/{file.link_token}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{file.link_access_count} accès</p>
          </div>

          {/* Métadonnées */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Informations</p>
            <div className="space-y-1.5">
              <Row label="Taille" value={formatSize(file.size)} />
              <Row label="Type" value={file.mime_type?.split('/')[1]?.toUpperCase() || '?'} />
              {file.width && <Row label="Résolution" value={`${file.width} × ${file.height} px`} />}
              {file.duration && <Row label="Durée" value={`${Math.floor(file.duration / 60)}m${Math.round(file.duration % 60)}s`} />}
              {file.fps && <Row label="FPS" value={file.fps?.toFixed(1)} />}
              {file.codec && <Row label="Codec" value={file.codec} />}
              <Row label="Qualité" value={file.quality_preset} />
              <Row label="Ajouté le" value={format(new Date(file.created_at), 'dd MMM yyyy HH:mm', { locale: fr })} />
            </div>
          </div>

          {/* Tags */}
          {file.tags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {file.tags.map((tag) => (
                  <span key={tag.id} className="text-xs bg-violet-900/40 text-violet-300 px-2 py-0.5 rounded-full">
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bouton supprimer en bas */}
        <div className="p-4 border-t border-gray-800 shrink-0">
          <button
            onClick={() => onAction('delete', file)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-900/30 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-900/50 text-sm font-medium transition-colors"
          >
            <Trash2 size={15} />
            Supprimer ce fichier
          </button>
        </div>
      </div>
    </div>
  )
}
