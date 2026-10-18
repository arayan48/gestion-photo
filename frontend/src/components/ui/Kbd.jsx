import { cn } from '../../lib/cn.js'

export function Kbd({ children, className }) {
  return (
    <kbd className={cn(
      'inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-line bg-overlay px-1.5 font-sans text-[10px] font-semibold text-muted',
      className
    )}>
      {children}
    </kbd>
  )
}
