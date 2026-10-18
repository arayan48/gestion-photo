import { motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'

export function EmptyState({ icon: Icon, title, description, action, className, compact }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-10' : 'py-20', className)}
    >
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-3xl bg-accent-500/20 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-soft">
            <Icon size={26} className="text-accent-500" strokeWidth={1.75} />
          </div>
        </div>
      )}
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted text-balance">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </motion.div>
  )
}
