import api, { apiError } from '../utils/api.js'
import { useUiStore } from '../stores/ui.store.js'
import { useUploadStore } from '../stores/upload.store.js'
import { usePreferencesStore } from '../stores/preferences.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { prompt } from '../stores/confirm.store.js'
import { toast } from '../stores/toast.store.js'
import { invalidateFiles } from './queryClient.js'
import { ACCEPT_ATTR, isAcceptedFile, publicLink } from './media.js'

// ── Envoi de fichiers ────────────────────────────────────────────────────────

// Point d'entrée unique : bouton Importer, glisser-déposer, palette, appareil photo…
export function startUpload(fileList, target) {
  const files = [...(fileList || [])]
  if (!files.length) return
  const accepted = files.filter(isAcceptedFile)
  const rejected = files.length - accepted.length
  if (rejected) toast.warn(`${rejected} fichier(s) ignoré(s) : seules les images et vidéos sont acceptées`)
  if (!accepted.length) return

  if (!useAuthStore.getState().hasPermission('files.upload')) {
    toast.error("Votre rôle ne permet pas d'envoyer des fichiers")
    return
  }

  const folder = target || useUiStore.getState().currentFolder
  const { askQuality, defaultQuality } = usePreferencesStore.getState()
  if (askQuality) {
    useUiStore.getState().setPendingUpload({ files: accepted, folderId: folder.id, folderName: folder.name })
  } else {
    useUploadStore.getState().enqueue(accepted.map((file) => ({ file, quality: defaultQuality, folderId: folder.id, folderName: folder.name })))
  }
}

// Ouvre le sélecteur de fichiers natif (option : appareil photo sur mobile)
export function pickFiles({ capture = false } = {}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = !capture
  input.accept = capture ? 'image/*,video/*' : ACCEPT_ATTR
  if (capture) input.capture = 'environment'
  input.style.display = 'none'
  input.onchange = () => {
    startUpload(input.files)
    input.remove()
  }
  document.body.appendChild(input)
  input.click()
}

// ── Dossiers ─────────────────────────────────────────────────────────────────

export async function createFolder(parent) {
  const target = parent || useUiStore.getState().currentFolder
  const name = await prompt('Nouveau dossier', {
    message: target.id ? `Dans « ${target.name} »` : 'À la racine de Mon espace',
    defaultValue: 'Nouveau dossier',
    confirmLabel: 'Créer',
    placeholder: 'Nom du dossier',
  })
  if (!name) return null
  try {
    const { data } = await api.post('/files/folders', { name, parentId: target.id || null })
    invalidateFiles()
    toast.success(`Dossier « ${data.name} » créé`)
    return data
  } catch (err) {
    toast.error(apiError(err, 'Impossible de créer le dossier'))
    return null
  }
}

// ── Téléchargements ──────────────────────────────────────────────────────────

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function downloadFile(file) {
  const id = toast.message(`Téléchargement de « ${file.original_name} »…`)
  try {
    const res = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
    saveBlob(new Blob([res.data], { type: file.mime_type }), file.original_name)
    toast.dismiss(id)
  } catch {
    toast.dismiss(id)
    toast.error('Erreur lors du téléchargement')
  }
}

export async function downloadZip(fileIds, name = 'obscura') {
  if (!fileIds.length) return
  if (fileIds.length === 1) {
    const { data } = await api.get(`/files/${fileIds[0]}`).catch(() => ({ data: null }))
    if (data) return downloadFile(data)
  }
  await toast.promise(
    api.post('/files/zip', { fileIds }, { responseType: 'blob' }).then((res) => {
      saveBlob(new Blob([res.data], { type: 'application/zip' }), `${name}-${new Date().toISOString().slice(0, 10)}.zip`)
    }),
    {
      loading: `Préparation de l'archive (${fileIds.length} fichiers)…`,
      success: 'Archive ZIP téléchargée',
      error: "Erreur lors de la création de l'archive",
    }
  )
}

export async function copyText(text, message = 'Copié dans le presse-papiers') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  } catch {
    // Contexte non sécurisé (HTTP) : repli sur execCommand
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    ok ? toast.success(message) : toast.error('Impossible de copier')
  }
}

export const copyFileLink = (file) => {
  if (file.link_active === false) toast.warn('Le lien public de ce fichier est désactivé')
  return copyText(publicLink(file), 'Lien public copié')
}

export async function shareFile(file) {
  const url = publicLink(file)
  if (navigator.share) {
    try {
      await navigator.share({ title: file.original_name, url })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }
  copyFileLink(file)
}
