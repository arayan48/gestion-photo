import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  UserCheck, UserX, Inbox, Key, Pencil, Trash2, Shield, Copy, Database,
  MoreHorizontal, CheckCircle2, XCircle,
} from 'lucide-react'
import api, { apiError } from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatSize, formatRelative, formatDateTime, pluralize } from '../../lib/format.js'
import { toast } from '../../stores/toast.store.js'
import { confirm } from '../../stores/confirm.store.js'
import { usePermission } from '../../stores/auth.store.js'
import { copyText } from '../../lib/actions.js'
import { Button } from '../ui/Button.jsx'
import { Badge } from '../ui/Badge.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { Checkbox, Field, Input, Select } from '../ui/Form.jsx'
import { ContextMenu, DropdownMenu } from '../ui/Menu.jsx'
import { Dialog } from '../ui/Dialog.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

const MoreTrigger = (
  <button className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-overlay hover:text-fg" aria-label="Actions">
    <MoreHorizontal size={17} />
  </button>
)

const ListSkeleton = () => <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 " />)}</div>

// ── Demandes de compte ───────────────────────────────────────────────────────
export function AdminRequests() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(new Set())
  const { data: requests = [], isLoading } = useQuery({ queryKey: ['account-requests'], queryFn: () => api.get('/users/requests').then((r) => r.data) })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['account-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const review = async (ids, action) => {
    const results = await Promise.allSettled(ids.map((id) => api.post(`/users/requests/${id}/review`, { action })))
    const ok = results.filter((r) => r.status === 'fulfilled').length
    if (ok) toast.success(`${pluralize(ok, 'demande')} ${action === 'accept' ? 'acceptée(s)' : 'refusée(s)'}`)
    if (ok < ids.length) toast.error(`${ids.length - ok} demande(s) en échec`)
    setSelected(new Set())
    refresh()
  }

  if (isLoading) return <ListSkeleton />
  if (!requests.length) return <EmptyState icon={Inbox} title="Aucune demande en attente" description="Les nouvelles demandes de compte apparaîtront ici et dans vos notifications." />

  const allSel = requests.every((r) => selected.has(r.id))
  const menu = (r) => [
    { label: 'Accepter', icon: UserCheck, onSelect: () => review([r.id], 'accept') },
    { label: 'Refuser', icon: UserX, danger: true, onSelect: () => review([r.id], 'refuse') },
    { type: 'separator' },
    { label: "Copier l'email", icon: Copy, onSelect: () => copyText(r.email, 'Email copié') },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox checked={allSel} indeterminate={selected.size > 0 && !allSel} onChange={() => setSelected(allSel ? new Set() : new Set(requests.map((r) => r.id)))} label={`${pluralize(requests.length, 'demande')} en attente`} />
        {selected.size > 0 && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="success" onClick={() => review([...selected], 'accept')}>Accepter ({selected.size})</Button>
            <Button size="sm" variant="danger-soft" onClick={() => review([...selected], 'refuse')}>Refuser</Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {requests.map((r) => (
          <ContextMenu key={r.id} items={() => menu(r)}>
            <div className={cn('card flex flex-col gap-4 p-4 transition-colors', selected.has(r.id) && 'border-accent-500/50 bg-accent-500/[0.04]')}>
              <div className="flex items-start gap-3">
                <Checkbox checked={selected.has(r.id)} onChange={() => setSelected((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })} className="mt-2.5" />
                <Avatar name={r.pseudo} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{r.pseudo} {(r.first_name || r.last_name) && <span className="font-normal text-muted">· {[r.first_name, r.last_name].filter(Boolean).join(' ')}</span>}</p>
                  <p className="truncate text-xs text-muted">{r.email}</p>
                  <p className="mt-0.5 text-[11px] text-subtle">{formatRelative(r.created_at)}</p>
                </div>
                <DropdownMenu items={() => menu(r)} trigger={MoreTrigger} />
              </div>
              <blockquote className="border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-muted">{r.reason}</blockquote>
              <div className="flex gap-2">
                <Button size="sm" variant="success" className="flex-1" onClick={() => review([r.id], 'accept')}>Accepter</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => review([r.id], 'refuse')}>Refuser</Button>
              </div>
            </div>
          </ContextMenu>
        ))}
      </div>
    </div>
  )
}

// ── Rôles ────────────────────────────────────────────────────────────────────
const PERM_CATEGORY_ORDER = ['Fichiers & Médias', 'Utilisateurs', 'Sécurité', 'Système']

function RoleDialog({ role, allPermissions, onClose, onSave }) {
  const [name, setName] = useState(role?.name || '')
  const [selected, setSelected] = useState(new Set(role?.permissions?.map((p) => p.key) || []))
  const grouped = useMemo(() => {
    const map = {}
    for (const p of allPermissions) (map[p.category] ||= []).push(p)
    return map
  }, [allPermissions])
  const cats = [...PERM_CATEGORY_ORDER.filter((c) => grouped[c]), ...Object.keys(grouped).filter((c) => !PERM_CATEGORY_ORDER.includes(c))]
  const toggle = (key) => setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const toggleCat = (cat) => {
    const keys = grouped[cat].map((p) => p.key)
    const all = keys.every((k) => selected.has(k))
    setSelected((s) => { const n = new Set(s); keys.forEach((k) => (all ? n.delete(k) : n.add(k))); return n })
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={role ? `Modifier « ${role.name} »` : 'Nouveau rôle'} icon={Key} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), permissionKeys: [...selected] })}>{role ? 'Enregistrer' : 'Créer'}</Button></>}>
      <div className="space-y-5">
        <Field label="Nom du rôle"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Modérateur" autoFocus /></Field>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-fg">Permissions <span className="text-subtle">({selected.size}/{allPermissions.length})</span></p>
          <div className="flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set(allPermissions.map((p) => p.key)))}>Tout cocher</Button>
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>Tout décocher</Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {cats.map((cat) => {
            const perms = grouped[cat]
            const n = perms.filter((p) => selected.has(p.key)).length
            return (
              <div key={cat} className="overflow-hidden border border-line">
                <button type="button" onClick={() => toggleCat(cat)} className="flex w-full items-center gap-3 bg-overlay/50 px-4 py-2.5 text-left hover:bg-overlay">
                  <Checkbox checked={n === perms.length} indeterminate={n > 0 && n < perms.length} onChange={() => toggleCat(cat)} />
                  <span className="flex-1 text-[13px] font-medium text-fg">{cat}</span>
                  <Badge>{n}/{perms.length}</Badge>
                </button>
                <div className="divide-y divide-line">
                  {perms.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-overlay/40" onClick={(e) => { e.preventDefault(); toggle(p.key) }}>
                      <Checkbox checked={selected.has(p.key)} onChange={() => toggle(p.key)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-[13px] text-fg">{p.label}</span>
                        <code className="text-[10px] text-subtle">{p.key}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}

export function AdminRoles({ isSuperAdmin }) {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)
  const { data: roles = [], isLoading } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then((r) => r.data) })
  const { data: allPermissions = [] } = useQuery({ queryKey: ['permissions'], queryFn: () => api.get('/roles/permissions').then((r) => r.data) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['roles'] })

  const save = async (payload) => {
    try {
      if (modal === 'create') await api.post('/roles', payload)
      else await api.put(`/roles/${modal.id}`, payload)
      toast.success(modal === 'create' ? `Rôle « ${payload.name} » créé` : 'Rôle mis à jour')
      setModal(null)
      refresh()
    } catch (err) { toast.error(apiError(err)) }
  }

  const remove = async (role) => {
    const ok = await confirm(`Le rôle « ${role.name} » sera supprimé.${role.user_count ? ` ${pluralize(role.user_count, 'utilisateur')} n'aura plus de rôle.` : ''}`, { title: 'Supprimer le rôle ?', danger: true, confirmLabel: 'Supprimer' })
    if (!ok) return
    try { await api.delete(`/roles/${role.id}`); toast.success('Rôle supprimé'); refresh() } catch (err) { toast.error(apiError(err)) }
  }

  const duplicate = (role) => setModal({ ...role, id: undefined, name: `${role.name} (copie)`, __duplicate: true })

  if (isLoading) return <ListSkeleton />
  const menu = (r) => r.is_super_admin || !isSuperAdmin ? [{ type: 'label', label: r.is_super_admin ? 'Rôle protégé' : 'Lecture seule' }] : [
    { label: 'Modifier…', icon: Pencil, onSelect: () => setModal(r) },
    { label: 'Dupliquer…', icon: Copy, onSelect: () => duplicate(r) },
    { type: 'separator' },
    { label: 'Supprimer', icon: Trash2, danger: true, onSelect: () => remove(r) },
  ]

  return (
    <div className="space-y-4">
      {isSuperAdmin && <div className="flex justify-end"><Button onClick={() => setModal('create')}>Nouveau rôle</Button></div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => {
          const perms = r.permissions || []
          return (
            <ContextMenu key={r.id} items={() => menu(r)}>
              <div className={cn('card flex flex-col p-5', r.is_super_admin && 'border-l-2 border-l-amber-500')}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-fg">{r.name}</p>
                    <p className="font-mono text-[11px] text-subtle">{pluralize(r.user_count || 0, 'membre')}</p>
                  </div>
                  {isSuperAdmin && !r.is_super_admin && <DropdownMenu items={() => menu(r)} trigger={MoreTrigger} />}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.is_super_admin ? <Badge color="amber">Toutes les permissions</Badge> : perms.length ? (
                    <>
                      {perms.slice(0, 5).map((p) => <Badge key={p.key}>{p.label}</Badge>)}
                      {perms.length > 5 && <Badge color="accent">+{perms.length - 5}</Badge>}
                    </>
                  ) : <span className="text-xs text-subtle">Aucune permission</span>}
                </div>
                {isSuperAdmin && !r.is_super_admin && (
                  <Button size="sm" variant="secondary" className="mt-4 self-start" onClick={() => setModal(r)}>Modifier les permissions</Button>
                )}
              </div>
            </ContextMenu>
          )
        })}
      </div>
      {modal && <RoleDialog role={modal === 'create' ? null : modal} allPermissions={allPermissions} onClose={() => setModal(null)} onSave={(p) => (modal.__duplicate ? api.post('/roles', p).then(() => { toast.success('Rôle dupliqué'); setModal(null); refresh() }).catch((e) => toast.error(apiError(e))) : save(p))} />}
    </div>
  )
}

// ── Liste blanche IP ─────────────────────────────────────────────────────────
function WhitelistDialog({ entry, onClose, onSave }) {
  const [ip, setIp] = useState(entry?.ip_address || '')
  const [label, setLabel] = useState(entry?.label || '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={entry ? "Modifier l'entrée" : 'Ajouter une IP'} icon={Shield} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!ip.trim()} onClick={() => onSave({ ip: ip.trim(), label: label.trim() })}>Enregistrer</Button></>}>
      <div className="space-y-4">
        <Field label="Adresse IP" hint="IPv4 ou IPv6. Seules ces adresses peuvent ouvrir les liens /media/…"><Input className="font-mono" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.42" autoFocus /></Field>
        <Field label="Étiquette" optional><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Serveur FiveM, bureau…" /></Field>
      </div>
    </Dialog>
  )
}

export function AdminWhitelist() {
  const queryClient = useQueryClient()
  const can = usePermission()
  const [modal, setModal] = useState(null)
  const { data: list = [], isLoading } = useQuery({ queryKey: ['whitelist'], queryFn: () => api.get('/admin/whitelist').then((r) => r.data) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['whitelist'] })
  const manage = can('security.manage_whitelist')

  const save = async (payload) => {
    try {
      if (modal === 'add') await api.post('/admin/whitelist', payload)
      else await api.put(`/admin/whitelist/${modal.id}`, payload)
      toast.success(modal === 'add' ? `IP ${payload.ip} ajoutée` : 'Entrée mise à jour')
      setModal(null)
      refresh()
    } catch (err) { toast.error(apiError(err)) }
  }
  const remove = async (e) => {
    if (!(await confirm(`${e.ip_address} ne pourra plus accéder aux médias publics.`, { title: "Retirer l'IP ?", danger: true, confirmLabel: 'Retirer' }))) return
    try { await api.delete(`/admin/whitelist/${e.id}`); toast.success('IP retirée'); refresh() } catch (err) { toast.error(apiError(err)) }
  }
  const menu = (e) => [
    { label: "Copier l'adresse", icon: Copy, onSelect: () => copyText(e.ip_address, 'Adresse copiée') },
    manage && { label: 'Modifier…', icon: Pencil, onSelect: () => setModal(e) },
    manage && { type: 'separator' },
    manage && { label: 'Retirer', icon: Trash2, danger: true, onSelect: () => remove(e) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 border-l-2 border-accent-500 bg-overlay/40 px-4 py-3">
        <p className="min-w-0 flex-1 text-[13px] text-muted">Toute requête vers <code className="rounded bg-overlay px-1 font-mono text-xs text-fg">/media/:token</code> provenant d'une IP absente de cette liste reçoit une erreur 403.</p>
        {manage && <Button onClick={() => setModal('add')}>Ajouter une IP</Button>}
      </div>
      {isLoading ? <ListSkeleton /> : !list.length ? (
        <EmptyState icon={Shield} title="Liste blanche vide" description="Aucun lien public ne peut être consulté tant qu'aucune IP n'est autorisée." compact />
      ) : (
        <div className="table-wrapper divide-y divide-line">
          {list.map((e) => (
            <ContextMenu key={e.id} items={() => menu(e)}>
              <div className="flex items-center gap-4 px-4 py-3 hover:bg-overlay/50">
                                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-fg">{e.ip_address}</p>
                  <p className="truncate text-xs text-muted">{e.label || 'Sans étiquette'} · ajoutée par {e.added_by_pseudo || '—'} {formatRelative(e.created_at)}</p>
                </div>
                <DropdownMenu items={() => menu(e)} trigger={MoreTrigger} />
              </div>
            </ContextMenu>
          ))}
        </div>
      )}
      {modal && <WhitelistDialog entry={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSave={save} />}
    </div>
  )
}

// ── Sauvegardes ──────────────────────────────────────────────────────────────
export function AdminBackups() {
  const queryClient = useQueryClient()
  const [type, setType] = useState('local')
  const [running, setRunning] = useState(false)
  const { data: backups = [], isLoading } = useQuery({ queryKey: ['backups'], queryFn: () => api.get('/admin/backups').then((r) => r.data) })

  const run = async () => {
    setRunning(true)
    try {
      await api.post('/admin/backups/run', { type })
      toast.success('Sauvegarde terminée')
    } catch (err) { toast.error(apiError(err, 'Erreur lors de la sauvegarde')) } finally {
      setRunning(false)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    }
  }

  const last = backups[0]
  const okCount = backups.filter((b) => b.status === 'success').length

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5 md:col-span-2">
          <p className="label-mono">Sauvegarde manuelle</p>
          <p className="mt-1 text-xs text-muted">Copie compressée de la base de données et des médias. La planification se règle dans Configuration → Sauvegardes.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-48 py-2">
              <option value="local">Locale (serveur)</option>
              <option value="backblaze">Backblaze B2</option>
            </Select>
            <Button loading={running} onClick={run}>{running ? 'Sauvegarde en cours…' : 'Lancer maintenant'}</Button>
          </div>
        </div>
        <div className="card p-5">
          <p className="label-mono">Dernière sauvegarde</p>
          {last ? (
            <>
              <p className="mt-2 flex items-center gap-2 text-lg font-medium text-fg">
                {last.status === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}
                {formatRelative(last.created_at)}
              </p>
              <p className="mt-1 text-xs text-subtle">{okCount}/{backups.length} réussies sur l'historique</p>
            </>
          ) : <p className="mt-2 text-sm text-subtle">Jamais</p>}
        </div>
      </div>

      {isLoading ? <ListSkeleton /> : !backups.length ? (
        <EmptyState icon={Database} title="Aucune sauvegarde" description="Lancez votre première sauvegarde pour protéger vos données." compact />
      ) : (
        <div className="table-wrapper divide-y divide-line">
          {backups.map((b) => (
            <div key={b.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize text-fg">{b.type === 'local' ? 'Locale' : b.type}</p>
                <p className="truncate text-xs text-muted" title={b.error_message || ''}>{b.error_message || formatDateTime(b.created_at)}</p>
              </div>
              <span className="hidden text-xs tabular-nums text-muted sm:block">{b.size ? formatSize(b.size) : '—'}</span>
              <Badge color={b.status === 'success' ? 'green' : 'red'} dot>{b.status === 'success' ? 'Succès' : 'Échec'}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
