import {
  Eye, Download, Link2, Link2Off, Heart, HeartOff, Pencil, Info, Trash2, RotateCcw,
  FolderInput, FolderOpen, FolderPlus, Upload, CheckSquare, Share2, Copy, ExternalLink,
  LayoutGrid, List, ArrowDownAZ, ArrowUpZA, CalendarArrowDown, CalendarArrowUp, HardDrive, XCircle,
} from 'lucide-react'
import api, { apiError } from '../../utils/api.js'
import { queryClient, invalidateFiles } from '../../lib/queryClient.js'
import { confirm, prompt } from '../../stores/confirm.store.js'
import { toast } from '../../stores/toast.store.js'
import { useUiStore } from '../../stores/ui.store.js'
import { useAuthStore } from '../../stores/auth.store.js'
import { MOD } from '../../hooks/useHotkeys.js'
import { downloadFile, downloadZip, copyFileLink, shareFile, createFolder, pickFiles } from '../../lib/actions.js'
import { mediaUrl } from '../../lib/media.js'
import { pluralize } from '../../lib/format.js'

/*
  Actions sur les fichiers et dossiers, indépendantes de React : appelées depuis
  les menus contextuels, la barre de sélection, les raccourcis clavier, la visionneuse
  et la barre latérale. Les actions destructrices proposent « Annuler » dans le toast.
*/

const refreshQuota = () => useAuthStore.getState().fetchMe().catch(() => {})
const bulk = (action, files, extra = {}) =>
  api.post('/files/bulk', { action, fileIds: files.map((f) => f.id), ...extra }).then((r) => r.data)

const nameOf = (files) => (files.length === 1 ? `« ${files[0].original_name} »` : pluralize(files.length, 'fichier'))

// ── Fichiers ─────────────────────────────────────────────────────────────────

export async function renameFile(file) {
  const ext = file.original_name.match(/\.[^.]+$/)?.[0] || ''
  const name = await prompt('Renommer le fichier', { defaultValue: file.original_name, confirmLabel: 'Renommer', selectBaseName: true })
  if (!name || name === file.original_name) return
  // L'extension est conservée si l'utilisateur l'a retirée par mégarde
  const finalName = ext && !/\.[^.]+$/.test(name) ? name + ext : name
  try {
    await api.patch(`/files/${file.id}`, { name: finalName })
    invalidateFiles()
    toast.success('Fichier renommé')
  } catch (err) { toast.error(apiError(err, 'Erreur lors du renommage')) }
}

export async function trashFiles(files) {
  if (!files.length) return
  try {
    const { count, skipped } = await bulk('trash', files)
    invalidateFiles()
    toast.success(`${count > 1 ? `${count} fichiers déplacés` : `${nameOf(files)} déplacé`} dans la corbeille`, {
      action: { label: 'Annuler', onClick: () => restoreFiles(files, { silent: true }) },
    })
    if (skipped) toast.warn(`${skipped} fichier(s) non supprimé(s) : permission insuffisante`)
  } catch (err) { toast.error(apiError(err, 'Erreur lors de la suppression')) }
}

export async function restoreFiles(files, { silent } = {}) {
  try {
    const { count } = await bulk('restore', files)
    invalidateFiles()
    toast.success(silent ? 'Action annulée' : `${pluralize(count, 'fichier restauré', 'fichiers restaurés')}`)
  } catch (err) { toast.error(apiError(err, 'Erreur lors de la restauration')) }
}

export async function deleteForever(files) {
  const ok = await confirm(
    `${nameOf(files)} ${files.length > 1 ? 'seront supprimés' : 'sera supprimé'} définitivement. Cette action est irréversible.`,
    { title: 'Supprimer définitivement ?', danger: true, confirmLabel: 'Supprimer définitivement' }
  )
  if (!ok) return
  try {
    const { count } = await bulk('delete_permanent', files)
    invalidateFiles()
    refreshQuota()
    toast.success(`${pluralize(count, 'fichier supprimé', 'fichiers supprimés')} définitivement`)
  } catch (err) { toast.error(apiError(err)) }
}

export async function emptyTrash(count) {
  const ok = await confirm(
    `${count ? pluralize(count, 'fichier') : 'Tous les fichiers'} de la corbeille seront supprimés définitivement.`,
    { title: 'Vider la corbeille ?', danger: true, confirmLabel: 'Vider la corbeille' }
  )
  if (!ok) return
  try {
    const { data } = await api.delete('/files/trash')
    invalidateFiles()
    refreshQuota()
    toast.success(data.message)
  } catch (err) { toast.error(apiError(err)) }
}

export async function setFavorite(files, value) {
  try {
    await bulk(value ? 'favorite' : 'unfavorite', files)
    invalidateFiles()
    toast.success(value ? `${nameOf(files)} ajouté${files.length > 1 ? 's' : ''} aux favoris` : 'Retiré des favoris')
  } catch (err) { toast.error(apiError(err)) }
}

export async function setLink(files, on) {
  // Mise à jour optimiste des fiches ouvertes : l'interrupteur bascule immédiatement
  const previous = files.map((f) => [f.id, queryClient.getQueryData(['file', f.id])])
  for (const [id, data] of previous) {
    if (data) queryClient.setQueryData(['file', id], { ...data, link_active: on })
  }
  try {
    const { count, skipped } = await bulk(on ? 'link_on' : 'link_off', files)
    const what = count > 1 ? `${count} liens publics` : 'Lien public'
    toast.success(`${what} ${on ? 'activé' : 'désactivé'}${count > 1 ? 's' : ''}`)
    if (skipped) toast.warn(`${skipped} fichier(s) ignoré(s) : permission insuffisante`)
  } catch (err) {
    for (const [id, data] of previous) if (data) queryClient.setQueryData(['file', id], data)
    toast.error(apiError(err))
  } finally {
    invalidateFiles()
  }
}

// ── Dossiers ─────────────────────────────────────────────────────────────────

export async function renameFolder(folder) {
  const name = await prompt('Renommer le dossier', { defaultValue: folder.name, confirmLabel: 'Renommer' })
  if (!name || name === folder.name) return
  try {
    await api.patch(`/files/folders/${folder.id}`, { name })
    invalidateFiles()
    toast.success('Dossier renommé')
  } catch (err) { toast.error(apiError(err)) }
}

export async function deleteFolders(folders) {
  if (!folders.length) return
  try {
    const stats = await Promise.all(folders.map((f) => api.get(`/files/folders/${f.id}/stats`).then((r) => r.data)))
    const total = stats.reduce((acc, s) => ({ fileCount: acc.fileCount + s.fileCount, folderCount: acc.folderCount + s.folderCount }), { fileCount: 0, folderCount: 0 })
    useUiStore.setState({ folderDelete: { folders, stats: total } })
  } catch (err) { toast.error(apiError(err)) }
}

export async function confirmDeleteFolders(folders, moveToTrash) {
  try {
    for (const f of folders) await api.delete(`/files/folders/${f.id}?moveToTrash=${moveToTrash}`)
    invalidateFiles()
    toast.success(folders.length > 1 ? `${folders.length} dossiers supprimés` : `Dossier « ${folders[0].name} » supprimé`)
  } catch (err) { toast.error(apiError(err)) }
}

// ── Déplacement (fichiers et dossiers mélangés) ──────────────────────────────

export async function moveItems(items, targetFolderId, { undoable = true } = {}) {
  const target = targetFolderId || null
  const files = items.filter((i) => i.kind === 'file' && (i.folder_id || null) !== target)
  const folders = items.filter((i) => i.kind === 'folder' && i.id !== target && (i.parent_id || null) !== target)
  if (!files.length && !folders.length) return false
  try {
    if (files.length) await bulk('move', files, { folderId: target })
    for (const f of folders) await api.patch(`/files/folders/${f.id}`, { parentId: target })
    invalidateFiles()
    const count = files.length + folders.length
    toast.success(`${pluralize(count, 'élément déplacé', 'éléments déplacés')}`, undoable ? {
      action: { label: 'Annuler', onClick: () => undoMove(files, folders) },
    } : undefined)
    return true
  } catch (err) {
    invalidateFiles()
    toast.error(apiError(err, 'Erreur lors du déplacement'))
    return false
  }
}

async function undoMove(files, folders) {
  try {
    const byFolder = new Map()
    for (const f of files) {
      const key = f.folder_id || null
      byFolder.set(key, [...(byFolder.get(key) || []), f])
    }
    for (const [folderId, group] of byFolder) await bulk('move', group, { folderId })
    for (const f of folders) await api.patch(`/files/folders/${f.id}`, { parentId: f.parent_id || null })
    invalidateFiles()
    toast.success('Déplacement annulé')
  } catch (err) { toast.error(apiError(err)) }
}

export const openMoveDialog = (items) => useUiStore.setState({ moveDialog: { items } })

// ── Construction des menus (clic droit, « ⋯ », feuille mobile) ───────────────

const sep = { type: 'separator' }

export function fileMenu(file, ctx) {
  const can = ctx.can
  const own = file.owner_id === ctx.userId || ctx.isSuperAdmin
  if (ctx.isTrash) {
    return [
      { label: 'Restaurer', icon: RotateCcw, onSelect: () => restoreFiles([file]) },
      sep,
      { label: 'Supprimer définitivement', icon: XCircle, danger: true, onSelect: () => deleteForever([file]) },
    ]
  }
  return [
    { label: 'Ouvrir', icon: Eye, shortcut: '↵', onSelect: () => ctx.open(file) },
    { label: 'Ouvrir dans un nouvel onglet', icon: ExternalLink, onSelect: () => window.open(mediaUrl(file), '_blank', 'noopener') },
    { label: 'Télécharger', icon: Download, onSelect: () => downloadFile(file) },
    sep,
    { label: 'Copier le lien public', icon: Copy, shortcut: `${MOD}+C`, onSelect: () => copyFileLink(file) },
    navigator.share && { label: 'Partager…', icon: Share2, onSelect: () => shareFile(file) },
    own && can('files.toggle_link') && (file.link_active
      ? { label: 'Désactiver le lien public', icon: Link2Off, onSelect: () => setLink([file], false) }
      : { label: 'Activer le lien public', icon: Link2, onSelect: () => setLink([file], true) }),
    file.is_favorite
      ? { label: 'Retirer des favoris', icon: HeartOff, shortcut: 'F', onSelect: () => setFavorite([file], false) }
      : { label: 'Ajouter aux favoris', icon: Heart, shortcut: 'F', onSelect: () => setFavorite([file], true) },
    sep,
    own && can('files.rename_move') && { label: 'Renommer', icon: Pencil, shortcut: 'F2', onSelect: () => renameFile(file) },
    own && can('files.rename_move') && { label: 'Déplacer vers…', icon: FolderInput, shortcut: 'M', onSelect: () => openMoveDialog([{ ...file, kind: 'file' }]) },
    ctx.select && { label: 'Sélectionner', icon: CheckSquare, onSelect: () => ctx.select(file) },
    { label: 'Informations', icon: Info, shortcut: 'I', onSelect: () => ctx.info(file) },
    sep,
    (own ? can('files.delete_own') : can('files.delete_others')) && {
      label: 'Mettre à la corbeille', icon: Trash2, danger: true, shortcut: 'Suppr', onSelect: () => trashFiles([file]),
    },
  ]
}

export function folderMenu(folder, ctx) {
  const can = ctx.can
  return [
    { label: 'Ouvrir', icon: FolderOpen, shortcut: '↵', onSelect: () => ctx.openFolder(folder) },
    can('files.upload') && { label: 'Importer ici…', icon: Upload, onSelect: () => { useUiStore.getState().setCurrentFolder({ id: folder.id, name: folder.name }); pickFiles() } },
    can('files.create_folder') && { label: 'Nouveau sous-dossier', icon: FolderPlus, onSelect: () => createFolder({ id: folder.id, name: folder.name }) },
    sep,
    can('files.rename_move') && { label: 'Renommer', icon: Pencil, shortcut: 'F2', onSelect: () => renameFolder(folder) },
    can('files.rename_move') && { label: 'Déplacer vers…', icon: FolderInput, shortcut: 'M', onSelect: () => openMoveDialog([{ ...folder, kind: 'folder' }]) },
    ctx.select && { label: 'Sélectionner', icon: CheckSquare, onSelect: () => ctx.select(folder) },
    sep,
    can('files.create_folder') && { label: 'Supprimer le dossier', icon: Trash2, danger: true, onSelect: () => deleteFolders([folder]) },
  ]
}

export function selectionMenu(items, ctx) {
  const files = items.filter((i) => i.kind === 'file')
  const folders = items.filter((i) => i.kind === 'folder')
  const can = ctx.can
  if (ctx.isTrash) {
    return [
      { type: 'label', label: `${items.length} sélectionnés` },
      { label: 'Restaurer', icon: RotateCcw, onSelect: () => restoreFiles(files) },
      sep,
      { label: 'Supprimer définitivement', icon: XCircle, danger: true, onSelect: () => deleteForever(files) },
    ]
  }
  const allFav = files.length > 0 && files.every((f) => f.is_favorite)
  return [
    { type: 'label', label: `${pluralize(items.length, 'élément sélectionné', 'éléments sélectionnés')}` },
    files.length > 0 && { label: `Télécharger (${files.length}) en ZIP`, icon: Download, onSelect: () => downloadZip(files.map((f) => f.id)) },
    files.length > 0 && (allFav
      ? { label: 'Retirer des favoris', icon: HeartOff, onSelect: () => setFavorite(files, false) }
      : { label: 'Ajouter aux favoris', icon: Heart, onSelect: () => setFavorite(files, true) }),
    files.length > 0 && can('files.toggle_link') && {
      type: 'sub', label: 'Lien public', icon: Link2, items: [
        { label: 'Activer les liens', icon: Link2, onSelect: () => setLink(files, true) },
        { label: 'Désactiver les liens', icon: Link2Off, onSelect: () => setLink(files, false) },
      ],
    },
    can('files.rename_move') && ctx.view === 'mine' && { label: 'Déplacer vers…', icon: FolderInput, shortcut: 'M', onSelect: () => openMoveDialog(items) },
    sep,
    ctx.clearSelection && { label: 'Tout désélectionner', icon: CheckSquare, shortcut: 'Échap', onSelect: ctx.clearSelection },
    sep,
    files.length > 0 && { label: `Mettre ${pluralize(files.length, 'fichier')} à la corbeille`, icon: Trash2, danger: true, shortcut: 'Suppr', onSelect: () => trashFiles(files) },
    folders.length > 0 && can('files.create_folder') && { label: `Supprimer ${pluralize(folders.length, 'dossier')}`, icon: Trash2, danger: true, onSelect: () => deleteFolders(folders) },
  ]
}

export function backgroundMenu(ctx) {
  const can = ctx.can
  const sortItems = [
    { label: 'Plus récents', icon: CalendarArrowDown, checked: ctx.sortBy === 'created_at' && ctx.sortDir === 'desc', onSelect: () => ctx.setSort('created_at', 'desc') },
    { label: 'Plus anciens', icon: CalendarArrowUp, checked: ctx.sortBy === 'created_at' && ctx.sortDir === 'asc', onSelect: () => ctx.setSort('created_at', 'asc') },
    { label: 'Nom (A → Z)', icon: ArrowDownAZ, checked: ctx.sortBy === 'original_name' && ctx.sortDir === 'asc', onSelect: () => ctx.setSort('original_name', 'asc') },
    { label: 'Nom (Z → A)', icon: ArrowUpZA, checked: ctx.sortBy === 'original_name' && ctx.sortDir === 'desc', onSelect: () => ctx.setSort('original_name', 'desc') },
    { label: 'Taille (plus gros)', icon: HardDrive, checked: ctx.sortBy === 'size' && ctx.sortDir === 'desc', onSelect: () => ctx.setSort('size', 'desc') },
  ]
  return [
    ctx.view === 'mine' && can('files.upload') && { label: 'Importer des fichiers…', icon: Upload, shortcut: 'U', onSelect: () => pickFiles() },
    ctx.view === 'mine' && can('files.create_folder') && { label: 'Nouveau dossier', icon: FolderPlus, shortcut: 'N', onSelect: () => createFolder() },
    ctx.view === 'mine' && sep,
    { type: 'sub', label: 'Affichage', icon: LayoutGrid, items: [
      { label: 'Grille', icon: LayoutGrid, checked: ctx.viewMode === 'grid', onSelect: () => ctx.setViewMode('grid') },
      { label: 'Liste', icon: List, checked: ctx.viewMode === 'list', onSelect: () => ctx.setViewMode('list') },
    ] },
    { type: 'sub', label: 'Trier par', icon: ArrowDownAZ, items: sortItems },
    ctx.itemCount > 0 && { label: 'Tout sélectionner', icon: CheckSquare, shortcut: `${MOD}+A`, onSelect: ctx.selectAll },
    ctx.isTrash && ctx.itemCount > 0 && sep,
    ctx.isTrash && ctx.itemCount > 0 && { label: 'Vider la corbeille', icon: Trash2, danger: true, onSelect: () => emptyTrash(ctx.itemCount) },
  ]
}
