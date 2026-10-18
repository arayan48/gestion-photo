import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useUiStore } from '../../stores/ui.store.js'
import { pluralize } from '../../lib/format.js'
import { confirmDeleteFolders } from './itemActions.js'
import { Dialog } from '../ui/Dialog.jsx'
import { Button } from '../ui/Button.jsx'
import { Switch } from '../ui/Form.jsx'

export default function FolderDeleteDialog() {
  const state = useUiStore((s) => s.folderDelete)
  const close = () => useUiStore.setState({ folderDelete: null })
  const [moveToTrash, setMoveToTrash] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (state) setMoveToTrash(true) }, [state])

  const folders = state?.folders || []
  const stats = state?.stats || { fileCount: 0, folderCount: 0 }
  const hasContent = stats.fileCount > 0 || stats.folderCount > 0
  const content = [
    stats.fileCount > 0 && pluralize(stats.fileCount, 'fichier'),
    stats.folderCount > 0 && pluralize(stats.folderCount, 'sous-dossier'),
  ].filter(Boolean).join(' et ')

  return (
    <Dialog
      open={!!state}
      onOpenChange={(o) => !o && close()}
      title={folders.length > 1 ? `Supprimer ${folders.length} dossiers ?` : `Supprimer « ${folders[0]?.name} » ?`}
      description={hasContent ? `Contenu direct : ${content}.` : 'Le dossier est vide.'}
      icon={Trash2}
      iconTone="danger"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Annuler</Button>
          <Button variant="danger" loading={busy} onClick={async () => {
            setBusy(true)
            await confirmDeleteFolders(folders, moveToTrash)
            setBusy(false)
            close()
          }}>Supprimer</Button>
        </>
      }
    >
      {hasContent && (
        <div className="rounded-xl border border-line bg-overlay/50 p-3.5">
          <Switch
            checked={moveToTrash}
            onChange={setMoveToTrash}
            label="Mettre les fichiers à la corbeille"
            description={moveToTrash ? 'Récupérables pendant 48 h depuis la corbeille.' : 'Les fichiers remontent dans le dossier parent.'}
          />
        </div>
      )}
    </Dialog>
  )
}
