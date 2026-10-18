import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api.js'
import AuthLayout, { Alert } from '../components/shared/AuthLayout.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Field, Input, PasswordInput, PasswordStrength, Textarea } from '../components/ui/Form.jsx'

export default function Register() {
  const [form, setForm] = useState({ email: '', pseudo: '', password: '', confirmPassword: '', firstName: '', lastName: '', reason: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const mismatch = form.confirmPassword && form.password !== form.confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) return setError('Les mots de passe ne correspondent pas')
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
      <AuthLayout title="Demande envoyée" subtitle="Un administrateur va l’examiner.">
        <div className="space-y-6">
          <p className="border-l-2 border-accent-500 pl-4 text-sm leading-relaxed text-muted">Vous recevrez un email dès que votre compte sera activé.</p>
          <Link to="/login" className="block"><Button variant="secondary" className="w-full">Retour à la connexion</Button></Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      wide
      title="Demander un accès"
      subtitle="Chaque compte est validé à la main par un administrateur."
      footer={<>Déjà inscrit ? <Link to="/login" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">Se connecter</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="vous@exemple.com" autoComplete="email" />
          </Field>
          <Field label="Pseudo" htmlFor="pseudo">
            <Input id="pseudo" value={form.pseudo} onChange={(e) => set('pseudo', e.target.value)} required placeholder="monpseudo" autoComplete="username" />
          </Field>
          <Field label="Prénom" optional>
            <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jean" autoComplete="given-name" />
          </Field>
          <Field label="Nom" optional>
            <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Dupont" autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Mot de passe">
          <PasswordInput value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} placeholder="8 caractères minimum" autoComplete="new-password" />
          <PasswordStrength password={form.password} />
        </Field>
        <Field label="Confirmer le mot de passe" error={mismatch && 'Les mots de passe ne correspondent pas'}>
          <PasswordInput value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} required placeholder="••••••••" autoComplete="new-password" className={mismatch ? 'input-invalid' : ''} />
        </Field>
        <Field label="Pourquoi souhaitez-vous un accès ?" hint="Quelques mots pour aider l'administrateur à valider votre demande.">
          <Textarea rows={3} value={form.reason} onChange={(e) => set('reason', e.target.value)} required placeholder="Quelques mots sur vous" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Envoyer la demande</Button>
      </form>
    </AuthLayout>
  )
}
