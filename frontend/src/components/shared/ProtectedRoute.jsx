import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store.js'

export default function ProtectedRoute() {
  const { user, accessToken, initAuth } = useAuthStore()
  // Si un user est en localStorage mais pas de token en mémoire → on tente un refresh silencieux
  const [checking, setChecking] = useState(!accessToken && !!user)

  useEffect(() => {
    if (!accessToken && user) {
      let mounted = true
      initAuth().finally(() => { if (mounted) setChecking(false) })
      return () => { mounted = false }
    }
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-500 text-sm">Chargement...</div>
      </div>
    )
  }

  if (!user || !accessToken) return <Navigate to="/login" replace />
  return <Outlet />
}
