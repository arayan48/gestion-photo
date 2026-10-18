import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { Users, FileImage, HardDrive, UserPlus, AlertTriangle, ShieldAlert, XCircle, ArrowRight } from 'lucide-react'
import api from '../../utils/api.js'
import { cn } from '../../lib/cn.js'
import { formatSize, formatDate } from '../../lib/format.js'
import { useThemeStore } from '../../stores/theme.store.js'
import { Progress } from '../ui/Progress.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

// Palette catégorielle validée (daltonisme, contraste) en clair et en sombre
const TYPE_COLORS = {
  light: { image: '#7c3aed', video: '#0891b2', other: '#d97706' },
  dark: { image: '#8b5cf6', video: '#0891b2', other: '#d97706' },
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

function Kpi({ icon: Icon, label, value, sub, tone = 'accent', onClick, children }) {
  const tones = {
    accent: 'bg-accent-500/10 text-accent-600 dark:text-accent-400',
    blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cn('card group flex flex-col p-5 text-left', onClick && 'transition-colors hover:border-line-strong')}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}><Icon size={17} /></span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {sub && <p className="mt-1 flex items-center gap-1 text-xs text-subtle">{sub}{onClick && <ArrowRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />}</p>}
      {children}
    </Tag>
  )
}

function UploadsChart({ data }) {
  const color = useCssColor('--accent-500')
  const theme = useThemeStore((s) => s.resolvedTheme)
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tick = theme === 'dark' ? '#71717a' : '#8a8a94'
  const rows = data.map((d) => ({ ...d, size: Number(d.size), label: formatDate(d.day, 'd MMM') }))
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">Fichiers envoyés</p>
          <p className="text-xs text-subtle">30 derniers jours (UTC)</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-fg">{total}</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="uploads-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tick }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tick }} width={40} />
            <RTooltip
              cursor={{ stroke: tick, strokeDasharray: '3 3' }}
              content={({ active, payload }) => active && payload?.length ? (
                <div className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs shadow-float">
                  <p className="font-medium text-fg">{formatDate(payload[0].payload.day, 'EEEE d MMMM')}</p>
                  <p className="mt-0.5 text-muted">{payload[0].payload.count} fichier(s) · {formatSize(payload[0].payload.size)}</p>
                </div>
              ) : null}
            />
            <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fill="url(#uploads-fill)" activeDot={{ r: 5, strokeWidth: 2, stroke: theme === 'dark' ? '#101013' : '#ffffff' }} />
          </AreaChart>
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
      <p className="text-sm font-semibold text-fg">Répartition par type</p>
      <p className="text-xs text-subtle">Part de l'espace occupé</p>
      {/* Barre empilée avec 2 px d'espace entre les segments */}
      <div className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded-full bg-overlay">
        {rows.map((r) => r.size > 0 && (
          <div key={r.type} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(r.size / totalSize) * 100}%`, background: colors[r.type] }} title={`${TYPE_LABELS[r.type]} : ${formatSize(r.size)}`} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.type} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[r.type] }} />
            <span className="flex-1 text-[13px] text-fg">{TYPE_LABELS[r.type]}</span>
            <span className="text-xs tabular-nums text-muted">{r.count} · {formatSize(r.size)}</span>
            <span className="w-10 text-right text-xs font-semibold tabular-nums text-fg">{Math.round((r.size / totalSize) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminOverview({ onNavigate }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  const pct = stats.storage.percent
  const l24 = stats.last24h || {}

  return (
    <div className="space-y-4">
      {pct >= 90 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={18} className="shrink-0" />
          Stockage serveur à <strong>{pct} %</strong>. Au-delà de 100 %, les envois sont bloqués automatiquement.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Utilisateurs actifs" value={stats.users.active} sub={`${stats.users.total} au total · ${stats.users.banned} suspendu(s)`} tone="blue" onClick={() => onNavigate('users')} />
        <Kpi icon={FileImage} label="Fichiers hébergés" value={Number(stats.files.total).toLocaleString('fr-FR')} sub={formatSize(stats.files.total_size)} />
        <Kpi icon={HardDrive} label="Stockage médias" value={`${pct} %`} sub={`${formatSize(stats.storage.used)} sur ${formatSize(stats.storage.limit)}`} tone={pct >= 90 ? 'red' : pct >= 70 ? 'amber' : 'green'}>
          <Progress value={pct} className="mt-3" />
        </Kpi>
        <Kpi icon={UserPlus} label="Demandes en attente" value={stats.pendingRequests} sub={stats.pendingRequests ? 'À traiter' : 'Rien à traiter'} tone="amber" onClick={() => onNavigate('requests')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><UploadsChart data={stats.timeline || []} /></div>
        <TypeBreakdown types={stats.types || []} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm font-semibold text-fg">Plus gros consommateurs</p>
          <p className="text-xs text-subtle">Espace utilisé par rapport au quota</p>
          <div className="mt-4 space-y-4">
            {(stats.topUsers || []).map((u) => {
              const p = Math.min(100, Math.round((Number(u.storage_used) / Number(u.storage_quota || 1)) * 100))
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <Avatar src={u.avatar_path} name={u.pseudo} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-fg">{u.pseudo}</span>
                      <span className="tabular-nums text-muted">{formatSize(u.storage_used)} / {formatSize(u.storage_quota)}</span>
                    </div>
                    <Progress value={p} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <button onClick={() => onNavigate('logs')} className="card p-5 text-left transition-colors hover:border-line-strong">
          <p className="text-sm font-semibold text-fg">Dernières 24 heures</p>
          <p className="text-xs text-subtle">Événements remontés par les journaux</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: ShieldAlert, label: 'Sécurité', value: l24.security || 0, cls: 'text-accent-600 dark:text-accent-400 bg-accent-500/10' },
              { icon: AlertTriangle, label: 'Alertes', value: l24.warnings || 0, cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
              { icon: XCircle, label: 'Erreurs', value: l24.errors || 0, cls: 'text-red-600 dark:text-red-400 bg-red-500/10' },
            ].map(({ icon: Icon, label, value, cls }) => (
              <div key={label} className="rounded-xl border border-line p-3">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', cls)}><Icon size={15} /></span>
                <p className="mt-2.5 text-2xl font-semibold tabular-nums text-fg">{value}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        </button>
      </div>
    </div>
  )
}
