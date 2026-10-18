import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '../stores/auth.store.js'
import api from '../utils/api.js'
import AuthLayout, { Alert, DiscordIcon } from '../components/shared/AuthLayout.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Field, Input, PasswordInput, OtpInput } from '../components/ui/Form.jsx'

// Messages transmis par redirection (?error=… / ?setup=done …)
const ERROR_MESSAGES = {
  account_not_found: "Aucun compte Obscura n'est lié à ce compte Discord. Connectez-vous puis liez Discord depuis vos paramètres.",
  account_inactive: 'Ce compte est inactif ou suspendu.',
  discord_failed: 'La connexion avec Discord a échoué. Veuillez réessayer.',
  discord_cancelled: 'Connexion Discord annulée.',
  discord_not_configured: "La connexion Discord n'est pas configurée sur ce serveur.",
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login, initAuth } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '', totp: '' })
  const [requireTotp, setRequireTotp] = useState(false)
  const [error, setError] = useState(() => ERROR_MESSAGES[searchParams.get('error')] || '')
  const [loading, setLoading] = useState(false)
  const redirectTo = location.state?.from && location.state.from !== '/login' ? location.state.from : '/explorer'

  const info = searchParams.get('setup') === 'done'
    ? 'Compte Super Admin créé. Vous pouvez vous connecter.'
    : searchParams.get('reset') === 'done'
      ? 'Mot de passe réinitialisé. Vous pouvez vous connecter.'
      : ''

  useEffect(() => {
    api.get('/auth/setup/status').then(({ data }) => {
      if (!data.isCompleted) navigate('/setup', { replace: true })
    }).catch(() => {})
  }, [])

  // Retour de Discord : la session est dans le cookie httpOnly, on récupère l'access token
  useEffect(() => {
    if (searchParams.get('discord') !== 'success') return
    setLoading(true)
    useAuthStore.setState({ accessToken: null })
    initAuth()
      .then((ok) => {
        if (ok) navigate('/explorer', { replace: true })
        else setError(ERROR_MESSAGES.discord_failed)
      })
      .finally(() => setLoading(false))
  }, [])

  const submit = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(form)
      if (result.requireTotp) setRequireTotp(true)
      else navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Email ou mot de passe incorrect')
      if (requireTotp) setForm((f) => ({ ...f, totp: '' }))
    } finally {
      setLoading(false)
    }
  }

  // Valider automatiquement quand les 6 chiffres sont saisis
  useEffect(() => {
    if (requireTotp && form.totp.length === 6 && !loading) submit()
  }, [form.totp])

  return (
    <AuthLayout
      title={requireTotp ? 'Code de vérification' : 'Connexion'}
      subtitle={requireTotp ? "Saisissez le code à 6 chiffres affiché par votre application d'authentification." : 'Accédez à vos photos et vidéos.'}
      footer={!requireTotp && (
        <>Pas de compte ? <Link to="/register" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">Demander un accès</Link></>
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!requireTotp ? (
          <motion.form key="creds" onSubmit={submit} className="space-y-4" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            {info && !error && <Alert tone="success">{info}</Alert>}
            {error && <Alert>{error}</Alert>}

            <Field label="Adresse email" htmlFor="email">
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" autoFocus placeholder="vous@exemple.com" />
            </Field>
            <Field
              label="Mot de passe"
              htmlFor="password"
              right={<Link to="/forgot-password" className="text-xs text-subtle hover:text-fg">Oublié ?</Link>}
            >
              <PasswordInput id="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" placeholder="••••••••" />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-line" /><span className="label-mono">ou</span><div className="h-px flex-1 bg-line" />
            </div>

            <button
              type="button"
              onClick={() => { window.location.href = '/api/auth/discord' }}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-sm border border-line-strong text-sm text-fg transition-colors hover:border-fg/40 hover:bg-overlay"
            >
              <DiscordIcon size={16} className="text-[#5865F2]" /> Continuer avec Discord
            </button>
          </motion.form>
        ) : (
          <motion.form key="totp" onSubmit={submit} className="space-y-6" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
            <OtpInput value={form.totp} onChange={(v) => setForm({ ...form, totp: v })} autoFocus disabled={loading} />
            {error && <Alert>{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={loading} disabled={form.totp.length !== 6}>Vérifier</Button>
            <Button variant="ghost" className="w-full" onClick={() => { setRequireTotp(false); setError(''); setForm((f) => ({ ...f, totp: '' })) }}>
              Retour
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
