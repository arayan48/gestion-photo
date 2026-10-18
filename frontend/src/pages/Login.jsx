import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, Mail, ShieldCheck, ArrowLeft } from 'lucide-react'
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
      title={requireTotp ? 'Double authentification' : 'Bon retour 👋'}
      subtitle={requireTotp ? "Saisissez le code à 6 chiffres de votre application d'authentification." : 'Connectez-vous pour accéder à votre espace.'}
      footer={!requireTotp && (
        <>Pas encore de compte ? <Link to="/register" className="font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400">Faire une demande</Link></>
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!requireTotp ? (
          <motion.form key="creds" onSubmit={submit} className="space-y-4" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            {info && !error && <Alert tone="success">{info}</Alert>}
            {error && <Alert>{error}</Alert>}

            <Field label="Adresse email" htmlFor="email">
              <Input id="email" type="email" icon={Mail} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" autoFocus placeholder="vous@exemple.com" />
            </Field>
            <Field
              label="Mot de passe"
              htmlFor="password"
              right={<Link to="/forgot-password" className="text-xs font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400">Mot de passe oublié ?</Link>}
            >
              <PasswordInput id="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" placeholder="••••••••" />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={loading} icon={LogIn}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line" /></div>
              <div className="relative flex justify-center"><span className="bg-bg px-3 text-xs text-subtle">ou</span></div>
            </div>

            <button
              type="button"
              onClick={() => { window.location.href = '/api/auth/discord' }}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_rgb(88_101_242/0.7)] transition-all hover:bg-[#4752C4] active:scale-[0.98]"
            >
              <DiscordIcon /> Continuer avec Discord
            </button>
          </motion.form>
        ) : (
          <motion.form key="totp" onSubmit={submit} className="space-y-6" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-500 ring-1 ring-accent-500/20">
                <ShieldCheck size={26} />
              </div>
            </div>
            <OtpInput value={form.totp} onChange={(v) => setForm({ ...form, totp: v })} autoFocus disabled={loading} />
            {error && <Alert>{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={loading} disabled={form.totp.length !== 6}>Vérifier</Button>
            <Button variant="ghost" className="w-full" icon={ArrowLeft} onClick={() => { setRequireTotp(false); setError(''); setForm((f) => ({ ...f, totp: '' })) }}>
              Retour
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
