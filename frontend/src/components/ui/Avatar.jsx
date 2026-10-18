import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn.js'
import { initials } from '../../lib/format.js'

// Dégradé stable dérivé du pseudo (chaque utilisateur garde sa couleur)
const GRADIENTS = [
  'from-violet-500 to-fuchsia-600', 'from-sky-500 to-indigo-600', 'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-blue-600',
]
const hash = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function Avatar({ src, name, size = 32, className, ring }) {
  const [error, setError] = useState(false)
  useEffect(() => setError(false), [src])
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) }
  if (src && !error) {
    return (
      <img
        src={src}
        alt={name || ''}
        style={style}
        onError={() => setError(true)}
        className={cn('shrink-0 rounded-full object-cover', ring && 'ring-2 ring-surface', className)}
      />
    )
  }
  return (
    <span
      style={style}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white',
        GRADIENTS[hash(name) % GRADIENTS.length],
        ring && 'ring-2 ring-surface',
        className
      )}
    >
      {initials(name)}
    </span>
  )
}

export const userAvatar = (u) => u?.avatar_path || u?.discord_avatar || null
