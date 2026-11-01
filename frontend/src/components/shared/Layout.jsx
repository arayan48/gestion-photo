import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar, { MobileSidebar } from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import MobileNav from './MobileNav.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import CommandPalette from './CommandPalette.jsx'
import ShortcutsDialog from './ShortcutsDialog.jsx'
import { DndProvider } from './DndProvider.jsx'
import MoveDialog from '../explorer/MoveDialog.jsx'
import FolderDeleteDialog from '../explorer/FolderDeleteDialog.jsx'
import FolderShareDialog from '../explorer/FolderShareDialog.jsx'
import UploadDialog from '../upload/UploadDialog.jsx'
import UploadManager from '../upload/UploadManager.jsx'
import { useAuthStore } from '../../stores/auth.store.js'
import { useNotificationStore } from '../../stores/notification.store.js'
import { useUiStore } from '../../stores/ui.store.js'
import { usePreferencesStore } from '../../stores/preferences.store.js'
import { startPreferencesSync, applyServerPreferences } from '../../lib/prefsSync.js'
import { useHotkeys } from '../../hooks/useHotkeys.js'
import { pickFiles, createFolder } from '../../lib/actions.js'
import api from '../../utils/api.js'

export default function Layout() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const { connect, setNotifications } = useNotificationStore()
  const { setCommandOpen, setShortcutsOpen } = useUiStore()
  const toggleSidebar = usePreferencesStore((s) => s.toggleSidebar)

  // Rafraîchir le profil (permissions, quota, préférences) à l'ouverture de l'application
  useEffect(() => {
    useAuthStore.getState().fetchMe().then((me) => applyServerPreferences(me?.preferences)).catch(() => {})
    startPreferencesSync()
  }, [])

  useEffect(() => {
    if (!accessToken) return
    connect(() => useAuthStore.getState().accessToken)
    api.get('/admin/notifications').then(({ data }) => setNotifications(data)).catch(() => {})
    return () => useNotificationStore.getState().disconnect()
  }, [!!accessToken])

  useHotkeys({ 'mod+k': () => setCommandOpen(true) }, { allowInInput: true, overDialogs: true })
  useHotkeys({
    '?': () => setShortcutsOpen(true),
    '[': toggleSidebar,
    u: () => { if (useAuthStore.getState().hasPermission('files.upload')) pickFiles() },
    n: () => { if (useAuthStore.getState().hasPermission('files.create_folder')) createFolder() },
  })

  return (
    <DndProvider>
      <div className="grain flex h-[100dvh] overflow-hidden bg-bg">
        <Sidebar />
        <MobileSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="relative min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">
            <Outlet />
          </main>
        </div>
        <MobileNav />
        <UploadManager />
        <UploadDialog />
        <MoveDialog />
        <FolderDeleteDialog />
        <FolderShareDialog />
        <CommandPalette />
        <ShortcutsDialog />
        <ConfirmDialog />
      </div>
    </DndProvider>
  )
}
