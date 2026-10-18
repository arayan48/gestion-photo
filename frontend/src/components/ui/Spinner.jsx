import { cn } from '../../lib/cn.js'

export function Spinner({ size = 18, className }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border border-line-strong border-t-fg', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Chargement"
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
      <Spinner />
    </div>
  )
}
