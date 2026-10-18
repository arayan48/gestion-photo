import { toast as sonner } from 'sonner'

// API conservée (toast.success/error/warn/info) au-dessus de Sonner
export const toast = {
  success: (msg, opts) => sonner.success(msg, opts),
  error: (msg, opts) => sonner.error(msg, { duration: 6000, ...opts }),
  warn: (msg, opts) => sonner.warning(msg, opts),
  info: (msg, opts) => sonner.info(msg, opts),
  message: (msg, opts) => sonner(msg, opts),
  promise: (p, opts) => sonner.promise(p, opts),
  dismiss: (id) => sonner.dismiss(id),
}
