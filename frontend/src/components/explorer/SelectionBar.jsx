import { AnimatePresence, motion } from 'framer-motion'
import { X, Download, Heart, FolderInput, Trash2, RotateCcw, XCircle, MoreHorizontal } from 'lucide-react'
import { downloadZip } from '../../lib/actions.js'
import { trashFiles, setFavorite, openMoveDialog, restoreFiles, deleteForever, deleteFolders, selectionMenu } from './itemActions.js'
import { IconButton } from '../ui/Button.jsx'
import { DropdownMenu } from '../ui/Menu.jsx'
import { Tooltip } from '../ui/Tooltip.jsx'

// Barre flottante des actions groupées (apparaît dès qu'un élément est sélectionné)
export default function SelectionBar({ items, total, onClear, onSelectAll, ctx }) {
  const files = items.filter((i) => i.kind === 'file')
  const folders = items.filter((i) => i.kind === 'folder')
  const allFav = files.length > 0 && files.every((f) => f.is_favorite)

  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 80, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          data-no-lasso
          className="absolute bottom-4 left-1/2 z-[60] flex max-w-[calc(100%-16px)] items-center gap-0.5 overflow-x-auto rounded-sm border border-line-strong bg-elevated p-1 shadow-float scrollbar-none md:bottom-6"
        >
          <IconButton icon={X} label="Tout désélectionner" shortcut="Échap" size="md" onClick={onClear} />
          <div className="px-1.5 pr-3">
            <p className="whitespace-nowrap font-mono text-[13px] text-fg">{items.length}<span className="text-subtle"> / {total}</span></p>
            {items.length < total && (
              <button onClick={onSelectAll} className="whitespace-nowrap text-[11px] text-subtle underline underline-offset-2 hover:text-fg">Tout sélectionner</button>
            )}
          </div>
          <div className="h-8 w-px bg-line" />

          {ctx.isTrash ? (
            <>
              <IconButton icon={RotateCcw} label="Restaurer" onClick={() => restoreFiles(files)} />
              <IconButton icon={XCircle} label="Supprimer définitivement" onClick={() => deleteForever(files)} className="hover:bg-red-600 hover:text-white" />
            </>
          ) : (
            <>
              {files.length > 0 && <IconButton icon={Download} label={files.length > 1 ? 'Télécharger en ZIP' : 'Télécharger'} onClick={() => downloadZip(files.map((f) => f.id))} />}
              {files.length > 0 && (
                <IconButton
                  icon={Heart}
                  label={allFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  onClick={() => setFavorite(files, !allFav)}
                  iconClassName={allFav ? 'fill-current' : ''}
                />
              )}
              {ctx.view === 'mine' && ctx.can('files.rename_move') && <IconButton icon={FolderInput} label="Déplacer vers…" shortcut="M" onClick={() => openMoveDialog(items)} />}
              {(files.length > 0 || folders.length > 0) && (
                <Tooltip content="Mettre à la corbeille" shortcut="Suppr">
                  <button
                    onClick={() => { if (files.length) trashFiles(files); if (folders.length) deleteFolders(folders); onClear() }}
                    className="flex h-9 w-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-red-600 hover:text-white"
                    aria-label="Mettre à la corbeille"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </Tooltip>
              )}
              <DropdownMenu
                side="top"
                items={() => selectionMenu(items, { ...ctx, clearSelection: onClear })}
                trigger={<button className="flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:bg-overlay hover:text-fg" aria-label="Plus d'actions"><MoreHorizontal size={16} /></button>}
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
