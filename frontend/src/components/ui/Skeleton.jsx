import { cn } from '../../lib/cn.js'

export function Skeleton({ className, style }) {
  return <div style={style} className={cn('animate-pulse rounded-sm bg-overlay', className)} />
}
