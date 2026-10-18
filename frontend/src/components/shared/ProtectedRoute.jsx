import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store.js'
import { LogoMark } from './Logo.jsx'

export function SplashScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-bg">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-3xl bg-accent-500/30 blur-2xl" />
        <LogoMark size={64} className="relative animate-[spin-slow_6s_linear_infinite]" />
      </div>
      <p className="text-sm text-subtle">Chargement…</p>
    </div>
  )
}

export default function ProtectedRoute() {
  const { user, accessToken, initAuth } = useAuthStore()
  const location = useLocation()
  // Un user est en mémoire mais pas de token → refresh silencieux via le cookie httpOnly
  const [checking, setChecking] = useState(!accessToken && !!user)

  useEffect(() => {
    if (!accessToken && user) {
      let mounted = true
      initAuth().finally(() => { if (mounted) setChecking(false) })
      return () => { mounted = false }
    }
  }, [])

  if (checking) return <SplashScreen />
  if (!user || !accessToken) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
