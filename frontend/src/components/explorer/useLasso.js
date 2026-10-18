import { useCallback, useEffect, useRef, useState } from 'react'

/*
  Sélection au lasso (clic-glisser sur le fond, comme le bureau Windows / Finder).
  Coordonnées exprimées dans le repère du contenu défilant : le rectangle reste
  juste pendant le défilement automatique près des bords.
*/
export function useLasso(scrollRef, { onStart, onSelect, onClear, enabled = true }) {
  const [rect, setRect] = useState(null)
  const state = useRef(null)

  const toContent = (clientX, clientY) => {
    const el = scrollRef.current
    const box = el.getBoundingClientRect()
    return { x: clientX - box.left + el.scrollLeft, y: clientY - box.top + el.scrollTop }
  }

  const compute = useCallback(() => {
    const s = state.current
    if (!s) return
    const cur = toContent(s.clientX, s.clientY)
    const r = {
      left: Math.min(s.start.x, cur.x),
      top: Math.min(s.start.y, cur.y),
      width: Math.abs(cur.x - s.start.x),
      height: Math.abs(cur.y - s.start.y),
    }
    if (!s.active && r.width < 5 && r.height < 5) return
    if (!s.active) onStart?.(s.additive)
    s.active = true
    setRect(r)
    const hits = []
    for (const it of s.items) {
      if (it.left < r.left + r.width && it.left + it.width > r.left && it.top < r.top + r.height && it.top + it.height > r.top) hits.push(it.key)
    }
    onSelect(hits, s.additive)
  }, [onSelect, onStart])

  const onPointerDown = useCallback((e) => {
    if (!enabled || e.button !== 0 || e.pointerType === 'touch') return
    if (e.target.closest('[data-key], button, a, input, [role="menu"], [data-no-lasso]')) return
    const el = scrollRef.current
    if (!el) return
    // Ne pas démarrer sur la barre de défilement
    const box = el.getBoundingClientRect()
    if (e.clientX > box.left + el.clientWidth) return

    const elBox = el.getBoundingClientRect()
    const items = [...el.querySelectorAll('[data-key]')].map((node) => {
      const b = node.getBoundingClientRect()
      return { key: node.dataset.key, left: b.left - elBox.left + el.scrollLeft, top: b.top - elBox.top + el.scrollTop, width: b.width, height: b.height }
    })
    state.current = {
      start: toContent(e.clientX, e.clientY),
      clientX: e.clientX,
      clientY: e.clientY,
      items,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
      active: false,
    }
    e.preventDefault()
  }, [enabled])

  useEffect(() => {
    let raf = null
    const tick = () => {
      const s = state.current
      const el = scrollRef.current
      if (!s || !el) return
      const box = el.getBoundingClientRect()
      const edge = 48
      let dy = 0
      if (s.clientY < box.top + edge) dy = -Math.ceil((box.top + edge - s.clientY) / 4)
      else if (s.clientY > box.bottom - edge) dy = Math.ceil((s.clientY - (box.bottom - edge)) / 4)
      if (dy) {
        el.scrollTop += dy
        compute()
      }
      raf = requestAnimationFrame(tick)
    }

    const move = (e) => {
      if (!state.current) return
      state.current.clientX = e.clientX
      state.current.clientY = e.clientY
      compute()
      if (!raf && state.current.active) raf = requestAnimationFrame(tick)
    }
    const up = () => {
      const s = state.current
      state.current = null
      cancelAnimationFrame(raf)
      raf = null
      if (s && !s.active && !s.additive) onClear?.()
      setRect(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      cancelAnimationFrame(raf)
    }
  }, [compute, onClear])

  return { rect, onPointerDown }
}
