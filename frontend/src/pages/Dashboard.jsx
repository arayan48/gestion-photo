import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api.js'
import {
  Users, HardDrive, FileImage, AlertTriangle, Shield, Plus, Trash2,
  UserCheck, UserX, ChevronUp, ChevronDown, Search, Filter,
  CheckSquare, Square, MoreHorizontal, Activity, Info, AlertCircle,
  XCircle, Clock,
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

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  // Users state
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [userSearch, setUserSearch] = useState('')

  // Requests state
  const [selectedRequests, setSelectedRequests] = useState(new Set())

  // Logs state
  const [logLevel, setLogLevel] = useState('all')
  const [logSearch, setLogSearch] = useState('')

  // IP whitelist state
  const [newIp, setNewIp] = useState({ ip: '', label: '' })

  // Queries
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
  const { data: whitelist } = useQuery({
    queryKey: ['whitelist'],
    queryFn: () => api.get('/admin/whitelist').then((r) => r.data),
    enabled: activeTab === 'whitelist',
  })
  const { data: logs } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.get('/admin/logs').then((r) => r.data),
    enabled: activeTab === 'logs',
  })

  const tabs = [
    { key: 'overview',   label: 'Vue d\'ensemble' },
    { key: 'requests',   label: `Demandes${stats?.pendingRequests ? ` (${stats.pendingRequests})` : ''}` },
    { key: 'users',      label: 'Utilisateurs' },
    { key: 'whitelist',  label: 'Liste blanche IP' },
    { key: 'logs',       label: 'Logs' },
  ]

  // ── Handlers ──
  const handleReviewRequest = async (id, action) => {
    await api.post(`/users/requests/${id}/review`, { action })
    queryClient.invalidateQueries({ queryKey: ['account-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
  }

  const handleBulkRequests = async (action) => {
    await Promise.all([...selectedRequests].map((id) =>
      api.post(`/users/requests/${id}/review`, { action }).catch(() => {})
    ))
    setSelectedRequests(new Set())
    queryClient.invalidateQueries({ queryKey: ['account-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
  }

  const handleDeleteUser = async (id) => {
    if (!confirm('Supprimer cet utilisateur définitivement ?')) return
    await api.delete(`/users/${id}`).catch(() => {})
    queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const handleBulkDeleteUsers = async () => {
    if (!confirm(`Supprimer ${selectedUsers.size} utilisateur(s) définitivement ?`)) return
    await Promise.all([...selectedUsers].map((id) =>
      api.delete(`/users/${id}`).catch(() => {})
    ))
    setSelectedUsers(new Set())
    queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const handleAddIp = async (e) => {
    e.preventDefault()
    await api.post('/admin/whitelist', newIp)
    setNewIp({ ip: '', label: '' })
    queryClient.invalidateQueries({ queryKey: ['whitelist'] })
  }

  const handleRemoveIp = async (id) => {
    if (!confirm('Retirer cette IP de la liste blanche ?')) return
    await api.delete(`/admin/whitelist/${id}`)
    queryClient.invalidateQueries({ queryKey: ['whitelist'] })
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

  const filteredLogs = useMemo(() => {
    if (!logs) return []
    return logs.filter((l) => {
      if (logLevel !== 'all' && l.level !== logLevel) return false
      if (logSearch) {
        const q = logSearch.toLowerCase()
        return (
          l.action?.toLowerCase().includes(q) ||
          l.category?.toLowerCase().includes(q) ||
          l.user_pseudo?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [logs, logLevel, logSearch])

  // ── Select helpers ──
  const allUsersSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedUsers.has(u.id))
  const someUsersSelected = filteredUsers.some((u) => selectedUsers.has(u.id)) && !allUsersSelected
  const toggleAllUsers = () => {
    if (allUsersSelected) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.id)))
    }
  }

  const allRequestsSelected = requests?.length > 0 && requests.every((r) => selectedRequests.has(r.id))
  const someRequestsSelected = requests?.some((r) => selectedRequests.has(r.id)) && !allRequestsSelected
  const toggleAllRequests = () => {
    if (allRequestsSelected) setSelectedRequests(new Set())
    else setSelectedRequests(new Set(requests.map((r) => r.id)))
  }

  return (
    <div className="space-y-5 max-w-screen-xl">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">Dashboard</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-200/60 dark:bg-gray-900 rounded-xl p-1 w-fit border border-slate-200 dark:border-gray-800">
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
          {/* Bulk actions bar */}
          {selectedRequests.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl dark:bg-violet-900/20 dark:border-violet-800">
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                {selectedRequests.size} sélectionné(s)
              </span>
              <button
                onClick={() => handleBulkRequests('accept')}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                <UserCheck size={12} /> Accepter tout
              </button>
              <button
                onClick={() => handleBulkRequests('refuse')}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                <UserX size={12} /> Refuser tout
              </button>
              <button
                onClick={() => setSelectedRequests(new Set())}
                className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300"
              >
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
                      <Checkbox
                        checked={allRequestsSelected}
                        indeterminate={someRequestsSelected}
                        onChange={toggleAllRequests}
                      />
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
                          <button
                            onClick={() => handleReviewRequest(req.id, 'accept')}
                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <UserCheck size={12} /> Accepter
                          </button>
                          <button
                            onClick={() => handleReviewRequest(req.id, 'refuse')}
                            className="flex items-center gap-1.5 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 text-xs px-3 py-1.5 rounded-lg transition-colors dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          >
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
          {/* Toolbar */}
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

          {/* Bulk actions bar */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl dark:bg-violet-900/20 dark:border-violet-800">
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                {selectedUsers.size} sélectionné(s)
              </span>
              <button
                onClick={handleBulkDeleteUsers}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> Supprimer
              </button>
              <button
                onClick={() => setSelectedUsers(new Set())}
                className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300"
              >
                Désélectionner
              </button>
            </div>
          )}

          <div className="table-wrapper">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
                <tr>
                  <th className="th w-10 pr-0">
                    <Checkbox
                      checked={allUsersSelected}
                      indeterminate={someUsersSelected}
                      onChange={toggleAllUsers}
                    />
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
                        <Badge color={u.is_active ? 'green' : 'yellow'}>
                          {u.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                        {u.is_banned && <Badge color="red">Suspendu</Badge>}
                      </div>
                    </td>
                    <td className="td hidden lg:table-cell text-xs text-slate-500 dark:text-gray-500">
                      {Math.round(u.storage_used / 1e6)} Mo / {Math.round(u.storage_quota / 1e9)} Go
                    </td>
                    <td className="td text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
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
                      <button onClick={() => handleRemoveIp(entry.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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

      {/* ── Logs ── */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex-1 min-w-0 max-w-xs dark:bg-gray-800 dark:border-gray-700">
              <Search size={13} className="text-slate-400 dark:text-gray-500 shrink-0" />
              <input
                placeholder="Rechercher dans les logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full dark:text-gray-300 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 dark:bg-gray-900 dark:border-gray-800">
              {['all', 'error', 'warning', 'info'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLogLevel(lvl)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    logLevel === lvl
                      ? lvl === 'error'   ? 'bg-red-600 text-white'
                      : lvl === 'warning' ? 'bg-amber-500 text-white'
                      : lvl === 'info'    ? 'bg-blue-600 text-white'
                      : 'bg-violet-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-gray-500 dark:hover:text-gray-300'
                  }`}
                >
                  {lvl === 'all' ? 'Tous' : lvl === 'error' ? 'Erreurs' : lvl === 'warning' ? 'Alertes' : 'Info'}
                </button>
              ))}
            </div>
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
                {filteredLogs.map((log) => {
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
                        <span
                          className="text-xs text-slate-400 dark:text-gray-600"
                          title={format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        >
                          {formatDistanceToNow(new Date(log.created_at), { locale: fr, addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredLogs.length === 0 && (
              <div className="text-center py-12">
                <Activity size={28} className="mx-auto text-slate-300 dark:text-gray-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">
                  {logSearch || logLevel !== 'all' ? 'Aucun log correspondant' : 'Aucun log disponible'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
