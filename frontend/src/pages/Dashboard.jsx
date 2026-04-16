import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api.js'
import { useAuthStore } from '../stores/auth.store.js'
import {
  Users, HardDrive, FileImage, Shield, Key, Trash2, UserCheck, UserX,
  Plus, AlertTriangle,
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color = 'violet' }) {
  const colors = {
    violet: 'text-violet-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  }
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <Icon size={20} className={`${colors[color]} opacity-60`} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [newIp, setNewIp] = useState({ ip: '', label: '' })

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

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: activeTab === 'users',
  })

  const { data: whitelist } = useQuery({
    queryKey: ['whitelist'],
    queryFn: () => api.get('/admin/whitelist').then((r) => r.data),
    enabled: activeTab === 'whitelist',
  })

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
    enabled: activeTab === 'users' || activeTab === 'requests',
  })

  const { data: logs } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.get('/admin/logs').then((r) => r.data),
    enabled: activeTab === 'logs',
  })

  const tabs = [
    { key: 'overview', label: 'Vue d\'ensemble' },
    { key: 'requests', label: `Demandes${stats?.pendingRequests ? ` (${stats.pendingRequests})` : ''}` },
    { key: 'users', label: 'Utilisateurs' },
    { key: 'whitelist', label: 'Liste blanche IP' },
    { key: 'logs', label: 'Logs' },
  ]

  const handleReviewRequest = async (id, action) => {
    await api.post(`/users/requests/${id}/review`, { action })
    queryClient.invalidateQueries({ queryKey: ['account-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
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

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-gray-100">Dashboard</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vue d'ensemble */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Utilisateurs actifs" value={stats.users.active} color="blue" />
            <StatCard icon={FileImage} label="Fichiers hébergés" value={stats.files.total} sub={`${Math.round(stats.files.total_size / 1e9)} Go`} color="violet" />
            <StatCard icon={HardDrive} label="Stockage médias" value={`${stats.storage.percent}%`} sub={`${Math.round(stats.storage.used / 1e9)} / ${Math.round(stats.storage.limit / 1e9)} Go`} color={stats.storage.percent >= 90 ? 'red' : 'green'} />
            <StatCard icon={AlertTriangle} label="Demandes en attente" value={stats.pendingRequests} color="yellow" />
          </div>

          {stats.storage.percent >= 90 && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">Stockage serveur à {stats.storage.percent}% — Pensez à libérer de l'espace.</p>
            </div>
          )}
        </div>
      )}

      {/* Demandes de compte */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {requests?.length === 0 && <p className="text-gray-500 text-sm">Aucune demande en attente.</p>}
          {requests?.map((req) => (
            <div key={req.id} className="card flex items-start gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-100">{req.pseudo}</p>
                <p className="text-sm text-gray-400">{req.email}</p>
                <p className="text-sm text-gray-500 mt-2 italic">"{req.reason}"</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReviewRequest(req.id, 'accept')}
                  className="flex items-center gap-1.5 bg-green-800 hover:bg-green-700 text-green-100 text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  <UserCheck size={13} /> Accepter
                </button>
                <button
                  onClick={() => handleReviewRequest(req.id, 'refuse')}
                  className="flex items-center gap-1.5 bg-red-900 hover:bg-red-800 text-red-100 text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  <UserX size={13} /> Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Utilisateurs */}
      {activeTab === 'users' && (
        <div className="space-y-2">
          {users?.users?.map((u) => (
            <div key={u.id} className="card flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {u.pseudo[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100">{u.pseudo}</p>
                <p className="text-xs text-gray-500">{u.email} · {u.role_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                  {u.is_active ? 'Actif' : 'Inactif'}
                </span>
                {u.is_banned && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">Suspendu</span>}
                <span className="text-xs text-gray-500">{Math.round(u.storage_used / 1e6)} Mo / {Math.round(u.storage_quota / 1e9)} Go</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste blanche IP */}
      {activeTab === 'whitelist' && (
        <div className="space-y-4">
          <form onSubmit={handleAddIp} className="flex gap-3">
            <input className="input w-48" placeholder="192.168.1.1" value={newIp.ip} onChange={(e) => setNewIp({ ...newIp, ip: e.target.value })} required />
            <input className="input flex-1" placeholder="Étiquette (optionnel)" value={newIp.label} onChange={(e) => setNewIp({ ...newIp, label: e.target.value })} />
            <button type="submit" className="btn-primary flex items-center gap-2 shrink-0">
              <Plus size={15} /> Ajouter
            </button>
          </form>

          <div className="space-y-2">
            {whitelist?.map((entry) => (
              <div key={entry.id} className="card flex items-center gap-3">
                <Shield size={16} className="text-violet-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-mono text-gray-200">{entry.ip_address}</p>
                  {entry.label && <p className="text-xs text-gray-500">{entry.label}</p>}
                </div>
                <p className="text-xs text-gray-500">Ajouté par {entry.added_by_pseudo}</p>
                <button onClick={() => handleRemoveIp(entry.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {whitelist?.length === 0 && <p className="text-sm text-gray-500">Aucune IP dans la liste blanche.</p>}
          </div>
        </div>
      )}

      {/* Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-1">
          {logs?.map((log) => (
            <div key={log.id} className={`flex items-start gap-3 px-4 py-2.5 rounded-lg text-sm ${
              log.level === 'error' ? 'bg-red-900/20' : log.level === 'warning' ? 'bg-yellow-900/10' : ''
            }`}>
              <span className={`shrink-0 text-xs font-mono uppercase ${
                log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-gray-500'
              }`}>{log.level}</span>
              <span className="text-xs text-gray-500 shrink-0">[{log.category}]</span>
              <span className="text-gray-300 flex-1">{log.action}</span>
              {log.user_pseudo && <span className="text-xs text-gray-500 shrink-0">{log.user_pseudo}</span>}
              <span className="text-xs text-gray-600 shrink-0">{new Date(log.created_at).toLocaleString('fr-FR')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
