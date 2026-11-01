import { mkdir, unlink } from 'fs/promises'
import { join, extname } from 'path'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import ffmpeg from 'fluent-ffmpeg'
import { config } from '../config/env.js'

const STORAGE_BASE = config.storage.path

export async function ensureStorageDirs() {
  const dirs = ['images', 'videos', 'thumbnails', 'avatars', 'temp', 'zips', 'backups']
  for (const dir of dirs) {
    await mkdir(join(STORAGE_BASE, dir), { recursive: true })
  }
}

// Nom affiché d'un fichier ou d'un dossier (le fichier sur disque porte toujours un nom
// aléatoire, cf. generateStoredName). Accents, espaces et majuscules sont conservés :
// seuls les caractères de contrôle et ceux interdits par les systèmes de fichiers
// (utile pour les ZIP et les téléchargements) sont remplacés.
export function sanitizeFilename(name, fallback = 'fichier') {
  const clean = String(name ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '') // pas de fichier caché / ".."
    .replace(/[. ]+$/, '') // Windows refuse un nom terminé par un point ou une espace
    .substring(0, 200)
    .trim()
  return clean || fallback
}

// Extension d'un fichier média reconnu (« .JPG » → retirée du nom de base à l'envoi)
export const MEDIA_EXT_RE = /\.(jpe?g|png|webp|gif|svg|avif|heic|heif|mp4|m4v|webm|mov)$/i

export function generateStoredName(originalName) {
  const ext = (extname(originalName).toLowerCase().match(/^\.[a-z0-9]{1,8}$/) || [''])[0]
  return `${nanoid(24)}${ext}`
}

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
])

export function validateMime(mime) {
  return ALLOWED_MIME.has(mime)
}

export const QUALITY_PRESETS = ['original', 'standard', 'thumbnail']

// Format réel détecté par Sharp (contenu du fichier, pas l'extension ni le MIME client)
const SHARP_FORMATS = {
  jpeg: { mime: 'image/jpeg', ext: '.jpg' },
  png: { mime: 'image/png', ext: '.png' },
  webp: { mime: 'image/webp', ext: '.webp' },
  gif: { mime: 'image/gif', ext: '.gif' },
  heif: { mime: 'image/avif', ext: '.avif' },
  avif: { mime: 'image/avif', ext: '.avif' },
  svg: { mime: 'image/svg+xml', ext: '.svg' },
}

/**
 * Valide et traite une image côté serveur.
 * - Le contenu est analysé par Sharp : un fichier qui n'est pas une vraie image est refusé.
 * - "original" conserve le fichier tel quel (animations GIF/WebP, qualité intacte)…
 * - …sauf le SVG, toujours rasterisé en PNG : servi tel quel il pourrait exécuter du script (XSS).
 * - "standard" / "thumbnail" produisent un JPEG.
 * Retourne { data, mime, ext, info }.
 */
export async function processImage(inputBuffer, qualityPreset) {
  let meta
  try {
    meta = await sharp(inputBuffer, { animated: true }).metadata()
  } catch {
    throw Object.assign(new Error('Le fichier n\'est pas une image valide'), { statusCode: 400 })
  }

  const detected = SHARP_FORMATS[meta.format]
  if (!detected) {
    throw Object.assign(new Error('Format d\'image non supporté'), { statusCode: 400 })
  }

  if (qualityPreset === 'original' && meta.format !== 'svg') {
    // Orientation EXIF 5 à 8 (photo de téléphone tenu à la verticale) : l'image
    // s'affiche pivotée d'un quart de tour, largeur et hauteur sont donc inversées
    const height = meta.pageHeight || meta.height
    const rotated = meta.orientation >= 5
    return {
      data: inputBuffer,
      mime: detected.mime,
      ext: detected.ext,
      info: { width: rotated ? height : meta.width, height: rotated ? meta.width : height, format: meta.format },
    }
  }

  let pipeline = sharp(inputBuffer).rotate() // applique l'orientation EXIF
  let mime = 'image/jpeg'
  let ext = '.jpg'

  if (qualityPreset === 'thumbnail') {
    pipeline = pipeline.resize(300, 300, { fit: 'inside' }).jpeg({ quality: 70 })
  } else if (qualityPreset === 'standard') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 85 })
  } else {
    // SVG en qualité originale → PNG (transparence conservée)
    pipeline = pipeline.png()
    mime = 'image/png'
    ext = '.png'
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
  return { data, mime, ext, info: { width: info.width, height: info.height, format: info.format } }
}

export async function generateImageThumbnail(inputPath) {
  const thumbName = `thumb_${nanoid(16)}.jpg`
  const thumbPath = join(STORAGE_BASE, 'thumbnails', thumbName)

  // rotate() applique l'orientation EXIF : sans lui, la miniature (qui perd les
  // métadonnées) d'une photo prise à la verticale apparaîtrait couchée
  await sharp(inputPath)
    .rotate()
    .resize(400, 300, { fit: 'inside' })
    .jpeg({ quality: 70 })
    .toFile(thumbPath)

  return thumbPath
}

export function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(Object.assign(new Error('Le fichier n\'est pas une vidéo valide'), { statusCode: 400 }))

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
      if (!videoStream) {
        return reject(Object.assign(new Error('Aucune piste vidéo détectée'), { statusCode: 400 }))
      }

      resolve({
        duration: metadata.format.duration ? parseFloat(metadata.format.duration) : null,
        width: videoStream?.width || null,
        height: videoStream?.height || null,
        fps: parseFrameRate(videoStream?.r_frame_rate),
        codec: videoStream?.codec_name || null,
        format: metadata.format.format_name || null,
      })
    })
  })
}

function parseFrameRate(rate) {
  if (!rate) return null
  const [num, den] = rate.split('/').map(Number)
  const fps = den ? num / den : num
  return Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : null
}

export async function generateVideoThumbnail(inputPath) {
  const thumbName = `thumb_${nanoid(16)}.jpg`
  const thumbPath = join(STORAGE_BASE, 'thumbnails', thumbName)

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        count: 1,
        timemarks: ['10%'],
        filename: thumbName,
        folder: join(STORAGE_BASE, 'thumbnails'),
        size: '400x?',
      })
      .on('end', resolve)
      .on('error', reject)
  })

  return thumbPath
}

export async function deleteFile(storedName, subdir) {
  try {
    const filePath = join(STORAGE_BASE, subdir, storedName)
    await unlink(filePath)
  } catch {
    // Fichier peut-être déjà supprimé
  }
}

export function getFilePath(subdir, storedName) {
  return join(STORAGE_BASE, subdir, storedName)
}

export function getMediaSubdir(mimeType) {
  return mimeType?.startsWith('video/') ? 'videos' : 'images'
}

// thumbnail_path est stocké sous la forme /storage/thumbnails/<nom>
export async function deleteThumbnail(thumbnailPath) {
  if (!thumbnailPath) return
  const name = thumbnailPath.split('/').pop()
  if (name) await deleteFile(name, 'thumbnails')
}

// Supprime du disque l'original et la miniature d'un fichier (ligne de la table files)
export async function deleteMediaFiles(file) {
  await deleteFile(file.stored_name, getMediaSubdir(file.mime_type))
  await deleteThumbnail(file.thumbnail_path)
}
