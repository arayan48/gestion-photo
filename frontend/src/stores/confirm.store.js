import { create } from 'zustand'

// Une seule boîte de dialogue à la fois ; une nouvelle demande répond « non » à la précédente
let resolver = null
const settle = (value) => {
  const r = resolver
  resolver = null
  r?.(value)
}

export const useConfirmStore = create((set) => ({
  open: false,
  kind: 'confirm', // 'confirm' | 'prompt'
  title: '',
  message: '',
  confirmLabel: 'Confirmer',
  danger: false,
  // prompt
  defaultValue: '',
  placeholder: '',
  selectBaseName: false,

  show(opts) {
    settle(opts.kind === 'prompt' ? null : false)
    set({
      open: true,
      kind: opts.kind || 'confirm',
      title: opts.title ?? 'Confirmer',
      message: opts.message ?? '',
      confirmLabel: opts.confirmLabel ?? 'Confirmer',
      danger: !!opts.danger,
      defaultValue: opts.defaultValue ?? '',
      placeholder: opts.placeholder ?? '',
      selectBaseName: !!opts.selectBaseName,
    })
    return new Promise((resolve) => { resolver = resolve })
  },

  close(result) {
    set({ open: false })
    settle(result)
  },
}))

export const confirm = (message, opts = {}) => useConfirmStore.getState().show({ ...opts, message, kind: 'confirm' })

// Remplace window.prompt() : renvoie la valeur saisie ou null
export const prompt = (title, opts = {}) => useConfirmStore.getState().show({ confirmLabel: 'Valider', ...opts, title, kind: 'prompt' })
