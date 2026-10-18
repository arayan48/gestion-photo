import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../utils/api.js'
import AuthLayout, { Alert } from '../components/shared/AuthLayout.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Field, PasswordInput, PasswordStrength } from '../components/ui/Form.jsx'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const token = params.get('token')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas')
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { token, password })
      navigate('/login?reset=done')
    } catch (err) {
      setError(err.response?.data?.error || 'Lien invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe robuste que vous n'utilisez nulle part ailleurs."
      footer={<Link to="/login" className="text-subtle hover:text-fg">← Retour à la connexion</Link>}
    >
      {!token ? (
        <Alert>Lien de réinitialisation incomplet. Utilisez le lien reçu par email.</Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nouveau mot de passe">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus autoComplete="new-password" />
            <PasswordStrength password={password} />
          </Field>
          <Field label="Confirmer" error={confirm && password !== confirm ? 'Ne correspond pas' : null}>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Enregistrer</Button>
        </form>
      )}
    </AuthLayout>
  )
}
