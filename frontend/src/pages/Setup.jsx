import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Globe, Mail, AtSign, Crown } from 'lucide-react'
import api from '../utils/api.js'
import { APP_NAME } from '../components/shared/Logo.jsx'
import AuthLayout, { Alert } from '../components/shared/AuthLayout.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Field, Input, PasswordInput, PasswordStrength } from '../components/ui/Form.jsx'

export default function Setup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    appName: APP_NAME,
    appUrl: window.location.origin, // URL actuelle : correcte dans la grande majorité des cas
    email: '', pseudo: '', password: '', confirmPassword: '', firstName: '', lastName: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    api.get('/auth/setup/status').then(({ data }) => { if (data.isCompleted) navigate('/login') }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) return setError('Les mots de passe ne correspondent pas')
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
    <AuthLayout wide title="Bienvenue sur Obscura" subtitle="Configuration initiale : créez l'instance et le compte Super Admin.">
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-subtle"><Globe size={13} /> Instance</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom">
              <Input value={form.appName} onChange={(e) => set('appName', e.target.value)} />
            </Field>
            <Field label="URL publique">
              <Input type="url" className="font-mono text-[13px]" value={form.appUrl} onChange={(e) => set('appUrl', e.target.value)} required placeholder="https://photos.mondomaine.fr" />
            </Field>
          </div>
          <p className="text-xs text-subtle">Utilisée pour les liens des emails et la connexion Discord. Email, Discord et sauvegardes se configurent ensuite dans Configuration.</p>
        </section>

        <section className="space-y-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-subtle"><Crown size={13} /> Compte Super Admin</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email"><Input type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} required /></Field>
            <Field label="Pseudo"><Input icon={AtSign} value={form.pseudo} onChange={(e) => set('pseudo', e.target.value)} required /></Field>
            <Field label="Prénom" optional><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
            <Field label="Nom" optional><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
          </div>
          <Field label="Mot de passe">
            <PasswordInput value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} autoComplete="new-password" />
            <PasswordStrength password={form.password} />
          </Field>
          <Field label="Confirmer le mot de passe">
            <PasswordInput value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
        </section>

        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={loading} icon={Rocket}>Créer le compte Super Admin</Button>
      </form>
    </AuthLayout>
  )
}
