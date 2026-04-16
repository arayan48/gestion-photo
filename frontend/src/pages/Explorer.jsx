import { useState, useCallback } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api.js'
import FileGrid from '../components/explorer/FileGrid.jsx'
import FileList from '../components/explorer/FileList.jsx'
import UploadPanel from '../components/upload/UploadPanel.jsx'
import FileViewer from '../components/viewer/FileViewer.jsx'
import ContextMenu from '../components/explorer/ContextMenu.jsx'
import Breadcrumb from '../components/explorer/Breadcrumb.jsx'
import { Grid3X3, List, Upload, FolderPlus, Search, Filter } from 'lucide-react'

export default function Explorer() {
  const [searchParams] = useSearchParams()
  const { folderId } = useParams()
  const view = searchParams.get('view') || 'mine'

  const [viewMode, setViewMode] = useState('grid')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const queryClient = useQueryClient()

  const queryKey = ['files', view, folderId, search]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (view === 'recent') {
        const { data } = await api.get('/files/recent')
        return { files: data }
      }
      if (view === 'favorites') {
        const { data } = await api.get('/files/favorites')
        return { files: data }
      }
      if (view === 'trash') {
        const { data } = await api.get('/files/trash')
        return { files: data }
      }
      const params = { view, folderId, search }
      const { data } = await api.get('/files', { params })
      return data
    },
  })

  const { data: folders } = useQuery({
    queryKey: ['folders', folderId],
    queryFn: async () => {
      const { data } = await api.get('/files/folders', { params: { parentId: folderId } })
      return data
    },
    enabled: view === 'mine',
  })

  const handleContextMenu = useCallback((e, file) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }, [])

  const handleFileAction = useCallback(async (action, file) => {
    setContextMenu(null)
    switch (action) {
      case 'view':
        setSelectedFile(file)
        break
      case 'delete':
        if (confirm(`Supprimer "${file.original_name}" ?`)) {
          await api.delete(`/files/${file.id}`)
          queryClient.invalidateQueries({ queryKey })
        }
        break
      case 'toggle-link':
        await api.post(`/files/${file.id}/toggle-link`)
        queryClient.invalidateQueries({ queryKey })
        break
      case 'favorite':
        await api.post(`/files/${file.id}/favorite`)
        queryClient.invalidateQueries({ queryKey })
        break
      case 'unfavorite':
        await api.delete(`/files/${file.id}/favorite`)
        queryClient.invalidateQueries({ queryKey })
        break
      case 'restore':
        await api.post(`/files/${file.id}/restore`)
        queryClient.invalidateQueries({ queryKey })
        break
      case 'download':
        window.open(`/api/files/${file.id}/download`, '_blank')
        break
      case 'copy-link':
        navigator.clipboard.writeText(`${window.location.origin}/media/${file.link_token}`)
        break
    }
  }, [queryClient, queryKey])

  const viewLabels = {
    mine: 'Mon espace',
    others: 'Espace commun',
    recent: 'Récents',
    favorites: 'Favoris',
    trash: 'Corbeille',
  }

  return (
    <div className="flex flex-col h-full" onClick={() => setContextMenu(null)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-100">{viewLabels[view] || 'Explorateur'}</h2>
          <Breadcrumb folderId={folderId} />
        </div>

        <div className="flex items-center gap-2">
          {/* Recherche */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-gray-500" />
            <input
              placeholder="Rechercher..."
              className="bg-transparent text-sm text-gray-300 placeholder:text-gray-500 outline-none w-40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Vue grille / liste */}
          <div className="flex bg-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-100'}`}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-100'}`}
            >
              <List size={16} />
            </button>
          </div>

          {view === 'mine' && (
            <>
              <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2 text-sm py-1.5">
                <Upload size={15} />
                Uploader
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {viewMode === 'grid' ? (
            <FileGrid
              files={data?.files || []}
              folders={folders || []}
              onFileClick={(f) => setSelectedFile(f)}
              onContextMenu={handleContextMenu}
              isTrash={view === 'trash'}
            />
          ) : (
            <FileList
              files={data?.files || []}
              folders={folders || []}
              onFileClick={(f) => setSelectedFile(f)}
              onContextMenu={handleContextMenu}
              isTrash={view === 'trash'}
            />
          )}
        </div>
      )}

      {/* Panels */}
      {showUpload && (
        <UploadPanel
          folderId={folderId}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey })
            setShowUpload(false)
          }}
        />
      )}

      {selectedFile && (
        <FileViewer
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onAction={handleFileAction}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          isTrash={view === 'trash'}
          onAction={handleFileAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
