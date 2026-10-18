import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, UserPlus, Users, Key, Shield, Database, Activity, ShieldOff } from 'lucide-react'
import api from '../utils/api.js'
import { useAuthStore, usePermission } from '../stores/auth.store.js'
import { Tabs } from '../components/ui/Tabs.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import AdminOverview from '../components/admin/AdminOverview.jsx'
import AdminUsers from '../components/admin/AdminUsers.jsx'
import AdminLogs from '../components/admin/AdminLogs.jsx'
import { AdminRequests, AdminRoles, AdminWhitelist, AdminBackups } from '../components/admin/AdminSections.jsx'

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const can = usePermission()
  const user = useAuthStore((s) => s.user)
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    enabled: can('system.view_stats'),
    refetchInterval: 30_000,
  })

  // Onglets selon les permissions (le backend reste la vraie barrière)
  const tabs = [
    can('system.view_stats') && { value: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
    can('users.accept_requests') && { value: 'requests', label: 'Demandes', icon: UserPlus, count: stats?.pendingRequests },
    can('users.view_list') && { value: 'users', label: 'Utilisateurs', icon: Users },
    { value: 'roles', label: 'Rôles', icon: Key },
    can('security.view_whitelist') && { value: 'whitelist', label: 'Liste blanche IP', icon: Shield },
    can('system.manage_backups') && { value: 'backups', label: 'Sauvegardes', icon: Database },
    can('system.view_logs') && { value: 'logs', label: 'Journaux', icon: Activity },
  ].filter(Boolean)

  const requested = params.get('tab')
  const tab = tabs.some((t) => t.value === requested) ? requested : tabs[0]?.value
  const setTab = (t) => setParams({ tab: t }, { replace: true })

  if (!tabs.length) return <EmptyState icon={ShieldOff} title="Accès refusé" description="Votre rôle ne donne accès à aucune section d'administration." />

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-medium tracking-[-0.01em] text-fg">Administration</h1>
        <p className="mt-1 text-sm text-muted">Membres, sécurité, sauvegardes et journaux de l’instance.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === 'overview' && <AdminOverview onNavigate={setTab} />}
        {tab === 'requests' && <AdminRequests />}
        {tab === 'users' && <AdminUsers />}
        {tab === 'roles' && <AdminRoles isSuperAdmin={!!user?.is_super_admin} />}
        {tab === 'whitelist' && <AdminWhitelist />}
        {tab === 'backups' && <AdminBackups />}
        {tab === 'logs' && <AdminLogs />}
      </motion.div>
    </div>
  )
}
