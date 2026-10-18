import { cn } from '../../lib/cn.js'

export function Spinner({ size = 20, className }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-accent-500/25 border-t-accent-500', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Chargement"
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
      <Spinner size={28} />
    </div>
  )
}
