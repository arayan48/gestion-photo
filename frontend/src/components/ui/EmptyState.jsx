import { cn } from '../../lib/cn.js'

// État vide typographique : pas d'icône décorative, un titre, une phrase, une action
export function EmptyState({ title, description, action, className, compact, label }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-12' : 'py-24', className)}>
      {label && <p className="label-mono mb-3">{label}</p>}
      <p className="text-base font-medium text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted text-balance">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}
