import { execFile } from 'child_process'
import { promisify } from 'util'
import { unlink } from 'fs/promises'
import { nanoid } from 'nanoid'
import pool from '../config/database.js'
import { log, notify } from '../utils/logger.js'
import { getFilePath } from './storage.service.js'

const execFileAsync = promisify(execFile)

// Copie de lecture pour les vidéos que les navigateurs ne lisent pas partout (MOV, HEVC…).
// L'original est conservé tel quel (téléchargement) ; la copie MP4 H.264 sert à la lecture.
// shortcut: copie non comptée dans le quota utilisateur, la compter si le disque devient un souci.

const PLAYABLE = {
  'video/mp4': ['h264', 'av1'],
  'video/webm': ['vp8', 'vp9', 'av1'],
}

export function needsPlaybackCopy(mimeType, codec) {
  return !PLAYABLE[mimeType]?.includes(codec)
}

export function ffmpegArgs(input, output, codec) {
  return [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-map', '0:v:0', '-map', '0:a:0?',
    // H.264 déjà présent (MOV d'appareil photo) : simple changement de conteneur, quasi instantané
    ...(codec === 'h264' ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p']),
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    output,
  ]
}

// Une conversion à la fois : le serveur reste réactif pendant ce temps
let queue = Promise.resolve()
export function queueTranscode(fileId) {
  queue = queue.then(() => transcode(fileId)).catch((err) => console.error('Conversion vidéo :', err))
}

async function transcode(fileId) {
  const { rows: [file] } = await pool.query(
    "SELECT id, owner_id, original_name, stored_name, codec FROM files WHERE id = $1 AND transcode_status = 'pending'",
    [fileId]
  )
  if (!file) return

  const playbackName = `play_${nanoid(16)}.mp4`
  const output = getFilePath('videos', playbackName)
  try {
    await execFileAsync('ffmpeg', ffmpegArgs(getFilePath('videos', file.stored_name), output, file.codec), { maxBuffer: 10 * 1024 * 1024 })
    // Le fichier a pu être supprimé pendant la conversion : la copie est alors jetée
    const { rowCount } = await pool.query(
      "UPDATE files SET playback_name = $1, transcode_status = NULL WHERE id = $2 AND stored_name = $3 AND transcode_status = 'pending'",
      [playbackName, file.id, file.stored_name]
    )
    if (!rowCount) return unlink(output).catch(() => {})
    await notify({ userId: file.owner_id, type: 'upload_done', message: `« ${file.original_name} » peut maintenant être lu dans le navigateur` })
  } catch (err) {
    await unlink(output).catch(() => {})
    await pool.query("UPDATE files SET transcode_status = 'failed' WHERE id = $1", [file.id])
    await log({ category: 'files', level: 'error', action: 'transcode_failed', userId: file.owner_id, metadata: { fileId: file.id, error: String(err.stderr || err.message).slice(0, 500) } })
  }
}

// Au démarrage : conversions interrompues et vidéos envoyées avant cette fonctionnalité
export async function resumeTranscodes() {
  const { rows } = await pool.query(
    `SELECT id, mime_type, codec FROM files
     WHERE mime_type LIKE 'video/%' AND playback_name IS NULL AND is_deleted = false
       AND transcode_status IS DISTINCT FROM 'failed'`
  )
  const ids = rows.filter((f) => needsPlaybackCopy(f.mime_type, f.codec)).map((f) => f.id)
  if (!ids.length) return
  await pool.query("UPDATE files SET transcode_status = 'pending' WHERE id = ANY($1)", [ids])
  ids.forEach(queueTranscode)
}
