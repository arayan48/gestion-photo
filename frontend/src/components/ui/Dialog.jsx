import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useIsMobile } from '../../hooks/useMediaQuery.js'

// Boîte de dialogue animée ; sur téléphone elle devient une feuille qui monte du bas
export function Dialog({ open, onOpenChange, children, title, description, icon: Icon, iconTone = 'accent', size = 'md', className, hideClose, footer, bodyClassName, onOpenAutoFocus }) {
  const isMobile = useIsMobile()
  const width = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' }[size]
  const tones = {
    accent: 'bg-accent-500/10 text-accent-600 dark:text-accent-400 ring-accent-500/20',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  }

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </RDialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[251] flex items-end justify-center md:items-center md:p-6">
            <RDialog.Content asChild forceMount onOpenAutoFocus={onOpenAutoFocus}>
              <motion.div
                initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 4 }}
                transition={isMobile ? { type: 'spring', damping: 32, stiffness: 380 } : { duration: 0.18, ease: [0.2, 0.9, 0.3, 1] }}
                className={cn(
                  'pointer-events-auto flex max-h-[92dvh] w-full flex-col border border-line bg-elevated shadow-float outline-none',
                  'rounded-t-3xl pb-safe md:rounded-2xl md:pb-0',
                  width,
                  className
                )}
              >
                <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" />
                {(title || Icon) && (
                  <div className="flex shrink-0 items-start gap-3.5 px-5 pb-1 pt-4 md:px-6 md:pt-5">
                    {Icon && (
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', tones[iconTone])}>
                        <Icon size={19} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <RDialog.Title className="text-[15px] font-semibold text-fg">{title}</RDialog.Title>
                      {description
                        ? <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description>
                        : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
                    </div>
                    {!hideClose && (
                      <RDialog.Close className="-mr-1.5 -mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-overlay hover:text-fg" aria-label="Fermer">
                        <X size={17} />
                      </RDialog.Close>
                    )}
                  </div>
                )}
                <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6', bodyClassName)}>{children}</div>
                {footer && (
                  <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-3.5 md:flex-row md:justify-end md:px-6">
                    {footer}
                  </div>
                )}
              </motion.div>
            </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  )
}
