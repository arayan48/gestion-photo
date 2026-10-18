import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, MouseSensor, KeyboardSensor, useSensor, useSensors,
  pointerWithin, rectIntersection,
} from '@dnd-kit/core'
import { Folder, FileImage, FileVideo } from 'lucide-react'
import { isImage, isVideo } from '../../lib/media.js'

/*
  Contexte de glisser-déposer global : l'explorateur, le fil d'Ariane ET l'arborescence
  de la barre latérale partagent le même DndContext. On peut donc glisser des fichiers
  ou des dossiers directement vers un dossier de la barre latérale.

  Souris et pavé tactile uniquement : sur écran tactile, l'appui long ouvre le menu
  contextuel et le déplacement passe par « Déplacer vers… ».
*/
const DndBridge = createContext(null)

function collision(args) {
  const pointer = pointerWithin(args)
  return pointer.length ? pointer : rectIntersection(args)
}

export function DndProvider({ children }) {
  const handlers = useRef({})
  const [preview, setPreview] = useState(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const register = useCallback((h) => {
    handlers.current = h
    return () => { if (handlers.current === h) handlers.current = {} }
  }, [])

  const value = useMemo(() => ({ register, setPreview }), [register])

  return (
    <DndBridge.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(e) => handlers.current.onDragStart?.(e)}
        onDragEnd={(e) => { setPreview(null); handlers.current.onDragEnd?.(e) }}
        onDragCancel={() => setPreview(null)}
        autoScroll={{ threshold: { x: 0, y: 0.15 } }}
      >
        {children}
        <DragOverlay dropAnimation={null} zIndex={500}>
          {preview && <DragPreview {...preview} />}
        </DragOverlay>
      </DndContext>
    </DndBridge.Provider>
  )
}

export const useDndBridge = () => useContext(DndBridge)

// Aperçu qui suit le curseur : vignette réelle + pile et compteur si sélection multiple
function DragPreview({ item, count }) {
  const isFolder = item?.kind === 'folder'
  const thumb = !isFolder && item?.thumbnail_path
  const Icon = isFolder ? Folder : isVideo(item) ? FileVideo : isImage(item) ? FileImage : FileImage
  return (
    <div className="pointer-events-none relative w-44 -translate-x-4 -translate-y-4 select-none">
      {count > 1 && (
        <>
          <div className="absolute inset-0 translate-x-2 translate-y-2 border border-line-strong bg-elevated" />
          <div className="absolute inset-0 translate-x-1 translate-y-1 border border-line-strong bg-elevated" />
        </>
      )}
      <div className="relative flex items-center gap-2.5 border border-accent-500 bg-elevated p-1.5 shadow-float">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-overlay">
          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <Icon size={16} strokeWidth={1.5} className="text-subtle" />}
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-fg">
          {count > 1 ? `${count} éléments` : isFolder ? item.name : item?.original_name}
        </p>
      </div>
      {count > 1 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-accent-600 px-1 font-mono text-[11px] text-white">
          {count}
        </span>
      )}
    </div>
  )
}
