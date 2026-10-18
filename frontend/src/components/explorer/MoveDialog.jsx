import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderInput, Folder, FolderOpen, ChevronRight, Home, FolderPlus, Search } from 'lucide-react'
import api from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { useUiStore } from '../../stores/ui.store.js'
import { createFolder } from '../../lib/actions.js'
import { pluralize } from '../../lib/format.js'
import { moveItems } from './itemActions.js'
import { Dialog } from '../ui/Dialog.jsx'
import { Button } from '../ui/Button.jsx'
import { Input } from '../ui/Form.jsx'

// « Déplacer vers… » : sélecteur d'arborescence (indispensable au tactile, sans glisser-déposer)
export default function MoveDialog() {
  const moveDialog = useUiStore((s) => s.moveDialog)
  const close = () => useUiStore.setState({ moveDialog: null })
  const items = moveDialog?.items || []
  const [target, setTarget] = useState(null) // null = racine
  const [expanded, setExpanded] = useState(new Set())
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: folders = [], refetch } = useQuery({
    queryKey: ['folder-tree'],
    queryFn: () => api.get('/files/folders/tree').then((r) => r.data),
    enabled: !!moveDialog,
  })

  useEffect(() => {
    if (moveDialog) { setTarget(null); setFilter(''); setExpanded(new Set()) }
  }, [moveDialog])

  // Un dossier ne peut pas être déplacé dans lui-même ni dans ses descendants
  const forbidden = useMemo(() => {
    const set = new Set()
    const movingFolders = items.filter((i) => i.kind === 'folder').map((i) => i.id)
    const children = new Map()
    folders.forEach((f) => children.set(f.parent_id || 'root', [...(children.get(f.parent_id || 'root') || []), f]))
    const walk = (id) => { set.add(id); (children.get(id) || []).forEach((c) => walk(c.id)) }
    movingFolders.forEach(walk)
    return set
  }, [items, folders])

  const childrenMap = useMemo(() => {
    const map = new Map()
    folders.forEach((f) => map.set(f.parent_id || 'root', [...(map.get(f.parent_id || 'root') || []), f]))
    return map
  }, [folders])

  const filtered = filter.trim()
    ? folders.filter((f) => f.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : null

  const submit = async () => {
    setBusy(true)
    const ok = await moveItems(items, target)
    setBusy(false)
    if (ok !== false) close()
  }

  const handleNewFolder = async () => {
    const parent = target ? folders.find((f) => f.id === target) : null
    const created = await createFolder(parent ? { id: parent.id, name: parent.name } : { id: null, name: 'Mon espace' })
    if (created) {
      await refetch()
      if (parent) setExpanded((e) => new Set([...e, parent.id]))
      setTarget(created.id)
    }
  }

  const Row = ({ folder, depth }) => {
    const kids = childrenMap.get(folder.id) || []
    const open = expanded.has(folder.id)
    const disabled = forbidden.has(folder.id)
    const selected = target === folder.id
    return (
      <>
        <div
          onClick={() => !disabled && setTarget(folder.id)}
          onDoubleClick={() => kids.length && setExpanded((e) => { const n = new Set(e); n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id); return n })}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-lg py-2 pr-3 text-sm transition-colors',
            selected ? 'bg-accent-600 text-white' : 'text-fg hover:bg-overlay',
            disabled && 'cursor-not-allowed opacity-40'
          )}
          style={{ paddingLeft: 8 + depth * 18 }}
        >
          <button
            type="button"
            className={cn('flex h-6 w-6 items-center justify-center', !kids.length && 'invisible')}
            onClick={(e) => { e.stopPropagation(); setExpanded((s) => { const n = new Set(s); n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id); return n }) }}
          >
            <ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} />
          </button>
          {selected ? <FolderOpen size={15} strokeWidth={1.75} /> : <Folder size={15} strokeWidth={1.75} className="text-subtle" />}
          <span className="truncate">{folder.name}</span>
        </div>
        {open && kids.map((k) => <Row key={k.id} folder={k} depth={depth + 1} />)}
      </>
    )
  }

  const targetName = target ? folders.find((f) => f.id === target)?.name : 'Mon espace'

  return (
    <Dialog
      open={!!moveDialog}
      onOpenChange={(o) => !o && close()}
      title={`Déplacer ${items.length === 1 ? `« ${items[0].original_name || items[0].name} »` : pluralize(items.length, 'élément')}`}
      description="Choisissez le dossier de destination."
      icon={FolderInput}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleNewFolder} className="md:mr-auto">Nouveau dossier</Button>
          <Button variant="ghost" onClick={close}>Annuler</Button>
          <Button onClick={submit} loading={busy}>Déplacer dans « {targetName} »</Button>
        </>
      }
    >
      <Input icon={Search} placeholder="Filtrer les dossiers…" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-3" />
      <div className="max-h-[46vh] min-h-[220px] overflow-y-auto border border-line py-1">
        <div
          onClick={() => setTarget(null)}
          className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm', target === null ? 'bg-accent-600 text-white' : 'hover:bg-overlay')}
        >
          <span className="font-mono text-subtle">/</span> Mon espace
        </div>
        {filtered
          ? filtered.map((f) => (
            <div key={f.id}
              onClick={() => !forbidden.has(f.id) && setTarget(f.id)}
              className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm', target === f.id ? 'bg-accent-600 text-white' : 'hover:bg-overlay', forbidden.has(f.id) && 'opacity-40')}>
              <Folder size={15} strokeWidth={1.75} /> {f.name}
            </div>
          ))
          : (childrenMap.get('root') || []).map((f) => <Row key={f.id} folder={f} depth={0} />)}
        {filtered && filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun dossier trouvé</p>}
      </div>
    </Dialog>
  )
}
