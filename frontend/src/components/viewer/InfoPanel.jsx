import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Copy, Link2, Link2Off, Tag, Plus, Calendar, HardDrive, Image as ImageIcon, Film, User, Gauge, Clock, Eye, Pencil } from 'lucide-react'
import api, { apiError } from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatSize, formatDuration, formatDateTime } from '../../lib/format.js'
import { isVideo, publicLink, fileExt, QUALITY_LABELS } from '../../lib/media.js'
import { copyFileLink } from '../../lib/actions.js'
import { invalidateFiles } from '../../lib/queryClient.js'
import { usePermission, useAuthStore } from '../../stores/auth.store.js'
import { toast } from '../../stores/toast.store.js'
import { setLink, renameFile } from '../explorer/itemActions.js'
import { Switch } from '../ui/Form.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { IconButton } from '../ui/Button.jsx'

// Ligne de fiche technique : libellé à gauche, valeur en mono à droite (comme des données EXIF)
function Row({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-line py-2 last:border-0">
      <span className="text-[12px] text-subtle">{label}</span>
      <span className="break-words font-mono text-[12px] text-fg">{value}</span>
    </div>
  )
}

function TagEditor({ file, editable }) {
  const queryClient = useQueryClient()
  const can = usePermission()
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get('/files/tags').then((r) => r.data),
    enabled: editable,
    staleTime: 60_000,
  })
  const tags = file.tags || []
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['file', file.id] })
    invalidateFiles()
  }

  const add = async (tag) => {
    try {
      let t = tag
      if (!t) {
        const name = input.trim().toLowerCase()
        if (!name) return
        t = allTags.find((x) => x.name === name)
        if (!t) {
          if (!can('files.create_tags')) return toast.error("Vous ne pouvez pas créer de nouveaux tags")
          t = (await api.post('/files/tags', { name })).data
          queryClient.invalidateQueries({ queryKey: ['tags'] })
        }
      }
      await api.post(`/files/${file.id}/tags`, { tagIds: [t.id] })
      setInput('')
      refresh()
    } catch (err) { toast.error(apiError(err)) }
  }

  const remove = async (tag) => {
    try {
      await api.delete(`/files/${file.id}/tags/${tag.id}`)
      refresh()
    } catch (err) { toast.error(apiError(err)) }
  }

  const suggestions = allTags.filter((t) => !tags.some((x) => x.id === t.id) && t.name.includes(input.trim().toLowerCase())).slice(0, 6)

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t.id} className="group inline-flex items-center gap-1 rounded-sm border border-line-strong px-2 py-0.5 font-mono text-[11px] text-fg">
            #{t.name}
            {editable && (
              <button onClick={() => remove(t)} className="-mr-0.5 p-0.5 opacity-50 hover:opacity-100" aria-label={`Retirer ${t.name}`}>
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!tags.length && !editable && <p className="text-xs text-subtle">Aucun tag</p>}
        {editable && !open && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-sm border border-dashed border-line-strong px-2 py-0.5 text-[11px] text-muted hover:border-fg/50 hover:text-fg">
            <Plus size={12} /> Ajouter
          </button>
        )}
      </div>
      {editable && open && (
        <div className="mt-2.5">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add() }
              if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Nom du tag puis Entrée"
            className="input py-2 text-[13px]"
          />
          {suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestions.map((t) => (
                <button key={t.id} onMouseDown={(e) => e.preventDefault()} onClick={() => add(t)} className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted hover:text-fg">
                  #{t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function InfoPanel({ file, onClose, className }) {
  const can = usePermission()
  const me = useAuthStore((s) => s.user)
  const { data: details } = useQuery({
    queryKey: ['file', file.id],
    queryFn: () => api.get(`/files/${file.id}`).then((r) => r.data),
    staleTime: 10_000,
  })
  const f = { ...file, ...(details || {}) }
  // Dans la corbeille, la fiche est en lecture seule (le serveur refuse les modifications)
  const own = (f.owner_id === me?.id || me?.is_super_admin) && !f.is_deleted
  const video = isVideo(f)

  return (
    <aside className={cn('flex h-full flex-col bg-elevated text-fg', className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <p className="text-sm font-medium">Informations</p>
        <IconButton icon={X} label="Fermer le panneau" shortcut="I" size="sm" onClick={onClose} />
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <div>
          <div className="group flex items-start gap-2">
            <h3 className="min-w-0 flex-1 break-words text-[15px] font-medium leading-snug">{f.original_name}</h3>
            {own && can('files.rename_move') && (
              <IconButton icon={Pencil} label="Renommer" size="xs" onClick={() => renameFile(f)} />
            )}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar name={f.owner_pseudo} size={26} />
            <p className="text-xs text-muted">Ajouté par <span className="text-fg">{f.owner_pseudo || 'vous'}</span></p>
          </div>
        </div>

        {/* Lien public */}
        <div className="border-y border-line py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="label-mono">Lien public</p>
            </div>
            {own && can('files.toggle_link')
              ? <Switch size="sm" checked={!!f.link_active} onChange={(v) => setLink([f], v)} />
              : <span className="text-xs text-muted">{f.link_active ? 'Actif' : 'Inactif'}</span>}
          </div>
          <div className="mt-3 flex items-start gap-2">
            <code className={cn('min-w-0 flex-1 select-all break-all border border-line px-2 py-1.5 font-mono text-[11px] leading-relaxed', f.link_active ? 'text-fg' : 'text-subtle line-through')}>{publicLink(f)}</code>
            <IconButton icon={Copy} label="Copier le lien" size="sm" variant="solid" onClick={() => copyFileLink(f)} />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle">
            {f.link_active
              ? <>{f.link_access_count || 0} accès · réservé aux IP de la liste blanche</>
              : 'Lien désactivé : le média n\'est plus accessible publiquement'}
          </p>
        </div>

        <div>
          <p className="label-mono mb-1">Fiche technique</p>
          <div>
            <Row icon={video ? Film : ImageIcon} label="Type" value={`${fileExt(f)} · ${f.mime_type}`} />
            <Row icon={HardDrive} label="Taille" value={formatSize(f.size)} />
            <Row icon={ImageIcon} label="Dimensions" value={f.width ? `${f.width} × ${f.height} px${f.width * f.height >= 1e5 ? ` · ${((f.width * f.height) / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mpx` : ''}` : null} />
            <Row icon={Clock} label="Durée" value={f.duration ? formatDuration(f.duration) : null} />
            <Row icon={Gauge} label="Images / seconde" value={f.fps ? `${Number(f.fps).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} i/s` : null} />
            <Row icon={Film} label="Codec" value={f.codec} />
            <Row icon={Gauge} label="Qualité d'envoi" value={QUALITY_LABELS[f.quality_preset] || f.quality_preset} />
            <Row icon={Calendar} label="Ajouté le" value={formatDateTime(f.created_at)} />
            {f.updated_at && f.updated_at !== f.created_at && <Row icon={Calendar} label="Modifié le" value={formatDateTime(f.updated_at)} />}
            <Row icon={User} label="Propriétaire" value={f.owner_pseudo} />
          </div>
        </div>

        <div>
          <p className="label-mono mb-2.5">Tags</p>
          <TagEditor file={f} editable={own} />
        </div>
      </div>
    </aside>
  )
}
