import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth.store.js'
import { useThemeStore } from '../stores/theme.store.js'
import api from '../utils/api.js'
import { Sun, Moon, Monitor, Save, Mail, HardDrive, AlertTriangle, Check } from 'lucide-react'

// ── Petit composant section ───────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-gray-100">{title}</h3>
        {description && <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// ── Sélecteur de thème ────────────────────────────────────────────────────────
function ThemeOption({ value, label, icon: Icon, current, onChange }) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all w-28 ${
        active
          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
          : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
      }`}
    >
      <Icon size={22} className={active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500'} />
      <span className={`text-xs font-medium ${active ? 'text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-gray-400'}`}>
        {label}
      </span>
      {active && <Check size={12} className="text-violet-600 dark:text-violet-400" />}
    </button>
  )
}

const EMAIL_PROVIDERS = [
  { value: 'brevo',    label: 'Brevo',    desc: 'Gratuit au démarrage (300 emails/jour)' },
  { value: 'smtp',     label: 'SMTP',     desc: 'Serveur mail personnel' },
  { value: 'resend',   label: 'Resend',   desc: 'Alternative moderne' },
  { value: 'mailgun',  label: 'Mailgun',  desc: 'Usage avancé' },
  { value: 'sendgrid', label: 'SendGrid', desc: 'Usage en production' },
]

export default function Settings() {
  const { user } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const queryClient = useQueryClient()
  const isSuperAdmin = user?.isSuperAdmin

  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')

  // Config système (admin seulement)
  const { data: sysConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => api.get('/admin/config').then((r) => r.data),
    enabled: !!isSuperAdmin,
  })

  const [emailProvider, setEmailProvider] = useState('')
  const [storageMediaPct, setStorageMediaPct] = useState('')
  const [storageBackupPct, setStorageBackupPct] = useState('')

  // Sync config once loaded
  useState(() => {
    if (sysConfig) {
      setEmailProvider(sysConfig['email.provider'] || 'brevo')
      setStorageMediaPct(sysConfig['storage.media_pct'] || '70')
      setStorageBackupPct(sysConfig['storage.backup_pct'] || '10')
    }
  }, [sysConfig])

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaveMsg('')
    setSaveError('')
    try {
      await api.patch('/admin/config', {
        'email.provider': emailProvider,
        'storage.media_pct': storageMediaPct,
        'storage.backup_pct': storageBackupPct,
      })
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
      setSaveMsg('Configuration enregistrée.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Erreur lors de la sauvegarde')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Paramètres</h2>

      {/* ── Apparence ── */}
      <Section title="Apparence" description="Choisissez le thème de l'interface.">
        <div className="flex gap-3">
          <ThemeOption value="light"  label="Clair"   icon={Sun}     current={theme} onChange={setTheme} />
          <ThemeOption value="dark"   label="Sombre"  icon={Moon}    current={theme} onChange={setTheme} />
          <ThemeOption value="system" label="Système" icon={Monitor} current={theme} onChange={setTheme} />
        </div>
        <p className="text-xs text-slate-400 dark:text-gray-600">
          "Système" suit automatiquement les préférences de votre OS.
        </p>
      </Section>

      {/* ── Configuration système (Super Admin) ── */}
      {isSuperAdmin && (
        <form onSubmit={handleSaveConfig}>
          <Section
            title="Configuration système"
            description="Paramètres globaux du serveur. Accessibles uniquement au Super Admin."
          >
            {/* Email provider */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                <Mail size={14} className="inline mr-1.5 text-violet-500" />
                Fournisseur d'emails
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EMAIL_PROVIDERS.map((p) => (
                  <label
                    key={p.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      emailProvider === p.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="emailProvider"
                      value={p.value}
                      checked={emailProvider === p.value}
                      onChange={() => setEmailProvider(p.value)}
                      className="mt-0.5 text-violet-600"
                    />
                    <div>
                      <p className={`text-sm font-medium ${emailProvider === p.value ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-gray-300'}`}>
                        {p.label}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-gray-500">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Stockage */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
                <HardDrive size={14} className="inline mr-1.5 text-violet-500" />
                Répartition du stockage
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-gray-500 mb-1">Médias (% de l'espace sécurisé)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="90"
                      className="input"
                      value={storageMediaPct}
                      onChange={(e) => setStorageMediaPct(e.target.value)}
                    />
                    <span className="text-slate-500 dark:text-gray-500 text-sm shrink-0">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-gray-500 mb-1">Sauvegardes (% de l'espace sécurisé)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max="40"
                      className="input"
                      value={storageBackupPct}
                      onChange={(e) => setStorageBackupPct(e.target.value)}
                    />
                    <span className="text-slate-500 dark:text-gray-500 text-sm shrink-0">%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  La somme médias + sauvegardes doit rester sous 90% pour laisser de la marge au système.
                </p>
              </div>
            </div>

            {saveMsg && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <Check size={14} /> {saveMsg}
              </div>
            )}
            {saveError && <p className="text-red-500 text-sm">{saveError}</p>}

            <div className="flex justify-end">
              <button type="submit" className="btn-primary flex items-center gap-2 text-sm">
                <Save size={14} /> Enregistrer
              </button>
            </div>
          </Section>
        </form>
      )}

      {/* ── Informations compte ── */}
      <Section title="Votre compte" description="Informations de base associées à votre compte.">
        <div className="flex items-center gap-4">
          {user?.avatar_path || user?.discord_avatar ? (
            <img src={user.avatar_path || user.discord_avatar} alt={user.pseudo} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center text-lg font-bold text-white shrink-0">
              {user?.pseudo?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-slate-900 dark:text-gray-100">{user?.pseudo}</p>
            <p className="text-sm text-slate-500 dark:text-gray-500">{user?.email}</p>
            {user?.role_name && (
              <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {user.role_name}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-gray-600">
          Pour modifier votre profil, photo ou mot de passe, rendez-vous dans{' '}
          <a href="/profile" className="text-violet-500 hover:underline">Mon profil</a>.
        </p>
      </Section>
    </div>
  )
}
