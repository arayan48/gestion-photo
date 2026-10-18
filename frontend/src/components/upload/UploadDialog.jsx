import { useEffect, useMemo, useState } from 'react'
import { CloudUpload, X, FileVideo, Folder, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../../stores/ui.store.js'
import { useUploadStore } from '../../stores/upload.store.js'
import { usePreferencesStore } from '../../stores/preferences.store.js'
import { formatSize, pluralize } from '../../lib/format.js'
import { QUALITY_PRESETS, ACCEPT_ATTR, isAcceptedFile } from '../../lib/media.js'
import { cn } from '../../lib/cn.js'
import { toast } from '../../stores/toast.store.js'
import { Dialog } from '../ui/Dialog.jsx'
import { Button } from '../ui/Button.jsx'
import { Segmented, Switch } from '../ui/Form.jsx'

// Préparation de l'envoi : noms, qualité (globale ou par fichier), destination
export default function UploadDialog() {
  const pending = useUiStore((s) => s.pendingUpload)
  const setPending = useUiStore((s) => s.setPendingUpload)
  const enqueue = useUploadStore((s) => s.enqueue)
  const { defaultQuality, setDefaultQuality, askQuality, set: setPrefs } = usePreferencesStore()
  const [entries, setEntries] = useState([])
  const [quality, setQuality] = useState(defaultQuality)

  useEffect(() => {
    if (!pending) return
    setQuality(defaultQuality)
    setEntries(pending.files.map((file, i) => ({
      key: `${file.name}-${file.size}-${i}`,
      file,
      name: file.name.replace(/\.[^.]+$/, ''),
      quality: null, // null = qualité globale
      preview: file.type.startsWith('image/') && file.type !== 'image/svg+xml' ? URL.createObjectURL(file) : null,
    })))
  }, [pending])

  const total = useMemo(() => entries.reduce((s, e) => s + e.file.size, 0), [entries])
  // Les aperçus de cette fenêtre sont libérés à la fermeture (le gestionnaire crée les siens)
  const close = () => {
    entries.forEach((e) => e.preview && URL.revokeObjectURL(e.preview))
    setPending(null)
  }

  const addMore = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = ACCEPT_ATTR
    input.onchange = () => {
      const files = [...input.files].filter(isAcceptedFile)
      const rejected = input.files.length - files.length
      if (rejected) toast.warn(`${rejected} fichier(s) ignoré(s) : seules les images et vidéos sont acceptées`)
      setEntries((prev) => [...prev, ...files.map((file, i) => ({
        key: `${file.name}-${file.size}-${Date.now()}-${i}`,
        file,
        name: file.name.replace(/\.[^.]+$/, ''),
        quality: null,
        preview: file.type.startsWith('image/') && file.type !== 'image/svg+xml' ? URL.createObjectURL(file) : null,
      }))])
    }
    input.click()
  }

  const submit = () => {
    setDefaultQuality(quality)
    enqueue(entries.map((e) => ({
      file: e.file,
      name: e.name.trim() || e.file.name.replace(/\.[^.]+$/, ''),
      quality: e.quality || quality,
      folderId: pending.folderId,
      folderName: pending.folderName,
    })))
    close()
  }

  return (
    <Dialog
      open={!!pending}
      onOpenChange={(o) => !o && close()}
      title={`Importer ${pluralize(entries.length, 'fichier')}`}
      description={<span>Vers <span className="text-fg">{pending?.folderName || 'Mon espace'}</span> <span className="font-mono text-[11px] text-subtle">· {formatSize(total)}</span></span>}
      icon={CloudUpload}
      size="lg"
      footer={
        <>
          <label className="flex items-center gap-2.5 text-xs text-muted md:mr-auto">
            <Switch size="sm" checked={!askQuality} onChange={(v) => setPrefs({ askQuality: !v })} />
            Ne plus demander (utiliser cette qualité)
          </label>
          <Button variant="ghost" onClick={close}>Annuler</Button>
          <Button onClick={submit} disabled={!entries.length}>
            Envoyer {entries.length > 1 ? `les ${entries.length} fichiers` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="label-mono mb-2">Qualité des images</p>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_PRESETS.map((q) => (
              <button
                key={q.value}
                onClick={() => setQuality(q.value)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all',
                  quality === q.value ? 'border-accent-500 bg-accent-600/10' : 'border-line hover:border-line-strong'
                )}
              >
                <p className="text-sm text-fg">{q.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-subtle">{q.desc}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-subtle">Les vidéos sont toujours conservées en qualité originale.</p>
        </div>

        <div>
          <AnimatePresence initial={false}>
            {entries.map((e, i) => (
              <motion.div
                key={e.key}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 border-b border-line py-2"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden bg-overlay">
                  {e.preview ? <img src={e.preview} alt="" className="h-full w-full object-cover" /> : <FileVideo size={18} strokeWidth={1.5} className="text-subtle" />}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={e.name}
                    onChange={(ev) => setEntries((prev) => prev.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
                    className="w-full rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-fg outline-none hover:bg-overlay focus:bg-overlay"
                    aria-label="Nom du fichier"
                  />
                  <p className="px-1 font-mono text-[10.5px] text-subtle">{formatSize(e.file.size)} · {e.file.type || 'inconnu'}</p>
                </div>
                {e.file.type.startsWith('image/') && (
                  <Segmented
                    size="sm"
                    className="hidden sm:inline-flex"
                    value={e.quality || quality}
                    onChange={(v) => setEntries((prev) => prev.map((x, j) => (j === i ? { ...x, quality: v === quality ? null : v } : x)))}
                    options={QUALITY_PRESETS.map((q) => ({ value: q.value, label: q.label.slice(0, 4) + '.', title: q.label }))}
                  />
                )}
                <button
                  onClick={() => { if (e.preview) URL.revokeObjectURL(e.preview); setEntries((prev) => prev.filter((_, j) => j !== i)) }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-subtle hover:text-red-500"
                  aria-label="Retirer"
                >
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button onClick={addMore} className="mt-2 flex w-full items-center justify-center border border-dashed border-line-strong py-2.5 text-[13px] text-muted transition-colors hover:border-fg/50 hover:text-fg">
            + Ajouter d'autres fichiers
          </button>
        </div>
      </div>
    </Dialog>
  )
}
