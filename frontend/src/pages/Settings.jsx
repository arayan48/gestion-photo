import { useState } from 'react'
import { useAuthStore } from '../stores/auth.store.js'
import { useThemeStore } from '../stores/theme.store.js'
import api from '../utils/api.js'
import { Camera, Shield, Link2, Unlink, HardDrive, Sun, Moon, Monitor, Check, Eye, EyeOff, User, Bell, Palette, Lock } from 'lucide-react'
import { toast } from '../stores/toast.store.js'

const GiB = 1024 * 1024 * 1024
const MiB = 1024 * 1024

function formatBytes(b) {
  if (b >= GiB) return `${(b / GiB).toFixed(2)} Go`
  if (b >= MiB) return `${(b / MiB).toFixed(0)} Mo`
  return `${Math.round(b / 1024)} Ko`
}

// ── Onglet thème ──────────────────────────────────────────────────────────────
function ThemeOption({ value, label, icon: Icon, current, onChange }) {
  const active = current === value
  return (
    <button type="button" onClick={() => onChange(value)}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all w-28 ${
        active ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
      }`}>
      <Icon size={22} className={active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500'} />
      <span className={`text-xs font-medium ${active ? 'text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-gray-400'}`}>{label}</span>
      {active && <Check size={12} className="text-violet-600 dark:text-violet-400" />}
    </button>
  )
}

const TABS = [
    { key: 'profile',    label: 'Mon profil',      icon: User },
  { key: 'appearance', label: 'Apparence',      icon: Palette },
  { key: 'security',   label: 'Sécurité',        icon: Lock },
  { key: 'linked',     label: 'Comptes liés',    icon: Link2 },
  { key: 'notifs',     label: 'Notifications',   icon: Bell },
]

export default function Settings() {
  const { user, fetchMe } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const [tab, setTab] = useState('appearance')
  const [form, setForm] = useState({
    pseudo: user?.pseudo || '',
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [totpQr, setTotpQr] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)

  const used = user?.storage_used ?? 0
  const quota = user?.storage_quota ?? GiB
  const pct = Math.min(100, Math.round((used / quota) * 100))
  const quotaColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-violet-500'

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.patch('/users/me/profile', {
        pseudo: form.pseudo !== user?.pseudo ? form.pseudo : undefined,
        firstName: form.firstName,
        lastName: form.lastName,
      })
      await fetchMe()
      toast.success('Profil mis à jour !')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur')
    } finally { setLoading(false) }
  }

  const handleSavePassword = async (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await api.patch('/users/me/profile', { password: form.newPassword })
      toast.success('Mot de passe mis à jour !')
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur')
    } finally { setLoading(false) }
  }

  const handleSetupTotp = async () => {
    const { data } = await api.post('/auth/totp/setup')
    setTotpQr(data.qrCode)
  }

  const handleConfirmTotp = async () => {
    try {
      await api.post('/auth/totp/confirm', { code: totpCode })
      await fetchMe()
      setTotpQr(null)
      setTotpCode('')
      toast.success('2FA activé !')
    } catch { toast.error('Code invalide') }
  }

  const handleDisableTotp = async () => {
    if (!totpCode) return
    try {
      await api.post('/auth/totp/disable', { code: totpCode })
      await fetchMe()
      toast.success('2FA désactivé')
      setTotpCode('')
    } catch { toast.error('Code invalide') }
  }

  const handleUnlinkDiscord = async () => {
    await api.delete('/users/me/discord')
    await fetchMe()
    toast.success('Compte Discord délié')
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post('/users/me/avatar', fd)
      await fetchMe()
      toast.success('Photo de profil mise à jour')
    } catch { toast.error('Erreur lors du téléversement') }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Paramètres</h2>

      {/* Onglets */}
      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-gray-900 rounded-xl p-1 border border-slate-200 dark:border-gray-800">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center sm:flex-none ${
              tab === key ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 shadow-sm' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
            }`}>
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Apparence ── */}
      {tab === 'appearance' && (
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Thème de l'interface</h3>
            <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">"Système" s'adapte automatiquement à votre OS.</p>
          </div>
          <div className="flex gap-3">
            <ThemeOption value="light"  label="Clair"   icon={Sun}     current={theme} onChange={setTheme} />
            <ThemeOption value="dark"   label="Sombre"  icon={Moon}    current={theme} onChange={setTheme} />
            <ThemeOption value="system" label="Système" icon={Monitor} current={theme} onChange={setTheme} />
          </div>
        </div>
      )}

      {/* ── Mon profil ── */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {/* Avatar + identité */}
          <div className="card flex items-center gap-5">
            <div className="relative shrink-0">
              {user?.avatar_path || user?.discord_avatar ? (
                <img src={user.avatar_path || user.discord_avatar} alt={user.pseudo}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-violet-500/20" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-violet-600 flex items-center justify-center text-3xl font-bold text-white">
                  {user?.pseudo?.[0]?.toUpperCase()}
                </div>
              )}
              <label className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                <Camera size={13} className="text-slate-600 dark:text-gray-300" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-gray-100 text-lg">{user?.pseudo}</p>
              <p className="text-sm text-slate-500 dark:text-gray-400">{user?.email}</p>
              {user?.role_name && (
                <span className="inline-flex items-center px-2 py-0.5 mt-1.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  {user.role_name}
                </span>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-slate-500 dark:text-gray-500"><HardDrive size={11} /> Stockage</span>
                  <span className={`font-medium ${pct >= 90 ? 'text-red-500' : 'text-slate-500 dark:text-gray-500'}`}>{formatBytes(used)} / {formatBytes(quota)}</span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${quotaColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-800 dark:text-gray-200 mb-4">Informations personnelles</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Pseudo</label>
                <input className="input" value={form.pseudo} onChange={(e) => setForm({ ...form, pseudo: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Prénom</label>
                  <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Optionnel" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Nom</label>
                  <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Optionnel" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Email</label>
                <input className="input opacity-60 cursor-not-allowed" value={user?.email || ''} readOnly />
                <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">L'email ne peut pas être modifié.</p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary text-sm">{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Sécurité ── */}
      {tab === 'security' && (
        <div className="space-y-4">
          {/* Mot de passe */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-gray-200">Changer le mot de passe</h3>
            <form onSubmit={handleSavePassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Nouveau mot de passe</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} className="input pr-10" value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })} minLength={8} placeholder="Min. 8 caractères" />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {form.newPassword && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Confirmer</label>
                  <input type={showPwd ? 'text' : 'password'}
                    className={`input ${form.confirmPassword && form.newPassword !== form.confirmPassword ? 'border-red-400' : ''}`}
                    value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirmer le mot de passe" />
                  {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Ne correspond pas</p>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading || !form.newPassword} className="btn-primary text-sm">Changer le mot de passe</button>
            </form>
          </div>

          {/* TOTP */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-violet-500" />
              <h3 className="font-semibold text-slate-800 dark:text-gray-200">Double authentification (TOTP)</h3>
            </div>
            {user?.totp_enabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Check size={14} className="text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">2FA activé — compte sécurisé</p>
                </div>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="Code TOTP pour désactiver" value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} maxLength={6} />
                  <button onClick={handleDisableTotp} disabled={totpCode.length !== 6} className="btn-danger text-sm shrink-0">Désactiver</button>
                </div>
              </div>
            ) : totpQr ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-gray-400">Scannez avec Google Authenticator ou Authy :</p>
                <img src={totpQr} alt="QR TOTP" className="w-40 h-40 rounded-xl border border-slate-200 dark:border-gray-700" />
                <div className="flex gap-2">
                  <input className="input flex-1 text-center text-xl tracking-widest font-mono" placeholder="000000" value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} maxLength={6} autoFocus />
                  <button onClick={handleConfirmTotp} disabled={totpCode.length !== 6} className="btn-primary text-sm shrink-0">Confirmer</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-gray-500">Non activé. Activez-le pour renforcer la sécurité de votre compte.</p>
                <button onClick={handleSetupTotp} className="btn-secondary text-sm">Activer la 2FA</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Comptes liés ── */}
      {tab === 'linked' && (
        <div className="card space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="12" viewBox="0 0 71 55" fill="#5865F2">
                <path d="M60.1 4.9C55.5 2.8 50.6 1.2 45.5.5c-.6 1.1-1.3 2.6-1.8 3.8C38.4 3.7 33.2 3.7 28 4.3c-.5-1.2-1.2-2.7-1.9-3.8C20.9 1.2 16 2.8 11.4 4.9 1.6 20.1-1 35 .3 49.7c5.7 4.2 11.2 6.7 16.7 8.4 1.3-1.8 2.5-3.8 3.5-5.8-1.9-.7-3.7-1.6-5.5-2.7.5-.3.9-.7 1.4-1 11.2 5.2 23.4 5.2 34.5 0 .4.3.9.7 1.4 1-1.7 1.1-3.6 2-5.5 2.7 1 2 2.2 4 3.5 5.8 5.5-1.7 11-4.2 16.7-8.4 1.5-17.3-2.6-32-10.9-44.8zM23.7 40.7c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8zm23.6 0c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8z" />
              </svg>
              <h3 className="font-semibold text-slate-800 dark:text-gray-200">Discord</h3>
            </div>
            {user?.discord_id ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
                {user.discord_avatar && <img src={user.discord_avatar} alt="Discord" className="w-10 h-10 rounded-full" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-gray-200">{user.discord_pseudo}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-500">Compte lié</p>
                </div>
                <button onClick={handleUnlinkDiscord} className="btn-secondary text-xs flex items-center gap-1.5">
                  <Unlink size={12} /> Délier
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-gray-500">Aucun compte Discord lié. Permet la connexion via Discord OAuth2.</p>
                <a href="/api/auth/discord" className="btn-secondary text-sm inline-flex items-center gap-2">
                  <Link2 size={14} /> Lier Discord
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {tab === 'notifs' && (
        <div className="card space-y-5">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-gray-200">Préférences de notifications</h3>
            <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">Ces préférences s'appliquent uniquement à votre compte.</p>
          </div>
          <div className="space-y-3">
            {[
              { key: 'notif.login_email',    label: 'Email à chaque connexion', desc: 'Un email est envoyé à chaque connexion réussie' },
              { key: 'notif.upload_bell',    label: 'Notification upload terminé', desc: 'Notifier dans la cloche quand un upload est fini' },
              { key: 'notif.storage_warn',   label: 'Alerte quota à 90%', desc: 'Prévenir quand le stockage est presque plein' },
              { key: 'notif.file_deleted',   label: 'Notifier si fichier supprimé par un admin', desc: 'Alerte si un administrateur supprime votre fichier' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                <input type="checkbox" defaultChecked className="mt-0.5 w-4 h-4 rounded text-violet-600" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-gray-300">{label}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-600">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
