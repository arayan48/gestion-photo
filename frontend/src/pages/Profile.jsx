import { useState } from 'react'
import { useAuthStore } from '../stores/auth.store.js'
import api from '../utils/api.js'
import { Camera, Shield, Link2, Unlink, HardDrive, User, Bell, Eye, EyeOff, Check } from 'lucide-react'
import { toast } from '../stores/toast.store.js'

const GiB = 1024 * 1024 * 1024
const MiB = 1024 * 1024

function formatBytes(b) {
  if (b >= GiB) return `${(b / GiB).toFixed(2)} Go`
  if (b >= MiB) return `${(b / MiB).toFixed(0)} Mo`
  return `${Math.round(b / 1024)} Ko`
}

const TABS = [
  { key: 'info',   label: 'Informations',   icon: User },
  { key: 'auth',   label: 'Authentification', icon: Shield },
  { key: 'linked', label: 'Comptes liés',    icon: Link2 },
  { key: 'notifs', label: 'Notifications',   icon: Bell },
]

export default function Profile() {
  const { user, fetchMe } = useAuthStore()
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({
    pseudo: user?.pseudo || '',
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    password: '',
    confirmPassword: '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [totpQr, setTotpQr] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)

  // Quota
  const used = user?.storage_used ?? 0
  const quota = user?.storage_quota ?? GiB
  const pct = Math.min(100, Math.round((used / quota) * 100))
  const quotaColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-violet-500'

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (form.password && form.password !== form.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await api.patch('/users/me/profile', {
        pseudo: form.pseudo !== user?.pseudo ? form.pseudo : undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password || undefined,
      })
      await fetchMe()
      toast.success('Profil mis à jour !')
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
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
      toast.success('2FA TOTP activé !')
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
      <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Mon profil</h2>

      {/* Carte identité */}
      <div className="card flex items-center gap-5">
        <div className="relative shrink-0">
          {user?.avatar_path || user?.discord_avatar ? (
            <img src={user.avatar_path || user.discord_avatar} alt={user.pseudo} className="w-20 h-20 rounded-2xl object-cover" />
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
          <p className="text-lg font-semibold text-slate-900 dark:text-gray-100">{user?.pseudo}</p>
          <p className="text-sm text-slate-500 dark:text-gray-400">{user?.email}</p>
          {user?.role_name && (
            <span className="inline-flex items-center px-2 py-0.5 mt-1.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {user.role_name}
            </span>
          )}

          {/* Barre de quota */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-slate-500 dark:text-gray-500">
                <HardDrive size={11} /> Stockage
              </span>
              <span className={`font-medium ${pct >= 90 ? 'text-red-500' : 'text-slate-500 dark:text-gray-500'}`}>
                {formatBytes(used)} / {formatBytes(quota)} ({pct}%)
              </span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${quotaColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-slate-100 dark:bg-gray-900 rounded-xl p-1 border border-slate-200 dark:border-gray-800">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
              tab === key
                ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 shadow-sm'
                : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Informations personnelles ── */}
      {tab === 'info' && (
        <div className="card">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
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

            <hr className="border-slate-200 dark:border-gray-800" />
            <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Changer le mot de passe</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Laisser vide pour ne pas changer"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {form.password && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Confirmer</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={`input ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-400' : ''}`}
                  placeholder="Confirmer le nouveau mot de passe"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary text-sm">
              {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </form>
        </div>
      )}

      {/* ── Authentification ── */}
      {tab === 'auth' && (
        <div className="card space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-violet-500" />
              <h3 className="font-semibold text-slate-800 dark:text-gray-200">Double authentification (TOTP)</h3>
            </div>

            {user?.totp_enabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Check size={14} className="text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-700 dark:text-green-400">TOTP activé — votre compte est sécurisé</p>
                </div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Code TOTP pour désactiver"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                  />
                  <button onClick={handleDisableTotp} disabled={totpCode.length !== 6} className="btn-danger text-sm shrink-0">
                    Désactiver
                  </button>
                </div>
              </div>
            ) : totpQr ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-gray-400">Scannez ce QR code avec Google Authenticator ou Authy :</p>
                <img src={totpQr} alt="QR Code" className="w-40 h-40 rounded-xl border border-slate-200 dark:border-gray-700" />
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Code à 6 chiffres"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                  />
                  <button onClick={handleConfirmTotp} disabled={totpCode.length !== 6} className="btn-primary text-sm shrink-0">
                    Confirmer
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-gray-500">TOTP non activé. Activez-le pour renforcer la sécurité.</p>
                <button onClick={handleSetupTotp} className="btn-secondary text-sm">Activer le TOTP</button>
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
                <p className="text-sm text-slate-500 dark:text-gray-500">Aucun compte Discord lié. Lier votre compte permet la connexion via Discord.</p>
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
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-gray-200 mb-1">Préférences de notifications</h3>
            <p className="text-sm text-slate-500 dark:text-gray-500 mb-4">Choisissez quand et comment être notifié.</p>
          </div>

          <div className="space-y-3">
            {[
              { key: 'notif.login_email', label: 'Recevoir un email à chaque connexion', desc: 'Un email de confirmation est envoyé à chaque connexion réussie' },
              { key: 'notif.upload_bell', label: 'Notification cloche après upload', desc: 'Notifier quand un upload est terminé' },
              { key: 'notif.storage_warn', label: 'Alerte quota à 90%', desc: 'Être prévenu quand le quota est presque atteint' },
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

          <p className="text-xs text-slate-400 dark:text-gray-600">
            Les emails de notification utilisent l'adresse configurée dans votre compte.
          </p>
        </div>
      )}
    </div>
  )
}
