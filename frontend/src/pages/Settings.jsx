import { useAuthStore } from '../stores/auth.store.js'
import { useThemeStore } from '../stores/theme.store.js'
import { Sun, Moon, Monitor, Check } from 'lucide-react'

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

export default function Settings() {
  const { user } = useAuthStore()
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Paramètres</h2>

      {/* Apparence */}
      <div className="card space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-gray-100">Apparence</h3>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">Choisissez le thème de l'interface.</p>
        </div>
        <div className="flex gap-3">
          <ThemeOption value="light"  label="Clair"   icon={Sun}     current={theme} onChange={setTheme} />
          <ThemeOption value="dark"   label="Sombre"  icon={Moon}    current={theme} onChange={setTheme} />
          <ThemeOption value="system" label="Système" icon={Monitor} current={theme} onChange={setTheme} />
        </div>
        <p className="text-xs text-slate-400 dark:text-gray-600">
          "Système" suit automatiquement les préférences de votre OS.
        </p>
      </div>

      {/* Compte */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-gray-100">Votre compte</h3>
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
          Pour modifier votre profil, photo ou mot de passe →{' '}
          <a href="/profile" className="text-violet-500 hover:underline">Mon profil</a>.
        </p>
      </div>
    </div>
  )
}
