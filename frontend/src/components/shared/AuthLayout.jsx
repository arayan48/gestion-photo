import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { LogoMark } from './Logo.jsx'
import { useThemeStore } from '../../stores/theme.store.js'

// Bord de pellicule : perforations régulières + marquages en mono
function FilmEdge({ position }) {
  return (
    <div className={`absolute inset-x-0 ${position} flex h-9 items-center overflow-hidden px-6`}>
      <div className="flex shrink-0 gap-[14px]">
        {Array.from({ length: 40 }).map((_, i) => <span key={i} className="h-[9px] w-[12px] shrink-0 rounded-[1px] bg-[#1d1b18]" />)}
      </div>
    </div>
  )
}

const POINTS = [
  ['01', 'Hébergement privé', 'Vos fichiers restent sur votre serveur.'],
  ['02', 'Liens filtrés par IP', 'Seules les adresses autorisées lisent les médias.'],
  ['03', 'Accès surveillés', 'Double authentification, journaux, sauvegardes.'],
]

function ArtPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0b0a09] text-[#ece8e1] lg:flex lg:flex-col">
      <div className="grain absolute inset-0 bg-[#0b0a09]" />
      <FilmEdge position="top-0" />
      <div className="absolute left-6 top-11 font-mono text-[10px] tracking-[0.2em] text-[#f04a17]/70">OBSCURA 400 ▸ 23 ▸ 23A ▸ 24</div>


      <div className="relative flex flex-1 flex-col justify-between px-14 pb-20 pt-24">
        <div className="flex items-center gap-3">
          <LogoMark size={26} className="text-[#ece8e1]" />
          <span className="font-mono text-[15px] font-medium tracking-[0.08em]">obscura</span>
        </div>

        <div className="max-w-lg">
          <h2 className="text-[40px] font-medium leading-[1.08] tracking-[-0.02em] text-balance">
            Vos images,<br />à l'abri de la lumière.
          </h2>
          <div className="mt-12 border-t border-[#2a2724]">
            {POINTS.map(([n, title, text]) => (
              <div key={n} className="grid grid-cols-[40px_1fr] border-b border-[#2a2724] py-4">
                <span className="font-mono text-xs text-[#f04a17]">{n}</span>
                <div>
                  <p className="text-sm">{title}</p>
                  <p className="mt-0.5 text-[13px] text-[#8a847b]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <FilmEdge position="bottom-0" />
    </div>
  )
}

export default function AuthLayout({ title, subtitle, children, footer, wide }) {
  const { resolvedTheme, toggle } = useThemeStore()
  return (
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-[1.1fr_1fr]">
      <ArtPanel />
      <div className="grain relative flex flex-col bg-bg">
        <div className="relative flex items-center justify-between p-5 sm:p-6">
          <div className="flex items-center gap-2.5 text-fg lg:invisible">
            <LogoMark size={22} />
            <span className="font-mono text-[15px] font-medium tracking-[0.08em]">obscura</span>
          </div>
          <button onClick={toggle} className="flex h-9 w-9 items-center justify-center text-subtle transition-colors hover:text-fg" aria-label="Changer de thème">
            {resolvedTheme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          </button>
        </div>
        <div className="relative flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className={wide ? 'w-full max-w-lg' : 'w-full max-w-[380px]'}
          >
            <div className="mb-8">
              <h1 className="text-2xl font-medium tracking-[-0.01em] text-fg">{title}</h1>
              {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="mt-10 border-t border-line pt-5 text-sm text-muted">{footer}</div>}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-red-500 text-red-600 dark:text-red-400',
    success: 'border-emerald-600 text-emerald-700 dark:text-emerald-400',
    info: 'border-accent-500 text-fg',
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`border-l-2 bg-overlay/50 px-3.5 py-2.5 text-[13px] ${tones[tone]}`}>
      {children}
    </motion.div>
  )
}

export const DiscordIcon = ({ size = 18, className }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 71 55" fill="currentColor" className={className} aria-hidden="true">
    <path d="M60.1 4.9C55.5 2.8 50.6 1.2 45.5.5c-.6 1.1-1.3 2.6-1.8 3.8C38.4 3.7 33.2 3.7 28 4.3c-.5-1.2-1.2-2.7-1.9-3.8C20.9 1.2 16 2.8 11.4 4.9 1.6 20.1-1 35 .3 49.7c5.7 4.2 11.2 6.7 16.7 8.4 1.3-1.8 2.5-3.8 3.5-5.8-1.9-.7-3.7-1.6-5.5-2.7.5-.3.9-.7 1.4-1 11.2 5.2 23.4 5.2 34.5 0 .4.3.9.7 1.4 1-1.7 1.1-3.6 2-5.5 2.7 1 2 2.2 4 3.5 5.8 5.5-1.7 11-4.2 16.7-8.4 1.5-17.3-2.6-32-10.9-44.8zM23.7 40.7c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8zm23.6 0c-3.9 0-7.1-3.6-7.1-8s3.1-8 7.1-8 7.2 3.6 7.1 8c0 4.4-3.1 8-7.1 8z" />
  </svg>
)
