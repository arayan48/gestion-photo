import { cn } from '../../lib/cn.js'

const COLORS = {
  gray: 'bg-overlay text-muted ring-line',
  accent: 'bg-accent-500/10 text-accent-700 ring-accent-500/20 dark:text-accent-300',
  green: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400',
  red: 'bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-400',
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-400',
  blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-400',
}

export function Badge({ children, color = 'gray', icon: Icon, className, dot }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', COLORS[color], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {Icon && <Icon size={11} />}
      {children}
    </span>
  )
}
