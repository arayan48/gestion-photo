import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn.js'
import { initials } from '../../lib/format.js'

// Sans photo : initiale sur fond neutre (pas de dégradé), teinte stable par pseudo
const TONES = ['bg-[#3a342e]', 'bg-[#2f3a36]', 'bg-[#33343d]', 'bg-[#3d3130]', 'bg-[#383527]']
const hash = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function Avatar({ src, name, size = 32, className, ring }) {
  const [error, setError] = useState(false)
  useEffect(() => setError(false), [src])
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.42) }
  if (src && !error) {
    return (
      <img
        src={src}
        alt={name || ''}
        style={style}
        onError={() => setError(true)}
        className={cn('shrink-0 rounded-full object-cover grayscale-[15%]', ring && 'ring-2 ring-surface', className)}
      />
    )
  }
  return (
    <span
      style={style}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-mono font-medium text-[#ece8e1]',
        TONES[hash(name) % TONES.length],
        ring && 'ring-2 ring-surface',
        className
      )}
    >
      {initials(name)}
    </span>
  )
}

export const userAvatar = (u) => u?.avatar_path || u?.discord_avatar || null
