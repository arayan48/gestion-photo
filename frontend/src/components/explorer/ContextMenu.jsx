import { useEffect, useRef } from 'react'
import { Eye, Download, Trash2, RotateCcw, Link2, Unlink, Heart, HeartOff, Copy, Info, Pencil } from 'lucide-react'

export default function ContextMenu({ x, y, file, isTrash, onAction, onClose }) {
  const ref = useRef(null)
  const isFolder = file?.type === 'folder'

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const style = {
    position: 'fixed',
    top: Math.min(y, window.innerHeight - 280),
    left: Math.min(x, window.innerWidth - 200),
    zIndex: 1000,
  }

  const MenuItem = ({ icon: Icon, label, onClick, danger }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded transition-colors text-left ${
        danger ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      <Icon size={14} className="shrink-0" />
      {label}
    </button>
  )

  // Les dossiers en corbeille n'ont pas d'actions : on n'affiche rien
  if (isTrash && isFolder) return null

  // Menu corbeille (fichiers uniquement)
  if (isTrash) {
    return (
      <div ref={ref} style={style} className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-1 w-48">
        <MenuItem icon={RotateCcw} label="Restaurer" onClick={() => onAction('restore', file)} />
        <MenuItem icon={Trash2} label="Supprimer définitivement" onClick={() => onAction('delete-permanent', file)} danger />
      </div>
    )
  }

  // Menu dossier
  if (isFolder) {
    return (
      <div ref={ref} style={style} className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-1 w-48">
        <MenuItem icon={Pencil} label="Renommer" onClick={() => onAction('rename-folder', file)} />
        <div className="my-1 border-t border-gray-800" />
        <MenuItem icon={Trash2} label="Supprimer le dossier" onClick={() => onAction('delete-folder', file)} danger />
      </div>
    )
  }

  // Menu fichier
  return (
    <div ref={ref} style={style} className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-1 w-48">
      <MenuItem icon={Eye}      label="Ouvrir"           onClick={() => onAction('view', file)} />
      <MenuItem icon={Download} label="Télécharger"      onClick={() => onAction('download', file)} />
      <MenuItem icon={Copy}     label="Copier le lien"   onClick={() => onAction('copy-link', file)} />
      <div className="my-1 border-t border-gray-800" />
      {file.is_favorite
        ? <MenuItem icon={HeartOff} label="Retirer des favoris" onClick={() => onAction('unfavorite', file)} />
        : <MenuItem icon={Heart}    label="Ajouter aux favoris" onClick={() => onAction('favorite', file)} />
      }
      {file.link_active
        ? <MenuItem icon={Unlink} label="Désactiver le lien" onClick={() => onAction('toggle-link', file)} />
        : <MenuItem icon={Link2}  label="Activer le lien"    onClick={() => onAction('toggle-link', file)} />
      }
      <MenuItem icon={Pencil} label="Renommer" onClick={() => onAction('rename', file)} />
      <div className="my-1 border-t border-gray-800" />
      <MenuItem icon={Info}   label="Informations" onClick={() => onAction('info', file)} />
      <MenuItem icon={Trash2} label="Supprimer"    onClick={() => onAction('delete', file)} danger />
    </div>
  )
}
