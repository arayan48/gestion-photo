import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, CheckCircle2, Mail, AtSign } from 'lucide-react'
import { motion } from 'framer-motion'
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
      <AuthLayout title="Demande envoyée !" subtitle="Un administrateur va étudier votre demande.">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card space-y-5 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
            <CheckCircle2 size={30} />
          </div>
          <p className="text-sm text-muted">Vous recevrez un email de confirmation dès que votre compte sera activé.</p>
          <Link to="/login"><Button className="w-full">Retour à la connexion</Button></Link>
        </motion.div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      wide
      title="Demander un accès"
      subtitle="Les comptes sont validés manuellement par un administrateur."
      footer={<>Déjà un compte ? <Link to="/login" className="font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400">Se connecter</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="vous@exemple.com" autoComplete="email" />
          </Field>
          <Field label="Pseudo" htmlFor="pseudo">
            <Input id="pseudo" icon={AtSign} value={form.pseudo} onChange={(e) => set('pseudo', e.target.value)} required placeholder="monpseudo" autoComplete="username" />
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
          <Textarea rows={3} value={form.reason} onChange={(e) => set('reason', e.target.value)} required placeholder="Je fais partie de l'équipe…" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={loading} icon={Send}>Envoyer la demande</Button>
      </form>
    </AuthLayout>
  )
}
