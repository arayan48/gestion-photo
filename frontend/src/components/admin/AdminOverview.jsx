import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import api from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatSize, formatDate } from '../../lib/format.js'
import { useThemeStore } from '../../stores/theme.store.js'
import { Progress } from '../ui/Progress.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'
import { toast } from '../../stores/toast.store.js'
import { apiError } from '../../utils/api.js'

// Palette catégorielle validée (daltonisme, contraste) en clair et en sombre
const TYPE_COLORS = {
  light: { image: '#c2410c', video: '#0891b2', other: '#a16207' },
  dark: { image: '#ea580c', video: '#0891b2', other: '#b7791f' },
}
const TYPE_LABELS = { image: 'Photos', video: 'Vidéos', other: 'Autres' }

// Les attributs SVG n'acceptent pas var() : on lit la couleur d'accent calculée
function useCssColor(name) {
  const accent = useThemeStore((s) => s.accent)
  const theme = useThemeStore((s) => s.resolvedTheme)
  return useMemo(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v ? `rgb(${v.split(/\s+/).join(',')})` : '#8b5cf6'
  }, [accent, theme, name])
}

// Relevé chiffré : libellé mono, grand nombre, ligne de détail. Pas d'icône décorative.
function Kpi({ label, value, sub, tone, onClick, children }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cn('group flex flex-col bg-surface px-5 py-5 text-left', onClick && 'transition-colors hover:bg-overlay')}>
      <span className="label-mono">{label}</span>
      <p className={cn('mt-3 font-mono text-[32px] leading-none tracking-[-0.03em]', tone === 'red' ? 'text-red-500' : tone === 'amber' ? 'text-amber-500' : 'text-fg')}>{value}</p>
      {sub && <p className="mt-2 text-[12px] text-subtle">{sub}{onClick && <span className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">→</span>}</p>}
      {children}
    </Tag>
  )
}

function UploadsChart({ data }) {
  const color = useCssColor('--accent-500')
  const theme = useThemeStore((s) => s.resolvedTheme)
  const grid = theme === 'dark' ? 'rgba(236,232,225,0.06)' : 'rgba(24,22,20,0.07)'
  const tick = theme === 'dark' ? '#706b64' : '#8a8379'
  const rows = data.map((d) => ({ ...d, size: Number(d.size), label: formatDate(d.day, 'd MMM') }))
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <div className="card p-5">
      <div className="mb-5 flex items-end justify-between border-b border-line pb-3">
        <p className="label-mono">Envois · 30 jours</p>
        <p className="font-mono text-xl leading-none text-fg">{total}</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, left: -22, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: grid }} tick={{ fontSize: 10, fill: tick, fontFamily: 'IBM Plex Mono' }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: tick, fontFamily: 'IBM Plex Mono' }} width={40} />
            <RTooltip
              cursor={{ fill: grid }}
              content={({ active, payload }) => active && payload?.length ? (
                <div className="border border-line-strong bg-elevated px-3 py-2 text-xs">
                  <p className="text-fg">{formatDate(payload[0].payload.day, 'EEEE d MMMM')}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{payload[0].payload.count} fichier(s) · {formatSize(payload[0].payload.size)}</p>
                </div>
              ) : null}
            />
            <Bar dataKey="count" fill={color} radius={[1, 1, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function TypeBreakdown({ types }) {
  const theme = useThemeStore((s) => s.resolvedTheme)
  const colors = TYPE_COLORS[theme === 'dark' ? 'dark' : 'light']
  const rows = ['image', 'video', 'other'].map((t) => {
    const r = types.find((x) => x.type === t)
    return { type: t, count: r?.count || 0, size: Number(r?.size || 0) }
  }).filter((r) => r.count > 0 || r.type !== 'other')
  const totalSize = rows.reduce((s, r) => s + r.size, 0) || 1
  return (
    <div className="card p-5">
      <p className="label-mono border-b border-line pb-3">Espace par type</p>
      {/* Barre empilée avec 2 px d'espace entre les segments */}
      <div className="mt-5 flex h-2 gap-[2px] overflow-hidden bg-overlay">
        {rows.map((r) => r.size > 0 && (
          <div key={r.type} className="h-full" style={{ width: `${(r.size / totalSize) * 100}%`, background: colors[r.type] }} title={`${TYPE_LABELS[r.type]} : ${formatSize(r.size)}`} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.type} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0" style={{ background: colors[r.type] }} />
            <span className="flex-1 text-[13px] text-fg">{TYPE_LABELS[r.type]}</span>
            <span className="font-mono text-[11px] text-muted">{r.count} · {formatSize(r.size)}</span>
            <span className="w-10 text-right font-mono text-[11px] text-fg">{Math.round((r.size / totalSize) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Version installée et mise à jour disponible (vérifiée par le serveur toutes les 12 h)
const DISMISS_KEY = 'obscura.update-dismissed'

function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) } catch { return null }
}

function UpdateBanner({ version }) {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (!version?.updateAvailable || dismissed === version.latest) return null
  const later = () => {
    try { localStorage.setItem(DISMISS_KEY, version.latest) } catch { /* bandeau masqué pour cette session seulement */ }
    setDismissed(version.latest)
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-accent-500 bg-overlay/50 px-4 py-3 text-sm text-fg">
      <p className="min-w-0 flex-1">
        <strong>Obscura {version.latest}</strong> est disponible (installée : {version.current}).
        Mettez à jour depuis l'App Store de ZimaOS, ou avec <code className="font-mono text-xs">docker compose pull && docker compose up -d</code>.
      </p>
      <button onClick={later} className="text-xs text-muted transition-colors hover:text-fg">Plus tard</button>
    </div>
  )
}

function VersionLine({ version }) {
  const queryClient = useQueryClient()
  const [checking, setChecking] = useState(false)
  if (!version) return null
  const check = async () => {
    setChecking(true)
    try {
      const { data } = await api.get('/admin/version', { params: { refresh: 1 } })
      queryClient.setQueryData(['admin-version'], data)
      if (!data.updateAvailable) toast.success('Obscura est à jour')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setChecking(false)
    }
  }
  return (
    <p className="font-mono text-[11px] text-subtle">
      Obscura {version.current}
      {' · '}
      {version.updateAvailable ? `${version.latest} disponible` : version.checkedAt ? 'à jour' : 'pas encore vérifié'}
      {' · '}
      <button onClick={check} disabled={checking} className="underline-offset-2 hover:text-fg hover:underline disabled:opacity-50">
        {checking ? 'vérification…' : 'vérifier'}
      </button>
    </p>
  )
}

export default function AdminOverview({ onNavigate }) {
  const { data: version } = useQuery({
    queryKey: ['admin-version'],
    queryFn: () => api.get('/admin/version').then((r) => r.data),
    staleTime: 3600_000,
  })

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const pct = stats.storage.percent
  const l24 = stats.last24h || {}

  return (
    <div className="space-y-4">
      <UpdateBanner version={version} />
      {pct >= 90 && (
        <div className="border-l-2 border-red-500 bg-overlay/50 px-4 py-3 text-sm text-fg">
          Stockage serveur à <strong>{pct} %</strong>. Au-delà de 100 %, les envois sont bloqués automatiquement.
        </div>
      )}

      <div className="grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Membres actifs" value={stats.users.active} sub={`${stats.users.total} au total · ${stats.users.banned} suspendu(s)`} onClick={() => onNavigate('users')} />
        <Kpi label="Fichiers" value={Number(stats.files.total).toLocaleString('fr-FR')} sub={formatSize(stats.files.total_size)} />
        <Kpi label="Stockage médias" value={`${pct}%`} sub={`${formatSize(stats.storage.used)} / ${formatSize(stats.storage.limit)}`} tone={pct >= 90 ? 'red' : pct >= 75 ? 'amber' : undefined}>
          <Progress value={pct} className="mt-3" />
        </Kpi>
        <Kpi label="Demandes" value={stats.pendingRequests} sub={stats.pendingRequests ? 'En attente de validation' : 'Aucune en attente'} tone={stats.pendingRequests ? 'amber' : undefined} onClick={() => onNavigate('requests')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><UploadsChart data={stats.timeline || []} /></div>
        <TypeBreakdown types={stats.types || []} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="label-mono border-b border-line pb-3">Plus gros consommateurs</p>
          <div className="mt-4 space-y-4">
            {(stats.topUsers || []).map((u) => {
              const p = Math.min(100, Math.round((Number(u.storage_used) / Number(u.storage_quota || 1)) * 100))
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <Avatar src={u.avatar_path} name={u.pseudo} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-fg">{u.pseudo}</span>
                      <span className="font-mono text-[11px] text-muted">{formatSize(u.storage_used)} / {formatSize(u.storage_quota)}</span>
                    </div>
                    <Progress value={p} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <button onClick={() => onNavigate('logs')} className="card p-5 text-left transition-colors hover:border-line-strong">
          <p className="label-mono border-b border-line pb-3">Journaux · 24 heures</p>
          <div className="mt-4 grid grid-cols-3 divide-x divide-line">
            {[
              { label: 'Sécurité', value: l24.security || 0, cls: 'text-accent-500' },
              { label: 'Alertes', value: l24.warnings || 0, cls: 'text-amber-500' },
              { label: 'Erreurs', value: l24.errors || 0, cls: 'text-red-500' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="px-4 first:pl-0">
                <p className={cn('font-mono text-2xl', value ? cls : 'text-fg')}>{value}</p>
                <p className="mt-1 text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        </button>
      </div>

      <VersionLine version={version} />
    </div>
  )
}
