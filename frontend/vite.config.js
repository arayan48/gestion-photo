import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cible du proxy de développement (Docker : backend:3000 ; hors Docker : BACKEND_URL=http://localhost:3000)
const backend = process.env.BACKEND_URL || 'http://backend:3000'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Bibliothèques séparées : mises en cache par le navigateur d'un déploiement à l'autre
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          ui: [
            '@radix-ui/react-context-menu', '@radix-ui/react-dropdown-menu', '@radix-ui/react-dialog',
            '@radix-ui/react-popover', '@radix-ui/react-tooltip', 'cmdk', 'vaul', 'sonner',
          ],
          data: ['@tanstack/react-query', 'axios', 'zustand', 'date-fns'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/storage': { target: backend, changeOrigin: true },
      // Liens publics : même réécriture que Nginx (/media/<jeton> → /api/files/public/<jeton>)
      '/media': { target: backend, changeOrigin: true, rewrite: (path) => path.replace(/^\/media\//, '/api/files/public/') },
      '/ws': { target: backend.replace(/^http/, 'ws'), ws: true },
    },
  },
})
