/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1a2e',
          50: '#f0f0f8',
          100: '#e0e0f0',
          200: '#c0c0e0',
          700: '#2a2a4e',
          800: '#1a1a3e',
          900: '#0d0d1e',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#8b5cf6',
          dark: '#6d28d9',
        },
      },
    },
  },
  plugins: [],
}
