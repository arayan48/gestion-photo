import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  User, Palette, Lock, Link2, Bell, HardDrive, MousePointerClick, Camera, Sun, Moon, Monitor, Check,
  ShieldCheck, Unlink, Save, Images, Film, Trash2, Heart, Folder, Keyboard,
} from 'lucide-react'
import api, { apiError } from '../utils/api.js'
import { cn } from '../lib/cn.js'
import { formatSize, formatDate } from '../lib/format.js'
import { QUALITY_PRESETS } from '../lib/media.js'
import { saveNotificationPreferences } from '../lib/prefsSync.js'
import { useAuthStore } from '../stores/auth.store.js'
import { useThemeStore, ACCENTS } from '../stores/theme.store.js'
import { usePreferencesStore, GRID_SIZES } from '../stores/preferences.store.js'
import { useUiStore } from '../stores/ui.store.js'
import { toast } from '../stores/toast.store.js'
import { useIsDesktop } from '../hooks/useMediaQuery.js'
import { Tabs, SideTabs } from '../components/ui/Tabs.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Field, Input, PasswordInput, PasswordStrength, Switch, OtpInput, Segmented } from '../components/ui/Form.jsx'
import { Avatar, userAvatar } from '../components/ui/Avatar.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Progress } from '../components/ui/Progress.jsx'
import { DiscordIcon } from '../components/shared/AuthLayout.jsx'

const TABS = [
  { value: 'profile', label: 'Profil', icon: User },
  { value: 'appearance', label: 'Apparence', icon: Palette },
  { value: 'explorer', label: 'Explorateur', icon: MousePointerClick },
  { value: 'security', label: 'Sécurité', icon: Lock },
  { value: 'linked', label: 'Comptes liés', icon: Link2 },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'storage', label: 'Stockage', icon: HardDrive },
]

const DISCORD_ERRORS = {
  discord_already_linked: 'Ce compte Discord est déjà lié à un autre utilisateur.',
  discord_failed: 'La liaison avec Discord a échoué.',
  discord_cancelled: 'Liaison Discord annulée.',
}

function Section({ title, description, children, className }) {
  return (
    <section className={cn('card p-5 sm:p-6', className)}>
      {title && (
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

function Row({ children }) {
  return <div className="border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">{children}</div>
}

// ── Profil ───────────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, fetchMe } = useAuthStore()
  const [form, setForm] = useState({ pseudo: user?.pseudo || '', firstName: user?.first_name || '', lastName: user?.last_name || '' })
  const [saving, setSaving] = useState(false)
  const dirty = form.pseudo !== (user?.pseudo || '') || form.firstName !== (user?.first_name || '') || form.lastName !== (user?.last_name || '')

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch('/users/me/profile', { pseudo: form.pseudo !== user?.pseudo ? form.pseudo : undefined, firstName: form.firstName, lastName: form.lastName })
      await fetchMe()
      toast.success('Profil mis à jour')
    } catch (err) { toast.error(apiError(err)) } finally { setSaving(false) }
  }

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      await toast.promise(api.post('/users/me/avatar', fd), { loading: 'Envoi de la photo…', success: 'Photo de profil mise à jour', error: (err) => apiError(err, "Erreur lors de l'envoi") })
      await fetchMe()
    } catch {}
  }

  return (
    <div className="space-y-5">
      <Section>
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="group relative">
            <Avatar src={userAvatar(user)} name={user?.pseudo} size={88} className="ring-4 ring-overlay" />
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={22} />
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={uploadAvatar} />
            </label>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-lg font-semibold text-fg">{user?.pseudo}</p>
            <p className="text-sm text-muted">{user?.email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {user?.role_name && <Badge color={user.is_super_admin ? 'amber' : 'accent'}>{user.role_name}</Badge>}
              {user?.totp_enabled && <Badge color="green" icon={ShieldCheck}>2FA</Badge>}
              {user?.created_at && <Badge>Membre depuis {formatDate(user.created_at, 'MMMM yyyy')}</Badge>}
            </div>
          </div>
          <label className="sm:ml-auto">
            <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-fg hover:bg-overlay"><Camera size={14} /> Changer la photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={uploadAvatar} />
          </label>
        </div>
      </Section>
      <Section title="Informations personnelles">
        <form onSubmit={save} className="space-y-4">
          <Field label="Pseudo"><Input value={form.pseudo} onChange={(e) => setForm({ ...form, pseudo: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" optional><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom" optional><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="Email" hint="L'adresse email ne peut pas être modifiée."><Input value={user?.email || ''} readOnly disabled /></Field>
          <div className="flex justify-end"><Button type="submit" icon={Save} loading={saving} disabled={!dirty}>Enregistrer</Button></div>
        </form>
      </Section>
    </div>
  )
}

// ── Apparence ────────────────────────────────────────────────────────────────
function ThemePreview({ mode }) {
  const dark = mode === 'dark'
  return (
    <div className={cn('flex h-20 overflow-hidden rounded-lg border', dark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-100')}>
      <div className={cn('w-1/4 space-y-1 p-1.5', dark ? 'bg-zinc-900' : 'bg-white')}>
        <div className="h-1.5 rounded bg-accent-500" />
        {[0, 1, 2].map((i) => <div key={i} className={cn('h-1 rounded', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />)}
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1 p-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={cn('rounded', dark ? 'bg-zinc-800' : 'bg-zinc-300')} />)}
      </div>
    </div>
  )
}

function AppearanceTab() {
  const { theme, setTheme, accent, setAccent } = useThemeStore()
  const { reduceMotion, set } = usePreferencesStore()
  const options = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ]
  return (
    <div className="space-y-5">
      <Section title="Thème" description="« Système » suit automatiquement le réglage de votre appareil. Synchronisé sur tous vos appareils.">
        <div className="grid grid-cols-3 gap-3">
          {options.map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setTheme(value)} className={cn('rounded-2xl border-2 p-2.5 text-left transition-all', theme === value ? 'border-accent-500 ring-4 ring-accent-500/10' : 'border-line hover:border-line-strong')}>
              {value === 'system' ? (
                <div className="grid grid-cols-2 overflow-hidden rounded-lg"><ThemePreview mode="light" /><ThemePreview mode="dark" /></div>
              ) : <ThemePreview mode={value} />}
              <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-fg"><Icon size={14} /> {label}{theme === value && <Check size={14} className="ml-auto text-accent-500" />}</p>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Couleur d'accent" description="Utilisée pour les boutons, la sélection et les éléments actifs.">
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button key={a.value} onClick={() => setAccent(a.value)} className="group flex flex-col items-center gap-1.5" aria-label={a.label}>
              <span className={cn('flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-all', accent === a.value ? 'ring-2' : 'group-hover:scale-110')} style={{ background: a.hex, '--tw-ring-color': a.hex }}>
                {accent === a.value && <Check size={18} className="text-white" strokeWidth={3} />}
              </span>
              <span className={cn('text-[11px]', accent === a.value ? 'font-medium text-fg' : 'text-subtle')}>{a.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Accessibilité">
        <Switch checked={reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="Réduire les animations" description="Désactive les transitions et effets de mouvement (le réglage de l'appareil est respecté par défaut)." />
      </Section>
    </div>
  )
}

// ── Explorateur ──────────────────────────────────────────────────────────────
function ExplorerTab() {
  const p = usePreferencesStore()
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  return (
    <div className="space-y-5">
      <Section title="Souris et clavier" description="Adaptez le comportement à votre façon de travailler.">
        <Row><Switch checked={p.clickToOpen} onChange={(v) => p.set({ clickToOpen: v })} label="Ouvrir d'un simple clic" description="Désactivé : un clic sélectionne et un double-clic ouvre (comme Windows / macOS). Sur écran tactile, un appui ouvre toujours." /></Row>
        <Row>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-fg">Raccourcis clavier</p>
              <p className="mt-0.5 text-xs text-muted">Navigation aux flèches, Suppr, F2, Ctrl+A, lasso, pincement du pavé tactile…</p>
            </div>
            <Button variant="secondary" size="sm" icon={Keyboard} onClick={() => setShortcutsOpen(true)}>Voir</Button>
          </div>
        </Row>
      </Section>
      <Section title="Affichage">
        <Row>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-fg">Vue par défaut</p>
            <Segmented value={p.viewMode} onChange={p.setViewMode} options={[{ value: 'grid', label: 'Grille' }, { value: 'list', label: 'Liste' }]} />
          </div>
        </Row>
        <Row>
          <p className="mb-3 text-sm font-medium text-fg">Taille des vignettes <span className="text-subtle">· {GRID_SIZES[p.gridSize]} px</span></p>
          <input type="range" min={0} max={GRID_SIZES.length - 1} value={p.gridSize} onChange={(e) => p.setGridSize(Number(e.target.value))} className="w-full accent-[rgb(var(--accent-500))]" />
        </Row>
        <Row><Switch checked={p.groupByDate} onChange={(v) => p.set({ groupByDate: v })} label="Grouper par date" description="Aujourd'hui, Hier, Cette semaine, par mois… (tri par date)." /></Row>
        <Row><Switch checked={p.showNames} onChange={(v) => p.set({ showNames: v })} label="Afficher les noms sous les vignettes" /></Row>
      </Section>
      <Section title="Envoi de fichiers">
        <Row><Switch checked={p.askQuality} onChange={(v) => p.set({ askQuality: v })} label="Préparer avant d'envoyer" description="Affiche la fenêtre pour renommer et choisir la qualité. Désactivé : l'envoi démarre immédiatement." /></Row>
        <Row>
          <p className="mb-3 text-sm font-medium text-fg">Qualité par défaut des images</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {QUALITY_PRESETS.map((q) => (
              <button key={q.value} onClick={() => p.setDefaultQuality(q.value)} className={cn('rounded-xl border p-3 text-left transition-all', p.defaultQuality === q.value ? 'border-accent-500 bg-accent-500/10' : 'border-line hover:border-line-strong')}>
                <p className="text-sm font-semibold text-fg">{q.label}</p>
                <p className="text-[11px] text-subtle">{q.desc}</p>
              </button>
            ))}
          </div>
        </Row>
      </Section>
    </div>
  )
}

// ── Sécurité ─────────────────────────────────────────────────────────────────
function SecurityTab() {
  const { user, fetchMe } = useAuthStore()
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [qr, setQr] = useState(null)
  const [code, setCode] = useState('')

  const savePassword = async (e) => {
    e.preventDefault()
    if (pwd.next !== pwd.confirm) return toast.error('Les mots de passe ne correspondent pas')
    setSaving(true)
    try {
      await api.patch('/users/me/profile', { password: pwd.next, currentPassword: pwd.current })
      toast.success('Mot de passe mis à jour')
      setPwd({ current: '', next: '', confirm: '' })
    } catch (err) { toast.error(apiError(err)) } finally { setSaving(false) }
  }

  const totp = {
    setup: async () => { try { setQr((await api.post('/auth/totp/setup')).data.qrCode) } catch (err) { toast.error(apiError(err)) } },
    confirm: async () => {
      try { await api.post('/auth/totp/confirm', { code }); await fetchMe(); setQr(null); setCode(''); toast.success('Double authentification activée') } catch { toast.error('Code invalide'); setCode('') }
    },
    disable: async () => {
      try { await api.post('/auth/totp/disable', { code }); await fetchMe(); setCode(''); toast.success('Double authentification désactivée') } catch { toast.error('Code invalide'); setCode('') }
    },
  }

  return (
    <div className="space-y-5">
      <Section title="Mot de passe" description="Toutes vos sessions restent actives après le changement.">
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="Mot de passe actuel"><PasswordInput value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} autoComplete="current-password" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nouveau mot de passe">
              <PasswordInput value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} minLength={8} autoComplete="new-password" required />
              <PasswordStrength password={pwd.next} />
            </Field>
            <Field label="Confirmer" error={pwd.confirm && pwd.next !== pwd.confirm ? 'Ne correspond pas' : null}>
              <PasswordInput value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} autoComplete="new-password" required />
            </Field>
          </div>
          <div className="flex justify-end"><Button type="submit" loading={saving} disabled={!pwd.current || !pwd.next}>Changer le mot de passe</Button></div>
        </form>
      </Section>

      <Section title="Double authentification (TOTP)" description="Un code à 6 chiffres de votre application (Google Authenticator, Authy, 1Password…) est demandé à chaque connexion.">
        {user?.totp_enabled ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-700 dark:text-emerald-400">
              <ShieldCheck size={18} /> Activée — votre compte est protégé.
            </div>
            <div className="space-y-3">
              <p className="text-[13px] text-muted">Pour désactiver, saisissez un code de votre application :</p>
              <OtpInput value={code} onChange={setCode} />
              <div className="flex justify-center"><Button variant="danger-soft" onClick={totp.disable} disabled={code.length !== 6}>Désactiver la 2FA</Button></div>
            </div>
          </div>
        ) : qr ? (
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <img src={qr} alt="QR code TOTP" className="h-44 w-44 rounded-2xl border border-line bg-white p-2" />
            <div className="flex-1 space-y-4">
              <ol className="list-inside list-decimal space-y-1 text-[13px] text-muted">
                <li>Scannez le QR code avec votre application.</li>
                <li>Saisissez le code à 6 chiffres affiché.</li>
              </ol>
              <OtpInput value={code} onChange={setCode} autoFocus />
              <div className="flex gap-2">
                <Button onClick={totp.confirm} disabled={code.length !== 6}>Activer</Button>
                <Button variant="ghost" onClick={() => { setQr(null); setCode('') }}>Annuler</Button>
              </div>
            </div>
          </div>
        ) : (
          <Button icon={ShieldCheck} onClick={totp.setup}>Activer la double authentification</Button>
        )}
      </Section>
    </div>
  )
}

// ── Comptes liés ─────────────────────────────────────────────────────────────
function LinkedTab() {
  const { user, fetchMe } = useAuthStore()
  const link = async () => {
    try { window.location.href = (await api.post('/auth/discord/link')).data.url } catch (err) { toast.error(apiError(err, 'Impossible de lier Discord')) }
  }
  const unlink = async () => {
    try { await api.delete('/users/me/discord'); await fetchMe(); toast.success('Compte Discord délié') } catch (err) { toast.error(apiError(err)) }
  }
  return (
    <Section title="Discord" description="Liez votre compte pour vous connecter en un clic avec Discord.">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#5865F2]/30 bg-[#5865F2]/[0.06] p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5865F2] text-white"><DiscordIcon size={22} /></span>
        {user?.discord_id ? (
          <>
            {user.discord_avatar && <img src={user.discord_avatar} alt="" className="h-10 w-10 rounded-full" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{user.discord_pseudo}</p>
              <p className="text-xs text-muted">Compte lié</p>
            </div>
            <Button variant="secondary" size="sm" icon={Unlink} onClick={unlink}>Délier</Button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-sm text-muted">Aucun compte Discord lié.</p>
            <Button size="sm" className="bg-[#5865F2] hover:bg-[#4752C4]" icon={Link2} onClick={link}>Lier Discord</Button>
          </>
        )}
      </div>
    </Section>
  )
}

// ── Notifications (enregistrées en base, respectées par le serveur) ──────────
const NOTIFS = [
  { key: 'upload_done', label: 'Envoi terminé', desc: 'Quand un fichier a fini d’être traité.' },
  { key: 'file_deleted', label: 'Fichier supprimé par un administrateur', desc: 'Si un admin met l’un de vos fichiers à la corbeille.' },
]
const ADMIN_NOTIFS = [
  { key: 'new_account_request', label: 'Nouvelle demande de compte', desc: 'Une personne demande un accès.' },
  { key: 'storage_warning', label: 'Alerte de stockage', desc: 'Le serveur dépasse 90 % de sa capacité médias.' },
  { key: 'backup_success', label: 'Sauvegarde réussie' },
  { key: 'backup_failed', label: 'Échec de sauvegarde', desc: 'Recommandé : à garder activé.' },
]

function NotificationsTab() {
  const { user, fetchMe } = useAuthStore()
  const [prefs, setPrefs] = useState(() => user?.preferences?.notifications || {})
  const toggle = async (key, value) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    try { await saveNotificationPreferences({ [key]: value }); fetchMe().catch(() => {}) } catch { toast.error('Enregistrement impossible'); setPrefs(prefs) }
  }
  const list = (items) => items.map((n) => (
    <Row key={n.key}><Switch checked={prefs[n.key] !== false} onChange={(v) => toggle(n.key, v)} label={n.label} description={n.desc} /></Row>
  ))
  return (
    <div className="space-y-5">
      <Section title="Cloche de notifications" description="Choisissez ce qui apparaît dans la cloche et en temps réel. Appliqué immédiatement.">{list(NOTIFS)}</Section>
      {user?.is_super_admin && <Section title="Administration">{list(ADMIN_NOTIFS)}</Section>}
    </div>
  )
}

// ── Stockage ─────────────────────────────────────────────────────────────────
function StorageTab() {
  const user = useAuthStore((s) => s.user)
  const { data } = useQuery({ queryKey: ['my-stats'], queryFn: () => api.get('/files/stats').then((r) => r.data) })
  const used = Number(user?.storage_used || 0)
  const quota = Number(user?.storage_quota || 1)
  const pct = Math.min(100, Math.round((used / quota) * 100))
  const by = (t) => data?.byType?.find((x) => x.type === t) || { count: 0, size: 0 }
  const img = by('image')
  const vid = by('video')
  // Palette catégorielle validée pour les graphiques (cf. AdminOverview)
  const seg = [
    { label: 'Photos', icon: Images, size: Number(img.size), count: img.count, color: '#7c3aed' },
    { label: 'Vidéos', icon: Film, size: Number(vid.size), count: vid.count, color: '#0891b2' },
    { label: 'Corbeille', icon: Trash2, size: Number(data?.trash_size || 0), count: data?.trash_count || 0, color: '#d97706' },
  ]
  return (
    <div className="space-y-5">
      <Section>
        <p className="text-sm text-muted">Espace utilisé</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-fg">{formatSize(used)} <span className="text-lg font-normal text-subtle">sur {formatSize(quota)}</span></p>
        <div className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded-full bg-overlay">
          {seg.map((s) => s.size > 0 && <motion.div key={s.label} initial={{ width: 0 }} animate={{ width: `${(s.size / quota) * 100}%` }} className="h-full first:rounded-l-full" style={{ background: s.color }} title={`${s.label} : ${formatSize(s.size)}`} />)}
        </div>
        <p className={cn('mt-2 text-xs', pct >= 90 ? 'text-red-500' : 'text-subtle')}>{pct} % utilisé · {formatSize(Math.max(0, quota - used))} disponibles</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {seg.map(({ label, icon: Icon, size, count, color }) => (
            <div key={label} className="rounded-xl border border-line p-3.5">
              <div className="flex items-center gap-2 text-[13px] text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /><Icon size={14} /> {label}</div>
              <p className="mt-2 text-lg font-semibold text-fg">{formatSize(size)}</p>
              <p className="text-xs text-subtle">{count} fichier(s)</p>
            </div>
          ))}
        </div>
        {pct >= 90 && <Progress value={pct} className="mt-5" />}
      </Section>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3 p-4"><Heart size={18} className="text-pink-500" /><span className="text-sm text-fg">{data?.favorites ?? '—'} favori(s)</span></div>
        <div className="card flex items-center gap-3 p-4"><Folder size={18} className="text-amber-500" /><span className="text-sm text-fg">{data?.folders ?? '—'} dossier(s)</span></div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { fetchMe } = useAuthStore()
  const [params, setParams] = useSearchParams()
  const isDesktop = useIsDesktop()
  const initial = params.get('discord') || params.get('discord_error') ? 'linked' : params.get('tab')
  const tab = TABS.some((t) => t.value === initial) ? initial : 'profile'
  const setTab = (t) => setParams({ tab: t }, { replace: true })

  // Retour de la liaison Discord (redirection depuis /api/auth/discord/callback)
  useEffect(() => {
    const linked = params.get('discord') === 'linked'
    const err = params.get('discord_error')
    if (!linked && !err) return
    if (linked) { fetchMe().catch(() => {}); toast.success('Compte Discord lié') } else toast.error(DISCORD_ERRORS[err] || DISCORD_ERRORS.discord_failed)
    setParams({ tab: 'linked' }, { replace: true })
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Paramètres</h1>
        <p className="mt-1 text-sm text-muted">Votre compte, l'apparence et le comportement d'Obscura.</p>
      </div>
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {isDesktop ? <div className="sticky top-6 self-start"><SideTabs value={tab} onChange={setTab} tabs={TABS} /></div> : <Tabs value={tab} onChange={setTab} tabs={TABS} className="mb-5" />}
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'explorer' && <ExplorerTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'linked' && <LinkedTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'storage' && <StorageTab />}
        </motion.div>
      </div>
    </div>
  )
}
