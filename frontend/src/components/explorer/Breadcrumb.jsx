import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Home } from 'lucide-react'
import api from '../../utils/api.js'

export default function Breadcrumb({ folderId }) {
  const { data: chain } = useQuery({
    queryKey: ['breadcrumb', folderId],
    queryFn: async () => {
      if (!folderId) return []
      const { data } = await api.get(`/files/folders/${folderId}/breadcrumb`).catch(() => ({ data: [] }))
      return data
    },
    enabled: !!folderId,
  })

  if (!folderId || !chain?.length) return null

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link to="/explorer" className="text-slate-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
        <Home size={13} />
      </Link>
      {chain.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <ChevronRight size={12} className="text-slate-300 dark:text-gray-700" />
          {i === chain.length - 1 ? (
            <span className="text-slate-700 dark:text-gray-300 font-medium">{crumb.name}</span>
          ) : (
            <Link to={`/explorer/${crumb.id}`} className="text-slate-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
              {crumb.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
