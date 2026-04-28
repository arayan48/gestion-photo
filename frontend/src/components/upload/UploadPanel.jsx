import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import api from '../../utils/api.js'
import { formatSize } from '../../utils/format.js'
import { usePreferencesStore } from '../../stores/preferences.store.js'

const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
}

const QUALITY_OPTIONS = [
  { value: 'original', label: '🖼️ Grande qualité', desc: 'Original conservé' },
  { value: 'standard', label: '⚖️ Usage standard', desc: 'Optimisation légère (~85%)' },
  { value: 'thumbnail', label: '🔹 Miniature / Icône', desc: 'Compression forte' },
]

export default function UploadPanel({ folderId, onClose, onDone }) {
  const { defaultQuality, setDefaultQuality } = usePreferencesStore()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((accepted) => {
    const newFiles = accepted.map((f) => ({
      file: f,
      name: f.name.replace(/\.[^.]+$/, ''),
      qualityPreset: defaultQuality,
      status: 'pending',
      progress: 0,
      error: null,
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [defaultQuality])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: true,
  })

  const updateFile = (index, updates) => {
    setFiles((prev) => prev.map((f, i) => i === index ? { ...f, ...updates } : f))
  }

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index))

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)

    // Compter les fichiers à traiter (pas déjà "done")
    const toUpload = files.filter((f) => f.status !== 'done').length
    let successCount = 0

    for (let i = 0; i < files.length; i++) {
      const item = files[i]
      if (item.status === 'done') continue

      updateFile(i, { status: 'uploading', progress: 0 })

      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('name', item.name)
      formData.append('qualityPreset', item.qualityPreset)
      if (folderId) formData.append('folderId', folderId)

      try {
        await api.post('/files/upload', formData, {
          onUploadProgress: (e) => {
            const progress = Math.round((e.loaded / e.total) * 100)
            updateFile(i, { progress })
          },
        })
        updateFile(i, { status: 'done', progress: 100 })
        successCount++
      } catch (err) {
        updateFile(i, { status: 'error', error: err.response?.data?.error || 'Erreur upload' })
      }
    }

    setUploading(false)
    // Utiliser un compteur local — `files` est une closure périmée ici
    if (successCount === toUpload) setTimeout(onDone, 800)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-40 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-gray-100">Uploader des fichiers</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Zone de drop */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-violet-500 bg-violet-500/10' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={28} className="mx-auto text-gray-500 mb-2" />
            <p className="text-sm text-gray-400">
              {isDragActive ? 'Déposez ici...' : 'Glissez-déposez ou cliquez pour sélectionner'}
            </p>
            <p className="text-xs text-gray-600 mt-1">Images (JPG, PNG, WEBP, GIF, SVG, AVIF) · Vidéos (MP4, WEBM, MOV)</p>
          </div>

          {/* Liste des fichiers */}
          {files.map((item, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <input
                    className="input text-sm py-1.5"
                    value={item.name}
                    onChange={(e) => updateFile(i, { name: e.target.value })}
                    disabled={item.status !== 'pending'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {item.file.name} · {formatSize(item.file.size)}
                  </p>
                </div>
                {item.status === 'pending' && (
                  <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 transition-colors mt-1">
                    <X size={16} />
                  </button>
                )}
                {item.status === 'done' && <CheckCircle size={18} className="text-green-400 mt-1 shrink-0" />}
                {item.status === 'error' && <AlertCircle size={18} className="text-red-400 mt-1 shrink-0" />}
                {item.status === 'uploading' && <Loader2 size={18} className="text-violet-400 animate-spin mt-1 shrink-0" />}
              </div>

              {item.status === 'pending' && (
                <div className="flex gap-2">
                  {QUALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { updateFile(i, { qualityPreset: opt.value }); setDefaultQuality(opt.value) }}
                      className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                        item.qualityPreset === opt.value
                          ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-gray-500 text-xs">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {item.status === 'uploading' && (
                <div className="mt-2">
                  <div className="bg-gray-700 rounded-full h-1.5">
                    <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.progress}%</p>
                </div>
              )}

              {item.error && <p className="text-xs text-red-400 mt-2">{item.error}</p>}
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading || files.every((f) => f.status === 'done')}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Upload en cours...' : `Uploader (${files.filter((f) => f.status === 'pending').length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
