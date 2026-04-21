import { mkdir, unlink, stat } from 'fs/promises'
import { join, extname } from 'path'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import ffmpeg from 'fluent-ffmpeg'
import { config } from '../config/env.js'

const STORAGE_BASE = config.storage.path

export async function ensureStorageDirs() {
  const dirs = ['images', 'videos', 'thumbnails', 'avatars', 'temp', 'zips']
  for (const dir of dirs) {
    await mkdir(join(STORAGE_BASE, dir), { recursive: true })
  }
}

export function sanitizeFilename(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200)
}

export function generateStoredName(originalName) {
  const ext = extname(originalName).toLowerCase()
  return `${nanoid(24)}${ext}`
}

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
])

export function validateMime(mime) {
  return ALLOWED_MIME.has(mime)
}

export async function processImage(inputBuffer, qualityPreset) {
  let pipeline = sharp(inputBuffer)

  if (qualityPreset === 'standard') {
    pipeline = pipeline.jpeg({ quality: 85 })
  } else if (qualityPreset === 'thumbnail') {
    pipeline = pipeline.resize(300, 300, { fit: 'inside' }).jpeg({ quality: 70 })
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true })
  return output
}

export async function generateImageThumbnail(inputPath) {
  const thumbName = `thumb_${nanoid(16)}.jpg`
  const thumbPath = join(STORAGE_BASE, 'thumbnails', thumbName)

  await sharp(inputPath)
    .resize(400, 300, { fit: 'inside' })
    .jpeg({ quality: 70 })
    .toFile(thumbPath)

  return thumbPath
}

export function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio')

      resolve({
        duration: metadata.format.duration ? parseFloat(metadata.format.duration) : null,
        width: videoStream?.width || null,
        height: videoStream?.height || null,
        fps: videoStream?.r_frame_rate
          ? videoStream.r_frame_rate.split('/').reduce((a, b) => parseFloat(a) / parseFloat(b))
          : null,
        codec: videoStream?.codec_name || null,
        format: metadata.format.format_name || null,
      })
    })
  })
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
