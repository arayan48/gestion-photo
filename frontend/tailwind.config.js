/** @type {import('tailwindcss').Config} */

// Couleurs pilotées par des variables CSS (index.css) : le thème clair/sombre
// et la couleur d'accent changent sans recompiler les classes
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
const accent = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, v(`accent-${k}`)])
)

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    // Direction « chambre noire » : angles presque droits partout.
    // Les classes rounded-xl / 2xl existantes restent valides mais deviennent sobres.
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '3px',
      md: '3px',
      lg: '4px',
      xl: '4px',
      '2xl': '6px',
      '3xl': '8px',
      full: '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        elevated: v('elevated'),
        overlay: v('overlay'),
        line: v('line'),
        'line-strong': v('line-strong'),
        fg: v('fg'),
        muted: v('muted'),
        subtle: v('subtle'),
        accent: { ...accent, DEFAULT: v('accent-600') },
      },
      // Ombres minimales : la profondeur vient des filets, pas des halos
      boxShadow: {
        soft: '0 1px 0 rgb(0 0 0 / 0.04)',
        float: '0 12px 32px -12px rgb(0 0 0 / 0.5)',
        glow: 'none',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'spin-slow': 'spin-slow 24s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
