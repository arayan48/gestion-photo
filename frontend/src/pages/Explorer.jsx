import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
  pointerWithin, rectIntersection, closestCenter,
} from '@dnd-kit/core'
import api from '../utils/api.js'
import { useAuthStore } from '../stores/auth.store.js'
import FileGrid, { GridSkeleton } from '../components/explorer/FileGrid.jsx'
import FileList, { ListSkeleton } from '../components/explorer/FileList.jsx'
import UploadPanel from '../components/upload/UploadPanel.jsx'
import FileViewer from '../components/viewer/FileViewer.jsx'
import ContextMenu from '../components/explorer/ContextMenu.jsx'
import Breadcrumb from '../components/explorer/Breadcrumb.jsx'
import { Grid3X3, List, Upload, Search, Download, X, Calendar, FolderPlus, Trash2, FileImage, FileVideo, File } from 'lucide-react'
import { toast } from '../stores/toast.store.js'
import { confirm } from '../stores/confirm.store.js'
import { usePreferencesStore } from '../stores/preferences.store.js'

// Icône selon le MIME type (utilisée dans l'overlay)
function FileTypeIcon({ mime, size = 20 }) {
  if (mime?.startsWith('image/')) return <FileImage size={size} className="text-blue-400" />
  if (mime?.startsWith('video/')) return <FileVideo size={size} className="text-purple-400" />
  return <File size={size} className="text-slate-400" />
}

// Collision : priorité au curseur dans la zone, sinon intersection des rectangles,
// puis closest center en dernier recours (évite les drops perdus sur mobile)
function customCollision(args) {
  const pointer = pointerWithin(args)
  if (pointer.length > 0) return pointer
  const rect = rectIntersection(args)
  if (rect.length > 0) return rect
  return closestCenter(args)
}

// Modal de suppression de dossier avec option corbeille
function FolderDeleteModal({ folderName, stats, onConfirm, onCancel }) {
  const [moveToTrash, setMoveToTrash] = useState(true)
  const hasContent = stats.fileCount > 0 || stats.folderCount > 0

  const contentDesc = [
    stats.fileCount  > 0 && `${stats.fileCount} fichier${stats.fileCount  > 1 ? 's' : ''}`,
    stats.folderCount > 0 && `${stats.folderCount} sous-dossier${stats.folderCount > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' et ')

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 w-96 mx-4 border border-slate-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-200 mb-1">Supprimer le dossier</h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
          Supprimer <span className="font-medium text-slate-800 dark:text-gray-200">"{folderName}"</span> ?
        </p>

        {hasContent && (
          <div className="mb-4 space-y-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Ce dossier contient {contentDesc}.
            </p>
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="checkbox"
                checked={moveToTrash}
                onChange={(e) => setMoveToTrash(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-violet-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                  Déplacer les fichiers vers la corbeille
                </p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                  {moveToTrash
                    ? 'Les fichiers seront récupérables pendant 48h depuis la corbeille.'
                    : 'Les fichiers seront remontés vers le dossier parent.'}
                </p>
              </div>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(moveToTrash)}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal de renommage — remplace window.prompt() bloquant
function RenameModal({ initial, onConfirm, onCancel }) {
  const [value, setValue] = useState(initial)
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 w-80 mx-4 border border-slate-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-200 mb-3">Renommer</h3>
        <input
          className="input w-full text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onConfirm(value.trim())
            if (e.key === 'Escape') onCancel()
          }}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
            className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Renommer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Explorer() {
  const [searchParams] = useSearchParams()
  const { folderId } = useParams()
  const navigate = useNavigate()
  const view = searchParams.get('view') || 'mine'

  const { viewMode, setViewMode } = usePreferencesStore()
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
  // activeDrag : { fileId, count, file (objet complet pour le thumbnail) }
  const [activeDrag, setActiveDrag] = useState(null)
  // renameModal : { file, action ('rename' | 'rename-folder'), initialValue }
  const [renameModal, setRenameModal] = useState(null)
  // folderDeleteModal : { file, stats: { fileCount, folderCount } }
  const [folderDeleteModal, setFolderDeleteModal] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    setSelectedFiles([])
    setContextMenu(null)
    setNewFolderMode(false)
    setNewFolderName('')
  }, [view, folderId])

  // PointerSensor (souris) + TouchSensor (mobile)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const queryKey = useMemo(
    () => ['files', view, folderId, search, dateFrom, dateTo],
    [view, folderId, search, dateFrom, dateTo]
  )

  // Breadcrumb remonté pour partager la chaîne et calculer parentFolderId
  const { data: breadcrumbChain = [] } = useQuery({
    queryKey: ['breadcrumb', folderId],
    queryFn: async () => {
      if (!folderId) return []
      const { data } = await api.get(`/files/folders/${folderId}/breadcrumb`).catch(() => ({ data: [] }))
      return data
    },
    enabled: !!folderId,
  })

  const parentFolderId = folderId
    ? (breadcrumbChain.length >= 2 ? breadcrumbChain[breadcrumbChain.length - 2].id : null)
    : undefined

  const handleNavigateUp = useCallback(() => {
    if (parentFolderId === null) navigate('/explorer')
    else if (parentFolderId) navigate(`/explorer/${parentFolderId}`)
  }, [parentFolderId, navigate])

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (view === 'recent')    { const { data } = await api.get('/files/recent');    return { files: data } }
      if (view === 'favorites') { const { data } = await api.get('/files/favorites'); return { files: data } }
      if (view === 'trash')     { const { data } = await api.get('/files/trash');     return { files: data } }
      const params = { view, folderId, search }
      if (dateFrom) params.from = dateFrom
      if (dateTo)   params.to   = dateTo
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

  // Au début du drag : enrichir activeDrag avec les infos du fichier pour l'overlay
  const handleDragStart = useCallback((event) => {
    const { data: evtData } = event.active
    if (evtData.current?.type !== 'file') return

    const fileId = evtData.current.fileId
    const allFiles = data?.files || []
    const fileObj = allFiles.find((f) => f.id === fileId)

    // Si le fichier draggé fait partie de la sélection → multi-drag
    const isMulti = selectedFiles.includes(fileId) && selectedFiles.length > 1
    setActiveDrag({
      fileId,
      count: isMulti ? selectedFiles.length : 1,
      file: fileObj,
    })
  }, [data, selectedFiles])

  // Fin du drag : déplacer un ou plusieurs fichiers
  const handleDragEnd = useCallback(async (event) => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over || !active) return

    const dragData = active.data.current
    const dropData = over.data.current

    if (dragData?.type === 'file' && dropData?.type === 'folder') {
      const targetFolderId  = dropData.folderId          // null = racine
      const currentFolderId = folderId ?? null

      if (targetFolderId === currentFolderId) return      // déjà dans ce dossier

      // Multi-drag : si le fichier draggé est dans la sélection, déplacer tout
      const isMulti  = selectedFiles.includes(dragData.fileId) && selectedFiles.length > 1
      const fileIds  = isMulti ? selectedFiles : [dragData.fileId]

      try {
        await Promise.all(fileIds.map((id) => api.patch(`/files/${id}`, { folderId: targetFolderId })))
        toast.success(fileIds.length > 1 ? `${fileIds.length} fichiers déplacés` : 'Fichier déplacé')
        // Vider la sélection seulement si tout a réussi
        if (isMulti) setSelectedFiles([])
        // Invalider toutes les vues fichiers (source + destination peuvent être n'importe quel dossier/vue)
        queryClient.invalidateQueries({ queryKey: ['files'] })
        queryClient.invalidateQueries({ queryKey: ['folders', folderId] })
        queryClient.invalidateQueries({ queryKey: ['folders', parentFolderId ?? null] })
      } catch {
        toast.error('Erreur lors du déplacement')
      }
    }
  }, [queryClient, folderId, parentFolderId, selectedFiles])

  const handleContextMenu = useCallback((e, file) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }, [])

  const handleFileAction = useCallback(async (action, file) => {
    setContextMenu(null)
    switch (action) {

      // ── Dossiers ────────────────────────────────────────────────────────────
      case 'rename-folder': {
        setRenameModal({ file, action: 'rename-folder', initialValue: file.name })
        break
      }
      case 'delete-folder': {
        try {
          const { data: stats } = await api.get(`/files/folders/${file.id}/stats`)
          setFolderDeleteModal({ file, stats })
        } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
        break
      }

      // ── Fichiers ─────────────────────────────────────────────────────────────
      case 'view':
        setSelectedFile(file)
        break
      case 'delete': {
        const ok = await confirm(`Supprimer "${file.original_name}" ?`, { danger: true, confirmLabel: 'Supprimer', title: 'Supprimer le fichier' })
        if (ok) {
          try {
            await api.delete(`/files/${file.id}`)
            queryClient.invalidateQueries({ queryKey })
            toast.success(`"${file.original_name}" déplacé dans la corbeille`)
          } catch (err) { toast.error(err.response?.data?.error || 'Erreur lors de la suppression') }
        }
        break
      }
      case 'toggle-link':
        try {
          await api.post(`/files/${file.id}/toggle-link`)
          queryClient.invalidateQueries({ queryKey })
        } catch { toast.error('Erreur lors de la modification du lien') }
        break
      case 'favorite':
        try {
          await api.post(`/files/${file.id}/favorite`)
          queryClient.invalidateQueries({ queryKey })
        } catch { toast.error('Erreur') }
        break
      case 'unfavorite':
        try {
          await api.delete(`/files/${file.id}/favorite`)
          queryClient.invalidateQueries({ queryKey })
        } catch { toast.error('Erreur') }
        break
      case 'restore':
        try {
          await api.post(`/files/${file.id}/restore`)
          queryClient.invalidateQueries({ queryKey: ['files'] })
          toast.success('Fichier restauré')
        } catch { toast.error('Erreur lors de la restauration') }
        break
      case 'delete-permanent': {
        const ok = await confirm(
          `Supprimer définitivement "${file.original_name}" ? Cette action est irréversible.`,
          { danger: true, confirmLabel: 'Supprimer définitivement', title: 'Suppression permanente' }
        )
        if (ok) {
          try {
            await api.delete(`/files/${file.id}/permanent`)
            queryClient.invalidateQueries({ queryKey })
            toast.success('Fichier supprimé définitivement')
          } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
        }
        break
      }
      case 'rename': {
        setRenameModal({ file, action: 'rename', initialValue: file.original_name })
        break
      }
      case 'info':
        setSelectedFile(file)
        break
      case 'download': {
        try {
          const res = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
          const url = URL.createObjectURL(new Blob([res.data], { type: file.mime_type }))
          const a = document.createElement('a')
          a.href = url
          a.download = file.original_name
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch { toast.error('Erreur lors du téléchargement') }
        break
      }
      case 'copy-link':
        navigator.clipboard
          .writeText(`${window.location.origin}/media/${file.link_token}`)
          .then(() => toast.success('Lien copié dans le presse-papiers'))
          .catch(() => toast.error('Impossible de copier le lien'))
        break
      default:
        console.warn('[Explorer] Action inconnue:', action)
    }
  }, [queryClient, queryKey, folderId, parentFolderId])

  const handleRenameSubmit = useCallback(async (newName) => {
    const { file, action } = renameModal
    setRenameModal(null)
    if (action === 'rename-folder') {
      if (newName === file.name) return
      try {
        await api.patch(`/files/folders/${file.id}`, { name: newName })
        queryClient.invalidateQueries({ queryKey: ['folders', folderId] })
        queryClient.invalidateQueries({ queryKey: ['folders', parentFolderId ?? null] })
        queryClient.invalidateQueries({ queryKey: ['breadcrumb', folderId] })
        toast.success('Dossier renommé')
      } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
    } else {
      if (newName === file.original_name) return
      try {
        await api.patch(`/files/${file.id}`, { name: newName })
        queryClient.invalidateQueries({ queryKey })
        toast.success('Fichier renommé')
      } catch (err) { toast.error(err.response?.data?.error || 'Erreur lors du renommage') }
    }
  }, [renameModal, queryClient, queryKey, folderId, parentFolderId])

  const handleFolderDeleteConfirm = useCallback(async (moveToTrash) => {
    const { file } = folderDeleteModal
    setFolderDeleteModal(null)
    try {
      await api.delete(`/files/folders/${file.id}?moveToTrash=${moveToTrash}`)
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['folders', folderId] })
      queryClient.invalidateQueries({ queryKey: ['folders', parentFolderId ?? null] })
      toast.success(`Dossier "${file.name}" supprimé`)
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }, [folderDeleteModal, queryClient, folderId, parentFolderId])

  const handleZipDownload = async () => {
    if (selectedFiles.length === 0) return
    try {
      const response = await api.post('/files/zip', { fileIds: selectedFiles }, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'archive.zip'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Archive ZIP téléchargée')
    } catch { toast.error('Erreur lors de la création du ZIP') }
  }

  const toggleSelectFile = useCallback((id) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }, [])

  const clearSelection = () => setSelectedFiles([])

  const handleBulkDelete = async () => {
    const ok = await confirm(`Supprimer ${selectedFiles.length} fichier(s) ?`, { danger: true, confirmLabel: 'Supprimer', title: 'Suppression multiple' })
    if (!ok) return
    await Promise.all(selectedFiles.map((id) => api.delete(`/files/${id}`).catch(() => {})))
    toast.success(`${selectedFiles.length} fichier(s) déplacé(s) dans la corbeille`)
    clearSelection()
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['folders', folderId] })
  }

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

  const viewLabels = { mine: 'Mon espace', others: 'Espace commun', recent: 'Récents', favorites: 'Favoris', trash: 'Corbeille' }
  const hasDateFilter = dateFrom || dateTo

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={customCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full" onClick={() => setContextMenu(null)}>
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 shrink-0">{viewLabels[view] || 'Explorateur'}</h2>
            <Breadcrumb chain={breadcrumbChain} folderId={folderId} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-slate-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg px-3 py-1.5">
              <Search size={14} className="text-slate-400 dark:text-gray-500" />
              <input
                placeholder="Rechercher..."
                className="bg-transparent text-sm text-slate-700 dark:text-gray-300 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none w-36"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

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
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl shadow-xl z-40 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-slate-600 dark:text-gray-400">Filtrer par date</p>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-gray-500 mb-1">Depuis</label>
                    <input type="date" className="input w-full text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-gray-500 mb-1">Jusqu'au</label>
                    <input type="date" className="input w-full text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                  {hasDateFilter && (
                    <button onClick={clearDateFilter} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors">
                      <X size={12} /> Effacer le filtre
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex bg-white border border-slate-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100'}`}><Grid3X3 size={16} /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100'}`}><List size={16} /></button>
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder()
                        if (e.key === 'Escape') { setNewFolderMode(false); setNewFolderName('') }
                      }}
                      autoFocus
                    />
                    <button onClick={handleCreateFolder} className="btn-primary text-sm py-1.5">Créer</button>
                    <button onClick={() => { setNewFolderMode(false); setNewFolderName('') }} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"><X size={15} /></button>
                  </div>
                ) : (
                  <button onClick={() => setNewFolderMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                    <FolderPlus size={14} /> Dossier
                  </button>
                )}
                <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2 text-sm py-1.5">
                  <Upload size={15} /> Uploader
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
            <button onClick={handleZipDownload} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              <Download size={12} /> Télécharger en ZIP
            </button>
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              <Trash2 size={12} /> Supprimer ({selectedFiles.length})
            </button>
            <button onClick={clearSelection} className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300">
              Désélectionner
            </button>
          </div>
        )}

        {/* Contenu */}
        {isLoading ? (
          <div className="flex-1 overflow-auto">
            {viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {viewMode === 'grid' ? (
              <FileGrid
                files={data?.files || []}
                folders={view === 'mine' ? (folders || []) : []}
                onFileClick={(f) => setSelectedFile(f)}
                onContextMenu={handleContextMenu}
                isTrash={view === 'trash'}
                selectedFiles={selectedFiles}
                onToggleSelect={toggleSelectFile}
                onAction={handleFileAction}
                parentFolderId={view === 'mine' ? parentFolderId : undefined}
                onNavigateUp={handleNavigateUp}
                draggingIds={activeDrag?.count > 1 ? selectedFiles : activeDrag ? [activeDrag.fileId] : []}
              />
            ) : (
              <FileList
                files={data?.files || []}
                folders={view === 'mine' ? (folders || []) : []}
                onFileClick={(f) => setSelectedFile(f)}
                onContextMenu={handleContextMenu}
                isTrash={view === 'trash'}
                selectedFiles={selectedFiles}
                onToggleSelect={toggleSelectFile}
                parentFolderId={view === 'mine' ? parentFolderId : undefined}
                onNavigateUp={handleNavigateUp}
                draggingIds={activeDrag?.count > 1 ? selectedFiles : activeDrag ? [activeDrag.fileId] : []}
              />
            )}

            {/* Overlay de drag — thumbnail réel + badge si multi-fichiers */}
            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeDrag && (
                activeDrag.count > 1 ? (
                  // Multi-drag : effet de pile + badge
                  <div className="relative select-none" style={{ width: 144 }}>
                    <div className="absolute inset-0 translate-x-2 translate-y-2 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 opacity-50 rotate-2" />
                    <div className="absolute inset-0 translate-x-1 translate-y-1 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 opacity-75 rotate-1" />
                    <div className="relative bg-white dark:bg-gray-900 rounded-xl border-2 border-violet-500 shadow-2xl overflow-hidden">
                      <div className="h-20 bg-slate-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        {activeDrag.file?.thumbnail_path
                          ? <img src={activeDrag.file.thumbnail_path} alt="" className="w-full h-full object-cover opacity-70" />
                          : <FileTypeIcon mime={activeDrag.file?.mime_type} size={24} />
                        }
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">{activeDrag.count} fichiers</p>
                      </div>
                    </div>
                    <div className="absolute -top-2 -right-2 bg-violet-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg z-10">
                      {activeDrag.count}
                    </div>
                  </div>
                ) : (
                  // Fichier unique : thumbnail réel
                  <div className="select-none bg-white dark:bg-gray-900 rounded-xl border-2 border-violet-500 shadow-2xl overflow-hidden opacity-95" style={{ width: 144 }}>
                    <div className="h-20 bg-slate-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                      {activeDrag.file?.thumbnail_path
                        ? <img src={activeDrag.file.thumbnail_path} alt="" className="w-full h-full object-cover" />
                        : <FileTypeIcon mime={activeDrag.file?.mime_type} size={24} />
                      }
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-slate-700 dark:text-gray-300 truncate font-medium">
                        {activeDrag.file?.original_name || 'Fichier'}
                      </p>
                    </div>
                  </div>
                )
              )}
            </DragOverlay>
          </div>
        )}

        {showUpload && (
          <UploadPanel
            folderId={folderId}
            onClose={() => setShowUpload(false)}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey })
              setShowUpload(false)
              useAuthStore.getState().fetchMe().catch(() => {}) // rafraîchir l'espace utilisé
            }}
          />
        )}

        {selectedFile && (
          <FileViewer file={selectedFile} onClose={() => setSelectedFile(null)} onAction={handleFileAction} />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x} y={contextMenu.y}
            file={contextMenu.file}
            isTrash={view === 'trash'}
            onAction={handleFileAction}
            onClose={() => setContextMenu(null)}
          />
        )}

        {renameModal && (
          <RenameModal
            initial={renameModal.initialValue}
            onConfirm={handleRenameSubmit}
            onCancel={() => setRenameModal(null)}
          />
        )}

        {folderDeleteModal && (
          <FolderDeleteModal
            folderName={folderDeleteModal.file.name}
            stats={folderDeleteModal.stats}
            onConfirm={handleFolderDeleteConfirm}
            onCancel={() => setFolderDeleteModal(null)}
          />
        )}
      </div>
    </DndContext>
  )
}
