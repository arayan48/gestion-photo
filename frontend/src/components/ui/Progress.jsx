import { cn } from '../../lib/cn.js'

export function quotaTone(pct) {
  return pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-fg/70'
}

// Jauge fine, angles droits
export function Progress({ value = 0, className, barClassName, tone }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-[3px] w-full overflow-hidden bg-line', className)}>
      <div className={cn('h-full transition-[width] duration-500 ease-out', tone ?? quotaTone(pct), barClassName)} style={{ width: `${pct}%` }} />
    </div>
  )
}
