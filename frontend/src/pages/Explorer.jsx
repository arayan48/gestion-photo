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
import { Grid3X3, List, Upload, Search, Download, X, Calendar, FolderPlus, Trash2, CheckSquare } from 'lucide-react'
import { toast } from '../stores/toast.store.js'
import { confirm } from '../stores/confirm.store.js'

export default function Explorer() {
  const [searchParams] = useSearchParams()
  const { folderId } = useParams()
  const view = searchParams.get('view') || 'mine'

  const [viewMode, setViewMode] = useState('grid')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const queryClient = useQueryClient()

  const queryKey = ['files', view, folderId, search, dateFrom, dateTo]
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
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
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
      case 'delete': {
        const ok = await confirm(`Supprimer "${file.original_name}" ?`, { danger: true, confirmLabel: 'Supprimer', title: 'Supprimer le fichier' })
        if (ok) {
          await api.delete(`/files/${file.id}`)
          queryClient.invalidateQueries({ queryKey })
          toast.success(`"${file.original_name}" déplacé dans la corbeille`)
        }
        break
      }
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
      case 'delete-permanent': {
        const ok = await confirm(`Supprimer définitivement "${file.original_name}" ? Cette action est irréversible.`, { danger: true, confirmLabel: 'Supprimer définitivement', title: 'Suppression permanente' })
        if (ok) {
          await api.delete(`/files/${file.id}/permanent`)
          queryClient.invalidateQueries({ queryKey })
          toast.success('Fichier supprimé définitivement')
        }
        break
      }
      case 'rename': {
        const newName = prompt('Nouveau nom :', file.original_name)
        if (newName && newName !== file.original_name) {
          await api.patch(`/files/${file.id}`, { name: newName })
          queryClient.invalidateQueries({ queryKey })
        }
        break
      }
      case 'info':
        setSelectedFile(file)
        break
      case 'download':
        window.open(`/api/files/${file.id}/download`, '_blank')
        break
      case 'copy-link':
        navigator.clipboard.writeText(`${window.location.origin}/media/${file.link_token}`)
        toast.success('Lien copié dans le presse-papiers')
        break
    }
  }, [queryClient, queryKey])

  const handleZipDownload = async () => {
    if (selectedFiles.length === 0) return
    try {
      const response = await api.post('/files/zip', { fileIds: selectedFiles }, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'archive.zip'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Archive ZIP téléchargée')
    } catch {
      toast.error('Erreur lors de la création du ZIP')
    }
  }

  const toggleSelectFile = useCallback((id) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }, [])

  const clearSelection = () => setSelectedFiles([])

  const handleEmptyTrash = async () => {
    const ok = await confirm('Vider la corbeille ? Cette action est irréversible.', { danger: true, confirmLabel: 'Vider', title: 'Vider la corbeille' })
    if (!ok) return
    try {
      const { data } = await api.delete('/files/trash')
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey })
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await api.post('/files/folders', { name: newFolderName.trim(), parentId: folderId || null })
      toast.success(`Dossier "${newFolderName}" créé`)
      setNewFolderName('')
      setNewFolderMode(false)
      queryClient.invalidateQueries({ queryKey: ['folders', folderId] })
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const clearDateFilter = () => { setDateFrom(''); setDateTo(''); setShowDateFilter(false) }

  const viewLabels = {
    mine: 'Mon espace',
    others: 'Espace commun',
    recent: 'Récents',
    favorites: 'Favoris',
    trash: 'Corbeille',
  }

  const hasDateFilter = dateFrom || dateTo

  return (
    <div className="flex flex-col h-full" onClick={() => setContextMenu(null)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 shrink-0">{viewLabels[view] || 'Explorateur'}</h2>
          <Breadcrumb folderId={folderId} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Recherche */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-slate-400 dark:text-gray-500" />
            <input
              placeholder="Rechercher..."
              className="bg-transparent text-sm text-slate-700 dark:text-gray-300 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none w-36"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filtre date */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowDateFilter((v) => !v) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                hasDateFilter
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700'
              }`}
            >
              <Calendar size={14} />
              Date
              {hasDateFilter && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
            </button>

            {showDateFilter && (
              <div
                className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl shadow-xl z-40 p-4 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-semibold text-slate-600 dark:text-gray-400">Filtrer par date</p>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-gray-500 mb-1">Depuis</label>
                  <input
                    type="date"
                    className="input w-full text-sm"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-gray-500 mb-1">Jusqu'au</label>
                  <input
                    type="date"
                    className="input w-full text-sm"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                {hasDateFilter && (
                  <button onClick={clearDateFilter} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors">
                    <X size={12} /> Effacer le filtre
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Vue grille / liste */}
          <div className="flex bg-white border border-slate-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100'}`}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100'}`}
            >
              <List size={16} />
            </button>
          </div>

          {view === 'mine' && (
            <>
              {newFolderMode ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input text-sm py-1.5 w-40"
                    placeholder="Nom du dossier"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setNewFolderMode(false); setNewFolderName('') } }}
                    autoFocus
                  />
                  <button onClick={handleCreateFolder} className="btn-primary text-sm py-1.5">Créer</button>
                  <button onClick={() => { setNewFolderMode(false); setNewFolderName('') }} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setNewFolderMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                  <FolderPlus size={14} /> Dossier
                </button>
              )}
              <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2 text-sm py-1.5">
                <Upload size={15} />
                Uploader
              </button>
            </>
          )}
          {view === 'trash' && (
            <button onClick={handleEmptyTrash} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white transition-colors">
              <Trash2 size={14} /> Vider la corbeille
            </button>
          )}
        </div>
      </div>

      {/* Barre sélection multiple */}
      {selectedFiles.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl dark:bg-violet-900/20 dark:border-violet-800">
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            {selectedFiles.length} fichier(s) sélectionné(s)
          </span>
          <button
            onClick={handleZipDownload}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={12} /> Télécharger en ZIP
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Désélectionner
          </button>
        </div>
      )}

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
              selectedFiles={selectedFiles}
              onToggleSelect={toggleSelectFile}
              onAction={handleFileAction}
            />
          ) : (
            <FileList
              files={data?.files || []}
              folders={folders || []}
              onFileClick={(f) => setSelectedFile(f)}
              onContextMenu={handleContextMenu}
              isTrash={view === 'trash'}
              selectedFiles={selectedFiles}
              onToggleSelect={toggleSelectFile}
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
