import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'sonner'
import axios from 'axios'
import { useThemeStore } from './stores/theme.store.js'
import { usePreferencesStore } from './stores/preferences.store.js'
import ProtectedRoute, { SplashScreen } from './components/shared/ProtectedRoute.jsx'
import Layout from './components/shared/Layout.jsx'
import { TooltipProvider } from './components/ui/Tooltip.jsx'
import { PageLoader } from './components/ui/Spinner.jsx'
import Explorer from './pages/Explorer.jsx'
import Login from './pages/Login.jsx'

// Pages chargées à la demande : l'explorateur et la connexion restent instantanés
const Setup = lazy(() => import('./pages/Setup.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const AdminSettings = lazy(() => import('./pages/AdminSettings.jsx'))

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [setupChecked, setSetupChecked] = useState(false)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const reduceMotion = usePreferencesStore((s) => s.reduceMotion)

  useEffect(() => {
    if (location.pathname === '/setup') { setSetupChecked(true); return }
    axios.get('/api/auth/setup/status', { withCredentials: true })
      .then(({ data }) => { if (!data.isCompleted) navigate('/setup', { replace: true }) })
      .catch(() => {})
      .finally(() => setSetupChecked(true))
  }, [])

  if (!setupChecked) return <SplashScreen />

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <TooltipProvider>
        <Suspense fallback={<SplashScreen />}>
          <Routes>
            <Route path="/setup" element={<Setup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/explorer" replace />} />
                <Route path="/explorer" element={<Explorer />} />
                <Route path="/explorer/:folderId" element={<Explorer />} />
                <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                {/* /profile redirige vers /settings (page unifiée) */}
                <Route path="/profile" element={<Navigate to="/settings" replace />} />
                <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                <Route path="/admin/settings" element={<Suspense fallback={<PageLoader />}><AdminSettings /></Suspense>} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster
          theme={resolvedTheme}
          position="bottom-center"
          closeButton
          richColors
          toastOptions={{
            className: 'font-sans !rounded-xl !border-line !shadow-float',
            style: { fontSize: 13 },
          }}
          // Au-dessus de la barre de sélection (bureau) et de la navigation basse (mobile)
          offset={{ bottom: 92 }}
          mobileOffset={{ bottom: 150 }}
        />
      </TooltipProvider>
    </MotionConfig>
  )
}
