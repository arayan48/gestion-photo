import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, UserPlus, Key, HardDrive, UserX, UserCheck, Trash2, MoreHorizontal, LogOut, Crown, Users, Check, X, Mail,
} from 'lucide-react'
import api, { apiError } from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatSize, formatRelative, pluralize } from '../../lib/format.js'
import { toast } from '../../stores/toast.store.js'
import { confirm } from '../../stores/confirm.store.js'
import { useAuthStore, usePermission } from '../../stores/auth.store.js'
import { Button } from '../ui/Button.jsx'
import { Badge } from '../ui/Badge.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { Progress } from '../ui/Progress.jsx'
import { Checkbox, Field, Input, PasswordInput, Select } from '../ui/Form.jsx'
import { ContextMenu, DropdownMenu } from '../ui/Menu.jsx'
import { Dialog } from '../ui/Dialog.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

const GiB = 1024 ** 3
const QUOTA_PRESETS = [1, 5, 10, 25, 50, 100]

function QuotaDialog({ user, onClose, onSave }) {
  const [gb, setGb] = useState(() => Math.max(1, Math.round(Number(user.storage_quota) / GiB)))
  const usedGb = Number(user.storage_used) / GiB
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Quota de ${user.pseudo}`} description={`Utilise actuellement ${formatSize(user.storage_used)}.`} icon={HardDrive} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={() => onSave({ storageQuota: Math.round(gb * GiB) })}>Enregistrer</Button></>}>
      <div className="space-y-4">
        <div className="flex items-baseline justify-center gap-1.5 py-2">
          <input type="number" min={1} max={2000} value={gb} onChange={(e) => setGb(Number(e.target.value) || 1)} className="w-24 bg-transparent text-center text-4xl font-medium tabular-nums text-fg outline-none" />
          <span className="text-lg text-muted">Go</span>
        </div>
        <input type="range" min={1} max={200} value={Math.min(gb, 200)} onChange={(e) => setGb(Number(e.target.value))} className="w-full accent-[rgb(var(--accent-500))]" />
        <div className="flex flex-wrap justify-center gap-1.5">
          {QUOTA_PRESETS.map((p) => (
            <button key={p} onClick={() => setGb(p)} className={cn('rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors', gb === p ? 'border-accent-600 bg-accent-600 text-white' : 'border-line text-muted hover:text-fg')}>{p} Go</button>
          ))}
        </div>
        {gb < usedGb && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">Le quota est inférieur à l'espace déjà utilisé : les nouveaux envois seront bloqués.</p>}
      </div>
    </Dialog>
  )
}

function RoleDialog({ user, roles, onClose, onSave }) {
  const [roleId, setRoleId] = useState(user.role_id || '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Rôle de ${user.pseudo}`} icon={Key} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!roleId || roleId === user.role_id} onClick={() => onSave({ roleId })}>Enregistrer</Button></>}>
      <div className="space-y-1.5">
        {roles.filter((r) => !r.is_super_admin).map((r) => (
          <button key={r.id} onClick={() => setRoleId(r.id)}
            className={cn('flex w-full items-center gap-3 border-b border-line px-1 py-2.5 text-left transition-colors', roleId === r.id ? 'text-fg' : 'text-muted hover:text-fg')}>
            <span className={cn('flex h-4 w-4 items-center justify-center rounded-[2px] border', roleId === r.id ? 'border-accent-500 bg-accent-500 text-white' : 'border-line-strong')}>
              {roleId === r.id && <Check size={11} strokeWidth={3} />}
            </span>
            <span className="flex-1 text-sm font-medium text-fg">{r.name}</span>
            <span className="text-xs text-subtle">{pluralize(r.permissions?.length || 0, 'permission')}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}

function AddUserDialog({ roles, onClose, onDone }) {
  const can = usePermission()
  // Quota personnalisé seulement avec la permission dédiée (sinon le serveur refuse la création)
  const canQuota = can('users.change_quota')
  const [form, setForm] = useState({ email: '', pseudo: '', password: '', firstName: '', lastName: '', roleId: '', storageQuota: 1 })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/users', { ...form, roleId: form.roleId || undefined, storageQuota: canQuota ? Math.round(Number(form.storageQuota) * GiB) : undefined })
      toast.success(`Utilisateur « ${form.pseudo} » créé`)
      onDone()
      onClose()
    } catch (err) { toast.error(apiError(err)) } finally { setLoading(false) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Créer un utilisateur" description="Le compte est actif immédiatement." icon={UserPlus} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><Input type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} required /></Field>
          <Field label="Pseudo"><Input value={form.pseudo} onChange={(e) => set('pseudo', e.target.value)} required /></Field>
          <Field label="Prénom" optional><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
          <Field label="Nom" optional><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
        </div>
        <Field label="Mot de passe"><PasswordInput value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} placeholder="8 caractères minimum" autoComplete="new-password" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rôle">
            <Select value={form.roleId} onChange={(e) => set('roleId', e.target.value)}>
              <option value="">Rôle par défaut</option>
              {roles.filter((r) => !r.is_super_admin).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          {canQuota && <Field label="Quota (Go)"><Input type="number" min={1} max={2000} value={form.storageQuota} onChange={(e) => set('storageQuota', e.target.value)} /></Field>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={loading}>Créer</Button>
        </div>
      </form>
    </Dialog>
  )
}

export default function AdminUsers() {
  const queryClient = useQueryClient()
  const can = usePermission()
  const me = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [modal, setModal] = useState(null) // { type, user }

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users', { params: { limit: 500 } }).then((r) => r.data) })
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then((r) => r.data) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const users = useMemo(() => {
    let list = data?.users || []
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((u) => u.pseudo.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    if (statusFilter === 'active') list = list.filter((u) => u.is_active && !u.is_banned)
    if (statusFilter === 'banned') list = list.filter((u) => u.is_banned)
    return list
  }, [data, search, statusFilter])

  const update = async (user, patch, message = 'Utilisateur mis à jour') => {
    try {
      await api.patch(`/users/${user.id}`, patch)
      toast.success(message)
      setModal(null)
      refresh()
    } catch (err) { toast.error(apiError(err)) }
  }

  const remove = async (list) => {
    const ok = await confirm(
      `${list.length === 1 ? `« ${list[0].pseudo} »` : pluralize(list.length, 'utilisateur')} et tous leurs fichiers seront supprimés définitivement.`,
      { title: 'Supprimer définitivement ?', danger: true, confirmLabel: 'Supprimer' }
    )
    if (!ok) return
    const results = await Promise.allSettled(list.map((u) => api.delete(`/users/${u.id}`)))
    const failed = results.filter((r) => r.status === 'rejected').length
    failed ? toast.error(`${failed} suppression(s) en échec`) : toast.success(list.length > 1 ? `${list.length} utilisateurs supprimés` : 'Utilisateur supprimé')
    setSelected(new Set())
    refresh()
  }

  const revoke = async (user) => {
    try {
      await api.post(`/admin/revoke-tokens/${user.id}`)
      toast.success(`Sessions de ${user.pseudo} révoquées`)
    } catch (err) { toast.error(apiError(err)) }
  }

  const menu = (u) => {
    const self = u.id === me?.id
    const locked = u.is_super_admin
    return [
      { type: 'label', label: u.pseudo },
      can('users.change_role') && !locked && { label: 'Changer le rôle…', icon: Key, onSelect: () => setModal({ type: 'role', user: u }) },
      can('users.change_quota') && { label: 'Modifier le quota…', icon: HardDrive, onSelect: () => setModal({ type: 'quota', user: u }) },
      can('security.revoke_tokens') && !self && { label: 'Déconnecter partout', icon: LogOut, onSelect: () => revoke(u) },
      can('users.suspend') && !locked && !self && { type: 'separator' },
      can('users.suspend') && !locked && !self && (u.is_banned
        ? { label: 'Réactiver le compte', icon: UserCheck, onSelect: () => update(u, { suspend: false }, 'Compte réactivé') }
        : { label: 'Suspendre le compte', icon: UserX, onSelect: () => update(u, { suspend: true }, 'Compte suspendu') }),
      can('users.delete') && !locked && !self && { type: 'separator' },
      can('users.delete') && !locked && !self && { label: 'Supprimer…', icon: Trash2, danger: true, onSelect: () => remove([u]) },
    ]
  }

  const selectedUsers = users.filter((u) => selected.has(u.id))
  // Ni le Super Admin ni soi-même ne peuvent être supprimés
  const deletable = selectedUsers.filter((u) => !u.is_super_admin && u.id !== me?.id)
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSel = users.length > 0 && users.every((u) => selected.has(u.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par pseudo ou email…" className="h-10 py-2" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-40 py-2">
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="banned">Suspendus</option>
        </Select>
        <span className="text-xs text-subtle">{pluralize(users.length, 'utilisateur')}</span>
        {can('users.accept_requests') && <Button className="ml-auto" onClick={() => setModal({ type: 'add' })}>Ajouter</Button>}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-l-2 border-accent-500 bg-overlay/40 px-4 py-2">
          <span className="text-sm font-medium text-fg">{selected.size} sélectionné(s)</span>
          {can('users.delete') && deletable.length > 0 && <Button size="sm" variant="danger-soft" onClick={() => remove(deletable)}>Supprimer ({deletable.length})</Button>}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted hover:text-fg"><X size={15} /></button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 " />)}</div>
      ) : !users.length ? (
        <EmptyState icon={Users} title="Aucun utilisateur" description={search ? 'Aucun résultat pour cette recherche.' : undefined} compact />
      ) : (
        <div className="table-wrapper">
          <div className="hidden grid-cols-[32px_minmax(0,2fr)_minmax(0,1fr)_120px_180px_120px_40px] items-center gap-4 border-b border-line px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-subtle xl:grid">
            <Checkbox checked={allSel} indeterminate={selected.size > 0 && !allSel} onChange={() => setSelected(allSel ? new Set() : new Set(users.map((u) => u.id)))} />
            <span>Utilisateur</span><span>Rôle</span><span>Statut</span><span>Stockage</span><span>Inscrit</span><span />
          </div>
          <div className="divide-y divide-line">
            {users.map((u) => {
              const pct = Math.min(100, Math.round((Number(u.storage_used) / Number(u.storage_quota || 1)) * 100))
              return (
                <ContextMenu key={u.id} items={() => menu(u)}>
                  <div className={cn('grid grid-cols-[32px_minmax(0,1fr)_40px] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-overlay/50 xl:grid-cols-[32px_minmax(0,2fr)_minmax(0,1fr)_120px_180px_120px_40px]', selected.has(u.id) && 'bg-accent-500/[0.06]')}>
                    <Checkbox checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={u.avatar_path} name={u.pseudo} size={36} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
                          {u.pseudo}
                          {u.is_super_admin && <Crown size={13} className="shrink-0 text-amber-500" />}
                          {u.id === me?.id && <span className="text-[11px] font-normal text-subtle">(vous)</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                    <div className="col-start-2 flex flex-wrap items-center gap-1.5 xl:col-start-auto">
                      <Badge color={u.is_super_admin ? 'amber' : 'accent'}>{u.role_name || 'Aucun rôle'}</Badge>
                      <span className="xl:hidden">{u.is_banned ? <Badge color="red" dot>Suspendu</Badge> : u.is_active ? <Badge color="green" dot>Actif</Badge> : <Badge color="amber" dot>Inactif</Badge>}</span>
                    </div>
                    <span className="hidden xl:block">{u.is_banned ? <Badge color="red" dot>Suspendu</Badge> : u.is_active ? <Badge color="green" dot>Actif</Badge> : <Badge color="amber" dot>Inactif</Badge>}</span>
                    <div className="col-start-2 xl:col-start-auto">
                      <div className="mb-1 flex justify-between text-[11px] tabular-nums text-muted">
                        <span>{formatSize(u.storage_used)}</span><span>{formatSize(u.storage_quota)}</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                    <span className="hidden text-xs text-muted xl:block">{formatRelative(u.created_at)}</span>
                    <div className="col-start-3 row-start-1 flex justify-end xl:col-start-auto xl:row-start-auto">
                      <DropdownMenu items={() => menu(u)} trigger={<button className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-overlay hover:text-fg" aria-label="Actions"><MoreHorizontal size={17} /></button>} />
                    </div>
                  </div>
                </ContextMenu>
              )
            })}
          </div>
        </div>
      )}

      {modal?.type === 'add' && <AddUserDialog roles={roles} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'quota' && <QuotaDialog user={modal.user} onClose={() => setModal(null)} onSave={(p) => update(modal.user, p, 'Quota mis à jour')} />}
      {modal?.type === 'role' && <RoleDialog user={modal.user} roles={roles} onClose={() => setModal(null)} onSave={(p) => update(modal.user, p, 'Rôle mis à jour')} />}
    </div>
  )
}
