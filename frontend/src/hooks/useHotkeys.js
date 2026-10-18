import { useEffect, useRef } from 'react'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'

export function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

const overlayOpen = () =>
  !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]')

// Raccourcis clavier déclaratifs : { 'mod+k': fn, 'shift+n': fn, 'delete': fn, '?': fn }
// « mod » = Cmd sur macOS, Ctrl ailleurs. Options :
//  - allowInInput : actif pendant la saisie dans un champ
//  - overDialogs  : actif même si une boîte de dialogue / un menu est ouvert
// Le handler peut renvoyer false pour laisser le comportement par défaut du navigateur.
export function useHotkeys(map, { enabled = true, allowInInput = false, overDialogs = false } = {}) {
  const ref = useRef(map)
  ref.current = map

  useEffect(() => {
    if (!enabled) return
    const onKey = (e) => {
      if (!allowInInput && isTypingTarget(e.target)) return
      if (!overDialogs && overlayOpen()) return
      const key = e.key === ' ' ? 'space' : e.key.toLowerCase()
      const mod = isMac ? e.metaKey : e.ctrlKey
      for (const [combo, handler] of Object.entries(ref.current)) {
        if (!handler) continue
        const parts = combo.toLowerCase().split('+')
        const want = parts[parts.length - 1]
        if (parts.includes('mod') !== mod) continue
        if (parts.includes('alt') !== e.altKey) continue
        if (parts.includes('shift') && !e.shiftKey) continue
        if (key !== want) continue
        if (handler(e) !== false) e.preventDefault()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, allowInInput, overDialogs])
}
