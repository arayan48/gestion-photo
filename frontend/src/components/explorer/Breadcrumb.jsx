import { Link } from 'react-router-dom'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight, Home } from 'lucide-react'

function DroppableHome() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'drop-root',
    data: { type: 'folder', folderId: null },
  })
  return (
    <span
      ref={setNodeRef}
      className={`inline-flex rounded p-0.5 transition-colors ${isOver ? 'bg-violet-100 dark:bg-violet-900/30' : ''}`}
    >
      <Link
        to="/explorer"
        className={`transition-colors ${isOver ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400'}`}
      >
        <Home size={13} />
      </Link>
    </span>
  )
}

function DroppableCrumb({ crumb, isLast }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-folder-${crumb.id}`,
    data: { type: 'folder', folderId: crumb.id },
  })

  return (
    <span className="flex items-center gap-1">
      <ChevronRight size={12} className="text-slate-300 dark:text-gray-700" />
      {isLast ? (
        <span
          ref={setNodeRef}
          className={`font-medium rounded px-1 py-0.5 transition-colors ${isOver ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-gray-300'}`}
        >
          {crumb.name}
        </span>
      ) : (
        <span
          ref={setNodeRef}
          className={`rounded px-0.5 transition-colors ${isOver ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : ''}`}
        >
          <Link
            to={`/explorer/${crumb.id}`}
            className={`transition-colors ${isOver ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400'}`}
          >
            {crumb.name}
          </Link>
        </span>
      )}
    </span>
  )
}

// chain et folderId sont maintenant passés depuis Explorer (query remontée)
export default function Breadcrumb({ chain, folderId }) {
  if (!folderId || !chain?.length) return null

  return (
    <nav className="flex items-center gap-1 text-sm">
      <DroppableHome />
      {chain.map((crumb, i) => (
        <DroppableCrumb key={crumb.id} crumb={crumb} isLast={i === chain.length - 1} />
      ))}
    </nav>
  )
}
