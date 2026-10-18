import { cn } from '../../lib/cn.js'

// Étiquette rectangulaire en mono (statuts, rôles, compteurs)
const COLORS = {
  gray: 'border-line-strong text-muted',
  accent: 'border-accent-500/50 text-accent-600 dark:text-accent-400',
  green: 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400',
  red: 'border-red-500/50 text-red-600 dark:text-red-400',
  amber: 'border-amber-500/50 text-amber-700 dark:text-amber-400',
  blue: 'border-sky-500/50 text-sky-700 dark:text-sky-400',
}

export function Badge({ children, color = 'gray', icon: Icon, className, dot }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-[10.5px] font-medium uppercase tracking-[0.06em]', COLORS[color], className)}>
      {dot && <span className="h-1.5 w-1.5 bg-current" />}
      {Icon && <Icon size={11} />}
      {children}
    </span>
  )
}
