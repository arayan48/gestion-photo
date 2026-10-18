import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, MailCheck } from 'lucide-react'
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
      title={sent ? 'Vérifiez vos emails' : 'Mot de passe oublié'}
      subtitle={sent ? 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d’être envoyé.' : 'Recevez un lien pour choisir un nouveau mot de passe.'}
      footer={<Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400"><ArrowLeft size={14} /> Retour à la connexion</Link>}
    >
      {sent ? (
        <div className="card flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-500 ring-1 ring-accent-500/20"><MailCheck size={26} /></div>
          <p className="text-sm text-muted">Pensez à vérifier vos courriers indésirables. Le lien expire rapidement.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Adresse email">
            <Input type="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="vous@exemple.com" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Envoyer le lien</Button>
        </form>
      )}
    </AuthLayout>
  )
}
