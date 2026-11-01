import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'

// Onglets soulignés animés (défilement horizontal sur mobile)
export function Tabs({ value, onChange, tabs, className }) {
  const id = useId()
  return (
    <div className={cn('scrollbar-none -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-2 text-[13px] transition-colors',
              active ? 'text-fg' : 'text-muted hover:text-fg'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('font-mono text-[11px]', active ? 'text-accent-600 dark:text-accent-400' : 'text-subtle')}>
                {tab.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-x-1 -bottom-px h-px bg-fg"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// Navigation verticale (paramètres sur grand écran), à la manière des barres latérales macOS
export function SideTabs({ value, onChange, tabs }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {tabs.map((tab) => {
        const active = tab.value === value
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150',
              active ? 'bg-overlay font-medium text-fg' : 'text-muted hover:bg-overlay/50 hover:text-fg'
            )}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} className={cn('shrink-0', active ? 'text-accent-600 dark:text-accent-400' : 'text-subtle')} />}
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
