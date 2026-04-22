import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from './stores/auth.store.js'
import Setup from './pages/Setup.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Explorer from './pages/Explorer.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import ProtectedRoute from './components/shared/ProtectedRoute.jsx'
import Layout from './components/shared/Layout.jsx'

export default function App() {
  const { user, accessToken } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [setupChecked, setSetupChecked] = useState(false)

  useEffect(() => {
    if (location.pathname === '/setup') {
      setSetupChecked(true)
      return
    }
    axios.get('/api/auth/setup/status', { withCredentials: true })
      .then(({ data }) => {
        if (!data.isCompleted) navigate('/setup', { replace: true })
      })
      .catch(() => {})
      .finally(() => setSetupChecked(true))
  }, [])

  if (!setupChecked) return null

  return (
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
