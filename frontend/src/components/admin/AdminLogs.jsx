import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Search, X, Info, AlertTriangle, XCircle, Activity, Copy, Filter, ScrollText } from 'lucide-react'
import api from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatRelative, formatDate } from '../../lib/format.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { copyText } from '../../lib/actions.js'
import { Button } from '../ui/Button.jsx'
import { Badge } from '../ui/Badge.jsx'
import { Input, Select, Segmented } from '../ui/Form.jsx'
import { ContextMenu } from '../ui/Menu.jsx'
import { Dialog } from '../ui/Dialog.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

const LEVELS = {
  info: { icon: Info, color: 'blue', label: 'Info', cls: 'text-sky-500' },
  warning: { icon: AlertTriangle, color: 'amber', label: 'Alerte', cls: 'text-amber-500' },
  error: { icon: XCircle, color: 'red', label: 'Erreur', cls: 'text-red-500' },
}
const CATEGORIES = { auth: 'Authentification', files: 'Fichiers', users: 'Utilisateurs', security: 'Sécurité', system: 'Système' }
const EMPTY = { level: '', category: '', search: '', from: '', to: '' }
const PAGE = 100

function LogDialog({ log, onClose }) {
  let meta = null
  try { meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata } catch {}
  const lvl = LEVELS[log.level] || LEVELS.info
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={log.action} description={formatDate(log.created_at, "EEEE d MMMM yyyy 'à' HH:mm:ss")} icon={lvl.icon} iconTone={log.level === 'error' ? 'danger' : log.level === 'warning' ? 'amber' : 'accent'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Niveau', <Badge key="l" color={lvl.color}>{lvl.label}</Badge>],
            ['Catégorie', CATEGORIES[log.category] || log.category],
            ['Utilisateur', log.user_pseudo ? `${log.user_pseudo}${log.user_email ? ` (${log.user_email})` : ''}` : '—'],
            ['Adresse IP', <span key="ip" className="font-mono">{log.ip_address || '—'}</span>],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-overlay/60 p-3">
              <p className="text-[11px] text-subtle">{k}</p>
              <div className="mt-1 break-words text-sm text-fg">{v}</div>
            </div>
          ))}
        </div>
        {meta && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Métadonnées</p>
              <Button size="xs" variant="ghost" icon={Copy} onClick={() => copyText(JSON.stringify(meta, null, 2), 'JSON copié')}>Copier</Button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-emerald-400">{JSON.stringify(meta, null, 2)}</pre>
          </div>
        )}
      </div>
    </Dialog>
  )
}

export default function AdminLogs() {
  const [filters, setFilters] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const search = useDebounce(filters.search, 300)
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }))
  const active = Object.entries(filters).some(([, v]) => v)

  const query = useInfiniteQuery({
    queryKey: ['logs', { ...filters, search }],
    queryFn: ({ pageParam }) => {
      const params = { page: pageParam, limit: PAGE }
      for (const k of ['level', 'category', 'from', 'to']) if (filters[k]) params[k] = filters[k]
      if (search) params.search = search
      return api.get('/admin/logs', { params }).then((r) => r.data)
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  })
  const logs = query.data?.pages.flatMap((p) => p.logs) || []
  const total = query.data?.pages[0]?.total ?? 0

  const menu = (l) => [
    { label: 'Voir le détail', icon: ScrollText, onSelect: () => setSelected(l) },
    { type: 'separator' },
    { label: 'Filtrer sur cette action', icon: Filter, onSelect: () => set('search', l.action) },
    { label: 'Filtrer sur cette catégorie', icon: Filter, onSelect: () => set('category', l.category) },
    l.ip_address && { label: "Copier l'IP", icon: Copy, onSelect: () => copyText(l.ip_address, 'IP copiée') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <Input icon={Search} value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="Action, métadonnées…" className="h-10 py-2" />
        </div>
        <Select value={filters.category} onChange={(e) => set('category', e.target.value)} className="h-10 w-44 py-2">
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Segmented size="sm" value={filters.level} onChange={(v) => set('level', v)} options={[
          { value: '', label: 'Tous' }, { value: 'error', label: 'Erreurs' }, { value: 'warning', label: 'Alertes' }, { value: 'info', label: 'Info' },
        ]} />
        <input type="date" className="input h-10 w-auto py-2" value={filters.from} onChange={(e) => set('from', e.target.value)} title="Depuis" />
        <input type="date" className="input h-10 w-auto py-2" value={filters.to} onChange={(e) => set('to', e.target.value)} title="Jusqu'au" />
        {active && <Button size="sm" variant="ghost" icon={X} onClick={() => setFilters(EMPTY)}>Réinitialiser</Button>}
        <span className="ml-auto text-xs text-subtle">{total.toLocaleString('fr-FR')} événement(s)</span>
      </div>

      {query.isLoading ? (
        <div className="space-y-1.5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : !logs.length ? (
        <EmptyState icon={Activity} title="Aucun événement" description={active ? 'Aucun log ne correspond aux filtres.' : undefined} compact />
      ) : (
        <div className="table-wrapper divide-y divide-line">
          {logs.map((l) => {
            const lvl = LEVELS[l.level] || LEVELS.info
            const Icon = lvl.icon
            return (
              <ContextMenu key={l.id} items={() => menu(l)}>
                <button onClick={() => setSelected(l)} className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-overlay/60', l.level === 'error' && 'bg-red-500/[0.04]', l.level === 'warning' && 'bg-amber-500/[0.04]')}>
                  <Icon size={16} className={cn('shrink-0', lvl.cls)} />
                  <span className="hidden w-28 shrink-0 sm:block"><Badge>{CATEGORIES[l.category] || l.category}</Badge></span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{l.action}</span>
                  <span className="hidden w-36 shrink-0 truncate text-xs text-muted md:block">{l.user_pseudo || '—'}</span>
                  <span className="hidden w-32 shrink-0 truncate font-mono text-[11px] text-subtle lg:block">{l.ip_address || ''}</span>
                  <span className="w-28 shrink-0 text-right text-xs text-subtle" title={formatDate(l.created_at, 'Pp')}>{formatRelative(l.created_at)}</span>
                </button>
              </ContextMenu>
            )
          })}
        </div>
      )}
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Charger plus</Button>
        </div>
      )}
      {selected && <LogDialog log={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
