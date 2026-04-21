import { X, Download, Link2, LinkOff, Heart, HeartOff, Copy, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}

export default function FileViewer({ file, onClose, onAction }) {
  const isImage = file.mime_type?.startsWith('image/')
  const isVideo = file.mime_type?.startsWith('video/')
  const mediaUrl = `/api/files/public/${file.link_token}`

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Visualiseur */}
      <div className="flex-1 flex items-center justify-center p-4 min-w-0">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg bg-gray-900/80 text-gray-400 hover:text-gray-100 transition-colors">
          <X size={20} />
        </button>

        {isImage && (
          <img
            src={mediaUrl}
            alt={file.original_name}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}

        {isVideo && (
          <video
            controls
            className="max-w-full max-h-full rounded-lg"
            poster={file.thumbnail_path}
            autoPlay={false}
          >
            <source src={mediaUrl} type={file.mime_type} />
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        )}
      </div>

      {/* Panel d'infos */}
      <div className="w-72 bg-gray-900 border-l border-gray-800 p-5 overflow-y-auto shrink-0 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-gray-100 break-all">{file.original_name}</h3>
          <p className="text-xs text-gray-500 mt-1">Par {file.owner_pseudo}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onAction('download', file)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
            <Download size={13} /> Télécharger
          </button>
          <button onClick={() => onAction('copy-link', file)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
            <Copy size={13} /> Copier le lien
          </button>
          <button onClick={() => onAction(file.is_favorite ? 'unfavorite' : 'favorite', file)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
            {file.is_favorite ? <HeartOff size={13} /> : <Heart size={13} />}
            {file.is_favorite ? 'Retirer' : 'Favori'}
          </button>
        </div>

        {/* Lien */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">Lien public</span>
            <button
              onClick={() => onAction('toggle-link', file)}
              className={`text-xs px-2 py-0.5 rounded-full ${file.link_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}
            >
              {file.link_active ? 'Actif' : 'Inactif'}
            </button>
          </div>
          <p className="text-xs text-gray-500 break-all font-mono">/media/{file.link_token}</p>
          <p className="text-xs text-gray-600 mt-1">{file.link_access_count} accès</p>
        </div>

        {/* Métadonnées */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400">Informations</p>
          <div className="space-y-1.5">
            <Row label="Taille" value={formatSize(file.size)} />
            <Row label="Format" value={file.mime_type} />
            {file.width && <Row label="Résolution" value={`${file.width} × ${file.height}`} />}
            {file.duration && <Row label="Durée" value={`${Math.round(file.duration)}s`} />}
            {file.fps && <Row label="FPS" value={file.fps?.toFixed(1)} />}
            {file.codec && <Row label="Codec" value={file.codec} />}
            <Row label="Qualité" value={file.quality_preset} />
            <Row label="Ajouté le" value={format(new Date(file.created_at), 'dd MMM yyyy', { locale: fr })} />
          </div>
        </div>

        {/* Tags */}
        {file.tags?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {file.tags.map((tag) => (
                <span key={tag.id} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-300 text-right">{value}</span>
    </div>
  )
}
