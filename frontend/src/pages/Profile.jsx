import { useState } from 'react'
import { useAuthStore } from '../stores/auth.store.js'
import api from '../utils/api.js'
import { Camera, Shield, Link2, Unlink } from 'lucide-react'

export default function Profile() {
  const { user, fetchMe } = useAuthStore()
  const [form, setForm] = useState({ pseudo: user?.pseudo || '', firstName: user?.first_name || '', lastName: user?.last_name || '', password: '' })
  const [totpQr, setTotpQr] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    setError('')
    try {
      await api.patch('/users/me/profile', {
        pseudo: form.pseudo !== user?.pseudo ? form.pseudo : undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password || undefined,
      })
      await fetchMe()
      setMsg('Profil mis à jour !')
      setForm((f) => ({ ...f, password: '' }))
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
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
      setMsg('2FA TOTP activé !')
    } catch {
      setError('Code invalide')
    }
  }

  const handleDisableTotp = async () => {
    if (!totpCode) return
    try {
      await api.post('/auth/totp/disable', { code: totpCode })
      await fetchMe()
      setMsg('2FA désactivé.')
    } catch {
      setError('Code invalide')
    }
  }

  const handleUnlinkDiscord = async () => {
    await api.delete('/users/me/discord')
    await fetchMe()
    setMsg('Compte Discord délié.')
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-xl font-semibold text-gray-100">Mon profil</h2>

      {/* Avatar */}
      <div className="card flex items-center gap-4">
        <div className="relative">
          {user?.avatar_path || user?.discord_avatar ? (
            <img src={user.avatar_path || user.discord_avatar} alt={user.pseudo} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold text-white">
              {user?.pseudo?.[0]?.toUpperCase()}
            </div>
          )}
          <label className="absolute bottom-0 right-0 p-1 bg-gray-800 rounded-full cursor-pointer hover:bg-gray-700 transition-colors">
            <Camera size={13} className="text-gray-300" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files[0]
                if (!file) return
                const fd = new FormData()
                fd.append('file', file)
                await api.post('/users/me/avatar', fd)
                await fetchMe()
              }}
            />
          </label>
        </div>
        <div>
          <p className="font-semibold text-gray-100">{user?.pseudo}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
          <p className="text-xs text-gray-500">{user?.role_name}</p>
        </div>
      </div>

      {/* Formulaire profil */}
      <div className="card">
        <h3 className="font-medium text-gray-200 mb-4">Modifier le profil</h3>
        <form onSubmit={handleUpdateProfile} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Pseudo</label>
            <input className="input" value={form.pseudo} onChange={(e) => setForm({ ...form, pseudo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Prénom</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nouveau mot de passe</label>
            <input type="password" className="input" placeholder="Laisser vide pour ne pas changer" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
          </div>
          {msg && <p className="text-green-400 text-sm">{msg}</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
        </form>
      </div>

      {/* 2FA */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-violet-400" />
          <h3 className="font-medium text-gray-200">Double authentification (TOTP)</h3>
        </div>

        {user?.totp_enabled ? (
          <div className="space-y-3">
            <p className="text-sm text-green-400">✅ TOTP activé</p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Code TOTP pour désactiver" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} maxLength={6} />
              <button onClick={handleDisableTotp} className="btn-danger text-sm">Désactiver</button>
            </div>
          </div>
        ) : totpQr ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Scannez ce QR code avec Google Authenticator ou Authy :</p>
            <img src={totpQr} alt="QR Code TOTP" className="w-40 h-40 rounded-lg" />
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Code à 6 chiffres" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} maxLength={6} />
              <button onClick={handleConfirmTotp} className="btn-primary text-sm">Confirmer</button>
            </div>
          </div>
        ) : (
          <button onClick={handleSetupTotp} className="btn-secondary text-sm">Activer le TOTP</button>
        )}
      </div>

      {/* Discord */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <svg width="16" height="12" viewBox="0 0 71 55" fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
            <path d="M60.1 4.9C55.5 2.8 50.6 1.2 45.5.5c-.6 1.1-1.3 2.6-1.8 3.8C38.4 3.7 33.2 3.7 28 4.3c-.5-1.2-1.2-2.7-1.9-3.8C20.9 1.2 16 2.8 11.4 4.9 1.6 20.1-1 35 .3 49.7c5.7 4.2 11.2 6.7 16.7 8.4 1.3-1.8 2.5-3.8 3.5-5.8-1.9-.7-3.7-1.6-5.5-2.7.5-.3.9-.7 1.4-1 11.2 5.2 23.4 5.2 34.5 0 .4.3.9.7 1.4 1-1.7 1.1-3.6 2-5.5 2.7 1 2 2.2 4 3.5 5.8 5.5-1.7 11-4.2 16.7-8.4 1.5-17.3-2.6-32-10.9-44.8zM23.7 40.7c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8zm23.6 0c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8z" />
          </svg>
          <h3 className="font-medium text-gray-200">Compte Discord</h3>
        </div>

        {user?.discord_id ? (
          <div className="flex items-center gap-3">
            {user.discord_avatar && <img src={user.discord_avatar} alt="Discord" className="w-8 h-8 rounded-full" />}
            <div className="flex-1">
              <p className="text-sm text-gray-300">{user.discord_pseudo}</p>
              <p className="text-xs text-gray-500">Compte lié</p>
            </div>
            <button onClick={handleUnlinkDiscord} className="btn-secondary text-xs flex items-center gap-1.5">
              <Unlink size={12} /> Délier
            </button>
          </div>
        ) : (
          <a href="/api/auth/discord" className="btn-secondary text-sm inline-flex items-center gap-2">
            <Link2 size={14} /> Lier un compte Discord
          </a>
        )}
      </div>
    </div>
  )
}
