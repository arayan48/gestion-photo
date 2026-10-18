import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { Tooltip } from './Tooltip.jsx'

const VARIANTS = {
  primary: 'bg-accent-600 text-white hover:bg-accent-500 active:bg-accent-700',
  secondary: 'border border-line-strong text-fg hover:bg-overlay hover:border-fg/30',
  outline: 'border border-line text-fg hover:bg-overlay hover:border-line-strong',
  ghost: 'text-muted hover:bg-overlay hover:text-fg',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
  'danger-soft': 'border border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400',
  success: 'bg-fg text-bg hover:bg-fg/85',
  link: 'text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg px-0',
}

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-[13px] gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...props },
  ref
) {
  const iconSize = size === 'xs' ? 13 : size === 'sm' ? 14 : size === 'lg' ? 16 : 15
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-sm font-medium transition-colors duration-100',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon && <Icon size={iconSize} strokeWidth={1.75} />}
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
  const dims = { xs: 'h-7 w-7', sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-11 w-11' }[size]
  const iconSize = { xs: 14, sm: 15, md: 16, lg: 19 }[size]
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm transition-colors duration-100 disabled:pointer-events-none disabled:opacity-30',
        variant === 'ghost' && 'text-muted hover:bg-overlay hover:text-fg',
        variant === 'solid' && 'border border-line text-fg hover:bg-overlay',
        variant === 'glass' && 'text-white/75 hover:bg-white/10 hover:text-white',
        variant === 'primary' && 'bg-accent-600 text-white hover:bg-accent-500',
        active && variant === 'glass' && 'bg-white/15 text-white',
        active && variant !== 'glass' && 'bg-overlay text-fg',
        dims,
        className
      )}
      {...props}
    >
      <Icon size={iconSize} strokeWidth={1.75} className={iconClassName} />
    </button>
  )
  if (!tooltip || !label) return button
  return <Tooltip content={label} shortcut={shortcut} side={side}>{button}</Tooltip>
})
