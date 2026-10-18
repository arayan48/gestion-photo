import { cn } from '../../lib/cn.js'

export function quotaTone(pct) {
  return pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-accent-500'
}

export function Progress({ value = 0, className, barClassName, tone }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-overlay', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tone ?? quotaTone(pct), barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
