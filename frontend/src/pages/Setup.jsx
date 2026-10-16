import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api.js'

export default function Setup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    appName: 'WubalStore',
    appUrl: window.location.origin, // URL actuelle : correcte dans la grande majorité des cas
    email: '', pseudo: '', password: '', confirmPassword: '', firstName: '', lastName: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/auth/setup/status').then(({ data }) => {
      if (data.isCompleted) navigate('/login')
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      const { confirmPassword, ...payload } = form
      await api.post('/auth/setup', payload)
      navigate('/login?setup=done')
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du setup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-violet-400">WubalStore</h1>
          <p className="text-gray-400 mt-2">Configuration initiale — Créer le compte Super Admin</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Instance</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom</label>
                <input className="input" value={form.appName} onChange={(e) => setForm({ ...form, appName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL publique *</label>
                <input type="url" className="input font-mono text-sm" value={form.appUrl}
                  onChange={(e) => setForm({ ...form, appUrl: e.target.value })} required placeholder="https://photos.mondomaine.fr" />
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              Utilisée pour les liens des emails et la connexion Discord. Email, Discord et sauvegardes se configurent ensuite dans Configuration.
            </p>

            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 pt-2">Compte Super Admin</p>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email *</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Pseudo *</label>
              <input
                className="input"
                value={form.pseudo}
                onChange={(e) => setForm({ ...form, pseudo: e.target.value })}
                required
              />
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
              <label className="block text-sm text-gray-400 mb-1">Mot de passe *</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Confirmer le mot de passe *</label>
              <input
                type="password"
                className="input"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                minLength={8}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Création...' : 'Créer le compte Super Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
