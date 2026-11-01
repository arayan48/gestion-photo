import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import api from '../utils/api.js'
import { Check, Eye, EyeOff, Mail, MessageSquare, Database, Globe, AlertTriangle, Bell, Info, HardDrive, Cpu, MemoryStick, Server, RefreshCw, X } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Switch } from '../components/ui/Form.jsx'
import { Tooltip as UiTooltip } from '../components/ui/Tooltip.jsx'
import { Tabs, SideTabs } from '../components/ui/Tabs.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'
import { useIsDesktop } from '../hooks/useMediaQuery.js'

function Toggle({ checked, onChange, label }) {
  return <Switch checked={checked} onChange={onChange} label={label} />
}

function Tooltip({ text }) {
  return (
    <UiTooltip content={<span className="block max-w-xs whitespace-normal leading-relaxed">{text}</span>} side="top">
      <span className="inline-flex cursor-help items-center"><Info size={14} className="text-subtle" /></span>
    </UiTooltip>
  )
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-subtle">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-fg">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
    </div>
  )
}

// Valeur renvoyée par l'API pour un secret déjà enregistré (jamais transmis en clair)
const MASKED_SECRET = '••••••••'

function PasswordInput({ value, onChange, placeholder, ...props }) {
  const [show, setShow] = useState(false)
  const isStored = value === MASKED_SECRET
  return (
    <div>
      <div className="relative">
        <input
          type={show && !isStored ? 'text' : 'password'}
          className="input pr-10"
          value={value}
          onChange={onChange}
          onFocus={(e) => isStored && e.target.select()}
          placeholder={placeholder}
          autoComplete="off"
          {...props}
        />
        {!isStored && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
            tabIndex={-1}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {isStored && (
        <p className="text-xs text-green-600 dark:text-green-500 mt-1">
          Enregistré (chiffré en base). Saisissez une nouvelle valeur pour le remplacer.
        </p>
      )}
    </div>
  )
}

function SaveBar({ saving, saved, error }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-surface px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6">
      <div className="text-sm">
        {saved && <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><Check size={14} /> Enregistré</span>}
        {error && <span className="text-red-500">{error}</span>}
      </div>
      <Button type="submit" loading={saving}>Enregistrer</Button>
    </div>
  )
}

// ── Hook générique pour les formulaires config ────────────────────────────────
function useConfigForm(config, keys) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (config) {
      const init = {}
      keys.forEach((k) => { init[k] = config[k] ?? '' })
      setForm(init)
    }
  }, [config])

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.patch('/admin/config', form)
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return { form, set, save, saving, saved, error }
}

// ── Onglet Email ──────────────────────────────────────────────────────────────
const EMAIL_PROVIDERS = [
  { value: 'brevo',    label: 'Brevo',     desc: 'Gratuit (300/jour)' },
  { value: 'smtp',     label: 'SMTP',      desc: 'Serveur custom' },
  { value: 'resend',   label: 'Resend',    desc: 'API moderne' },
  { value: 'mailgun',  label: 'Mailgun',   desc: 'Usage avancé' },
  { value: 'sendgrid', label: 'SendGrid',  desc: 'Production' },
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
  const { form, set, save, saving, saved, error } = useConfigForm(config, keys)
  const provider = form['email.provider'] || 'brevo'

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Fournisseur">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {EMAIL_PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => set('email.provider', p.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
                provider === p.value
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <span className={`text-sm font-medium ${provider === p.value ? 'text-accent-600 dark:text-accent-400' : 'text-fg'}`}>
                {p.label}
              </span>
              <span className="text-xs text-subtle">{p.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Expéditeur">
        <Field label="Adresse d'envoi" hint="Apparaît dans le champ 'De :' des emails">
          <input className="input" value={form['email.from'] || ''} onChange={(e) => set('email.from', e.target.value)} placeholder="noreply@mon-domaine.com" />
        </Field>
      </Section>

      {/* Brevo */}
      {provider === 'brevo' && (
        <Section title="Brevo">
          <Field label="Clé API Brevo">
            <PasswordInput value={form['email.brevo_key'] || ''} onChange={(e) => set('email.brevo_key', e.target.value)} placeholder="xkeysib-..." />
          </Field>
        </Section>
      )}

      {/* SMTP */}
      {provider === 'smtp' && (
        <Section title="SMTP">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hôte">
              <input className="input" value={form['email.smtp_host'] || ''} onChange={(e) => set('email.smtp_host', e.target.value)} placeholder="smtp.example.com" />
            </Field>
            <Field label="Port">
              <input className="input" type="number" value={form['email.smtp_port'] || ''} onChange={(e) => set('email.smtp_port', e.target.value)} placeholder="587" />
            </Field>
          </div>
          <Field label="Utilisateur">
            <input className="input" value={form['email.smtp_user'] || ''} onChange={(e) => set('email.smtp_user', e.target.value)} placeholder="user@example.com" />
          </Field>
          <Field label="Mot de passe">
            <PasswordInput value={form['email.smtp_password'] || ''} onChange={(e) => set('email.smtp_password', e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="TLS / SSL">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form['email.smtp_secure'] === 'true'}
                onChange={(e) => set('email.smtp_secure', String(e.target.checked))}
                className="w-4 h-4 rounded text-accent-600"
              />
              <span className="text-sm text-fg">Activer TLS (port 465)</span>
            </label>
          </Field>
        </Section>
      )}

      {/* Resend */}
      {provider === 'resend' && (
        <Section title="Resend">
          <Field label="Clé API Resend">
            <PasswordInput value={form['email.resend_key'] || ''} onChange={(e) => set('email.resend_key', e.target.value)} placeholder="re_..." />
          </Field>
        </Section>
      )}

      {/* Mailgun */}
      {provider === 'mailgun' && (
        <Section title="Mailgun">
          <Field label="Clé API Mailgun">
            <PasswordInput value={form['email.mailgun_key'] || ''} onChange={(e) => set('email.mailgun_key', e.target.value)} placeholder="key-..." />
          </Field>
          <Field label="Domaine Mailgun">
            <input className="input" value={form['email.mailgun_domain'] || ''} onChange={(e) => set('email.mailgun_domain', e.target.value)} placeholder="mg.mon-domaine.com" />
          </Field>
        </Section>
      )}

      {/* SendGrid */}
      {provider === 'sendgrid' && (
        <Section title="SendGrid">
          <Field label="Clé API SendGrid">
            <PasswordInput value={form['email.sendgrid_key'] || ''} onChange={(e) => set('email.sendgrid_key', e.target.value)} placeholder="SG...." />
          </Field>
        </Section>
      )}

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Onglet Discord ────────────────────────────────────────────────────────────
function TabDiscord({ config }) {
  const keys = ['discord.client_id', 'discord.client_secret', 'discord.redirect_uri']
  const { form, set, save, saving, saved, error } = useConfigForm(config, keys)

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-xl">
        <svg width="20" height="15" viewBox="0 0 71 55" fill="#5865F2" className="shrink-0 mt-0.5">
          <path d="M60.1 4.9C55.5 2.8 50.6 1.2 45.5.5c-.6 1.1-1.3 2.6-1.8 3.8C38.4 3.7 33.2 3.7 28 4.3c-.5-1.2-1.2-2.7-1.9-3.8C20.9 1.2 16 2.8 11.4 4.9 1.6 20.1-1 35 .3 49.7c5.7 4.2 11.2 6.7 16.7 8.4 1.3-1.8 2.5-3.8 3.5-5.8-1.9-.7-3.7-1.6-5.5-2.7.5-.3.9-.7 1.4-1 11.2 5.2 23.4 5.2 34.5 0 .4.3.9.7 1.4 1-1.7 1.1-3.6 2-5.5 2.7 1 2 2.2 4 3.5 5.8 5.5-1.7 11-4.2 16.7-8.4 1.5-17.3-2.6-32-10.9-44.8zM23.7 40.7c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8zm23.6 0c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-[#5865F2]">OAuth2 Discord</p>
          <p className="text-xs text-muted mt-0.5">
            Créez une application sur <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="underline hover:text-accent-500">discord.com/developers</a>, puis copiez les identifiants OAuth2.
          </p>
        </div>
      </div>

      <Section title="Identifiants">
        <Field label="Client ID">
          <input className="input font-mono" value={form['discord.client_id'] || ''} onChange={(e) => set('discord.client_id', e.target.value)} placeholder="123456789012345678" />
        </Field>
        <Field label="Client Secret">
          <PasswordInput value={form['discord.client_secret'] || ''} onChange={(e) => set('discord.client_secret', e.target.value)} placeholder="••••••••••••••••••••••••••••••••" />
        </Field>
        <Field label="Redirect URI" hint="Laisser vide pour utiliser l'URL affichée en grisé (déduite de l'URL publique). Doit correspondre exactement à celle déclarée sur le Discord Developer Portal.">
          <input className="input font-mono" value={form['discord.redirect_uri'] || ''} onChange={(e) => set('discord.redirect_uri', e.target.value)} placeholder={`${config?.['app.url'] || 'https://mon-domaine.com'}/api/auth/discord/callback`} />
        </Field>
      </Section>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Onglet Notifications ──────────────────────────────────────────────────────
const NOTIF_EVENTS = [
  { key: 'new_request',    label: 'Nouvelle demande de compte',  desc: 'Un utilisateur soumet une demande' },
  { key: 'storage_alert',  label: 'Alerte stockage (90%)',        desc: 'Espace disque presque saturé' },
  { key: 'backup_done',    label: 'Sauvegarde terminée',          desc: 'Succès ou échec d\'une sauvegarde' },
  { key: 'backup_failed',  label: 'Échec de sauvegarde',          desc: 'Une sauvegarde a échoué' },
  { key: 'login_alert',    label: 'Connexion suspecte détectée',  desc: 'Tentative de brute-force ou ban' },
  { key: 'user_banned',    label: 'Utilisateur banni',            desc: 'Un utilisateur a été banni automatiquement' },
  { key: 'system_error',   label: 'Erreur critique système',      desc: 'Erreur backend non gérée' },
  { key: 'upload_done',    label: 'Upload terminé (bulk)',         desc: 'Quand un utilisateur termine un gros upload' },
]

function TabNotifications({ config }) {
  const emailKeys = NOTIF_EVENTS.map((e) => `notif.email.${e.key}`)
  const discordKeys = NOTIF_EVENTS.map((e) => `notif.discord.${e.key}`)
  const keys = ['notif.email.enabled', 'notif.discord.enabled', 'notif.discord.webhook', ...emailKeys, ...discordKeys]
  const { form, set, save, saving, saved, error } = useConfigForm(config, keys)

  const emailEnabled = form['notif.email.enabled'] === 'true'
  const discordEnabled = form['notif.discord.enabled'] === 'true'

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Email notifications */}
      <Section title="Notifications Email">
        <div className="flex items-center justify-between p-3 bg-overlay/50 rounded-xl border border-line">
          <div>
            <p className="text-sm font-medium text-fg">Notifications par email</p>
            <p className="text-xs text-subtle">Envoie un email aux admins pour les événements sélectionnés</p>
          </div>
          <Toggle checked={emailEnabled} onChange={(v) => set('notif.email.enabled', String(v))} />
        </div>
        {emailEnabled && (
          <div className="space-y-2 mt-2">
            {NOTIF_EVENTS.map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-overlay cursor-pointer transition-colors">
                <input type="checkbox"
                  checked={form[`notif.email.${key}`] === 'true'}
                  onChange={(e) => set(`notif.email.${key}`, String(e.target.checked))}
                  className="mt-0.5 w-4 h-4 rounded text-accent-600" />
                <div>
                  <p className="text-sm font-medium text-fg">{label}</p>
                  <p className="text-xs text-subtle">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Section>

      {/* Discord webhook */}
      <Section title="Notifications Discord (Webhook)">
        <div className="flex items-center justify-between p-3 bg-overlay/50 rounded-xl border border-line">
          <div>
            <p className="text-sm font-medium text-fg">Notifications Discord</p>
            <p className="text-xs text-subtle">Envoie des messages dans un channel Discord via Webhook</p>
          </div>
          <Toggle checked={discordEnabled} onChange={(v) => set('notif.discord.enabled', String(v))} />
        </div>
        {discordEnabled && (
          <div className="space-y-3 mt-2">
            <Field label="URL du Webhook Discord" hint="Paramètres Discord → Intégrations → Créer un webhook → Copier l'URL">
              <input className="input font-mono text-sm" value={form['notif.discord.webhook'] || ''} onChange={(e) => set('notif.discord.webhook', e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
            </Field>
            <div className="space-y-2">
              {NOTIF_EVENTS.map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-overlay cursor-pointer transition-colors">
                  <input type="checkbox"
                    checked={form[`notif.discord.${key}`] === 'true'}
                    onChange={(e) => set(`notif.discord.${key}`, String(e.target.checked))}
                    className="mt-0.5 w-4 h-4 rounded text-accent-600" />
                  <div>
                    <p className="text-sm font-medium text-fg">{label}</p>
                    <p className="text-xs text-subtle">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </Section>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Onglet Sauvegardes ────────────────────────────────────────────────────────
function ProviderConfig({ name, form, set }) {
  if (name === 'backblaze') return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
        <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">Gratuit jusqu'à 10 Go. Créez un bucket sur <strong>backblaze.com</strong>.</p>
      </div>
      <Field label="Key ID"><input className="input font-mono text-sm" value={form['b2.key_id'] || ''} onChange={(e) => set('b2.key_id', e.target.value)} placeholder="00xxxxxxxxxxxxxxxxxxxxxxx" /></Field>
      <Field label="App Key"><PasswordInput value={form['b2.key'] || ''} onChange={(e) => set('b2.key', e.target.value)} placeholder="K00xxx..." /></Field>
      <Field label="Bucket"><input className="input font-mono text-sm" value={form['b2.bucket'] || ''} onChange={(e) => set('b2.bucket', e.target.value)} placeholder="mon-bucket" /></Field>
    </div>
  )
  if (name === 's3') return (
    <div className="space-y-3">
      <Field label="Endpoint" hint="Vide=AWS. Wasabi: s3.wasabisys.com. MinIO: http://...">
        <input className="input font-mono text-sm" value={form['s3.endpoint'] || ''} onChange={(e) => set('s3.endpoint', e.target.value)} placeholder="https://s3.wasabisys.com (optionnel)" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Région"><input className="input font-mono text-sm" value={form['s3.region'] || ''} onChange={(e) => set('s3.region', e.target.value)} placeholder="eu-west-1" /></Field>
        <Field label="Bucket"><input className="input font-mono text-sm" value={form['s3.bucket'] || ''} onChange={(e) => set('s3.bucket', e.target.value)} placeholder="mon-bucket" /></Field>
      </div>
      <Field label="Access Key"><input className="input font-mono text-sm" value={form['s3.access_key'] || ''} onChange={(e) => set('s3.access_key', e.target.value)} placeholder="AKIA..." /></Field>
      <Field label="Secret Key"><PasswordInput value={form['s3.secret_key'] || ''} onChange={(e) => set('s3.secret_key', e.target.value)} placeholder="••••••••" /></Field>
    </div>
  )
  if (name === 'ftp') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hôte"><input className="input text-sm" value={form['ftp.host'] || ''} onChange={(e) => set('ftp.host', e.target.value)} placeholder="ftp.exemple.com" /></Field>
        <Field label="Port"><input className="input text-sm" type="number" value={form['ftp.port'] || '21'} onChange={(e) => set('ftp.port', e.target.value)} /></Field>
      </div>
      <Field label="Utilisateur"><input className="input text-sm" value={form['ftp.user'] || ''} onChange={(e) => set('ftp.user', e.target.value)} placeholder="ftpuser" /></Field>
      <Field label="Mot de passe"><PasswordInput value={form['ftp.password'] || ''} onChange={(e) => set('ftp.password', e.target.value)} placeholder="••••••••" /></Field>
      <Field label="Chemin"><input className="input font-mono text-sm" value={form['ftp.path'] || ''} onChange={(e) => set('ftp.path', e.target.value)} placeholder="/backups/obscura" /></Field>
    </div>
  )
  if (name === 'sftp') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hôte"><input className="input text-sm" value={form['sftp.host'] || ''} onChange={(e) => set('sftp.host', e.target.value)} placeholder="ssh.exemple.com" /></Field>
        <Field label="Port"><input className="input text-sm" type="number" value={form['sftp.port'] || '22'} onChange={(e) => set('sftp.port', e.target.value)} /></Field>
      </div>
      <Field label="Utilisateur"><input className="input text-sm" value={form['sftp.user'] || ''} onChange={(e) => set('sftp.user', e.target.value)} placeholder="sshuser" /></Field>
      <Field label="Mot de passe"><PasswordInput value={form['sftp.password'] || ''} onChange={(e) => set('sftp.password', e.target.value)} placeholder="Laisser vide si clé SSH" /></Field>
      <Field label="Clé SSH (contenu)"><textarea className="input resize-none font-mono text-xs" rows={3} value={form['sftp.key'] || ''} onChange={(e) => set('sftp.key', e.target.value)} placeholder="-----BEGIN RSA PRIVATE KEY-----..." /></Field>
      <Field label="Chemin"><input className="input font-mono text-sm" value={form['sftp.path'] || ''} onChange={(e) => set('sftp.path', e.target.value)} placeholder="/home/user/backups" /></Field>
    </div>
  )
  if (name === 'webdav') return (
    <div className="space-y-3">
      <Field label="URL WebDAV"><input className="input text-sm" value={form['webdav.url'] || ''} onChange={(e) => set('webdav.url', e.target.value)} placeholder="https://nextcloud.exemple.com/remote.php/dav/files/user" /></Field>
      <Field label="Utilisateur"><input className="input text-sm" value={form['webdav.user'] || ''} onChange={(e) => set('webdav.user', e.target.value)} placeholder="user" /></Field>
      <Field label="Mot de passe"><PasswordInput value={form['webdav.password'] || ''} onChange={(e) => set('webdav.password', e.target.value)} placeholder="••••••••" /></Field>
    </div>
  )
  if (name === 'gdrive') return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <AlertTriangle size={12} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-400">Créez une app OAuth2 sur <strong>console.cloud.google.com</strong>.</p>
      </div>
      <Field label="Client ID"><input className="input font-mono text-sm" value={form['gdrive.client_id'] || ''} onChange={(e) => set('gdrive.client_id', e.target.value)} placeholder="xxx.apps.googleusercontent.com" /></Field>
      <Field label="Client Secret"><PasswordInput value={form['gdrive.client_secret'] || ''} onChange={(e) => set('gdrive.client_secret', e.target.value)} placeholder="••••••••" /></Field>
    </div>
  )
  if (name === 'rclone') return (
    <Field label="Remote rclone" hint="Nom du remote dans rclone.conf suivi du chemin">
      <input className="input font-mono text-sm" value={form['rclone.remote'] || ''} onChange={(e) => set('rclone.remote', e.target.value)} placeholder="myremote:bucket/path" />
    </Field>
  )
  return null
}

function TabBackblaze({ config }) {
  const allKeys = [
    'backup.schedule', 'backup.keep_n',
    'backup.local.enabled', 'backup.backblaze.enabled', 'backup.s3.enabled',
    'backup.ftp.enabled', 'backup.sftp.enabled', 'backup.webdav.enabled',
    'backup.gdrive.enabled', 'backup.rclone.enabled',
    'b2.key_id', 'b2.key', 'b2.bucket',
    's3.endpoint', 's3.region', 's3.bucket', 's3.access_key', 's3.secret_key',
    'ftp.host', 'ftp.port', 'ftp.user', 'ftp.password', 'ftp.path',
    'sftp.host', 'sftp.port', 'sftp.user', 'sftp.password', 'sftp.path', 'sftp.key',
    'webdav.url', 'webdav.user', 'webdav.password',
    'gdrive.client_id', 'gdrive.client_secret', 'rclone.remote',
  ]
  const { form, set, save, saving, saved, error } = useConfigForm(config, allKeys)

  const providers = [
    { value: 'local',     label: 'Local',          desc: 'Disque du serveur (toujours recommandé)' },
    { value: 'backblaze', label: 'Backblaze B2',   desc: 'Gratuit jusqu\'à 10 Go' },
    { value: 's3',        label: 'S3 / Wasabi / MinIO', desc: 'Compatible Amazon S3' },
    { value: 'ftp',       label: 'FTP',            desc: 'Serveur FTP classique' },
    { value: 'sftp',      label: 'SFTP',           desc: 'SSH sécurisé' },
    { value: 'webdav',    label: 'WebDAV',         desc: 'Nextcloud, ownCloud…' },
    { value: 'gdrive',    label: 'Google Drive',   desc: 'Via OAuth2' },
    { value: 'rclone',    label: 'rclone custom',  desc: 'Remote rclone personnalisé' },
  ]

  const isOn = (v) => form[`backup.${v}.enabled`] === 'true'
  const toggle = (v) => set(`backup.${v}.enabled`, isOn(v) ? 'false' : 'true')

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Destinations">
        <p className="text-xs text-muted">Activez plusieurs destinations pour sauvegarder simultanément sur différents supports.</p>
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.value} className={`rounded-xl border-2 overflow-hidden transition-all ${isOn(p.value) ? 'border-accent-500' : 'border-line'}`}>
              <div className={`flex items-center justify-between px-4 py-3 cursor-pointer ${isOn(p.value) ? 'bg-accent-500/10' : 'bg-surface'}`} onClick={() => toggle(p.value)}>
                <div>
                  <p className={`text-sm font-medium ${isOn(p.value) ? 'text-accent-600 dark:text-accent-400' : 'text-fg'}`}>{p.label}</p>
                  <p className="text-xs text-subtle">{p.desc}</p>
                </div>
                <Toggle checked={isOn(p.value)} onChange={() => toggle(p.value)} />
              </div>
              {isOn(p.value) && p.value !== 'local' && (
                <div className="px-4 pb-4 pt-3 border-t border-line bg-overlay/30">
                  <ProviderConfig name={p.value} form={form} set={set} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Planification">
        <Field label="Fréquence">
          <div className="flex flex-wrap gap-2">
            {[{ v: 'hourly', l: 'Toutes les heures' }, { v: 'daily', l: 'Quotidien (3h)' }, { v: 'weekly', l: 'Hebdomadaire' }, { v: 'manual', l: 'Manuel' }].map(({ v, l }) => (
              <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm ${(form['backup.schedule'] || 'daily') === v ? 'border-accent-500 bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'border-line text-fg hover:border-line-strong'}`}>
                <input type="radio" name="schedule" value={v} checked={(form['backup.schedule'] || 'daily') === v} onChange={() => set('backup.schedule', v)} className="text-accent-600" />
                {l}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Sauvegardes à conserver" hint="Les plus anciennes sont auto-supprimées">
          <input type="number" min="1" max="30" className="input w-28" value={form['backup.keep_n'] || '7'} onChange={(e) => set('backup.keep_n', e.target.value)} />
        </Field>
      </Section>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Onglet Général ────────────────────────────────────────────────────────────
function StorageBar({ segments }) {
  return (
    <div className="flex h-7 rounded-xl overflow-hidden text-[10px] font-medium shadow-inner">
      {segments.map(({ color, pct, label, gb }) =>
        pct > 0 ? (
          <div
            key={label}
            className={`${color} flex items-center justify-center text-white transition-all duration-300 overflow-hidden`}
            style={{ width: `${pct}%` }}
            title={`${label} : ${pct}% ${gb ? `(${gb} Go)` : ''}`}
          >
            {pct >= 7 ? `${pct}%` : ''}
          </div>
        ) : null
      )}
    </div>
  )
}

function StorageLegend({ segments, totalGb }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
      {segments.map(({ color, label, pct, gb, fixed }) => (
        <div key={label} className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
          <span className="text-muted flex-1 truncate">{label}</span>
          <span className="font-medium text-fg">
            {fixed ? `${gb} Go` : totalGb ? `${((pct / 100) * totalGb).toFixed(1)} Go` : `${pct}%`}
          </span>
          {!fixed && <span className="text-subtle">({pct}%)</span>}
        </div>
      ))}
    </div>
  )
}

// ── Infrastructure détectée ───────────────────────────────────────────────────
const GiB = 1024 ** 3
const fmtGb = (b) => `${(b / GiB).toFixed(b < 10 * GiB ? 1 : 0)} Go`

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  return d > 0 ? `${d} j ${h} h` : `${h} h ${Math.floor((sec % 3600) / 60)} min`
}

function InfraStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-line bg-overlay/40 p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-subtle">
        <Icon size={13} strokeWidth={1.75} /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-fg" title={typeof value === 'string' ? value : undefined}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-subtle" title={typeof sub === 'string' ? sub : undefined}>{sub}</p>}
    </div>
  )
}

function ToolBadge({ name, tool }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tool.available ? 'border-line text-fg' : 'border-red-500/40 text-red-600 dark:text-red-400'}`}>
      {tool.available ? <Check size={11} /> : <X size={11} />}
      {name}{tool.version ? ` ${tool.version}` : ''}
    </span>
  )
}

function InfraPanel({ infra, onRedetect, redetecting, onApply, currentTotalGb }) {
  const { disk, allocation, host, cpu, memory, gpu, tools, warnings } = infra
  const diskInfo = [disk.device?.kind, disk.fsType, disk.device?.model].filter(Boolean).join(' · ')
  const hasGpu = gpu.nvidia || gpu.renderNodes.length > 0
  const pct = (b) => (disk.size > 0 ? (b / disk.size) * 100 : 0)
  const diskSegments = [
    { color: 'bg-accent-500', label: 'Médias Obscura', bytes: disk.obscura.media },
    { color: 'bg-blue-400', label: 'Sauvegardes', bytes: disk.obscura.backups },
    { color: 'bg-zinc-400 dark:bg-zinc-600', label: 'Autres données', bytes: disk.other },
  ]
  const recommended = allocation.recommendedTotalGb

  return (
    <Section title="Infrastructure détectée">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-subtle">
          Analyse du serveur le {new Date(infra.detectedAt).toLocaleString('fr-FR')}
        </p>
        <Button size="sm" variant="outline" icon={RefreshCw} loading={redetecting} onClick={onRedetect}>
          Re-détecter
        </Button>
      </div>

      {/* Occupation réelle du disque */}
      <div className="rounded-xl border border-line p-4 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium text-fg">
            <HardDrive size={14} /> Disque <code className="font-mono text-xs text-subtle">{disk.path}</code>
            {diskInfo && <span className="text-xs font-normal text-muted">— {diskInfo}</span>}
          </span>
          <span className="text-xs text-muted">{fmtGb(disk.free)} libres sur {fmtGb(disk.size)}</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-overlay">
          {diskSegments.map((s) => s.bytes > 0 && (
            <div key={s.label} className={s.color} style={{ width: `${pct(s.bytes)}%` }} title={`${s.label} : ${fmtGb(s.bytes)}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {diskSegments.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.color}`} />{s.label} : {fmtGb(s.bytes)}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-overlay border border-line" />Libre : {fmtGb(disk.free)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <InfraStat icon={Server} label="Système" value={host.os}
          sub={`${host.hostname} · ${host.arch} · en ligne depuis ${fmtUptime(host.uptime)}${host.container ? ` · ${host.container}${host.image ? ` (${host.image})` : ''}` : ''}`} />
        <InfraStat icon={Cpu} label="Processeur"
          value={cpu.limit ? `${cpu.limit} cœur(s) alloué(s) / ${cpu.cores}` : `${cpu.cores} cœur(s)`}
          sub={`${cpu.model} · charge ${cpu.load[0]}`} />
        <InfraStat icon={MemoryStick} label="Mémoire"
          value={`${fmtGb(memory.total)}${memory.limited ? ' (limite conteneur)' : ''}`}
          sub={`${fmtGb(memory.free)} libres${memory.limited ? ` · hôte ${fmtGb(memory.host)}` : ''}`} />
        <InfraStat icon={HardDrive} label="Espace utilisable"
          value={fmtGb(allocation.autoSafe)}
          sub="Libre + déjà utilisé par Obscura − 5% de marge" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-subtle mr-1">Outils :</span>
        <ToolBadge name="FFmpeg" tool={tools.ffmpeg} />
        <ToolBadge name="FFprobe" tool={tools.ffprobe} />
        <ToolBadge name="Rclone" tool={tools.rclone} />
        <span
          className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs text-fg"
          title={gpu.hwaccels.length ? `Accélérations FFmpeg compilées : ${gpu.hwaccels.join(', ')}` : undefined}
        >
          {hasGpu ? `GPU ${gpu.nvidia ? 'NVIDIA' : 'VAAPI'} accessible` : 'Pas de GPU — encodage CPU'}
        </span>
        <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs text-fg">Node {host.node}</span>
        {host.postgres && <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs text-fg">PostgreSQL {host.postgres}</span>}
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} className="mt-px shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {recommended > 0 && currentTotalGb !== recommended && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
          <p className="text-xs text-muted">
            Taille recommandée pour ce serveur : <span className="font-medium text-fg">{recommended} Go</span>
            {!currentTotalGb && ' (appliquée automatiquement tant que le champ reste vide)'}
          </p>
          <Button size="xs" variant="secondary" onClick={() => onApply(recommended)}>Fixer à {recommended} Go</Button>
        </div>
      )}
    </Section>
  )
}

function TabGeneral({ config }) {
  const keys = [
    'app.name', 'app.url',
    'storage.media_pct', 'storage.backup_pct',
    'storage.total_gb', 'storage.logs_gb',
  ]
  const { form, set, save, saving, saved, error } = useConfigForm(config, keys)
  const queryClient = useQueryClient()

  // Réservé à system.manage_storage : sans cette permission, le panneau est masqué
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

  const manualGb   = parseFloat(form['storage.total_gb'] || 0) || null
  // Champ vide : on affiche les tailles réelles à partir de l'espace auto-détecté
  const autoGb     = infra ? Math.floor(infra.allocation.autoSafe / GiB) || null : null
  const totalGb    = manualGb || autoGb
  const mediaPct   = parseInt(form['storage.media_pct']  || 70)
  const backupPct  = parseInt(form['storage.backup_pct'] || 10)
  const logsGb     = parseFloat(form['storage.logs_gb']  || 2)

  const logsPct    = totalGb ? Math.round((logsGb / totalGb) * 100) : 5
  const systemPct  = Math.max(0, 100 - mediaPct - backupPct - logsPct)
  const overLimit  = mediaPct + backupPct + logsPct > 95

  const url = form['app.url'] || ''
  const isInsecure = url && !url.startsWith('https://')

  const minRecommended = totalGb ? (logsGb + 1 + totalGb * 0.05).toFixed(1) : null
  const maxMedia       = totalGb ? (totalGb * 0.85).toFixed(1) : null

  const segments = [
    { color: 'bg-accent-500', label: 'Médias',      pct: mediaPct,  gb: totalGb ? ((mediaPct / 100) * totalGb).toFixed(1) : null },
    { color: 'bg-blue-400',   label: 'Sauvegardes', pct: backupPct, gb: totalGb ? ((backupPct / 100) * totalGb).toFixed(1) : null },
    { color: 'bg-amber-400',  label: 'Logs',        pct: logsPct,   gb: logsGb, fixed: true },
    { color: 'bg-zinc-400 dark:bg-zinc-600', label: 'Système',   pct: systemPct, gb: totalGb ? ((systemPct / 100) * totalGb).toFixed(1) : null },
  ]

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Identité du projet">
        <Field label="Nom du projet" hint="Affiché dans l'interface et les emails">
          <input className="input" value={form['app.name'] || ''} onChange={(e) => set('app.name', e.target.value)} placeholder="Obscura" />
        </Field>
        <Field label={
          <span className="flex items-center gap-1.5">
            URL publique de l'instance
            <Tooltip text="Saisissez l'URL complète avec le protocole (ex: https://dashboard.example.com). Sans « https:// » au début, l'instance ne sera pas sécurisée." />
          </span>
        }>
          <input
            className={`input ${isInsecure ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-400' : ''}`}
            value={url}
            onChange={(e) => set('app.url', e.target.value)}
            placeholder="https://dashboard.exemple.com"
          />
          {isInsecure && (
            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
              <AlertTriangle size={11} /> HTTPS requis — ajoutez <code className="font-mono bg-amber-50 dark:bg-amber-900/20 px-1 rounded">https://</code> au début de l'URL
            </p>
          )}
        </Field>
      </Section>

      {infra && (
        <InfraPanel
          infra={infra}
          onRedetect={() => redetect.mutate()}
          redetecting={redetect.isPending}
          onApply={(gb) => set('storage.total_gb', String(gb))}
          currentTotalGb={manualGb}
        />
      )}

      <Section title="Allocation du stockage">
        {/* Espace total */}
        <Field
          label={
            <span className="flex items-center gap-1.5">
              Espace total alloué au projet
              <Tooltip text="Taille maximale qu'Obscura peut utiliser sur le disque. Laissez vide pour que le serveur l'auto-détecte : espace libre + espace déjà utilisé par Obscura, moins 5% de marge. Recalculé toutes les heures." />
            </span>
          }
          hint={totalGb ? `Min recommandé : ${minRecommended} Go — Max médias possible : ${maxMedia} Go` : 'Renseignez la taille pour voir les tailles en Go dans le graphe'}
        >
          <div className="flex items-center gap-2">
            <input
              type="number" min="1" step="1"
              className="input w-32"
              value={form['storage.total_gb'] || ''}
              onChange={(e) => set('storage.total_gb', e.target.value)}
              placeholder={autoGb ? `Auto (${autoGb})` : 'Auto'}
            />
            <span className="text-muted text-sm">Go</span>
            {manualGb && (
              <span className="text-xs text-subtle ml-1">
                = {(totalGb * 1024).toFixed(0)} Mo
              </span>
            )}
          </div>
        </Field>

        {/* Sliders */}
        <div className="space-y-4">
          {[
            { key: 'storage.media_pct',  label: 'Médias',       min: 10, max: 85, default: 70, color: 'text-accent-600', hint: 'Images et vidéos uploadées' },
            { key: 'storage.backup_pct', label: 'Sauvegardes',  min: 5,  max: 40, default: 10, color: 'text-blue-500',   hint: 'Sauvegardes locales (avant envoi cloud)' },
          ].map(({ key, label, min, max, default: def, color, hint }) => {
            const val = parseInt(form[key] || def)
            const gb  = totalGb ? ((val / 100) * totalGb).toFixed(1) : null
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-fg">{label}</span>
                  <span className="flex items-center gap-2">
                    {gb && <span className="text-xs text-subtle">{gb} Go</span>}
                    <span className={`text-sm font-medium w-10 text-right ${color}`}>{val}%</span>
                  </span>
                </div>
                <input
                  type="range" min={min} max={max}
                  className="w-full accent-accent-600 h-2 rounded-full"
                  value={val}
                  onChange={(e) => set(key, e.target.value)}
                />
                <p className="text-xs text-subtle mt-0.5">{hint} — min {min}%, max {max}%</p>
              </div>
            )
          })}

          {/* Logs en Go fixe */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-fg">Logs</span>
              <span className={`text-sm font-medium text-amber-500`}>{logsGb} Go</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number" min="0.5" max="20" step="0.5"
                className="input w-24 text-sm"
                value={form['storage.logs_gb'] || 2}
                onChange={(e) => set('storage.logs_gb', e.target.value)}
              />
              <span className="text-sm text-muted">Go — rotation automatique</span>
            </div>
          </div>
        </div>

        {/* Graphe visuel */}
        <div className="space-y-3 mt-4 p-4 bg-overlay/50 rounded-xl border border-line">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>0 {totalGb ? 'Go' : '%'}</span>
            <span className="font-medium text-fg">
              {totalGb ? `${totalGb} Go total${manualGb ? '' : ' (auto)'}` : 'Répartition (%)'}
            </span>
            <span>{totalGb ? `${totalGb} Go` : '100%'}</span>
          </div>
          <StorageBar segments={segments} />
          <StorageLegend segments={segments} totalGb={totalGb} />
        </div>

        {overLimit && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">La somme dépasse 95% — laissez une marge pour le système d'exploitation.</p>
          </div>
        )}
      </Section>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
const TABS = [
  { key: 'email',     label: 'Email',        icon: Mail },
  { key: 'discord',   label: 'Discord',      icon: MessageSquare },
  { key: 'notifs',    label: 'Notifications', icon: Bell },
  { key: 'backups',   label: 'Sauvegardes',  icon: Database },
  { key: 'general',   label: 'Général',      icon: Globe },
]

export default function AdminSettings() {
  const [params, setParams] = useSearchParams()
  const isDesktop = useIsDesktop()
  const requested = params.get('tab')
  const activeTab = TABS.some((t) => t.key === requested) ? requested : 'email'
  const setActiveTab = (t) => setParams({ tab: t }, { replace: true })
  const tabs = TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then((r) => r.data),
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-medium tracking-[-0.01em] text-fg">Configuration système</h1>
        <p className="mt-1 text-sm text-muted">Connexions externes et paramètres serveur. Les secrets sont chiffrés en base.</p>
      </div>
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {isDesktop
          ? <div className="sticky top-6 self-start"><SideTabs value={activeTab} onChange={setActiveTab} tabs={tabs} /></div>
          : <Tabs value={activeTab} onChange={setActiveTab} tabs={tabs} className="mb-5" />}
        <div className="card min-w-0 p-5 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : (
            <>
              {activeTab === 'email' && <TabEmail config={config} />}
              {activeTab === 'discord' && <TabDiscord config={config} />}
              {activeTab === 'notifs' && <TabNotifications config={config} />}
              {activeTab === 'backups' && <TabBackblaze config={config} />}
              {activeTab === 'general' && <TabGeneral config={config} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
