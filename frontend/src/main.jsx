import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import App from './App.jsx'
import { queryClient } from './lib/queryClient.js'
import { useThemeStore } from './stores/theme.store.js'
import { useAuthStore } from './stores/auth.store.js'
import { injectStore } from './utils/api.js'
import './index.css'

// Casse la dépendance circulaire : api.js a besoin du store sans l'importer
injectStore(useAuthStore)

useThemeStore.getState().init()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
