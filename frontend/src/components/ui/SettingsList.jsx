import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { Button } from './Button.jsx'

// Listes de réglages groupées (modèle Réglages iOS / macOS, Paramètres Android) :
// un titre au-dessus, des lignes séparées par un filet, une note en dessous.

export function Group({ title, description, action, footer, children, className }) {
  return (
    <section className={cn('space-y-2', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-4 px-1">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-medium text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{children}</div>
      {footer && <div className="px-1 text-xs leading-relaxed text-subtle">{footer}</div>}
    </section>
  )
}

// Ligne : libellé (et description) à gauche, valeur ou contrôle à droite.
// `stack` place le contrôle sous le libellé (champ long, curseur).
export function Row({ label, description, htmlFor, children, stack, className }) {
  const Label = htmlFor ? 'label' : 'div'
  return (
    <div className={cn(
      'flex min-h-[52px] gap-x-6 gap-y-3 px-4 py-3',
      stack ? 'flex-col' : 'flex-wrap items-center justify-between',
      className
    )}>
      <Label htmlFor={htmlFor} className={cn('min-w-0', !stack && 'flex-1 basis-44')}>
        <span className="block text-sm text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>}
      </Label>
      {children != null && (
        <div className={cn('min-w-0', stack ? 'w-full' : 'flex max-w-full items-center justify-end text-right')}>{children}</div>
      )}
    </div>
  )
}

// Valeur en lecture seule alignée à droite
export function Value({ children, tone }) {
  return (
    <span className={cn('break-words text-sm', tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-muted')}>
      {children}
    </span>
  )
}

// Choix unique présenté en lignes, coche à droite (sélecteur natif des réglages)
export function ChoiceRows({ name, value, onChange, options }) {
  return options.map((o) => {
    const selected = o.value === value
    return (
      <label key={o.value} className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-overlay/40 has-[:focus-visible]:bg-overlay/60">
        <input type="radio" name={name} value={o.value} checked={selected} onChange={() => onChange(o.value)} className="peer sr-only" />
        <span className="min-w-0">
          <span className="block text-sm text-fg">{o.label}</span>
          {o.description && <span className="mt-0.5 block text-xs text-muted">{o.description}</span>}
        </span>
        <Check size={16} strokeWidth={2.25}
          className={cn('shrink-0 text-accent-600 transition-opacity duration-150 dark:text-accent-400', selected ? 'opacity-100' : 'opacity-0')} />
      </label>
    )
  })
}

// Barre flottante : n'apparaît que s'il y a quelque chose à enregistrer (ou un retour à afficher)
export function UnsavedBar({ dirty, saving, saved, error, onReset }) {
  const visible = dirty || saving || saved || !!error
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="sticky bottom-4 z-20 mx-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-line-strong bg-elevated py-2 pl-4 pr-2 shadow-float md:bottom-6"
          role="status"
        >
          <p className="min-w-0 truncate text-[13px]">
            {error
              ? <span className="text-red-600 dark:text-red-400">{error}</span>
              : saved && !dirty
                ? <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><Check size={14} /> Modifications enregistrées</span>
                : <span className="text-fg">Modifications non enregistrées</span>}
          </p>
          <div className="flex shrink-0 gap-1.5">
            {dirty && <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>Annuler</Button>}
            {(dirty || saving) && <Button type="submit" size="sm" loading={saving}>Enregistrer</Button>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
