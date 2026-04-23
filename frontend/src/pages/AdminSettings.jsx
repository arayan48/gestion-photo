import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api.js'
import { Save, Check, Eye, EyeOff, Mail, MessageSquare, Database, Globe, AlertTriangle } from 'lucide-react'

// ── Helpers UI ────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">{hint}</p>}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="input pr-10"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
        tabIndex={-1}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function SaveBar({ saving, saved, error, onSave }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-gray-800">
      <div className="text-sm">
        {saved && <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400"><Check size={14} /> Enregistré</span>}
        {error && <span className="text-red-500">{error}</span>}
      </div>
      <button
        type="submit"
        disabled={saving}
        className="btn-primary flex items-center gap-2 text-sm"
      >
        <Save size={14} />
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
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
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                  : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
              }`}
            >
              <span className={`text-sm font-semibold ${provider === p.value ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-gray-300'}`}>
                {p.label}
              </span>
              <span className="text-xs text-slate-400 dark:text-gray-500">{p.desc}</span>
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
                className="w-4 h-4 rounded text-violet-600"
              />
              <span className="text-sm text-slate-700 dark:text-gray-300">Activer TLS (port 465)</span>
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
          <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
            Créez une application sur <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="underline hover:text-violet-500">discord.com/developers</a>, puis copiez les identifiants OAuth2.
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
        <Field label="Redirect URI" hint="Doit correspondre exactement à ce qui est configuré sur Discord Developer Portal">
          <input className="input font-mono" value={form['discord.redirect_uri'] || ''} onChange={(e) => set('discord.redirect_uri', e.target.value)} placeholder="https://mon-domaine.com/api/auth/discord/callback" />
        </Field>
      </Section>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Onglet Sauvegardes ────────────────────────────────────────────────────────
const BACKUP_PROVIDERS = [
  { value: 'local',     label: 'Local',          desc: 'Disque du serveur' },
  { value: 'backblaze', label: 'Backblaze B2',   desc: 'Gratuit jusqu\'à 10 Go' },
  { value: 's3',        label: 'Amazon S3',      desc: 'S3 / Wasabi / MinIO' },
  { value: 'ftp',       label: 'FTP',            desc: 'Serveur FTP classique' },
  { value: 'sftp',      label: 'SFTP',           desc: 'SSH / SFTP sécurisé' },
  { value: 'webdav',    label: 'WebDAV',         desc: 'Nextcloud, ownCloud…' },
  { value: 'gdrive',    label: 'Google Drive',   desc: 'Via rclone OAuth2' },
  { value: 'rclone',    label: 'rclone custom',  desc: 'Remote rclone configuré' },
]

function TabBackblaze({ config }) {
  const keys = [
    'backup.provider', 'backup.schedule', 'backup.keep_n',
    'b2.key_id', 'b2.key', 'b2.bucket',
    's3.endpoint', 's3.region', 's3.bucket', 's3.access_key', 's3.secret_key',
    'ftp.host', 'ftp.port', 'ftp.user', 'ftp.password', 'ftp.path',
    'sftp.host', 'sftp.port', 'sftp.user', 'sftp.password', 'sftp.path', 'sftp.key',
    'webdav.url', 'webdav.user', 'webdav.password',
    'gdrive.client_id', 'gdrive.client_secret',
    'rclone.remote',
  ]
  const { form, set, save, saving, saved, error } = useConfigForm(config, keys)
  const provider = form['backup.provider'] || 'local'

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Destination de sauvegarde">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BACKUP_PROVIDERS.map((p) => (
            <button key={p.value} type="button" onClick={() => set('backup.provider', p.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                provider === p.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
              }`}>
              <span className={`text-sm font-semibold ${provider === p.value ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-gray-300'}`}>{p.label}</span>
              <span className="text-[10px] text-slate-400 dark:text-gray-500">{p.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Backblaze B2 */}
      {provider === 'backblaze' && (
        <Section title="Backblaze B2">
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl mb-3">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">Gratuit jusqu'à 10 Go. Créez un bucket sur <strong>backblaze.com</strong>.</p>
          </div>
          <Field label="Application Key ID"><input className="input font-mono" value={form['b2.key_id'] || ''} onChange={(e) => set('b2.key_id', e.target.value)} placeholder="00xxxxxxxxxxxxxxxxxxxxxxx" /></Field>
          <Field label="Application Key"><PasswordInput value={form['b2.key'] || ''} onChange={(e) => set('b2.key', e.target.value)} placeholder="K00xxx..." /></Field>
          <Field label="Nom du bucket"><input className="input font-mono" value={form['b2.bucket'] || ''} onChange={(e) => set('b2.bucket', e.target.value)} placeholder="mon-bucket" /></Field>
        </Section>
      )}

      {/* S3 compatible */}
      {provider === 's3' && (
        <Section title="S3 / Wasabi / MinIO">
          <Field label="Endpoint" hint="Laisser vide pour AWS S3 standard. Remplir pour Wasabi (s3.wasabisys.com) ou MinIO (http://...)">
            <input className="input font-mono" value={form['s3.endpoint'] || ''} onChange={(e) => set('s3.endpoint', e.target.value)} placeholder="https://s3.wasabisys.com (optionnel)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Région"><input className="input font-mono" value={form['s3.region'] || ''} onChange={(e) => set('s3.region', e.target.value)} placeholder="eu-west-1" /></Field>
            <Field label="Bucket"><input className="input font-mono" value={form['s3.bucket'] || ''} onChange={(e) => set('s3.bucket', e.target.value)} placeholder="mon-bucket" /></Field>
          </div>
          <Field label="Access Key ID"><input className="input font-mono" value={form['s3.access_key'] || ''} onChange={(e) => set('s3.access_key', e.target.value)} placeholder="AKIA..." /></Field>
          <Field label="Secret Access Key"><PasswordInput value={form['s3.secret_key'] || ''} onChange={(e) => set('s3.secret_key', e.target.value)} placeholder="••••••••" /></Field>
        </Section>
      )}

      {/* FTP */}
      {provider === 'ftp' && (
        <Section title="FTP">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hôte"><input className="input" value={form['ftp.host'] || ''} onChange={(e) => set('ftp.host', e.target.value)} placeholder="ftp.exemple.com" /></Field>
            <Field label="Port"><input className="input" type="number" value={form['ftp.port'] || '21'} onChange={(e) => set('ftp.port', e.target.value)} /></Field>
          </div>
          <Field label="Utilisateur"><input className="input" value={form['ftp.user'] || ''} onChange={(e) => set('ftp.user', e.target.value)} placeholder="ftpuser" /></Field>
          <Field label="Mot de passe"><PasswordInput value={form['ftp.password'] || ''} onChange={(e) => set('ftp.password', e.target.value)} placeholder="••••••••" /></Field>
          <Field label="Chemin distant" hint="Dossier de destination sur le serveur FTP"><input className="input font-mono" value={form['ftp.path'] || ''} onChange={(e) => set('ftp.path', e.target.value)} placeholder="/backups/wubalstore" /></Field>
        </Section>
      )}

      {/* SFTP */}
      {provider === 'sftp' && (
        <Section title="SFTP">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hôte"><input className="input" value={form['sftp.host'] || ''} onChange={(e) => set('sftp.host', e.target.value)} placeholder="ssh.exemple.com" /></Field>
            <Field label="Port"><input className="input" type="number" value={form['sftp.port'] || '22'} onChange={(e) => set('sftp.port', e.target.value)} /></Field>
          </div>
          <Field label="Utilisateur"><input className="input" value={form['sftp.user'] || ''} onChange={(e) => set('sftp.user', e.target.value)} placeholder="sshuser" /></Field>
          <Field label="Mot de passe"><PasswordInput value={form['sftp.password'] || ''} onChange={(e) => set('sftp.password', e.target.value)} placeholder="Laisser vide si clé SSH" /></Field>
          <Field label="Clé SSH privée (contenu)" hint="Collez le contenu de votre fichier ~/.ssh/id_rsa">
            <textarea className="input resize-none font-mono text-xs" rows={4} value={form['sftp.key'] || ''} onChange={(e) => set('sftp.key', e.target.value)} placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." />
          </Field>
          <Field label="Chemin distant"><input className="input font-mono" value={form['sftp.path'] || ''} onChange={(e) => set('sftp.path', e.target.value)} placeholder="/home/user/backups" /></Field>
        </Section>
      )}

      {/* WebDAV */}
      {provider === 'webdav' && (
        <Section title="WebDAV">
          <Field label="URL WebDAV" hint="URL complète du endpoint WebDAV (Nextcloud, ownCloud…)">
            <input className="input" value={form['webdav.url'] || ''} onChange={(e) => set('webdav.url', e.target.value)} placeholder="https://nextcloud.exemple.com/remote.php/dav/files/user" />
          </Field>
          <Field label="Utilisateur"><input className="input" value={form['webdav.user'] || ''} onChange={(e) => set('webdav.user', e.target.value)} placeholder="user" /></Field>
          <Field label="Mot de passe"><PasswordInput value={form['webdav.password'] || ''} onChange={(e) => set('webdav.password', e.target.value)} placeholder="••••••••" /></Field>
        </Section>
      )}

      {/* Google Drive */}
      {provider === 'gdrive' && (
        <Section title="Google Drive (via rclone)">
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl mb-3">
            <AlertTriangle size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-400">Nécessite une application Google OAuth2. Créez-la sur <strong>console.cloud.google.com</strong>.</p>
          </div>
          <Field label="Client ID"><input className="input font-mono" value={form['gdrive.client_id'] || ''} onChange={(e) => set('gdrive.client_id', e.target.value)} placeholder="xxx.apps.googleusercontent.com" /></Field>
          <Field label="Client Secret"><PasswordInput value={form['gdrive.client_secret'] || ''} onChange={(e) => set('gdrive.client_secret', e.target.value)} placeholder="••••••••" /></Field>
        </Section>
      )}

      {/* rclone custom */}
      {provider === 'rclone' && (
        <Section title="Remote rclone personnalisé">
          <Field label="Nom du remote rclone" hint="Le nom du remote tel que configuré dans rclone.conf (ex: myremote)">
            <input className="input font-mono" value={form['rclone.remote'] || ''} onChange={(e) => set('rclone.remote', e.target.value)} placeholder="myremote:bucket/path" />
          </Field>
        </Section>
      )}

      {/* Planification */}
      <Section title="Planification">
        <Field label="Fréquence">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'hourly',  label: 'Toutes les heures' },
              { value: 'daily',   label: 'Quotidien (3h)' },
              { value: 'weekly',  label: 'Hebdomadaire (lundi)' },
              { value: 'manual',  label: 'Manuel uniquement' },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                (form['backup.schedule'] || 'daily') === opt.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
              }`}>
                <input type="radio" name="schedule" value={opt.value} checked={(form['backup.schedule'] || 'daily') === opt.value} onChange={() => set('backup.schedule', opt.value)} className="text-violet-600" />
                <span className="text-sm text-slate-700 dark:text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sauvegardes locales à conserver" hint="Les plus anciennes sont auto-supprimées">
            <input type="number" min="1" max="30" className="input" value={form['backup.keep_n'] || '7'} onChange={(e) => set('backup.keep_n', e.target.value)} />
          </Field>
        </div>
      </Section>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Onglet Général ────────────────────────────────────────────────────────────
function TabGeneral({ config }) {
  const keys = ['app.name', 'app.url', 'storage.media_pct', 'storage.backup_pct', 'storage.total_gb']
  const { form, set, save, saving, saved, error } = useConfigForm(config, keys)

  const mediaPct = parseInt(form['storage.media_pct'] || 70)
  const backupPct = parseInt(form['storage.backup_pct'] || 10)
  const logsPct = 5
  const zipsPct = 3
  const systemPct = Math.max(0, 100 - mediaPct - backupPct - logsPct - zipsPct)
  const total = mediaPct + backupPct
  const url = form['app.url'] || ''
  const isInsecure = url && !url.startsWith('https://')

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Identité du projet">
        <Field label="Nom du projet" hint="Affiché dans l'interface et les emails">
          <input className="input" value={form['app.name'] || ''} onChange={(e) => set('app.name', e.target.value)} placeholder="WubalStore" />
        </Field>
        <Field label="URL publique de l'instance">
          <input
            className={`input ${isInsecure ? 'border-amber-400 dark:border-amber-600' : ''}`}
            value={url}
            onChange={(e) => set('app.url', e.target.value)}
            placeholder="https://dashboard.exemple.com"
          />
          {!url && (
            <div className="mt-2 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <AlertTriangle size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Saisissez l'URL complète de l'instance (par exemple : <code className="font-mono">https://dashboard.example.com</code>).<br/>
                <strong>Important :</strong> pour que le tableau de bord soit accessible via HTTPS, vous devez impérativement inclure <code className="font-mono">https://</code> au début. Sans cela, le tableau de bord utilisera HTTP et ne sera pas sécurisé.
              </p>
            </div>
          )}
          {isInsecure && (
            <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Attention :</strong> l'URL ne commence pas par <code className="font-mono">https://</code>. Le tableau de bord ne sera <strong>pas sécurisé</strong>. Ajoutez <code className="font-mono">https://</code> pour activer HTTPS.
              </p>
            </div>
          )}
        </Field>
      </Section>

      <Section title="Allocation du stockage">
        <Field label="Espace total alloué au projet (Go)" hint="Taille totale que WubalStore peut utiliser sur le disque">
          <div className="flex items-center gap-2">
            <input type="number" min="1" className="input w-32" value={form['storage.total_gb'] || ''} onChange={(e) => set('storage.total_gb', e.target.value)} placeholder="Auto-détecté" />
            <span className="text-slate-500 dark:text-gray-500 text-sm">Go</span>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'storage.media_pct',  label: 'Médias',       min: 10, max: 85, color: 'text-violet-600' },
            { key: 'storage.backup_pct', label: 'Sauvegardes',  min: 5,  max: 40, color: 'text-blue-500' },
          ].map(({ key, label, min, max, color }) => (
            <Field key={key} label={`${label} (%)`}>
              <div className="flex items-center gap-2">
                <input type="range" min={min} max={max} className="flex-1 accent-violet-600" value={form[key] || (key === 'storage.media_pct' ? 70 : 10)}
                  onChange={(e) => set(key, e.target.value)} />
                <span className={`text-sm font-bold w-10 text-right ${color}`}>{form[key] || (key === 'storage.media_pct' ? 70 : 10)}%</span>
              </div>
            </Field>
          ))}
        </div>

        {/* Barre visuelle */}
        <div className="space-y-2 mt-2">
          <div className="flex h-6 rounded-xl overflow-hidden text-[10px] font-bold">
            <div className="bg-violet-500 flex items-center justify-center text-white transition-all" style={{ width: `${mediaPct}%` }} title={`Médias ${mediaPct}%`}>
              {mediaPct >= 8 ? `${mediaPct}%` : ''}
            </div>
            <div className="bg-blue-400 flex items-center justify-center text-white transition-all" style={{ width: `${backupPct}%` }} title={`Sauvegardes ${backupPct}%`}>
              {backupPct >= 6 ? `${backupPct}%` : ''}
            </div>
            <div className="bg-amber-400 flex items-center justify-center text-white transition-all" style={{ width: `${logsPct}%` }} title="Logs 5%">
              {logsPct >= 5 ? '5%' : ''}
            </div>
            <div className="bg-green-400 flex items-center justify-center text-white transition-all" style={{ width: `${zipsPct}%` }} title="Zips 3%">
              {zipsPct >= 4 ? '3%' : ''}
            </div>
            <div className="bg-slate-200 dark:bg-gray-700 flex-1 flex items-center justify-center text-slate-500 dark:text-gray-400" title={`Système ${systemPct}%`}>
              {systemPct >= 5 ? `${systemPct}%` : ''}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-gray-500">
            {[
              { color: 'bg-violet-500', label: 'Médias', pct: mediaPct },
              { color: 'bg-blue-400',   label: 'Sauvegardes', pct: backupPct },
              { color: 'bg-amber-400',  label: 'Logs', pct: logsPct },
              { color: 'bg-green-400',  label: 'Zips temp.', pct: zipsPct },
              { color: 'bg-slate-300 dark:bg-gray-700', label: 'Système', pct: systemPct },
            ].map(({ color, label, pct }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${color}`} />
                {label} <span className="font-medium">{pct}%</span>
              </span>
            ))}
          </div>
        </div>

        {total > 90 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">La somme médias + sauvegardes dépasse 90% — le système n'aura pas assez de marge.</p>
          </div>
        )}
      </Section>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
const TABS = [
  { key: 'email',      label: 'Email',        icon: Mail },
  { key: 'discord',    label: 'Discord',      icon: MessageSquare },
  { key: 'backblaze',  label: 'Sauvegardes',  icon: Database },
  { key: 'general',   label: 'Général',      icon: Globe },
]

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('email')

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then((r) => r.data),
  })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Configuration système</h2>
        <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Connexions externes et paramètres serveur.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-gray-900 rounded-xl p-1 border border-slate-200 dark:border-gray-800 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 shadow-sm'
                : 'text-slate-500 dark:text-gray-500 hover:text-slate-800 dark:hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'email'     && <TabEmail     config={config} />}
            {activeTab === 'discord'   && <TabDiscord   config={config} />}
            {activeTab === 'backblaze' && <TabBackblaze config={config} />}
            {activeTab === 'general'  && <TabGeneral   config={config} />}
          </>
        )}
      </div>
    </div>
  )
}
