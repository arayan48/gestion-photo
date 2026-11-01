import { useRef, useState } from 'react'
import { AlertTriangle, HelpCircle, Pencil } from 'lucide-react'
import { useConfirmStore } from '../../stores/confirm.store.js'
import { Dialog } from '../ui/Dialog.jsx'
import { Button } from '../ui/Button.jsx'

// Rend confirm() et prompt() (stores/confirm.store.js)
export default function ConfirmDialog() {
  const { open, kind, title, message, confirmLabel, danger, defaultValue, placeholder, selectBaseName, close } = useConfirmStore()
  const [value, setValue] = useState('')
  const inputRef = useRef(null)
  const isPrompt = kind === 'prompt'

  // Valeur posée dès le rendu d'ouverture (pas dans un effet) : sinon la sélection du texte
  // se fait sur un champ encore vide et la saisie s'ajoute à « Nouveau dossier »
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setValue(defaultValue || '')
  }

  const submit = () => {
    if (isPrompt) {
      const v = value.trim()
      if (v) close(v)
    } else close(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close(isPrompt ? null : false)}
      title={title}
      description={!isPrompt ? message : message || undefined}
      icon={isPrompt ? Pencil : danger ? AlertTriangle : HelpCircle}
      iconTone={danger ? 'danger' : 'accent'}
      size="sm"
      bodyClassName={isPrompt ? '' : 'py-0'}
      onOpenAutoFocus={(e) => {
        if (!isPrompt) return
        e.preventDefault()
        // Sélectionne le nom sans l'extension (comme l'explorateur Windows / Finder)
        requestAnimationFrame(() => {
          const el = inputRef.current
          if (!el) return
          el.focus()
          const dot = selectBaseName ? el.value.lastIndexOf('.') : -1
          el.setSelectionRange(0, dot > 0 ? dot : el.value.length)
        })
      }}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(isPrompt ? null : false)}>Annuler</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit} disabled={isPrompt && !value.trim()} autoFocus={!isPrompt}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {isPrompt && (
        <input
          ref={inputRef}
          className="input"
          value={value}
          placeholder={placeholder}
          maxLength={255}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        />
      )}
    </Dialog>
  )
}
