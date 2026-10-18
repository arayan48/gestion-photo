import { forwardRef, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Check, Minus, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn.js'

export function Field({ label, hint, error, children, className, htmlFor, optional, right }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || right) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px] text-muted">
              {label}
              {optional && <span className="text-xs font-normal text-subtle">(optionnel)</span>}
            </label>
          )}
          {right}
        </div>
      )}
      {children}
      {error ? <p className="text-xs text-red-500">{error}</p> : hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, invalid, icon: Icon, ...props }, ref) {
  if (!Icon) return <input ref={ref} className={cn('input', invalid && 'input-invalid', className)} {...props} />
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
      <input ref={ref} className={cn('input pl-10', invalid && 'input-invalid', className)} {...props} />
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('input min-h-[88px] resize-y', className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn('input cursor-pointer appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
    </div>
  )
})

export const PasswordInput = forwardRef(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={cn('input pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-subtle transition-colors hover:text-fg"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
})

export function Switch({ checked, onChange, disabled, label, description, className, size = 'md' }) {
  const id = useId()
  const track = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9'
  const knob = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const shift = size === 'sm' ? 12 : 16
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange?.(!checked) }}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-sm border p-px transition-colors duration-150 disabled:opacity-50',
        track,
        checked ? 'border-accent-600 bg-accent-600' : 'border-line-strong bg-transparent'
      )}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? shift : 0 }}
        transition={{ type: 'spring', stiffness: 700, damping: 35 }}
        className={cn('block rounded-[1px]', checked ? 'bg-white' : 'bg-subtle', knob)}
      />
    </button>
  )
  if (!label) return control
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed', className)}>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      {control}
    </label>
  )
}

export function Checkbox({ checked, indeterminate, onChange, className, label, disabled, round }) {
  const box = (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : !!checked}
      tabIndex={label ? -1 : 0}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange?.(!checked) }}
      onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); onChange?.(!checked) } }}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border transition-colors duration-100',
        checked || indeterminate
          ? 'border-accent-600 bg-accent-600 text-white'
          : 'border-line-strong bg-transparent hover:border-fg/50',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {indeterminate ? <Minus size={11} strokeWidth={3} /> : checked ? <Check size={11} strokeWidth={3} /> : null}
    </span>
  )
  if (!label) return box
  return (
    <label className="flex cursor-pointer items-start gap-3" onClick={() => !disabled && onChange?.(!checked)}>
      <span className="mt-0.5">{box}</span>
      <span className="text-sm text-fg">{label}</span>
    </label>
  )
}

// Contrôle segmenté animé (vue grille/liste, filtres…)
export function Segmented({ value, onChange, options, size = 'md', className, layoutId }) {
  const fallbackId = useId()
  const lid = layoutId || fallbackId
  return (
    <div className={cn('inline-flex items-center rounded-sm border border-line', className)}>
      {options.map((opt) => {
        const active = value === opt.value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.title || (typeof opt.label === 'string' ? opt.label : undefined)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 border-l border-line font-normal transition-colors first:border-l-0',
              size === 'sm' ? 'h-[30px] px-2.5 text-xs' : 'h-[34px] px-3 text-[13px]',
              active ? 'text-fg' : 'text-subtle hover:text-fg'
            )}
          >
            {active && (
              <motion.span
                layoutId={lid}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 bg-overlay"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon && <Icon size={15} />}
              {opt.label && <span className={cn(opt.hideLabelOnMobile && 'hidden sm:inline')}>{opt.label}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Saisie de code à 6 chiffres (2FA) avec collage et navigation au clavier
export function OtpInput({ value, onChange, length = 6, autoFocus, disabled }) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  const setAt = (i, d) => {
    const next = digits.slice()
    next[i] = d
    onChange(next.join('').slice(0, length))
  }

  return (
    <div className="flex justify-center gap-2" onPaste={(e) => {
      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
      if (text) {
        e.preventDefault()
        onChange(text)
        refs.current[Math.min(text.length, length - 1)]?.focus()
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          aria-label={`Chiffre ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1)
            setAt(i, v)
            if (v && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-11 rounded-sm border bg-transparent text-center font-mono text-2xl text-fg transition-colors sm:w-12',
            'focus:border-fg focus:outline-none',
            d ? 'border-line-strong' : 'border-line'
          )}
        />
      ))}
    </div>
  )
}

// Indicateur de robustesse du mot de passe
export function passwordScore(pwd = '') {
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return Math.min(4, score)
}

export function PasswordStrength({ password }) {
  if (!password) return null
  const score = passwordScore(password)
  const labels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent']
  const colors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-500']
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('h-[3px] flex-1 transition-colors duration-300', i < score ? colors[score] : 'bg-line')} />
        ))}
      </div>
      <p className="font-mono text-[11px] text-subtle">
        Robustesse : <span className="text-muted">{labels[score]}</span>
        {password.length < 8 && ' — 8 caractères minimum'}
      </p>
    </div>
  )
}
