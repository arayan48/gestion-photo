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
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-2 text-[13px] font-medium transition-colors',
              active ? 'text-fg' : 'text-muted hover:text-fg'
            )}
          >
            {Icon && <Icon size={15} />}
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('rounded-full px-1.5 py-px text-[10px] font-bold', active ? 'bg-accent-600 text-white' : 'bg-overlay text-muted')}>
                {tab.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent-500"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// Navigation verticale (paramètres sur grand écran)
export function SideTabs({ value, onChange, tabs }) {
  const id = useId()
  return (
    <nav className="flex flex-col gap-0.5">
      {tabs.map((tab) => {
        const active = tab.value === value
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
              active ? 'text-fg' : 'text-muted hover:bg-overlay/60 hover:text-fg'
            )}
          >
            {active && (
              <motion.span
                layoutId={`stab-${id}`}
                className="absolute inset-0 rounded-xl bg-overlay ring-1 ring-line"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            {Icon && <Icon size={17} className={cn('relative', active && 'text-accent-500')} />}
            <span className="relative">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
