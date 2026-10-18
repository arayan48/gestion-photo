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
          <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rotate-[4deg] rounded-2xl border border-line bg-elevated opacity-60 shadow-float" />
          <div className="absolute inset-0 translate-x-1 translate-y-1 rotate-[2deg] rounded-2xl border border-line bg-elevated opacity-80" />
        </>
      )}
      <div className="relative flex items-center gap-2.5 rounded-2xl border border-accent-500/60 bg-elevated/95 p-2 shadow-glow backdrop-blur-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-overlay">
          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <Icon size={18} className={isFolder ? 'text-amber-400' : 'text-accent-400'} />}
        </div>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-fg">
          {count > 1 ? `${count} éléments` : isFolder ? item.name : item?.original_name}
        </p>
      </div>
      {count > 1 && (
        <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white shadow-glow">
          {count}
        </span>
      )}
    </div>
  )
}
