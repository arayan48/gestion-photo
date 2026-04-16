import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store.js'

export default function ProtectedRoute() {
  const { user, accessToken } = useAuthStore()
  if (!user || !accessToken) return <Navigate to="/login" replace />
  return <Outlet />
}
