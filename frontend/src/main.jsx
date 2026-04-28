import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { useThemeStore } from './stores/theme.store.js'
import { useAuthStore } from './stores/auth.store.js'
import { injectStore } from './utils/api.js'
import './index.css'

// Break circular dep: api.js needs the store but can't import it directly
injectStore(useAuthStore)

useThemeStore.getState().init()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 0 },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
