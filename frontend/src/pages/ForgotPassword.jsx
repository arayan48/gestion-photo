import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api.js'
import AuthLayout from '../components/shared/AuthLayout.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Field, Input } from '../components/ui/Form.jsx'

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
    <AuthLayout
      title={sent ? 'Email envoyé' : 'Mot de passe oublié'}
      subtitle={sent ? 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d’être envoyé.' : 'Recevez un lien pour choisir un nouveau mot de passe.'}
      footer={<Link to="/login" className="text-subtle hover:text-fg">← Retour à la connexion</Link>}
    >
      {sent ? (
        <p className="border-l-2 border-accent-500 pl-4 text-sm leading-relaxed text-muted">Pensez à vérifier vos courriers indésirables. Le lien expire rapidement.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Adresse email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="vous@exemple.com" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Envoyer le lien</Button>
        </form>
      )}
    </AuthLayout>
  )
}
