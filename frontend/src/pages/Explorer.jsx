import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { AnimatePresence, motion } from 'framer-motion'
import {
  HardDrive, Globe, Clock, Heart, Trash2, Search, Upload, FolderPlus, CloudUpload, Info,
  FolderOpen, SearchX, Sparkles, ArrowDown, ArrowUp,
} from 'lucide-react'
import api from '../utils/api.js'
import { cn } from '../lib/cn.js'
import { dateGroupLabel, pluralize } from '../lib/format.js'
import { startUpload, pickFiles, createFolder, copyFileLink } from '../lib/actions.js'
import { useAuthStore, usePermission } from '../stores/auth.store.js'
import { usePreferencesStore, GRID_SIZES } from '../stores/preferences.store.js'
import { useUiStore } from '../stores/ui.store.js'
import { useDebounce } from '../hooks/useDebounce.js'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { useIsTouch } from '../hooks/useMediaQuery.js'
import { useDndBridge } from '../components/shared/DndProvider.jsx'
import { FileCard, FolderCard, ItemRow, LIST_COLUMNS } from '../components/explorer/Items.jsx'
import Breadcrumbs from '../components/explorer/Breadcrumbs.jsx'
import SelectionBar from '../components/explorer/SelectionBar.jsx'
import { Toolbar } from '../components/explorer/Toolbar.jsx'
import { useLasso } from '../components/explorer/useLasso.js'
import {
  fileMenu, folderMenu, selectionMenu, backgroundMenu, moveItems, trashFiles, deleteForever,
  deleteFolders, renameFile, renameFolder, setFavorite, openMoveDialog, emptyTrash,
} from '../components/explorer/itemActions.js'
import { ContextMenu } from '../components/ui/Menu.jsx'
import { Button } from '../components/ui/Button.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'
import { Checkbox } from '../components/ui/Form.jsx'

// Visionneuse chargée à la première ouverture (zoom / pincement)
const MediaViewer = lazy(() => import('../components/viewer/MediaViewer.jsx'))

const PAGE_SIZE = 60

const VIEWS = {
  mine: { title: 'Mon espace', icon: HardDrive },
  others: { title: 'Espace commun', icon: Globe, desc: 'Les fichiers partagés par tous les membres.' },
  recent: { title: 'Récents', icon: Clock, desc: 'Vos 20 derniers fichiers ajoutés ou modifiés.' },
  favorites: { title: 'Favoris', icon: Heart, desc: 'Vos fichiers marqués d’un cœur.' },
  trash: { title: 'Corbeille', icon: Trash2, desc: 'Les fichiers sont supprimés définitivement après 48 h.' },
  search: { title: 'Recherche', icon: Search },
}

function GridSkeleton({ size }) {
  return (
    <div className="grid gap-x-1.5 gap-y-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${size}px, calc(33% - 4px)), 1fr))` }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="aspect-square" style={{ animationDelay: `${i * 40}ms` }} />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="hidden h-3 w-24 md:block" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children, right, onSelectAll, allSelected, someSelected }) {
  return (
    <div className="group/sec mb-3 flex items-baseline gap-3 border-b border-line pb-2">
      <h3 className="text-sm text-fg">{children}</h3>
      {right && <span className="font-mono text-[11px] text-subtle">{right}</span>}
      {onSelectAll && (
        <span className={cn('transition-opacity', allSelected || someSelected ? 'opacity-100' : 'opacity-0 group-hover/sec:opacity-100 [@media(hover:none)]:opacity-100')} title="Sélectionner le groupe">
          <Checkbox round checked={allSelected} indeterminate={someSelected && !allSelected} onChange={onSelectAll} />
        </span>
      )}
    </div>
  )
}

export default function Explorer() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { folderId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const viewParam = searchParams.get('view')
  const view = VIEWS[viewParam] ? viewParam : 'mine'
  const q = searchParams.get('q') || ''
  const openFileId = searchParams.get('file')
  const isTrash = view === 'trash'
  const paged = view === 'mine' || view === 'others' || view === 'search'

  const { viewMode, gridSize, setGridSize, groupByDate, sortBy, sortDir, setSort, showNames, clickToOpen, setViewMode } = usePreferencesStore()
  const user = useAuthStore((s) => s.user)
  const can = usePermission()
  const isTouch = useIsTouch()
  const bridge = useDndBridge()
  const setCurrentFolder = useUiStore((s) => s.setCurrentFolder)

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState('')
  const debouncedFilter = useDebounce(filter.trim(), 250)
  const [type, setType] = useState('all')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const hasFilters = !!debouncedFilter || type !== 'all' || !!dateRange.from || !!dateRange.to
  const clearFilters = () => { setFilter(''); setType('all'); setDateRange({ from: '', to: '' }) }

  useEffect(() => { clearFilters() }, [view, folderId])

  // ── Données ────────────────────────────────────────────────────────────────
  const filesQuery = useInfiniteQuery({
    queryKey: ['files', view, folderId ?? null, view === 'search' ? q : debouncedFilter, type, dateRange.from, dateRange.to, sortBy, sortDir],
    queryFn: async ({ pageParam }) => {
      const params = { view: view === 'others' ? 'others' : 'mine', page: pageParam, limit: PAGE_SIZE, sortBy, sortDir }
      if (view === 'mine' && folderId) params.folderId = folderId
      if (view === 'search') { params.global = 'true'; params.search = q }
      else if (debouncedFilter) params.search = debouncedFilter
      if (type !== 'all') params.type = type
      if (dateRange.from) params.from = dateRange.from
      if (dateRange.to) params.to = dateRange.to
      const { data } = await api.get('/files', { params })
      return data
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: paged && (view !== 'search' || q.length > 0),
  })

  const listQuery = useQuery({
    queryKey: ['files', view],
    queryFn: async () => (await api.get(`/files/${view}`)).data,
    enabled: !paged,
  })

  const foldersQuery = useQuery({
    queryKey: ['folders', folderId ?? null],
    queryFn: () => api.get('/files/folders', { params: { parentId: folderId } }).then((r) => r.data),
    enabled: view === 'mine',
  })

  const { data: chain = [] } = useQuery({
    queryKey: ['breadcrumb', folderId],
    queryFn: () => api.get(`/files/folders/${folderId}/breadcrumb`).then((r) => r.data).catch(() => []),
    enabled: !!folderId && view === 'mine',
  })
  const currentFolder = folderId ? chain[chain.length - 1] : null

  // Destination des envois / nouveaux dossiers
  useEffect(() => {
    setCurrentFolder(view === 'mine' && folderId
      ? { id: folderId, name: currentFolder?.name || 'Dossier' }
      : { id: null, name: 'Mon espace' })
  }, [view, folderId, currentFolder?.name])
  useEffect(() => () => setCurrentFolder({ id: null, name: 'Mon espace' }), [])

  const files = useMemo(() => {
    let list
    if (paged) list = filesQuery.data?.pages.flatMap((p) => p.files) || []
    else {
      list = listQuery.data || []
      const needle = debouncedFilter.toLowerCase()
      if (needle) list = list.filter((f) => f.original_name.toLowerCase().includes(needle))
      if (type !== 'all') list = list.filter((f) => f.mime_type?.startsWith(`${type}/`))
      if (dateRange.from) list = list.filter((f) => f.created_at.slice(0, 10) >= dateRange.from)
      if (dateRange.to) list = list.filter((f) => f.created_at.slice(0, 10) <= dateRange.to)
      if (view === 'favorites') {
        const dir = sortDir === 'asc' ? 1 : -1
        list = [...list].sort((a, b) => {
          if (sortBy === 'original_name') return dir * a.original_name.localeCompare(b.original_name, 'fr')
          if (sortBy === 'size') return dir * (Number(a.size) - Number(b.size))
          return dir * (new Date(a.created_at) - new Date(b.created_at))
        })
      }
    }
    return list.map((f) => ({ ...f, kind: 'file', key: `f:${f.id}` }))
  }, [paged, filesQuery.data, listQuery.data, debouncedFilter, type, dateRange, view, sortBy, sortDir])

  const folders = useMemo(() => {
    if (view !== 'mine' || type !== 'all' || dateRange.from || dateRange.to) return []
    let list = foldersQuery.data || []
    if (debouncedFilter) list = list.filter((f) => f.name.toLowerCase().includes(debouncedFilter.toLowerCase()))
    if (sortBy === 'original_name' && sortDir === 'desc') list = [...list].reverse()
    return list.map((f) => ({ ...f, kind: 'folder', key: `d:${f.id}` }))
  }, [foldersQuery.data, view, type, dateRange, debouncedFilter, sortBy, sortDir])

  const items = useMemo(() => [...folders, ...files], [folders, files])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const total = paged ? (filesQuery.data?.pages[0]?.total ?? files.length) + folders.length : items.length
  const isLoading = paged ? filesQuery.isLoading && (view !== 'search' || !!q) : listQuery.isLoading
  const loadingFolders = view === 'mine' && foldersQuery.isLoading

  // ── Sélection ──────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState(() => new Set())
  const [focusKey, setFocusKey] = useState(null)
  const [touchSelect, setTouchSelect] = useState(false)
  const anchorRef = useRef(null)
  const lassoBase = useRef(new Set())
  const selectionMode = selected.size > 0 || touchSelect

  useEffect(() => { setSelected(new Set()); setFocusKey(null); setTouchSelect(false); anchorRef.current = null }, [view, folderId, q])
  // Retirer de la sélection ce qui a disparu (supprimé, déplacé…)
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev
      const keys = new Set(items.map((i) => i.key))
      const next = new Set([...prev].filter((k) => keys.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [items])

  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.key)), [items, selected])
  const clearSelection = useCallback(() => { setSelected(new Set()); setTouchSelect(false) }, [])
  const selectAll = useCallback(() => setSelected(new Set(itemsRef.current.map((i) => i.key))), [])

  const rangeSelect = (toKey, additive) => {
    const keys = itemsRef.current.map((i) => i.key)
    const a = keys.indexOf(anchorRef.current ?? toKey)
    const b = keys.indexOf(toKey)
    const [s, e] = a < b ? [a, b] : [b, a]
    const range = keys.slice(s, e + 1)
    setSelected((prev) => new Set(additive ? [...prev, ...range] : range))
  }

  // ── Visionneuse (état dans l'URL : le bouton retour la ferme) ─────────────
  const [viewerInfo, setViewerInfo] = useState(false)
  const openViewer = useCallback((id, { info = false } = {}) => {
    setViewerInfo(info)
    const sp = new URLSearchParams(window.location.search)
    sp.set('file', id)
    navigate({ search: sp.toString() }, { state: { viewer: true } })
  }, [navigate])
  const closeViewer = useCallback(() => {
    if (location.state?.viewer) navigate(-1)
    else {
      const sp = new URLSearchParams(window.location.search)
      sp.delete('file')
      setSearchParams(sp, { replace: true })
    }
  }, [location.state, navigate, setSearchParams])
  const navigateViewer = useCallback((id) => {
    const sp = new URLSearchParams(window.location.search)
    sp.set('file', id)
    setSearchParams(sp, { replace: true, state: location.state })
  }, [location.state, setSearchParams])

  const inList = !!openFileId && files.some((f) => f.id === openFileId)
  const { data: singleFile } = useQuery({
    queryKey: ['file', openFileId],
    queryFn: () => api.get(`/files/${openFileId}`).then((r) => r.data),
    enabled: !!openFileId && !inList && !isLoading,
  })
  const viewerFiles = inList ? files : singleFile ? [{ ...singleFile, kind: 'file', key: `f:${singleFile.id}` }] : []

  const openItem = useCallback((item) => {
    if (item.kind === 'folder') navigate(`/explorer/${item.id}`)
    else openViewer(item.id)
  }, [navigate, openViewer])

  // ── Interactions (références stables pour les cartes mémoïsées) ──────────
  const pointerType = useRef('mouse')
  const lastContext = useRef(0)
  const lastDragEnd = useRef(0)
  const live = useRef({})
  live.current = { selected, clickToOpen, openItem, selectionMode }

  const handlers = useMemo(() => ({
    showOwner: view !== 'mine',
    userId: user?.id,
    bind: (item) => ({
      onPointerDown: (e) => {
        pointerType.current = e.pointerType
        // Tactile : l'appui long ne doit ouvrir que le menu de l'élément, pas aussi celui du fond
        if (e.pointerType !== 'mouse') e.stopPropagation()
      },
      onClick: (e) => {
        if (Date.now() - lastContext.current < 600 || Date.now() - lastDragEnd.current < 250) return
        const { clickToOpen: cto, openItem: open, selectionMode: selMode } = live.current
        if (pointerType.current === 'touch') {
          if (selMode) toggle(item)
          else open(item)
          return
        }
        if (e.shiftKey) { rangeSelect(item.key, e.ctrlKey || e.metaKey); setFocusKey(item.key); return }
        if (e.ctrlKey || e.metaKey) { toggle(item); return }
        if (cto) { open(item); return }
        setSelected(new Set([item.key]))
        anchorRef.current = item.key
        setFocusKey(item.key)
      },
      onDoubleClick: () => {
        if (pointerType.current === 'touch' || live.current.clickToOpen) return
        live.current.openItem(item)
      },
    }),
    toggle: (item) => toggle(item),
    onContext: (item) => {
      lastContext.current = Date.now()
      setFocusKey(item.key)
      // Clic droit sur un élément hors sélection : il devient la sélection (comme Windows / Finder)
      if (pointerType.current !== 'touch' && !live.current.selected.has(item.key)) {
        setSelected(new Set([item.key]))
        anchorRef.current = item.key
      }
    },
  }), [view, user?.id])

  function toggle(item) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(item.key) ? next.delete(item.key) : next.add(item.key)
      return next
    })
    anchorRef.current = item.key
    setFocusKey(item.key)
  }

  const menuCtx = {
    can,
    userId: user?.id,
    isSuperAdmin: user?.is_super_admin,
    isTrash,
    view,
    open: (f) => openViewer(f.id),
    info: (f) => openViewer(f.id, { info: true }),
    openFolder: (f) => navigate(`/explorer/${f.id}`),
    select: (it) => { setSelected((prev) => new Set(prev).add(it.key)); if (isTouch) setTouchSelect(true) },
    clearSelection,
    selectAll,
    viewMode, setViewMode, sortBy, sortDir, setSort,
    itemCount: items.length,
  }
  const menuRef = useRef(null)
  menuRef.current = (item) => {
    if (selected.has(item.key) && selected.size > 1) return selectionMenu(selectedItems, menuCtx)
    return item.kind === 'folder' ? folderMenu(item, menuCtx) : fileMenu(item, menuCtx)
  }
  const getMenu = useCallback((item) => menuRef.current(item), [])

  // ── Glisser-déposer interne (vers dossiers, fil d'Ariane, barre latérale) ─
  const [draggingKeys, setDraggingKeys] = useState(null)
  const dragGroup = useRef([])
  useEffect(() => bridge?.register({
    onDragStart: (e) => {
      const key = e.active.data.current?.key
      const item = itemsRef.current.find((i) => i.key === key)
      if (!item) return
      const sel = live.current.selected
      const group = sel.has(key) ? itemsRef.current.filter((i) => sel.has(i.key)) : [item]
      dragGroup.current = group
      setDraggingKeys(new Set(group.map((g) => g.key)))
      bridge.setPreview({ item, count: group.length })
    },
    onDragEnd: async (e) => {
      lastDragEnd.current = Date.now()
      setDraggingKeys(null)
      const over = e.over?.data.current
      if (over?.type !== 'folder') return
      const group = dragGroup.current.filter((g) => !(g.kind === 'folder' && g.id === over.folderId))
      if (!group.length) return
      const moved = await moveItems(group, over.folderId)
      if (moved) setSelected(new Set())
    },
  }), [bridge])

  // ── Défilement, lasso, pincement ───────────────────────────────────────────
  const scrollRef = useRef(null)
  const lasso = useLasso(scrollRef, {
    enabled: !isTouch,
    onStart: (additive) => { lassoBase.current = additive ? new Set(live.current.selected) : new Set() },
    onSelect: useCallback((keys) => setSelected(new Set([...lassoBase.current, ...keys])), []),
    onClear: useCallback(() => { setSelected(new Set()); setFocusKey(null) }, []),
  })

  // Pincer sur le pavé tactile (ou Ctrl + molette) : taille des vignettes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let acc = 0
    const onWheel = (e) => {
      if (!e.ctrlKey || usePreferencesStore.getState().viewMode !== 'grid') return
      e.preventDefault()
      acc += e.deltaY
      if (Math.abs(acc) > 60) {
        const cur = usePreferencesStore.getState().gridSize
        setGridSize(cur + (acc < 0 ? 1 : -1))
        acc = 0
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Défilement infini
  const sentinelRef = useRef(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !paged) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && filesQuery.hasNextPage && !filesQuery.isFetchingNextPage) filesQuery.fetchNextPage()
    }, { root: scrollRef.current, rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [paged, filesQuery.hasNextPage, filesQuery.isFetchingNextPage, items.length])

  // ── Clavier ────────────────────────────────────────────────────────────────
  const filterRef = useRef(null)
  const moveFocus = (dir, extend) => {
    const list = itemsRef.current
    if (!list.length) return
    const keys = list.map((i) => i.key)
    const current = focusKey && keys.includes(focusKey) ? focusKey : null
    let next
    if (!current) next = keys[0]
    else if (viewMode === 'list' || dir === 'left' || dir === 'right') {
      const step = dir === 'left' || dir === 'up' ? -1 : 1
      next = keys[Math.max(0, Math.min(keys.length - 1, keys.indexOf(current) + step))]
    } else {
      // Grille : élément visuellement au-dessus / en dessous (fonctionne avec les groupes par date)
      const root = scrollRef.current
      const curEl = root.querySelector(`[data-key="${CSS.escape(current)}"]`)
      const cr = curEl.getBoundingClientRect()
      const cx = cr.left + cr.width / 2
      let best = null
      let bestScore = Infinity
      for (const node of root.querySelectorAll('[data-key]')) {
        if (node === curEl) continue
        const r = node.getBoundingClientRect()
        const below = r.top >= cr.bottom - 4
        const above = r.bottom <= cr.top + 4
        if ((dir === 'down' && !below) || (dir === 'up' && !above)) continue
        const dy = dir === 'down' ? r.top - cr.bottom : cr.top - r.bottom
        const score = dy * 4 + Math.abs(r.left + r.width / 2 - cx)
        if (score < bestScore) { bestScore = score; best = node.dataset.key }
      }
      next = best || current
    }
    setFocusKey(next)
    if (extend) rangeSelect(next, false)
    else { setSelected(new Set([next])); anchorRef.current = next }
    scrollRef.current?.querySelector(`[data-key="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const targets = () => {
    if (selectedItems.length) return selectedItems
    const f = items.find((i) => i.key === focusKey)
    return f ? [f] : []
  }

  useHotkeys({
    'mod+a': () => selectAll(),
    'mod+c': () => {
      const t = targets()
      if (t.length !== 1 || t[0].kind !== 'file' || window.getSelection()?.toString()) return false
      copyFileLink(t[0])
    },
    escape: () => (selected.size || touchSelect ? clearSelection() : false),
    arrowright: (e) => moveFocus('right', e.shiftKey),
    arrowleft: (e) => moveFocus('left', e.shiftKey),
    arrowdown: (e) => moveFocus('down', e.shiftKey),
    arrowup: (e) => moveFocus('up', e.shiftKey),
    enter: () => { const t = targets(); if (t.length === 1) openItem(t[0]); else return false },
    space: () => { const t = targets().find((i) => i.kind === 'file'); if (t) openViewer(t.id); else return false },
    f2: () => {
      const t = targets()
      if (t.length !== 1 || isTrash) return
      t[0].kind === 'folder' ? renameFolder(t[0]) : renameFile(t[0])
    },
    delete: () => {
      const t = targets()
      if (!t.length) return false
      const fs = t.filter((i) => i.kind === 'file')
      const ds = t.filter((i) => i.kind === 'folder')
      if (isTrash) return deleteForever(fs)
      if (fs.length) trashFiles(fs)
      if (ds.length) deleteFolders(ds)
    },
    backspace: (e) => {
      // Cmd+Retour arrière (macOS) ou Retour arrière : même action que Suppr
      const t = targets()
      if (!t.length) return false
      if (isTrash) return deleteForever(t.filter((i) => i.kind === 'file'))
      const fs = t.filter((i) => i.kind === 'file')
      if (fs.length) trashFiles(fs)
      const ds = t.filter((i) => i.kind === 'folder')
      if (ds.length) deleteFolders(ds)
      e.preventDefault()
    },
    m: () => { const t = targets(); if (t.length && view === 'mine' && can('files.rename_move')) openMoveDialog(t) },
    f: () => { const fs = targets().filter((i) => i.kind === 'file'); if (fs.length && !isTrash) setFavorite(fs, !fs.every((x) => x.is_favorite)) },
    i: () => { const t = targets().find((i) => i.kind === 'file'); if (t) openViewer(t.id, { info: true }) },
    v: () => setViewMode(viewMode === 'grid' ? 'list' : 'grid'),
    '/': () => filterRef.current?.focus(),
  })

  // ── Dépôt de fichiers depuis l'ordinateur ──────────────────────────────────
  const canUploadHere = can('files.upload') && !isTrash
  const uploadTarget = view === 'mine' && folderId ? { id: folderId, name: currentFolder?.name || 'Dossier' } : { id: null, name: 'Mon espace' }
  const { getRootProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    disabled: !canUploadHere,
    onDrop: (accepted, rejected) => startUpload([...accepted, ...rejected.map((r) => r.file)], uploadTarget),
  })

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const meta = VIEWS[view]
  const gridMin = GRID_SIZES[gridSize] || GRID_SIZES[2]
  const grouped = viewMode === 'grid' && groupByDate && sortBy === 'created_at' && !isTrash && view !== 'recent'

  const fileGroups = useMemo(() => {
    if (!grouped) return [{ label: null, items: files }]
    const groups = []
    for (const f of files) {
      const label = dateGroupLabel(f.created_at)
      const last = groups[groups.length - 1]
      if (last?.label === label) last.items.push(f)
      else groups.push({ label, items: [f] })
    }
    return groups
  }, [files, grouped])

  const isDraggable = (item) =>
    !isTouch && !isTrash && can('files.rename_move') && (item.kind === 'folder' || item.owner_id === user?.id || user?.is_super_admin)

  const cardProps = (item) => ({
    item,
    selected: selected.has(item.key),
    focused: focusKey === item.key,
    selectionMode,
    dimmed: draggingKeys?.has(item.key),
    handlers,
    getMenu,
    isTrash,
    draggable: isDraggable(item),
  })

  const gridStyle = (min) => ({ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, calc(33% - 4px)), 1fr))` })

  const empty = !isLoading && !loadingFolders && items.length === 0
  const countLabel = items.length
    ? [folders.length && pluralize(folders.length, 'dossier'), (paged ? total - folders.length : files.length) > 0 && pluralize(paged ? total - folders.length : files.length, 'fichier')].filter(Boolean).join(' · ')
    : null

  const emptyState = () => {
    if (view === 'search' && !q) return <EmptyState title="Que cherchez-vous ?" description="Tapez un nom de fichier dans la recherche (Ctrl K)." />
    if (hasFilters || view === 'search') {
      return (
        <EmptyState label="0 résultat" title="Rien ne correspond" description={view === 'search' ? `Aucun fichier ne contient « ${q} ».` : 'Aucun élément ne correspond à ces filtres.'}
          action={hasFilters && <Button variant="secondary" onClick={clearFilters}>Effacer les filtres</Button>} />
      )
    }
    if (view === 'trash') return <EmptyState label="Corbeille" title="La corbeille est vide" description="Les fichiers supprimés y restent 48 h, puis sont effacés." />
    if (view === 'favorites') return <EmptyState label="Favoris" title="Aucun favori" description="Appuyez sur F sur un fichier pour le garder ici." />
    if (view === 'recent') return <EmptyState label="Récents" title="Rien de récent" description="Vos derniers fichiers apparaîtront ici." />
    if (view === 'others') return <EmptyState label="Commun" title="Aucun fichier partagé" description="Les fichiers des autres membres apparaîtront ici." />
    return (
      <EmptyState
        label={folderId ? 'Dossier vide' : 'Aucun fichier'}
        title={folderId ? 'Ce dossier est vide' : 'Commencez par importer'}
        description={can('files.upload') ? 'Déposez des photos ou des vidéos n’importe où sur cette page.' : 'Aucun fichier pour le moment.'}
        action={
          <>
            {can('files.upload') && <Button onClick={() => pickFiles()}>Importer des fichiers</Button>}
            {can('files.create_folder') && <Button variant="secondary" onClick={() => createFolder()}>Nouveau dossier</Button>}
          </>
        }
      />
    )
  }

  const renderListHeader = () => {
    const sortBtn = (by, label, className) => (
      <button
        onClick={() => setSort(by, sortBy === by && sortDir === 'desc' ? 'asc' : 'desc')}
        className={cn('flex items-center gap-1 text-left hover:text-fg', sortBy === by && 'text-fg', className)}
      >
        {label}
        {sortBy === by && (sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    )
    return (
      <div className={cn('label-mono sticky top-0 z-10 grid items-center gap-3 border-b border-line-strong bg-bg px-2 py-2', LIST_COLUMNS)}>
        <span className="flex justify-center">
          <Checkbox checked={items.length > 0 && selected.size === items.length} indeterminate={selected.size > 0 && selected.size < items.length} onChange={(v) => (v ? selectAll() : clearSelection())} />
        </span>
        {sortBtn('original_name', 'Nom')}
        <span className="hidden xl:block">Propriétaire</span>
        {sortBtn('created_at', isTrash ? 'Suppression' : 'Ajouté', 'hidden md:flex')}
        {sortBtn('size', 'Taille', 'hidden justify-end sm:flex')}
        <span className="hidden xl:block">Type</span>
        <span />
      </div>
    )
  }

  const breadcrumbMenu = currentFolder
    ? () => folderMenu({ ...currentFolder, kind: 'folder' }, menuCtx).filter((i) => i && i.label !== 'Ouvrir' && i.label !== 'Sélectionner')
    : view === 'mine' ? () => backgroundMenu(menuCtx).filter((i) => i && i.type !== 'sub') : undefined

  return (
    <div {...getRootProps({ className: 'relative flex h-full flex-col outline-none' })}>
      {/* En-tête */}
      <div className="shrink-0 space-y-4 border-b border-line px-4 pb-3 pt-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            {view === 'mine' ? (
              <Breadcrumbs
                chain={chain}
                currentMenu={breadcrumbMenu}
                folderMenuFor={(c) => () => folderMenu({ ...c, kind: 'folder' }, menuCtx)}
              />
            ) : (
              <div className="min-w-0">
                <h1 className="truncate text-xl font-medium tracking-[-0.01em] text-fg">
                  {view === 'search' ? (q ? `« ${q} »` : 'Recherche') : meta.title}
                </h1>
                {meta.desc && <p className="mt-0.5 truncate text-[13px] text-muted">{meta.desc}</p>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {view === 'mine' && can('files.create_folder') && (
              <Button variant="secondary" size="sm" onClick={() => createFolder()} className="hidden sm:inline-flex">Nouveau dossier</Button>
            )}
            {view === 'mine' && can('files.upload') && (
              <Button size="sm" onClick={() => pickFiles()} className="hidden sm:inline-flex">Importer</Button>
            )}
            {isTrash && items.length > 0 && (
              <Button size="sm" variant="danger-soft" onClick={() => emptyTrash(items.length)}>Vider la corbeille</Button>
            )}
          </div>
        </div>

        <Toolbar
          ref={filterRef}
          filter={filter}
          setFilter={setFilter}
          type={type}
          setType={setType}
          dateRange={dateRange}
          setDateRange={setDateRange}
          hideFilter={view === 'search'}
          showSort={view !== 'recent' && view !== 'trash'}
          isTouch={isTouch}
          touchSelect={touchSelect}
          setTouchSelect={(v) => { setTouchSelect(v); if (!v) setSelected(new Set()) }}
          countLabel={countLabel}
        />

      </div>

      {/* Contenu défilant : clic droit sur le fond = menu de l'espace, glisser = lasso */}
      <ContextMenu items={() => (selected.size > 1 ? selectionMenu(selectedItems, menuCtx) : backgroundMenu(menuCtx))}>
        <div
          ref={scrollRef}
          onPointerDown={lasso.onPointerDown}
          className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-6 lg:px-8"
        >
          {isLoading || loadingFolders ? (
            viewMode === 'grid' ? <GridSkeleton size={gridMin} /> : <ListSkeleton />
          ) : empty ? (
            emptyState()
          ) : viewMode === 'grid' ? (
            <div className="space-y-8">
              {folders.length > 0 && (
                <section>
                  <SectionTitle right={pluralize(folders.length, 'dossier')}>Dossiers</SectionTitle>
                  <div className="grid gap-2" style={gridStyle(Math.max(gridMin, 180) * 1.1)}>
                    {folders.map((f) => <FolderCard key={f.key} {...cardProps(f)} />)}
                  </div>
                </section>
              )}
              {fileGroups.map((g, gi) => {
                if (!g.items.length) return null
                const groupKeys = g.items.map((i) => i.key)
                const all = groupKeys.every((k) => selected.has(k))
                const some = groupKeys.some((k) => selected.has(k))
                return (
                  <section key={g.label || gi}>
                    {(g.label || folders.length > 0) && (
                      <SectionTitle
                        right={pluralize(g.items.length, 'élément')}
                        allSelected={all}
                        someSelected={some}
                        onSelectAll={() => setSelected((prev) => {
                          const next = new Set(prev)
                          all ? groupKeys.forEach((k) => next.delete(k)) : groupKeys.forEach((k) => next.add(k))
                          return next
                        })}
                      >
                        {g.label || 'Fichiers'}
                      </SectionTitle>
                    )}
                    <div className={cn('grid', showNames ? 'gap-x-1.5 gap-y-4' : 'gap-1')} style={gridStyle(gridMin)}>
                      {g.items.map((f) => <FileCard key={f.key} {...cardProps(f)} showNames={showNames} />)}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div>
              {renderListHeader()}
              <div>
                {items.map((it) => <ItemRow key={it.key} {...cardProps(it)} />)}
              </div>
            </div>
          )}

          {paged && <div ref={sentinelRef} className="h-px" />}
          {filesQuery.isFetchingNextPage && <div className="flex justify-center py-6"><Spinner /></div>}

          {lasso.rect && (
            <div
              className="pointer-events-none absolute z-20 border border-accent-500 bg-accent-500/10"
              style={{ left: lasso.rect.left, top: lasso.rect.top, width: lasso.rect.width, height: lasso.rect.height }}
            />
          )}
        </div>
      </ContextMenu>

      <SelectionBar items={selectedItems} total={items.length} onClear={clearSelection} onSelectAll={selectAll} ctx={menuCtx} />

      {/* Voile de dépôt de fichiers */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center bg-bg/90"
          >
            <div className="absolute inset-4 border border-dashed border-accent-500" />
            <div className="text-center">
              <p className="label-mono !text-accent-500">Déposer</p>
              <p className="mt-2 text-2xl font-medium text-fg">Importer dans « {uploadTarget.name} »</p>
              <p className="mt-1 text-sm text-muted">Images et vidéos uniquement</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {openFileId && viewerFiles.length > 0 && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black"><Spinner /></div>}>
        <MediaViewer
          files={viewerFiles}
          fileId={openFileId}
          isTrash={isTrash}
          initialInfo={viewerInfo}
          onNavigate={navigateViewer}
          onClose={closeViewer}
          onNeedMore={() => filesQuery.hasNextPage && !filesQuery.isFetchingNextPage && filesQuery.fetchNextPage()}
        />
        </Suspense>
      )}
    </div>
  )
}
