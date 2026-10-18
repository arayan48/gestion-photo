import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useIsMobile } from '../../hooks/useMediaQuery.js'

// Boîte de dialogue animée ; sur téléphone elle devient une feuille qui monte du bas
export function Dialog({ open, onOpenChange, children, title, description, iconTone, size = 'md', className, hideClose, footer, bodyClassName, onOpenAutoFocus }) {
  const isMobile = useIsMobile()
  const width = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' }[size]

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[250] bg-black/60"
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
                  'rounded-t-lg pb-safe md:rounded-sm md:pb-0',
                  width,
                  className
                )}
              >
                <div className="mx-auto mt-2 h-1 w-8 shrink-0 bg-line-strong md:hidden" />
                {title && (
                  <div className={cn('flex shrink-0 items-start gap-3 border-b border-line px-5 py-3.5 md:px-6', iconTone === 'danger' && 'border-b-red-500/40')}>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <RDialog.Title className="text-[15px] font-medium text-fg">{title}</RDialog.Title>
                      {description
                        ? <RDialog.Description className="mt-0.5 text-[13px] text-muted">{description}</RDialog.Description>
                        : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
                    </div>
                    {!hideClose && (
                      <RDialog.Close className="-mr-2 flex h-7 w-7 items-center justify-center text-subtle transition-colors hover:text-fg" aria-label="Fermer">
                        <X size={16} strokeWidth={1.75} />
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
