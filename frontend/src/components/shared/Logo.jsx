import { useId } from 'react'

// Diaphragme à 6 lames, monochrome : seule l'ouverture centrale (la lumière) prend l'accent
const HEX = 'M32 23.4L39.45 27.7L39.45 36.3L32 40.6L24.55 36.3L24.55 27.7Z'
const BLADES = [
  'M32 23.4L57.53 38.13',
  'M39.45 27.7L39.45 57.18',
  'M39.45 36.3L13.92 51.03',
  'M32 40.6L6.47 25.87',
  'M24.55 36.3L24.55 6.82',
  'M24.55 27.7L50.08 12.97',
]

export function LogoMark({ size = 28, className = '', accent = true }) {
  // Identifiants uniques : plusieurs logos peuvent coexister dans la page
  const uid = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <circle cx="32" cy="32" r="29" fill="#fff" />
          <path d={HEX} fill="#000" />
          <g stroke="#000" strokeWidth="2.4" strokeLinecap="square">
            {BLADES.map((d) => <path key={d} d={d} />)}
          </g>
        </mask>
      </defs>
      <rect width="64" height="64" fill="currentColor" mask={`url(#${uid}-m)`} />
      {accent && <path d={HEX} className="fill-accent-500" transform="translate(32 32) scale(.62) translate(-32 -32)" />}
    </svg>
  )
}

export const APP_NAME = 'Obscura'

export default function Logo({ size = 22, textClassName = 'text-[15px]' }) {
  return (
    <div className="flex items-center gap-2.5 text-fg">
      <LogoMark size={size} className="shrink-0" />
      <span className={`font-mono font-medium lowercase tracking-[0.08em] ${textClassName}`}>{APP_NAME}</span>
    </div>
  )
}
