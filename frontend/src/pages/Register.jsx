import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Send, CheckCircle } from 'lucide-react'
import api from '../utils/api.js'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', pseudo: '', password: '', confirmPassword: '', firstName: '', lastName: '', reason: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register/request', form)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la demande')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-950 px-4">
        <div className="card text-center max-w-sm w-full space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle size={28} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Demande envoyée !</h2>
            <p className="text-slate-500 dark:text-gray-400 text-sm mt-2">
              Un administrateur traitera votre demande. Vous recevrez un email de confirmation à l'acceptation.
            </p>
          </div>
          <Link to="/login" className="btn-primary inline-block">Retour à la connexion</Link>
        </div>
      </div>
    )
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600 mb-4 shadow-lg shadow-violet-500/30">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">WubalStore</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">Demande de création de compte</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email + Pseudo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="vous@exemple.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Pseudo *</label>
                <input className="input" value={form.pseudo} onChange={(e) => set('pseudo', e.target.value)} required placeholder="monpseudo" />
              </div>
            </div>

            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Prénom</label>
                <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jean" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Nom</label>
                <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Dupont" />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Mot de passe * <span className="text-xs font-normal text-slate-400">(min. 8 caractères)</span></label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Confirmer le mot de passe *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                className={`input ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-400 dark:border-red-600' : ''}`}
                value={form.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
                required
                placeholder="••••••••"
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Raison */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Raison de la demande *</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Pourquoi souhaitez-vous accéder à WubalStore ?"
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send size={15} />}
              {loading ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-gray-500 mt-4">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-violet-500 hover:text-violet-400 font-medium transition-colors">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
