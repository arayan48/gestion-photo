import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { Tooltip } from './Tooltip.jsx'

const VARIANTS = {
  primary: 'bg-accent-600 text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_6px_16px_-6px_rgb(var(--accent-600)/0.6)] hover:bg-accent-500 active:bg-accent-700',
  secondary: 'bg-overlay text-fg border border-line hover:bg-line/60 hover:border-line-strong',
  outline: 'border border-line bg-surface text-fg hover:bg-overlay hover:border-line-strong',
  ghost: 'text-muted hover:bg-overlay hover:text-fg',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-[0_6px_16px_-6px_rgb(220_38_38/0.6)]',
  'danger-soft': 'bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
  link: 'text-accent-600 hover:text-accent-500 dark:text-accent-400 dark:hover:text-accent-300 underline-offset-4 hover:underline px-0',
}

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2.5 rounded-xl',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...props },
  ref
) {
  const iconSize = size === 'xs' ? 13 : size === 'sm' ? 14 : size === 'lg' ? 18 : 16
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-150',
        'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon && <Icon size={iconSize} strokeWidth={2} />}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} />}
    </button>
  )
})

// Bouton icône avec infobulle (et raccourci clavier optionnel)
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, shortcut, size = 'md', variant = 'ghost', active, className, tooltip = true, side, iconClassName, ...props },
  ref
) {
  const dims = { xs: 'h-7 w-7 rounded-lg', sm: 'h-8 w-8 rounded-lg', md: 'h-9 w-9 rounded-xl', lg: 'h-11 w-11 rounded-xl' }[size]
  const iconSize = { xs: 14, sm: 15, md: 17, lg: 20 }[size]
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 active:scale-95',
        variant === 'ghost' && 'text-muted hover:bg-overlay hover:text-fg',
        variant === 'solid' && 'bg-overlay text-fg hover:bg-line/70',
        variant === 'glass' && 'bg-black/40 text-white/90 backdrop-blur-md hover:bg-black/60 hover:text-white',
        variant === 'primary' && 'bg-accent-600 text-white hover:bg-accent-500 shadow-glow',
        active && 'bg-accent-500/15 text-accent-600 dark:text-accent-300 hover:bg-accent-500/20',
        dims,
        className
      )}
      {...props}
    >
      <Icon size={iconSize} className={iconClassName} />
    </button>
  )
  if (!tooltip || !label) return button
  return <Tooltip content={label} shortcut={shortcut} side={side}>{button}</Tooltip>
})
