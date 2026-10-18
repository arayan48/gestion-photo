import { cn } from '../../lib/cn.js'

export function Skeleton({ className, style }) {
  return (
    <div style={style} className={cn('relative overflow-hidden rounded-lg bg-overlay', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent dark:via-white/[0.04]" />
    </div>
  )
}
