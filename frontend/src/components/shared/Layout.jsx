import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import { useEffect } from 'react'
import { useAuthStore } from '../../stores/auth.store.js'
import { useNotificationStore } from '../../stores/notification.store.js'
import api from '../../utils/api.js'

export default function Layout() {
  const { accessToken } = useAuthStore()
  const { connect, setNotifications } = useNotificationStore()

  useEffect(() => {
    if (accessToken) {
      connect(accessToken)
      api.get('/admin/notifications').then(({ data }) => setNotifications(data)).catch(() => {})
    }
    return () => useNotificationStore.getState().disconnect()
  }, [accessToken])

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-gray-950 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
