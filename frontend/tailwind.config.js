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
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
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
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.06), 0 4px 16px -4px rgb(0 0 0 / 0.12)',
        float: '0 8px 30px -6px rgb(0 0 0 / 0.35), 0 2px 8px -2px rgb(0 0 0 / 0.2)',
        glow: '0 0 0 1px rgb(var(--accent-500) / 0.35), 0 8px 28px -6px rgb(var(--accent-600) / 0.45)',
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
