import { useId } from 'react'

// Diaphragme à 6 lames — même tracé que public/icon.svg
const HEX = 'M32 23.4L39.45 27.7L39.45 36.3L32 40.6L24.55 36.3L24.55 27.7Z'
const BLADES = [
  'M32 23.4L53.53 35.83',
  'M39.45 27.7L39.45 52.56',
  'M39.45 36.3L17.92 48.73',
  'M32 40.6L10.47 28.17',
  'M24.55 36.3L24.55 11.44',
  'M24.55 27.7L46.08 15.27',
]

export function LogoMark({ size = 32, className = '' }) {
  // Identifiants uniques : plusieurs logos peuvent coexister dans la page
  const uid = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset=".55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="32" cy="32" r="9" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f5f3ff" />
          <stop offset="1" stopColor="#c4b5fd" />
        </radialGradient>
        <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <circle cx="32" cy="32" r="20" fill="#fff" />
          <path d={HEX} fill="#000" />
          <g stroke="#000" strokeWidth="2.2" strokeLinecap="round">
            {BLADES.map((d) => <path key={d} d={d} />)}
          </g>
        </mask>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${uid}-bg)`} />
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="20" fill="#2e1065" fillOpacity=".35" />
      <rect width="64" height="64" fill="#fff" mask={`url(#${uid}-m)`} />
      <path d={HEX} fill={`url(#${uid}-glow)`} fillOpacity=".9" transform="translate(32 32) scale(.5) translate(-32 -32)" />
    </svg>
  )
}

export const APP_NAME = 'Obscura'

export default function Logo({ size = 28, textClassName = 'text-lg' }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} className="shrink-0 drop-shadow-[0_2px_6px_rgba(124,58,237,0.35)]" />
      <span className={`font-semibold tracking-tight text-slate-900 dark:text-gray-50 ${textClassName}`}>
        {APP_NAME.toLowerCase()}
      </span>
    </div>
  )
}
