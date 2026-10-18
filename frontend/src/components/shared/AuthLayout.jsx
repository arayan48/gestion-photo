import { motion } from 'framer-motion'
import { ShieldCheck, Images, Zap, Sun, Moon } from 'lucide-react'
import { LogoMark, APP_NAME } from './Logo.jsx'
import { useThemeStore } from '../../stores/theme.store.js'

// Tuiles décoratives : dégradés façon « photos floutées » qui flottent doucement
const TILES = [
  { c: 'from-fuchsia-500/70 to-violet-700/70', x: '8%', y: '14%', w: 150, h: 190, r: -8, d: 0 },
  { c: 'from-sky-400/70 to-indigo-600/70', x: '58%', y: '8%', w: 190, h: 140, r: 6, d: 1.2 },
  { c: 'from-amber-400/70 to-rose-600/70', x: '66%', y: '52%', w: 150, h: 200, r: 10, d: 0.6 },
  { c: 'from-emerald-400/70 to-cyan-600/70', x: '14%', y: '60%', w: 200, h: 150, r: -4, d: 1.8 },
  { c: 'from-accent-400/70 to-accent-800/70', x: '38%', y: '34%', w: 170, h: 170, r: 2, d: 0.9 },
]

const FEATURES = [
  { icon: Images, title: 'Photos & vidéos', text: 'Explorateur rapide, visionneuse plein écran, dossiers et favoris.' },
  { icon: ShieldCheck, title: 'Privé par conception', text: 'Liste blanche IP, 2FA, bannissement progressif et secrets chiffrés.' },
  { icon: Zap, title: 'Auto-hébergé', text: 'Vos données restent sur votre serveur, sauvegardées où vous voulez.' },
]

function ArtPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-zinc-950 lg:flex lg:flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(var(--accent-600)/0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgb(var(--accent-800)/0.4),transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

      <div className="relative flex-1">
        {TILES.map((t, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-3xl bg-gradient-to-br ${t.c} shadow-2xl ring-1 ring-white/10 backdrop-blur`}
            style={{ left: t.x, top: t.y, width: t.w, height: t.h, rotate: t.r }}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: [0, -12, 0], scale: 1 }}
            transition={{ opacity: { delay: t.d * 0.3, duration: 0.8 }, scale: { delay: t.d * 0.3, duration: 0.8 }, y: { delay: t.d, duration: 7 + i, repeat: Infinity, ease: 'easeInOut' } }}
          >
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_30%_30%,rgb(255_255_255/0.35),transparent_60%)]" />
            <div className="absolute bottom-3 left-3 h-2 w-16 rounded-full bg-white/30" />
          </motion.div>
        ))}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 120 }}
          >
            <div className="absolute inset-0 rounded-[28px] bg-accent-500/50 blur-3xl" />
            <LogoMark size={104} className="relative drop-shadow-2xl" />
          </motion.div>
        </div>
      </div>

      <div className="relative space-y-6 p-12">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white text-balance">Vos photos et vidéos,<br />dans l'ombre et en sécurité.</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">Une plateforme d'hébergement de médias auto-hébergée, pensée pour être aussi agréable qu'un service grand public.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <Icon size={18} className="text-accent-300" />
              <p className="mt-2 text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AuthLayout({ title, subtitle, children, footer, wide }) {
  const { resolvedTheme, toggle } = useThemeStore()
  return (
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-[1.05fr_1fr]">
      <ArtPanel />
      <div className="relative flex flex-col">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent-500)/0.12),transparent_70%)] lg:hidden" />
        <div className="relative flex items-center justify-between p-5 sm:p-6">
          <div className="flex items-center gap-2.5 lg:invisible">
            <LogoMark size={32} />
            <span className="text-lg font-semibold tracking-tight text-fg">{APP_NAME.toLowerCase()}</span>
          </div>
          <button onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-overlay hover:text-fg" aria-label="Changer de thème">
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div className="relative flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }}
            className={wide ? 'w-full max-w-lg' : 'w-full max-w-[400px]'}
          >
            <div className="mb-8">
              <h1 className="text-[26px] font-semibold tracking-tight text-fg">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    info: 'border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-300',
  }
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border px-3.5 py-3 text-sm ${tones[tone]}`}>
      {children}
    </motion.div>
  )
}

export const DiscordIcon = ({ size = 18, className }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 71 55" fill="currentColor" className={className} aria-hidden="true">
    <path d="M60.1 4.9C55.5 2.8 50.6 1.2 45.5.5c-.6 1.1-1.3 2.6-1.8 3.8C38.4 3.7 33.2 3.7 28 4.3c-.5-1.2-1.2-2.7-1.9-3.8C20.9 1.2 16 2.8 11.4 4.9 1.6 20.1-1 35 .3 49.7c5.7 4.2 11.2 6.7 16.7 8.4 1.3-1.8 2.5-3.8 3.5-5.8-1.9-.7-3.7-1.6-5.5-2.7.5-.3.9-.7 1.4-1 11.2 5.2 23.4 5.2 34.5 0 .4.3.9.7 1.4 1-1.7 1.1-3.6 2-5.5 2.7 1 2 2.2 4 3.5 5.8 5.5-1.7 11-4.2 16.7-8.4 1.5-17.3-2.6-32-10.9-44.8zM23.7 40.7c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8zm23.6 0c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8z" />
  </svg>
)
