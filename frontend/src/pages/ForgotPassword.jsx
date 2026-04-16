import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await api.post('/auth/forgot-password', { email }).catch(() => {})
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-violet-400">Mot de passe oublié</h1>
        </div>
        <div className="card">
          {sent ? (
            <div className="text-center">
              <p className="text-gray-300 text-sm">Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.</p>
              <Link to="/login" className="btn-secondary inline-block mt-4 text-sm">Retour à la connexion</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
              <Link to="/login" className="block text-center text-sm text-gray-500 hover:text-gray-400">Retour</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
