import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api.js'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', pseudo: '', password: '', firstName: '', lastName: '', reason: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="card text-center max-w-sm w-full">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Demande envoyée</h2>
          <p className="text-gray-400 text-sm">Un administrateur traitera votre demande. Vous recevrez un email à l'acceptation.</p>
          <Link to="/login" className="btn-primary inline-block mt-4">Retour à la connexion</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-violet-400">WubalStore</h1>
          <p className="text-gray-400 mt-1 text-sm">Demande de création de compte</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Pseudo *</label>
              <input className="input" value={form.pseudo} onChange={(e) => setForm({ ...form, pseudo: e.target.value })} required />
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
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Raison de la demande *</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Pourquoi souhaitez-vous accéder à WubalStore ?"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
