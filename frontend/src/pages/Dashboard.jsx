import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api.js'
import { toast } from '../stores/toast.store.js'
import {
  Users, HardDrive, FileImage, AlertTriangle, Shield, Plus, Trash2,
  UserCheck, UserX, Search, Activity, Info, AlertCircle,
  XCircle, Key, Save, X, Edit2, Database, Download, RefreshCw, Lock,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'violet' }) {
  const colors = {
    violet: { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
    green:  { text: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30' },
    blue:   { text: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30' },
    red:    { text: 'text-red-600 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30' },
    yellow: { text: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  }
  const c = colors[color]
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${c.bg} shrink-0`}>
        <Icon size={20} className={c.text} />
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-gray-500 mb-0.5">{label}</p>
        <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => el && (el.indeterminate = indeterminate)}
      onChange={onChange}
      className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500 cursor-pointer"
    />
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ children, color }) {
  const colors = {
    green:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    gray:   'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  )
}

// ── Log level config ───────────────────────────────────────────────────────────
const LOG_LEVELS = {
  error:   { icon: XCircle,      color: 'text-red-500',   bg: 'bg-red-50 dark:bg-red-900/10',     badge: 'red',    label: 'Erreur' },
  warning: { icon: AlertCircle,  color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', badge: 'yellow', label: 'Alerte' },
  info:    { icon: Info,         color: 'text-blue-500',  bg: '',                                  badge: 'gray',   label: 'Info' },
}

const LOG_CATEGORIES = ['auth', 'files', 'users', 'security', 'system']

// ── Permission matrix categories ─────────────────────────────────────────────
const PERM_CATEGORY_ORDER = ['Fichiers & Médias', 'Utilisateurs', 'Sécurité', 'Système']

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-800 shrink-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Role modal ────────────────────────────────────────────────────────────────
function RoleModal({ role, allPermissions, onClose, onSave }) {
  const [name, setName] = useState(role?.name || '')
  const [selected, setSelected] = useState(new Set(role?.permissions?.map((p) => p.key) || []))

  const grouped = useMemo(() => {
    const map = {}
    for (const p of allPermissions) {
      if (!map[p.category]) map[p.category] = []
      map[p.category].push(p)
    }
    return map
  }, [allPermissions])

  const togglePerm = (key) => {
    const next = new Set(selected)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelected(next)
  }

  const toggleCategory = (cat) => {
    const keys = grouped[cat]?.map((p) => p.key) || []
    const allSelected = keys.every((k) => selected.has(k))
    const next = new Set(selected)
    if (allSelected) keys.forEach((k) => next.delete(k))
    else keys.forEach((k) => next.add(k))
    setSelected(next)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({ name, permissionKeys: [...selected] })
  }

  return (
    <Modal title={role ? `Modifier "${role.name}"` : 'Créer un rôle'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Nom du rôle</label>
          <input
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Modérateur"
            required
          />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">Permissions</p>
          <div className="space-y-4">
            {PERM_CATEGORY_ORDER.filter((c) => grouped[c]).map((cat) => {
              const perms = grouped[cat]
              const allSel = perms.every((p) => selected.has(p.key))
              const someSel = perms.some((p) => selected.has(p.key)) && !allSel
              return (
                <div key={cat} className="border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <input
                      type="checkbox"
                      checked={allSel}
                      ref={(el) => el && (el.indeterminate = someSel)}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-violet-600 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">{cat}</span>
                    <Badge color="gray">{perms.filter((p) => selected.has(p.key)).length}/{perms.length}</Badge>
                  </button>
                  <div className="divide-y divide-slate-100 dark:divide-gray-800">
                    {perms.map((p) => (
                      <label key={p.key} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.has(p.key)}
                          onChange={() => togglePerm(p.key)}
                          className="w-4 h-4 rounded text-violet-600"
                        />
                        <div>
                          <span className="text-sm text-slate-700 dark:text-gray-300">{p.label}</span>
                          <code className="ml-2 text-[10px] text-slate-400 dark:text-gray-600 font-mono">{p.key}</code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
            Annuler
          </button>
          <button type="submit" className="btn-primary flex items-center gap-2 text-sm">
            <Save size={14} /> {role ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── User action modal ─────────────────────────────────────────────────────────
function UserActionModal({ user, type, roles, onClose, onSave }) {
  const [roleId, setRoleId] = useState(user.role_id || '')
  const [quota, setQuota] = useState(Math.round(user.storage_quota / 1e9))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (type === 'role') onSave({ roleId })
    if (type === 'quota') onSave({ storageQuota: quota * 1e9 })
  }

  const titles = { role: `Changer le rôle de ${user.pseudo}`, quota: `Modifier le quota de ${user.pseudo}` }

  return (
    <Modal title={titles[type]} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'role' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Rôle</label>
            <select className="input w-full" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Aucun rôle</option>
              {roles?.filter((r) => !r.is_super_admin).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
        {type === 'quota' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Quota (Go)</label>
            <input
              type="number"
              min="1"
              max="500"
              className="input w-full"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
            Annuler
          </button>
          <button type="submit" className="btn-primary flex items-center gap-2 text-sm">
            <Save size={14} /> Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  // Users state
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [userSearch, setUserSearch] = useState('')
  const [userModal, setUserModal] = useState(null) // { type: 'role'|'quota', user }

  // Requests state
  const [selectedRequests, setSelectedRequests] = useState(new Set())

  // Roles state
  const [roleModal, setRoleModal] = useState(null) // null | 'create' | roleObject

  // Log filters (sent to API)
  const [logFilters, setLogFilters] = useState({ level: '', category: '', search: '', from: '', to: '' })

  // Backups state
  const [backupType, setBackupType] = useState('local')
  const [backupRunning, setBackupRunning] = useState(false)

  // IP whitelist state
  const [newIp, setNewIp] = useState({ ip: '', label: '' })

  // ── Queries ──
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30_000,
  })
  const { data: requests } = useQuery({
    queryKey: ['account-requests'],
    queryFn: () => api.get('/users/requests').then((r) => r.data),
    enabled: activeTab === 'requests',
  })
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: activeTab === 'users',
  })
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
  })
  const { data: allPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get('/roles/permissions').then((r) => r.data),
    enabled: activeTab === 'roles',
  })
  const { data: whitelist } = useQuery({
    queryKey: ['whitelist'],
    queryFn: () => api.get('/admin/whitelist').then((r) => r.data),
    enabled: activeTab === 'whitelist',
  })
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['logs', logFilters],
    queryFn: () => {
      const params = {}
      if (logFilters.level) params.level = logFilters.level
      if (logFilters.category) params.category = logFilters.category
      if (logFilters.search) params.search = logFilters.search
      if (logFilters.from) params.from = logFilters.from
      if (logFilters.to) params.to = logFilters.to
      return api.get('/admin/logs', { params }).then((r) => r.data)
    },
    enabled: activeTab === 'logs',
  })
  const { data: backups } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get('/admin/backups').then((r) => r.data),
    enabled: activeTab === 'backups',
  })

  const tabs = [
    { key: 'overview',   label: 'Vue d\'ensemble' },
    { key: 'requests',   label: `Demandes${stats?.pendingRequests ? ` (${stats.pendingRequests})` : ''}` },
    { key: 'users',      label: 'Utilisateurs' },
    { key: 'roles',      label: 'Rôles' },
    { key: 'whitelist',  label: 'Liste blanche IP' },
    { key: 'backups',    label: 'Sauvegardes' },
    { key: 'logs',       label: 'Logs' },
  ]

  // ── Handlers ──
  const handleReviewRequest = async (id, action) => {
    try {
      await api.post(`/users/requests/${id}/review`, { action })
      toast.success(action === 'accept' ? 'Demande acceptée' : 'Demande refusée')
      queryClient.invalidateQueries({ queryKey: ['account-requests'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } catch { toast.error('Erreur lors du traitement') }
  }

  const handleBulkRequests = async (action) => {
    await Promise.all([...selectedRequests].map((id) =>
      api.post(`/users/requests/${id}/review`, { action }).catch(() => {})
    ))
    toast.success(`${selectedRequests.size} demande(s) ${action === 'accept' ? 'acceptée(s)' : 'refusée(s)'}`)
    setSelectedRequests(new Set())
    queryClient.invalidateQueries({ queryKey: ['account-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
  }

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur définitivement ?')) return
    try {
      await api.delete(`/users/${id}`)
      toast.success('Utilisateur supprimé')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const handleBulkDeleteUsers = async () => {
    if (!window.confirm(`Supprimer ${selectedUsers.size} utilisateur(s) définitivement ?`)) return
    await Promise.all([...selectedUsers].map((id) =>
      api.delete(`/users/${id}`).catch(() => {})
    ))
    setSelectedUsers(new Set())
    queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const handleSuspendUser = async (user) => {
    try {
      await api.patch(`/users/${user.id}`, { suspend: !user.is_banned })
      toast.success(user.is_banned ? 'Utilisateur réactivé' : 'Utilisateur suspendu')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch { toast.error('Erreur') }
  }

  const handleUserModalSave = async (data) => {
    try {
      await api.patch(`/users/${userModal.user.id}`, data)
      toast.success('Utilisateur mis à jour')
      setUserModal(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const handleAddIp = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/whitelist', newIp)
      toast.success(`IP ${newIp.ip} ajoutée à la liste blanche`)
      setNewIp({ ip: '', label: '' })
      queryClient.invalidateQueries({ queryKey: ['whitelist'] })
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const handleRemoveIp = async (id, ip) => {
    if (!window.confirm(`Retirer ${ip} de la liste blanche ?`)) return
    await api.delete(`/admin/whitelist/${id}`)
    toast.success('IP retirée')
    queryClient.invalidateQueries({ queryKey: ['whitelist'] })
  }

  const handleCreateRole = async ({ name, permissionKeys }) => {
    try {
      await api.post('/roles', { name, permissionKeys })
      toast.success(`Rôle "${name}" créé`)
      setRoleModal(null)
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const handleUpdateRole = async ({ name, permissionKeys }) => {
    try {
      await api.put(`/roles/${roleModal.id}`, { name, permissionKeys })
      toast.success('Rôle mis à jour')
      setRoleModal(null)
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const handleDeleteRole = async (id, name) => {
    if (!window.confirm(`Supprimer le rôle "${name}" ?`)) return
    try {
      await api.delete(`/roles/${id}`)
      toast.success('Rôle supprimé')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const handleRunBackup = async () => {
    setBackupRunning(true)
    try {
      await api.post('/admin/backups/run', { type: backupType })
      toast.success(`Sauvegarde ${backupType} lancée`)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde')
    } finally {
      setBackupRunning(false)
    }
  }

  // ── Filtered data ──
  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return []
    if (!userSearch) return usersData.users
    const q = userSearch.toLowerCase()
    return usersData.users.filter((u) =>
      u.pseudo.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [usersData, userSearch])

  // ── Select helpers ──
  const allUsersSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedUsers.has(u.id))
  const someUsersSelected = filteredUsers.some((u) => selectedUsers.has(u.id)) && !allUsersSelected
  const toggleAllUsers = () => {
    if (allUsersSelected) setSelectedUsers(new Set())
    else setSelectedUsers(new Set(filteredUsers.map((u) => u.id)))
  }

  const allRequestsSelected = requests?.length > 0 && requests.every((r) => selectedRequests.has(r.id))
  const someRequestsSelected = requests?.some((r) => selectedRequests.has(r.id)) && !allRequestsSelected
  const toggleAllRequests = () => {
    if (allRequestsSelected) setSelectedRequests(new Set())
    else setSelectedRequests(new Set(requests.map((r) => r.id)))
  }

  const setLogFilter = (key, val) => setLogFilters((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-5 max-w-screen-xl">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Dashboard</h2>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-200/60 dark:bg-gray-900 rounded-xl p-1 w-fit border border-slate-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-gray-500 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Vue d'ensemble ── */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users}         label="Utilisateurs actifs"   value={stats.users.active}            color="blue" />
            <StatCard icon={FileImage}     label="Fichiers hébergés"      value={stats.files.total}             sub={`${Math.round(stats.files.total_size / 1e9)} Go`} color="violet" />
            <StatCard icon={HardDrive}     label="Stockage médias"        value={`${stats.storage.percent}%`}  sub={`${Math.round(stats.storage.used / 1e9)} / ${Math.round(stats.storage.limit / 1e9)} Go`} color={stats.storage.percent >= 90 ? 'red' : 'green'} />
            <StatCard icon={AlertTriangle} label="Demandes en attente"    value={stats.pendingRequests}         color="yellow" />
          </div>
          {stats.storage.percent >= 90 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 dark:bg-red-900/20 dark:border-red-800">
              <AlertTriangle size={18} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">
                Stockage serveur à <strong>{stats.storage.percent}%</strong> — Pensez à libérer de l'espace.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Demandes ── */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {selectedRequests.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl dark:bg-violet-900/20 dark:border-violet-800">
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                {selectedRequests.size} sélectionné(s)
              </span>
              <button onClick={() => handleBulkRequests('accept')} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                <UserCheck size={12} /> Accepter tout
              </button>
              <button onClick={() => handleBulkRequests('refuse')} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                <UserX size={12} /> Refuser tout
              </button>
              <button onClick={() => setSelectedRequests(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300">
                Désélectionner
              </button>
            </div>
          )}

          {requests?.length === 0 && (
            <div className="card text-center py-12">
              <UserCheck size={32} className="mx-auto text-slate-300 dark:text-gray-700 mb-3" />
              <p className="text-slate-500 dark:text-gray-500 text-sm">Aucune demande en attente</p>
            </div>
          )}

          {requests?.length > 0 && (
            <div className="table-wrapper">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
                  <tr>
                    <th className="th w-10 pr-0">
                      <Checkbox checked={allRequestsSelected} indeterminate={someRequestsSelected} onChange={toggleAllRequests} />
                    </th>
                    <th className="th">Utilisateur</th>
                    <th className="th hidden md:table-cell">Raison</th>
                    <th className="th hidden sm:table-cell">Date</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {requests.map((req) => (
                    <tr key={req.id} className="tr-hover">
                      <td className="td w-10 pr-0">
                        <Checkbox
                          checked={selectedRequests.has(req.id)}
                          indeterminate={false}
                          onChange={() => {
                            const next = new Set(selectedRequests)
                            next.has(req.id) ? next.delete(req.id) : next.add(req.id)
                            setSelectedRequests(next)
                          }}
                        />
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {req.pseudo?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 dark:text-gray-200 text-sm">{req.pseudo}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-500">{req.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td hidden md:table-cell max-w-xs">
                        <p className="text-slate-600 dark:text-gray-400 text-xs italic truncate">"{req.reason}"</p>
                      </td>
                      <td className="td hidden sm:table-cell text-xs text-slate-400 dark:text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(req.created_at), { locale: fr, addSuffix: true })}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => handleReviewRequest(req.id, 'accept')} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                            <UserCheck size={12} /> Accepter
                          </button>
                          <button onClick={() => handleReviewRequest(req.id, 'refuse')} className="flex items-center gap-1.5 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 text-xs px-3 py-1.5 rounded-lg transition-colors dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400">
                            <UserX size={12} /> Refuser
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Utilisateurs ── */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs dark:bg-gray-800 dark:border-gray-700">
              <Search size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
              <input
                placeholder="Rechercher un utilisateur..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full dark:text-gray-300 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl dark:bg-violet-900/20 dark:border-violet-800">
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                {selectedUsers.size} sélectionné(s)
              </span>
              <button onClick={handleBulkDeleteUsers} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                <Trash2 size={12} /> Supprimer
              </button>
              <button onClick={() => setSelectedUsers(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300">
                Désélectionner
              </button>
            </div>
          )}

          <div className="table-wrapper">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
                <tr>
                  <th className="th w-10 pr-0">
                    <Checkbox checked={allUsersSelected} indeterminate={someUsersSelected} onChange={toggleAllUsers} />
                  </th>
                  <th className="th">Utilisateur</th>
                  <th className="th hidden sm:table-cell">Rôle</th>
                  <th className="th hidden md:table-cell">Statut</th>
                  <th className="th hidden lg:table-cell">Stockage</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="tr-hover">
                    <td className="td w-10 pr-0">
                      <Checkbox
                        checked={selectedUsers.has(u.id)}
                        indeterminate={false}
                        onChange={() => {
                          const next = new Set(selectedUsers)
                          next.has(u.id) ? next.delete(u.id) : next.add(u.id)
                          setSelectedUsers(next)
                        }}
                      />
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {u.pseudo[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-gray-200 text-sm">{u.pseudo}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td hidden sm:table-cell">
                      <Badge color="violet">{u.role_name || '—'}</Badge>
                    </td>
                    <td className="td hidden md:table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge color={u.is_active ? 'green' : 'yellow'}>{u.is_active ? 'Actif' : 'Inactif'}</Badge>
                        {u.is_banned && <Badge color="red">Suspendu</Badge>}
                      </div>
                    </td>
                    <td className="td hidden lg:table-cell">
                      {(() => {
                        const pct = Math.min(100, Math.round((u.storage_used / u.storage_quota) * 100))
                        const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-violet-500'
                        return (
                          <div className="w-28">
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-gray-500 mb-1">
                              <span>{Math.round(u.storage_used / 1e6)} Mo</span>
                              <span>{Math.round(u.storage_quota / 1e9)} Go</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className={`text-[10px] mt-0.5 font-medium ${pct >= 90 ? 'text-red-500' : 'text-slate-400 dark:text-gray-600'}`}>{pct}%</p>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="td text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setUserModal({ type: 'role', user: u })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                          title="Changer le rôle"
                        >
                          <Key size={14} />
                        </button>
                        <button
                          onClick={() => setUserModal({ type: 'quota', user: u })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Modifier le quota"
                        >
                          <HardDrive size={14} />
                        </button>
                        <button
                          onClick={() => handleSuspendUser(u)}
                          className={`p-1.5 rounded-lg transition-colors ${u.is_banned
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                          title={u.is_banned ? 'Réactiver' : 'Suspendre'}
                        >
                          {u.is_banned ? <UserCheck size={14} /> : <UserX size={14} />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users size={32} className="mx-auto text-slate-300 dark:text-gray-700 mb-3" />
                <p className="text-slate-500 dark:text-gray-500 text-sm">
                  {userSearch ? 'Aucun résultat' : 'Aucun utilisateur'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Rôles ── */}
      {activeTab === 'roles' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setRoleModal('create')}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={14} /> Nouveau rôle
            </button>
          </div>

          <div className="table-wrapper">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
                <tr>
                  <th className="th">Rôle</th>
                  <th className="th hidden sm:table-cell">Permissions</th>
                  <th className="th hidden md:table-cell">Créé le</th>
                  <th className="th text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {roles?.map((role) => (
                  <tr key={role.id} className="tr-hover">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        {role.is_super_admin && <Lock size={13} className="text-violet-500 shrink-0" />}
                        <span className="font-medium text-slate-800 dark:text-gray-200 text-sm">{role.name}</span>
                        {role.is_super_admin && <Badge color="violet">Super Admin</Badge>}
                      </div>
                    </td>
                    <td className="td hidden sm:table-cell">
                      <Badge color="gray">
                        {role.permissions?.length || 0} permission{(role.permissions?.length || 0) !== 1 ? 's' : ''}
                      </Badge>
                    </td>
                    <td className="td hidden md:table-cell text-xs text-slate-400 dark:text-gray-500">
                      {format(new Date(role.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="td text-right">
                      {!role.is_super_admin && (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setRoleModal(role)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                            title="Modifier"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role.id, role.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!roles?.length && (
              <div className="text-center py-12">
                <Key size={28} className="mx-auto text-slate-300 dark:text-gray-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">Aucun rôle</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Liste blanche IP ── */}
      {activeTab === 'whitelist' && (
        <div className="space-y-4">
          <form onSubmit={handleAddIp} className="flex gap-3">
            <input className="input w-44" placeholder="192.168.1.1" value={newIp.ip} onChange={(e) => setNewIp({ ...newIp, ip: e.target.value })} required />
            <input className="input flex-1" placeholder="Étiquette (optionnel)" value={newIp.label} onChange={(e) => setNewIp({ ...newIp, label: e.target.value })} />
            <button type="submit" className="btn-primary flex items-center gap-2 shrink-0">
              <Plus size={14} /> Ajouter
            </button>
          </form>
          <div className="table-wrapper">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
                <tr>
                  <th className="th">Adresse IP</th>
                  <th className="th hidden sm:table-cell">Étiquette</th>
                  <th className="th hidden md:table-cell">Ajouté par</th>
                  <th className="th w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {whitelist?.map((entry) => (
                  <tr key={entry.id} className="tr-hover">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-violet-500 shrink-0" />
                        <span className="font-mono text-sm text-slate-800 dark:text-gray-200">{entry.ip_address}</span>
                      </div>
                    </td>
                    <td className="td hidden sm:table-cell text-slate-500 dark:text-gray-500">{entry.label || '—'}</td>
                    <td className="td hidden md:table-cell text-xs text-slate-400 dark:text-gray-500">{entry.added_by_pseudo}</td>
                    <td className="td text-right">
                      <button onClick={() => handleRemoveIp(entry.id, entry.ip_address)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {whitelist?.length === 0 && (
              <div className="text-center py-10">
                <Shield size={28} className="mx-auto text-slate-300 dark:text-gray-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">Aucune IP dans la liste blanche</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sauvegardes ── */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          <div className="card flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-1">Lancer une sauvegarde</p>
              <p className="text-xs text-slate-500 dark:text-gray-500">La sauvegarde crée une copie compressée des données.</p>
            </div>
            <select
              className="input w-36"
              value={backupType}
              onChange={(e) => setBackupType(e.target.value)}
            >
              <option value="local">Locale</option>
              <option value="backblaze">Backblaze B2</option>
            </select>
            <button
              onClick={handleRunBackup}
              disabled={backupRunning}
              className="btn-primary flex items-center gap-2 text-sm shrink-0 disabled:opacity-60"
            >
              {backupRunning ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {backupRunning ? 'En cours...' : 'Lancer'}
            </button>
          </div>

          <div className="table-wrapper">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
                <tr>
                  <th className="th">Type</th>
                  <th className="th">Statut</th>
                  <th className="th hidden sm:table-cell">Taille</th>
                  <th className="th hidden md:table-cell text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {backups?.map((b) => (
                  <tr key={b.id} className="tr-hover">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Database size={14} className="text-violet-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-800 dark:text-gray-200 capitalize">{b.type}</span>
                      </div>
                    </td>
                    <td className="td">
                      <Badge color={b.status === 'success' ? 'green' : 'red'}>
                        {b.status === 'success' ? 'Succès' : 'Échec'}
                      </Badge>
                      {b.error_message && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 max-w-xs truncate">{b.error_message}</p>
                      )}
                    </td>
                    <td className="td hidden sm:table-cell text-xs text-slate-500 dark:text-gray-500">
                      {b.size ? `${Math.round(b.size / 1e6)} Mo` : '—'}
                    </td>
                    <td className="td hidden md:table-cell text-right">
                      <span className="text-xs text-slate-400 dark:text-gray-600" title={format(new Date(b.created_at), 'dd/MM/yyyy HH:mm')}>
                        {formatDistanceToNow(new Date(b.created_at), { locale: fr, addSuffix: true })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {backups?.length === 0 && (
              <div className="text-center py-12">
                <Database size={28} className="mx-auto text-slate-300 dark:text-gray-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">Aucune sauvegarde</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Logs ── */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Recherche */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-52 dark:bg-gray-800 dark:border-gray-700">
              <Search size={13} className="text-slate-400 dark:text-gray-500 shrink-0" />
              <input
                placeholder="Rechercher..."
                value={logFilters.search}
                onChange={(e) => setLogFilter('search', e.target.value)}
                className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full dark:text-gray-300 dark:placeholder:text-gray-500"
              />
            </div>

            {/* Catégorie */}
            <select
              className="input text-sm py-1.5"
              value={logFilters.category}
              onChange={(e) => setLogFilter('category', e.target.value)}
            >
              <option value="">Toutes catégories</option>
              {LOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>

            {/* Niveau */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 dark:bg-gray-900 dark:border-gray-800">
              {['', 'error', 'warning', 'info'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLogFilter('level', lvl)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    logFilters.level === lvl
                      ? lvl === 'error'   ? 'bg-red-600 text-white'
                      : lvl === 'warning' ? 'bg-amber-500 text-white'
                      : lvl === 'info'    ? 'bg-blue-600 text-white'
                      : 'bg-violet-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-gray-500 dark:hover:text-gray-300'
                  }`}
                >
                  {lvl === '' ? 'Tous' : lvl === 'error' ? 'Erreurs' : lvl === 'warning' ? 'Alertes' : 'Info'}
                </button>
              ))}
            </div>

            {/* Date de */}
            <input
              type="datetime-local"
              className="input text-sm py-1.5 w-48"
              value={logFilters.from}
              onChange={(e) => setLogFilter('from', e.target.value)}
              title="Depuis"
              placeholder="Depuis"
            />

            {/* Date à */}
            <input
              type="datetime-local"
              className="input text-sm py-1.5 w-48"
              value={logFilters.to}
              onChange={(e) => setLogFilter('to', e.target.value)}
              title="Jusqu'à"
            />

            {/* Reset */}
            {(logFilters.level || logFilters.category || logFilters.search || logFilters.from || logFilters.to) && (
              <button
                onClick={() => setLogFilters({ level: '', category: '', search: '', from: '', to: '' })}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X size={12} /> Réinitialiser
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
                <tr>
                  <th className="th w-24">Niveau</th>
                  <th className="th hidden sm:table-cell w-28">Catégorie</th>
                  <th className="th">Action</th>
                  <th className="th hidden md:table-cell w-28">Utilisateur</th>
                  <th className="th w-36 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {logsLoading ? (
                  <tr><td colSpan={5} className="td text-center py-8">
                    <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td></tr>
                ) : logs?.map((log) => {
                  const lvl = LOG_LEVELS[log.level] || LOG_LEVELS.info
                  const LvlIcon = lvl.icon
                  return (
                    <tr key={log.id} className={`tr-hover ${lvl.bg}`}>
                      <td className="td">
                        <div className="flex items-center gap-1.5">
                          <LvlIcon size={13} className={lvl.color} />
                          <Badge color={lvl.badge}>{lvl.label}</Badge>
                        </div>
                      </td>
                      <td className="td hidden sm:table-cell">
                        <span className="font-mono text-xs text-slate-500 dark:text-gray-500 bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          {log.category}
                        </span>
                      </td>
                      <td className="td text-slate-700 dark:text-gray-300 text-sm">{log.action}</td>
                      <td className="td hidden md:table-cell text-xs text-slate-400 dark:text-gray-500">
                        {log.user_pseudo || '—'}
                      </td>
                      <td className="td text-right">
                        <span className="text-xs text-slate-400 dark:text-gray-600" title={format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}>
                          {formatDistanceToNow(new Date(log.created_at), { locale: fr, addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!logsLoading && logs?.length === 0 && (
              <div className="text-center py-12">
                <Activity size={28} className="mx-auto text-slate-300 dark:text-gray-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">Aucun log correspondant</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {roleModal && (
        <RoleModal
          role={roleModal === 'create' ? null : roleModal}
          allPermissions={allPermissions || []}
          onClose={() => setRoleModal(null)}
          onSave={roleModal === 'create' ? handleCreateRole : handleUpdateRole}
        />
      )}

      {userModal && (
        <UserActionModal
          user={userModal.user}
          type={userModal.type}
          roles={roles}
          onClose={() => setUserModal(null)}
          onSave={handleUserModalSave}
        />
      )}
    </div>
  )
}
