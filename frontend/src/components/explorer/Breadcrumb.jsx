import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
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
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      <Link to="/explorer" className="hover:text-gray-300 transition-colors">Accueil</Link>
      {chain.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <ChevronRight size={12} />
          {i === chain.length - 1 ? (
            <span className="text-gray-300">{crumb.name}</span>
          ) : (
            <Link to={`/explorer/${crumb.id}`} className="hover:text-gray-300 transition-colors">{crumb.name}</Link>
          )}
        </span>
      ))}
    </nav>
  )
}
