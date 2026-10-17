import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth.store.js'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import api from '../utils/api.js'
import { LogoMark, APP_NAME } from '../components/shared/Logo.jsx'

// Messages transmis par redirection (?error=… / ?setup=done …)
const ERROR_MESSAGES = {
  account_not_found: 'Aucun compte Obscura n\'est lié à ce compte Discord. Connectez-vous puis liez Discord depuis vos paramètres.',
  account_inactive: 'Ce compte est inactif ou suspendu.',
  discord_failed: 'La connexion avec Discord a échoué. Veuillez réessayer.',
  discord_cancelled: 'Connexion Discord annulée.',
  discord_not_configured: 'La connexion Discord n\'est pas configurée sur ce serveur.',
}

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, initAuth } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '', totp: '' })
  const [requireTotp, setRequireTotp] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState(() => ERROR_MESSAGES[searchParams.get('error')] || '')
  const [loading, setLoading] = useState(false)

  const info = searchParams.get('setup') === 'done'
    ? 'Compte Super Admin créé. Vous pouvez vous connecter.'
    : searchParams.get('reset') === 'done'
      ? 'Mot de passe réinitialisé. Vous pouvez vous connecter.'
      : ''

  useEffect(() => {
    api.get('/auth/setup/status').then(({ data }) => {
      if (!data.isCompleted) navigate('/setup', { replace: true })
    }).catch(() => {})
  }, [])

  // Retour de Discord : la session est dans le cookie httpOnly, on récupère l'access token
  useEffect(() => {
    if (searchParams.get('discord') !== 'success') return
    setLoading(true)
    useAuthStore.setState({ accessToken: null })
    initAuth()
      .then((ok) => {
        if (ok) navigate('/explorer', { replace: true })
        else setError(ERROR_MESSAGES.discord_failed)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(form)
      if (result.requireTotp) {
        setRequireTotp(true)
      } else {
        navigate('/explorer')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <LogoMark size={56} className="mx-auto mb-4 drop-shadow-[0_6px_18px_rgba(124,58,237,0.4)]" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-gray-100">{APP_NAME}</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">Connexion à votre espace</p>
        </div>

        <div className="card space-y-5">
          {!requireTotp ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {info && !error && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-green-700 dark:text-green-400 text-sm">{info}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Mot de passe</label>
                  <Link to="/forgot-password" className="text-xs text-violet-500 hover:text-violet-400 transition-colors">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="input pr-10"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <LogIn size={15} />}
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔐</span>
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-gray-200">Double authentification</p>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">Code à 6 chiffres de votre application</p>
              </div>
              <input
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="000000"
                maxLength={6}
                value={form.totp}
                onChange={(e) => setForm({ ...form, totp: e.target.value.replace(/\D/g, '') })}
                autoFocus
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading || form.totp.length !== 6} className="btn-primary w-full">
                {loading ? 'Vérification...' : 'Vérifier'}
              </button>
              <button type="button" onClick={() => { setRequireTotp(false); setError('') }}
                className="w-full text-sm text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 transition-colors">
                ← Retour
              </button>
            </form>
          )}

          {!requireTotp && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-gray-900 px-3 text-slate-400 dark:text-gray-600">ou continuer avec</span>
                </div>
              </div>

              <button
                onClick={() => { window.location.href = '/api/auth/discord' }}
                className="w-full flex items-center justify-center gap-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm"
              >
                <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor">
                  <path d="M60.1 4.9C55.5 2.8 50.6 1.2 45.5.5c-.6 1.1-1.3 2.6-1.8 3.8C38.4 3.7 33.2 3.7 28 4.3c-.5-1.2-1.2-2.7-1.9-3.8C20.9 1.2 16 2.8 11.4 4.9 1.6 20.1-1 35 .3 49.7c5.7 4.2 11.2 6.7 16.7 8.4 1.3-1.8 2.5-3.8 3.5-5.8-1.9-.7-3.7-1.6-5.5-2.7.5-.3.9-.7 1.4-1 11.2 5.2 23.4 5.2 34.5 0 .4.3.9.7 1.4 1-1.7 1.1-3.6 2-5.5 2.7 1 2 2.2 4 3.5 5.8 5.5-1.7 11-4.2 16.7-8.4 1.5-17.3-2.6-32-10.9-44.8zM23.7 40.7c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8zm23.6 0c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8z" />
                </svg>
                Discord
              </button>

              <p className="text-center text-sm text-slate-500 dark:text-gray-500">
                Pas encore de compte ?{' '}
                <Link to="/register" className="text-violet-500 hover:text-violet-400 font-medium transition-colors">
                  Faire une demande
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
