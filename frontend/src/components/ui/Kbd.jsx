import { cn } from '../../lib/cn.js'

export function Kbd({ children, className }) {
  return (
    <kbd className={cn(
      'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-line-strong px-1 font-mono text-[10px] text-muted',
      className
    )}>
      {children}
    </kbd>
  )
}
