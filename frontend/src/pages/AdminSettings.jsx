import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import api from '../utils/api.js'
import { Check, Eye, EyeOff, Mail, MessageSquare, Database, SlidersHorizontal, AlertTriangle, Bell, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Switch } from '../components/ui/Form.jsx'
import { Tabs, SideTabs } from '../components/ui/Tabs.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'
import { Group, Row, Value, ChoiceRows, UnsavedBar } from '../components/ui/SettingsList.jsx'
import { cn } from '../lib/cn.js'
import { useIsDesktop } from '../hooks/useMediaQuery.js'

// ── Champs ────────────────────────────────────────────────────────────────────
// Valeur renvoyée par l'API pour un secret déjà enregistré (jamais transmis en clair)
const MASKED_SECRET = '••••••••'

function TextInput({ className, ...props }) {
  return <input className={cn('input', className)} {...props} />
}

function PasswordInput({ value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false)
  const isStored = value === MASKED_SECRET
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={show && !isStored ? 'text' : 'password'}
          className="input pr-10 font-mono text-[13px]"
          value={value}
          onChange={onChange}
          onFocus={(e) => isStored && e.target.select()}
          placeholder={placeholder}
          autoComplete="off"
        />
        {!isStored && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
            aria-label={show ? 'Masquer' : 'Afficher'}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {isStored && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
          Enregistré et chiffré. Saisissez une nouvelle valeur pour le remplacer.
        </p>
      )}
    </div>
  )
}

// Champ numérique avec unité à l'intérieur (« Go »)
function UnitInput({ unit, className, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <input type="number"
        className="input pr-11 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-subtle">{unit}</span>
    </div>
  )
}

// ── Formulaire de configuration ───────────────────────────────────────────────
// Suit les modifications : la barre d'enregistrement n'apparaît que si quelque chose a changé
function useConfigForm(config, keys) {
  const queryClient = useQueryClient()
  const [initial, setInitial] = useState({})
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!config) return
    const init = {}
    keys.forEach((k) => { init[k] = config[k] ?? '' })
    setInitial(init)
    setForm(init)
  }, [config])

  const dirty = keys.some((k) => String(form[k] ?? '') !== String(initial[k] ?? ''))
  const set = (key, val) => { setSaved(false); setError(''); setForm((f) => ({ ...f, [key]: val })) }
  const reset = () => { setForm(initial); setError('') }

  const save = async (e) => {
    e.preventDefault()
    if (!dirty) return
    setSaving(true)
    setError('')
    try {
      await api.patch('/admin/config', form)
      setInitial(form)
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const bar = <UnsavedBar dirty={dirty} saving={saving} saved={saved} error={error} onReset={reset} />
  return { form, set, save, bar }
}

// ── Email ─────────────────────────────────────────────────────────────────────
const EMAIL_PROVIDERS = [
  { value: 'brevo',    label: 'Brevo',    description: '300 emails par jour gratuits' },
  { value: 'smtp',     label: 'SMTP',     description: 'Votre propre serveur de messagerie' },
  { value: 'resend',   label: 'Resend',   description: 'API simple, offre gratuite' },
  { value: 'mailgun',  label: 'Mailgun',  description: 'Gros volumes' },
  { value: 'sendgrid', label: 'SendGrid', description: 'Gros volumes' },
]

function TabEmail({ config }) {
  const keys = [
    'email.provider', 'email.from',
    'email.brevo_key',
    'email.smtp_host', 'email.smtp_port', 'email.smtp_user', 'email.smtp_password', 'email.smtp_secure',
    'email.resend_key',
    'email.mailgun_key', 'email.mailgun_domain',
    'email.sendgrid_key',
  ]
  const { form, set, save, bar } = useConfigForm(config, keys)
  const provider = form['email.provider'] || 'brevo'
  const providerLabel = EMAIL_PROVIDERS.find((p) => p.value === provider)?.label
  const field = (key) => ({ value: form[key] || '', onChange: (e) => set(key, e.target.value) })

  return (
    <form onSubmit={save} className="space-y-8">
      <Group title="Service d'envoi" footer="Utilisé pour les codes de connexion, la réinitialisation des mots de passe et les validations de compte.">
        <ChoiceRows name="email-provider" value={provider} onChange={(v) => set('email.provider', v)} options={EMAIL_PROVIDERS} />
      </Group>

      <Group title="Expéditeur">
        <Row stack label="Adresse d'envoi" description="Affichée dans le champ « De » des emails." htmlFor="email-from">
          <TextInput id="email-from" type="email" {...field('email.from')} placeholder="noreply@mon-domaine.fr" />
        </Row>
      </Group>

      <Group title={`Identifiants ${providerLabel}`}>
        {provider === 'brevo' && (
          <Row stack label="Clé API" htmlFor="brevo-key">
            <PasswordInput id="brevo-key" {...field('email.brevo_key')} placeholder="xkeysib-…" />
          </Row>
        )}
        {provider === 'smtp' && (
          <>
            <Row stack label="Serveur" htmlFor="smtp-host">
              <TextInput id="smtp-host" {...field('email.smtp_host')} placeholder="smtp.mon-domaine.fr" />
            </Row>
            <Row label="Port" htmlFor="smtp-port">
              <TextInput id="smtp-port" type="number" className="w-24 text-right tabular-nums" {...field('email.smtp_port')} placeholder="587" />
            </Row>
            <Row label="Connexion chiffrée (TLS)" description="À activer pour le port 465.">
              <Switch checked={form['email.smtp_secure'] === 'true'} onChange={(v) => set('email.smtp_secure', String(v))} />
            </Row>
            <Row stack label="Utilisateur" htmlFor="smtp-user">
              <TextInput id="smtp-user" {...field('email.smtp_user')} placeholder="utilisateur@mon-domaine.fr" />
            </Row>
            <Row stack label="Mot de passe" htmlFor="smtp-password">
              <PasswordInput id="smtp-password" {...field('email.smtp_password')} placeholder="••••••••" />
            </Row>
          </>
        )}
        {provider === 'resend' && (
          <Row stack label="Clé API" htmlFor="resend-key">
            <PasswordInput id="resend-key" {...field('email.resend_key')} placeholder="re_…" />
          </Row>
        )}
        {provider === 'mailgun' && (
          <>
            <Row stack label="Clé API" htmlFor="mailgun-key">
              <PasswordInput id="mailgun-key" {...field('email.mailgun_key')} placeholder="key-…" />
            </Row>
            <Row stack label="Domaine" htmlFor="mailgun-domain">
              <TextInput id="mailgun-domain" {...field('email.mailgun_domain')} placeholder="mg.mon-domaine.fr" />
            </Row>
          </>
        )}
        {provider === 'sendgrid' && (
          <Row stack label="Clé API" htmlFor="sendgrid-key">
            <PasswordInput id="sendgrid-key" {...field('email.sendgrid_key')} placeholder="SG.…" />
          </Row>
        )}
      </Group>

      {bar}
    </form>
  )
}

// ── Discord ───────────────────────────────────────────────────────────────────
function TabDiscord({ config }) {
  const keys = ['discord.client_id', 'discord.client_secret', 'discord.redirect_uri']
  const { form, set, save, bar } = useConfigForm(config, keys)
  const field = (key) => ({ value: form[key] || '', onChange: (e) => set(key, e.target.value) })

  return (
    <form onSubmit={save} className="space-y-8">
      <Group
        title="Application OAuth2"
        footer={<>Créez une application sur <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">discord.com/developers</a>, puis copiez ses identifiants OAuth2 ici.</>}
      >
        <Row stack label="Client ID" htmlFor="discord-id">
          <TextInput id="discord-id" className="font-mono text-[13px]" {...field('discord.client_id')} placeholder="123456789012345678" />
        </Row>
        <Row stack label="Client Secret" htmlFor="discord-secret">
          <PasswordInput id="discord-secret" {...field('discord.client_secret')} placeholder="••••••••" />
        </Row>
        <Row stack label="URL de redirection" description="Laissez vide pour utiliser celle proposée. Elle doit être déclarée à l'identique sur le portail Discord." htmlFor="discord-redirect">
          <TextInput id="discord-redirect" className="font-mono text-[13px]" {...field('discord.redirect_uri')}
            placeholder={`${config?.['app.url'] || 'https://mon-domaine.fr'}/api/auth/discord/callback`} />
        </Row>
      </Group>

      {bar}
    </form>
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────
const NOTIF_EVENTS = [
  { key: 'new_request',   label: 'Nouvelle demande de compte' },
  { key: 'storage_alert', label: 'Stockage presque plein', description: 'À 90 % de la part réservée aux médias' },
  { key: 'backup_done',   label: 'Sauvegarde terminée' },
  { key: 'backup_failed', label: 'Échec de sauvegarde' },
  { key: 'login_alert',   label: 'Connexion suspecte', description: 'Tentatives répétées ou bannissement' },
  { key: 'user_banned',   label: 'Utilisateur banni automatiquement' },
  { key: 'system_error',  label: 'Erreur critique du serveur' },
  { key: 'upload_done',   label: 'Gros envoi terminé' },
]

function NotifChannel({ channel, title, description, form, set, children }) {
  const enabled = form[`notif.${channel}.enabled`] === 'true'
  return (
    <Group title={title}>
      <Row label="Activer" description={description}>
        <Switch checked={enabled} onChange={(v) => set(`notif.${channel}.enabled`, String(v))} />
      </Row>
      {enabled && children}
      {enabled && NOTIF_EVENTS.map((e) => (
        <Row key={e.key} label={e.label} description={e.description}>
          <Switch size="sm" checked={form[`notif.${channel}.${e.key}`] === 'true'} onChange={(v) => set(`notif.${channel}.${e.key}`, String(v))} />
        </Row>
      ))}
    </Group>
  )
}

function TabNotifications({ config }) {
  const keys = [
    'notif.email.enabled', 'notif.discord.enabled', 'notif.discord.webhook',
    ...NOTIF_EVENTS.map((e) => `notif.email.${e.key}`),
    ...NOTIF_EVENTS.map((e) => `notif.discord.${e.key}`),
  ]
  const { form, set, save, bar } = useConfigForm(config, keys)

  return (
    <form onSubmit={save} className="space-y-8">
      <NotifChannel channel="email" title="Par email" description="Un email aux administrateurs pour les événements choisis." form={form} set={set} />
      <NotifChannel channel="discord" title="Sur Discord" description="Un message dans un salon, via un webhook." form={form} set={set}>
        <Row stack label="URL du webhook" description="Discord → Paramètres du salon → Intégrations → Webhooks." htmlFor="discord-webhook">
          <TextInput id="discord-webhook" className="font-mono text-[13px]" value={form['notif.discord.webhook'] || ''}
            onChange={(e) => set('notif.discord.webhook', e.target.value)} placeholder="https://discord.com/api/webhooks/…" />
        </Row>
      </NotifChannel>

      {bar}
    </form>
  )
}

// ── Sauvegardes ───────────────────────────────────────────────────────────────
const SCHEDULES = [
  { value: 'hourly', label: 'Toutes les heures' },
  { value: 'daily', label: 'Chaque jour', description: 'À 3 h UTC' },
  { value: 'weekly', label: 'Chaque semaine', description: 'Le dimanche à 3 h UTC' },
  { value: 'manual', label: 'Manuellement', description: 'Depuis Administration → Sauvegardes' },
]

function TabBackups({ config }) {
  const keys = [
    'backup.schedule', 'backup.keep_n',
    'backup.local.enabled', 'backup.backblaze.enabled',
    'b2.key_id', 'b2.key', 'b2.bucket', 'b2.passphrase',
  ]
  const { form, set, save, bar } = useConfigForm(config, keys)
  // Le serveur sauvegarde en local tant que ce n'est pas explicitement désactivé
  const localOn = form['backup.local.enabled'] !== 'false'
  const b2On = form['backup.backblaze.enabled'] === 'true'
  const field = (key) => ({ value: form[key] || '', onChange: (e) => set(key, e.target.value) })

  return (
    <form onSubmit={save} className="space-y-8">
      <Group title="Destinations" footer="Base de données et médias sont archivés ensemble. Plusieurs destinations peuvent être actives à la fois.">
        <Row label="Sur ce serveur" description="Recommandé, même avec une copie distante.">
          <Switch checked={localOn} onChange={(v) => set('backup.local.enabled', String(v))} />
        </Row>
        <Row label="Backblaze B2" description="Stockage distant, gratuit jusqu'à 10 Go.">
          <Switch checked={b2On} onChange={(v) => set('backup.backblaze.enabled', String(v))} />
        </Row>
        {b2On && (
          <>
            <Row stack label="Key ID" htmlFor="b2-key-id">
              <TextInput id="b2-key-id" className="font-mono text-[13px]" {...field('b2.key_id')} placeholder="00xxxxxxxxxxxxxxxxxxxxxxx" />
            </Row>
            <Row stack label="Application Key" htmlFor="b2-key">
              <PasswordInput id="b2-key" {...field('b2.key')} placeholder="K00…" />
            </Row>
            <Row stack label="Bucket" htmlFor="b2-bucket">
              <TextInput id="b2-bucket" className="font-mono text-[13px]" {...field('b2.bucket')} placeholder="mon-bucket" />
            </Row>
            <Row stack label="Phrase de chiffrement" htmlFor="b2-passphrase"
              description="Les archives sont chiffrées avant l'envoi. Notez cette phrase ailleurs : sans elle, impossible de les relire si le serveur est perdu.">
              <PasswordInput id="b2-passphrase" {...field('b2.passphrase')} placeholder="Une phrase longue et unique" />
            </Row>
          </>
        )}
      </Group>

      <Group title="Fréquence">
        <ChoiceRows name="backup-schedule" value={form['backup.schedule'] || 'daily'} onChange={(v) => set('backup.schedule', v)} options={SCHEDULES} />
      </Group>

      <Group>
        <Row label="Archives conservées" description="Les plus anciennes sont supprimées automatiquement." htmlFor="keep-n">
          <TextInput id="keep-n" type="number" min="1" max="30" className="w-20 text-right tabular-nums"
            value={form['backup.keep_n'] || '7'} onChange={(e) => set('backup.keep_n', e.target.value)} />
        </Row>
      </Group>

      {bar}
    </form>
  )
}

// ── Général ───────────────────────────────────────────────────────────────────
const GiB = 1024 ** 3
const fmtNum = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
const fmtGb = (b) => `${fmtNum(b / GiB)} Go`

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  return d > 0 ? `${d} j ${h} h` : `${h} h ${Math.floor((sec % 3600) / 60)} min`
}

// Barre segmentée + légende (à la manière du « Stockage » iOS / macOS)
function UsageBar({ segments, total }) {
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-overlay" role="img"
        aria-label={segments.map((s) => `${s.label} : ${s.display}`).join(', ')}>
        {segments.map((s) => s.value > 0 && (
          <div key={s.label} className={cn('min-w-[3px] transition-[width] duration-300 ease-out first:rounded-l-full last:rounded-r-full', s.color)}
            style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', s.dot || s.color)} />
            <span className="text-muted">{s.label}</span>
            <span className="tabular-nums text-fg">{s.display}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SliderRow({ id, label, description, value, min, max, gb, onChange }) {
  return (
    <div className="space-y-2.5 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="min-w-0">
          <span className="block text-sm text-fg">{label}</span>
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        </label>
        <span className="shrink-0 text-sm tabular-nums">
          <span className="text-fg">{value} %</span>
          {gb != null && <span className="text-muted"> · {fmtNum(gb)} Go</span>}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)}
        className="block w-full" style={{ '--fill': `${((value - min) / (max - min)) * 100}%` }} aria-valuetext={`${value} %`} />
    </div>
  )
}

// Suivi des versions (modèle « Mise à jour logicielle ») : visible avec system.view_stats
function VersionGroup() {
  const queryClient = useQueryClient()
  const { data: version, isError } = useQuery({
    queryKey: ['admin-version'],
    queryFn: () => api.get('/admin/version').then((r) => r.data),
    staleTime: 3600_000,
    retry: false,
  })
  const check = useMutation({
    mutationFn: () => api.get('/admin/version', { params: { refresh: 1 } }).then((r) => r.data),
    onSuccess: (data) => queryClient.setQueryData(['admin-version'], data),
  })
  if (isError || !version) return null

  const checkedAt = version.checkedAt && new Date(version.checkedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
  return (
    <Group
      title="Version"
      action={<Button type="button" size="sm" variant="outline" icon={RefreshCw} loading={check.isPending} onClick={() => check.mutate()}>Rechercher</Button>}
      footer={check.isError
        ? <span className="text-red-600 dark:text-red-400">{check.error.response?.data?.error || 'Vérification impossible'}</span>
        : version.updateAvailable
          ? <>Mettez à jour depuis l'App Store de ZimaOS, ou avec <code className="font-mono">docker compose pull && docker compose up -d</code>. Les réglages et les fichiers sont conservés.</>
          : 'Les nouvelles versions sont recherchées toutes les 12 heures ; une notification prévient les administrateurs.'}
    >
      <Row label="Version installée"><Value>{version.current}</Value></Row>
      <Row label="Dernière version publiée">
        <Value>{version.latest || '—'}</Value>
      </Row>
      <Row label="État" description={checkedAt ? `Vérifié le ${checkedAt}` : undefined}>
        {version.updateAvailable
          ? <span className="text-sm font-medium text-accent-600 dark:text-accent-400">Mise à jour disponible</span>
          : version.checkedAt
            ? <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"><Check size={14} />À jour</span>
            : <Value>Pas encore vérifié</Value>}
      </Row>
    </Group>
  )
}

function ToolValue({ tool }) {
  return tool.available
    ? <Value>{tool.version || 'Installé'}</Value>
    : <Value tone="danger">Introuvable</Value>
}

function TabGeneral({ config }) {
  const keys = [
    'app.name', 'app.url',
    'storage.media_pct', 'storage.backup_pct',
    'storage.total_gb', 'storage.max_gb', 'storage.logs_gb',
  ]
  const { form, set, save, bar } = useConfigForm(config, keys)
  const queryClient = useQueryClient()

  // Réservé à system.manage_storage : sans cette permission, la partie serveur est masquée
  const { data: infra } = useQuery({
    queryKey: ['admin-infra'],
    queryFn: () => api.get('/admin/infra').then((r) => r.data),
    retry: false,
  })
  const redetect = useMutation({
    mutationFn: () => api.post('/admin/infra/redetect').then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-infra'], data)
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
    },
  })

  const manualGb  = parseFloat(form['storage.total_gb'] || 0) || null
  const detectedGb = infra ? Math.floor(infra.allocation.autoSafe / GiB) || null : null
  const maxGb     = parseFloat(form['storage.max_gb'] || 0) || null
  // Même règle que le serveur (utils/infra.js) : l'auto suit le disque sans dépasser le plafond
  const autoGb    = detectedGb && maxGb ? Math.min(detectedGb, maxGb) : detectedGb || maxGb
  const capped    = !!(detectedGb && maxGb && maxGb < detectedGb)
  const isAuto    = !form['storage.total_gb']
  const totalGb   = manualGb || autoGb
  const mediaPct  = parseInt(form['storage.media_pct'] || 70)
  const backupPct = parseInt(form['storage.backup_pct'] || 10)
  const logsGb    = parseFloat(form['storage.logs_gb'] || 2)
  const logsPct   = totalGb ? Math.round((logsGb / totalGb) * 100) : 5
  const systemPct = Math.max(0, 100 - mediaPct - backupPct - logsPct)
  const overLimit = mediaPct + backupPct + logsPct > 95
  const gbOf = (pct) => (totalGb ? (pct / 100) * totalGb : null)

  const url = form['app.url'] || ''
  const isInsecure = url && !url.startsWith('https://')

  const allocation = [
    { color: 'bg-accent-500', label: 'Médias', value: mediaPct },
    { color: 'bg-blue-400', label: 'Sauvegardes', value: backupPct },
    { color: 'bg-amber-400', label: 'Journaux', value: logsPct },
    { color: 'bg-line-strong', label: 'Marge système', value: systemPct },
  ].map((s) => ({ ...s, display: totalGb ? `${fmtNum(gbOf(s.value))} Go` : `${s.value} %` }))

  return (
    <form onSubmit={save} className="space-y-8">
      <VersionGroup />

      <Group
        title="Instance"
        footer={isInsecure
          ? <span className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300"><AlertTriangle size={13} className="mt-px shrink-0" />Sans https://, les connexions et les cookies de session ne sont pas chiffrés.</span>
          : 'Le nom apparaît dans l\'interface et les emails ; l\'URL sert à construire les liens envoyés.'}
      >
        <Row stack label="Nom" htmlFor="app-name">
          <TextInput id="app-name" value={form['app.name'] || ''} onChange={(e) => set('app.name', e.target.value)} placeholder="Obscura" />
        </Row>
        <Row stack label="URL publique" htmlFor="app-url">
          <TextInput id="app-url" inputMode="url" className={cn('font-mono text-[13px]', isInsecure && 'border-amber-500/60')}
            value={url} onChange={(e) => set('app.url', e.target.value)} placeholder="https://photos.mon-domaine.fr" />
        </Row>
      </Group>

      <Group
        title="Stockage"
        footer={overLimit
          ? <span role="alert" className="flex items-start gap-1.5 text-red-600 dark:text-red-400"><AlertTriangle size={13} className="mt-px shrink-0" />Médias, sauvegardes et journaux dépassent 95 % : laissez de la marge au système.</span>
          : 'Les envois sont bloqués quand la part des médias est pleine ; une alerte part à 90 %.'}
      >
        <div className="space-y-4 px-4 py-5">
          <div>
            <p className="text-[28px] font-medium leading-none tracking-tight text-fg tabular-nums">
              {totalGb ? `${fmtNum(totalGb)} Go` : 'Automatique'}
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              {!isAuto
                ? 'Alloués manuellement à Obscura'
                : capped
                  ? `Alloués automatiquement, limités par le plafond (${fmtNum(detectedGb)} Go disponibles)`
                  : 'Alloués automatiquement à Obscura'}
            </p>
          </div>
          <UsageBar segments={allocation} total={100} />
        </div>
        <Row label="Taille automatique" description="Espace libre + données d'Obscura, moins 5 % de marge. Recalculée chaque heure.">
          <Switch checked={isAuto} onChange={(v) => set('storage.total_gb', v ? '' : String(autoGb || 100))} />
        </Row>
        {isAuto && (
          <Row label="Plafond" description="Jamais plus que cette taille, même si le disque se libère. Vide : aucun plafond." htmlFor="max-gb">
            <UnitInput id="max-gb" unit="Go" min="1" step="1" className="w-32" placeholder="Aucun"
              value={form['storage.max_gb'] || ''} onChange={(e) => set('storage.max_gb', e.target.value)} />
          </Row>
        )}
        {!isAuto && (
          <Row label="Taille allouée" htmlFor="total-gb">
            <UnitInput id="total-gb" unit="Go" min="1" step="1" className="w-32"
              value={form['storage.total_gb'] || ''} onChange={(e) => set('storage.total_gb', e.target.value)} />
          </Row>
        )}
        <SliderRow id="media-pct" label="Médias" description="Photos et vidéos" value={mediaPct} min={10} max={85}
          gb={gbOf(mediaPct)} onChange={(v) => set('storage.media_pct', v)} />
        <SliderRow id="backup-pct" label="Sauvegardes" description="Archives conservées sur ce serveur" value={backupPct} min={5} max={40}
          gb={gbOf(backupPct)} onChange={(v) => set('storage.backup_pct', v)} />
        <Row label="Journaux" description="Les plus anciens sont supprimés au-delà." htmlFor="logs-gb">
          <UnitInput id="logs-gb" unit="Go" min="0.5" max="20" step="0.5" className="w-28"
            value={form['storage.logs_gb'] || 2} onChange={(e) => set('storage.logs_gb', e.target.value)} />
        </Row>
      </Group>

      {infra && <ServerGroups infra={infra} onRedetect={() => redetect.mutate()} redetecting={redetect.isPending} />}

      {bar}
    </form>
  )
}

function ServerGroups({ infra, onRedetect, redetecting }) {
  const { disk, host, cpu, memory, gpu, tools, warnings } = infra
  const diskInfo = [disk.device?.kind, disk.fsType, disk.device?.model].filter(Boolean).join(' · ')
  const hasGpu = gpu.nvidia || gpu.renderNodes.length > 0
  const diskSegments = [
    { color: 'bg-accent-500', label: 'Obscura', value: disk.obscura.media },
    { color: 'bg-blue-400', label: 'Sauvegardes', value: disk.obscura.backups },
    { color: 'bg-line-strong', label: 'Autres données', value: disk.other },
    { color: 'bg-transparent', dot: 'border border-line-strong', label: 'Libre', value: disk.free },
  ].map((s) => ({ ...s, display: fmtGb(s.value) }))

  return (
    <>
      <Group
        title="Serveur"
        description={`Analysé le ${new Date(infra.detectedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`}
        action={<Button type="button" size="sm" variant="outline" icon={RefreshCw} loading={redetecting} onClick={onRedetect}>Analyser</Button>}
      >
        {warnings.map((w) => (
          <div key={w} className="flex items-start gap-3 bg-amber-500/[0.06] px-4 py-3 text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" /> {w}
          </div>
        ))}
        <div className="space-y-4 px-4 py-5">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-[28px] font-medium leading-none tracking-tight text-fg tabular-nums">{fmtGb(disk.free)}</p>
              <p className="mt-1.5 text-[13px] text-muted">libres sur {fmtGb(disk.size)}</p>
            </div>
            {diskInfo && <p className="text-xs text-subtle">{diskInfo}</p>}
          </div>
          <UsageBar segments={diskSegments} total={disk.size || 1} />
        </div>
        <Row label="Emplacement">
          <span className="block max-w-[16rem] truncate font-mono text-xs text-muted sm:max-w-sm" title={disk.path}>{disk.path}</span>
        </Row>
        <Row label="Système"><Value>{host.os}</Value></Row>
        <Row label="Machine"><Value>{host.hostname} · {host.arch}</Value></Row>
        {host.container && <Row label="Conteneur"><Value>{host.container}{host.image ? ` · ${host.image}` : ''}</Value></Row>}
        <Row label="En ligne depuis"><Value>{fmtUptime(host.uptime)}</Value></Row>
        <Row label="Processeur" description={cpu.model}>
          <Value>{cpu.limit ? `${cpu.limit} sur ${cpu.cores} cœurs` : `${cpu.cores} cœurs`}</Value>
        </Row>
        <Row label="Mémoire" description={`${fmtGb(memory.free)} libres${memory.limited ? ` · hôte ${fmtGb(memory.host)}` : ''}`}>
          <Value>{fmtGb(memory.total)}{memory.limited && ' (conteneur)'}</Value>
        </Row>
        <Row label="Vidéo" description={gpu.hwaccels.length ? `Accélérations FFmpeg : ${gpu.hwaccels.join(', ')}` : undefined}>
          <Value>{hasGpu ? `GPU ${gpu.nvidia ? 'NVIDIA' : 'VAAPI'}` : 'Processeur (pas de GPU)'}</Value>
        </Row>
      </Group>

      <Group title="Logiciels" footer="FFmpeg traite les vidéos ; Rclone envoie les sauvegardes vers Backblaze.">
        <Row label="FFmpeg"><ToolValue tool={tools.ffmpeg} /></Row>
        <Row label="FFprobe"><ToolValue tool={tools.ffprobe} /></Row>
        <Row label="Rclone"><ToolValue tool={tools.rclone} /></Row>
        <Row label="Node.js"><Value>{host.node}</Value></Row>
        {host.postgres && <Row label="PostgreSQL"><Value>{host.postgres}</Value></Row>}
      </Group>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'general', label: 'Général',       icon: SlidersHorizontal, description: 'Version, identité de l\'instance, stockage et état du serveur.', Component: TabGeneral },
  { key: 'email',   label: 'Email',         icon: Mail,              description: 'Service utilisé pour envoyer les emails.', Component: TabEmail },
  { key: 'discord', label: 'Discord',       icon: MessageSquare,     description: 'Connexion avec un compte Discord.', Component: TabDiscord },
  { key: 'notifs',  label: 'Notifications', icon: Bell,              description: 'Alertes envoyées aux administrateurs.', Component: TabNotifications },
  { key: 'backups', label: 'Sauvegardes',   icon: Database,          description: 'Où, quand et combien de sauvegardes garder.', Component: TabBackups },
]

export default function AdminSettings() {
  const [params, setParams] = useSearchParams()
  const isDesktop = useIsDesktop()
  const requested = params.get('tab')
  const active = TABS.find((t) => t.key === requested) || TABS[0]
  const setActiveTab = (t) => setParams({ tab: t }, { replace: true })
  const tabs = TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then((r) => r.data),
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-6 lg:mb-10">
        <h1 className="text-[26px] font-medium tracking-[-0.015em] text-fg">Configuration</h1>
        <p className="mt-1 text-sm text-muted">Réglages du serveur. Les clés et mots de passe sont chiffrés en base.</p>
      </header>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        {isDesktop
          ? <div className="sticky top-6 self-start"><SideTabs value={active.key} onChange={setActiveTab} tabs={tabs} /></div>
          : <Tabs value={active.key} onChange={setActiveTab} tabs={tabs} className="mb-6" />}

        <div className="min-w-0 max-w-2xl">
          <div className="mb-6 hidden lg:block">
            <h2 className="text-lg font-medium text-fg">{active.label}</h2>
            <p className="mt-0.5 text-[13px] text-muted">{active.description}</p>
          </div>
          {isLoading
            ? <div className="flex items-center justify-center py-20"><Spinner /></div>
            : <active.Component key={active.key} config={config} />}
        </div>
      </div>
    </div>
  )
}
