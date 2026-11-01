import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, X } from 'lucide-react'
import api, { apiError } from '../../utils/api.js'
import { useUiStore } from '../../stores/ui.store.js'
import { toast } from '../../stores/toast.store.js'
import { Dialog } from '../ui/Dialog.jsx'
import { Button } from '../ui/Button.jsx'
import { Input } from '../ui/Form.jsx'
import { Avatar, userAvatar } from '../ui/Avatar.jsx'

// Partage d'un dossier en lecture seule (sous-dossiers compris), par pseudo
export default function FolderShareDialog() {
  const folder = useUiStore((s) => s.folderShare)
  const close = () => { useUiStore.setState({ folderShare: null }); setPseudo('') }
  const [pseudo, setPseudo] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: shares = [], refetch } = useQuery({
    queryKey: ['folder-shares', folder?.id],
    queryFn: () => api.get(`/files/folders/${folder.id}/shares`).then((r) => r.data),
    enabled: !!folder,
  })

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post(`/files/folders/${folder.id}/shares`, { pseudo })
      toast.success(`Partagé avec ${data.pseudo}`)
      setPseudo('')
      refetch()
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }

  const remove = async (u) => {
    try { await api.delete(`/files/folders/${folder.id}/shares/${u.id}`); refetch() } catch (err) { toast.error(apiError(err)) }
  }

  return (
    <Dialog
      open={!!folder}
      onOpenChange={(o) => !o && close()}
      title={`Partager « ${folder?.name} »`}
      description="Les membres choisis peuvent voir et télécharger son contenu, sous-dossiers compris. Ils ne peuvent rien modifier."
      size="sm"
    >
      <form onSubmit={add} className="flex gap-2">
        <Input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo du membre" aria-label="Pseudo du membre" autoFocus />
        <Button type="submit" loading={busy} disabled={!pseudo.trim()}>Partager</Button>
      </form>
      {shares.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {shares.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <Avatar src={userAvatar(u)} name={u.pseudo} size={28} />
              <span className="flex-1 truncate text-sm text-fg">{u.pseudo}</span>
              <Button size="sm" variant="ghost" icon={X} onClick={() => remove(u)} aria-label={`Retirer ${u.pseudo}`}>Retirer</Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
