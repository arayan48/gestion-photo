import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { needsPlaybackCopy, ffmpegArgs } from '../src/services/transcode.service.js'
import { inspectArchive } from '../src/services/backup.service.js'

test('copie de lecture seulement pour les vidéos non lisibles partout', () => {
  assert.equal(needsPlaybackCopy('video/mp4', 'h264'), false)
  assert.equal(needsPlaybackCopy('video/webm', 'vp9'), false)
  assert.equal(needsPlaybackCopy('video/mp4', 'hevc'), true)
  assert.equal(needsPlaybackCopy('video/quicktime', 'h264'), true)
})

test('H.264 est recopié sans réencodage, le reste est converti', () => {
  assert.ok(ffmpegArgs('a.mov', 'b.mp4', 'h264').join(' ').includes('-c:v copy'))
  assert.ok(ffmpegArgs('a.mov', 'b.mp4', 'hevc').includes('libx264'))
})

// Archive au format produit par createArchive() : médias + temp/<dossier>/obscura_db.sql.gz
function makeArchive(build) {
  const dir = mkdtempSync(join(tmpdir(), 'obscura-test-'))
  const src = join(dir, 'src')
  mkdirSync(join(src, 'images'), { recursive: true })
  writeFileSync(join(src, 'images', 'a.jpg'), 'x')
  const entries = build(src)
  const archive = join(dir, 'a.tar.gz')
  execFileSync('tar', ['-czf', archive, '-C', src, ...entries])
  return archive
}

test('archive valide : le dump SQL est trouvé', async () => {
  const archive = makeArchive((src) => {
    mkdirSync(join(src, 'temp', 'backup_x'), { recursive: true })
    writeFileSync(join(src, 'temp', 'backup_x', 'obscura_db.sql.gz'), '')
    return ['images', 'temp']
  })
  assert.equal(await inspectArchive(archive), 'temp/backup_x/obscura_db.sql.gz')
})

test('archive sans base refusée', async () => {
  const archive = makeArchive(() => ['images'])
  await assert.rejects(inspectArchive(archive), /aucune base/)
})

test('archive avec un dossier inattendu refusée', async () => {
  const archive = makeArchive((src) => {
    mkdirSync(join(src, 'etc'))
    writeFileSync(join(src, 'etc', 'passwd'), '')
    return ['images', 'etc']
  })
  await assert.rejects(inspectArchive(archive), /entrée inattendue/)
})

test('fichier qui n\'est pas une archive refusé', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'obscura-test-'))
  writeFileSync(join(dir, 'x.tar.gz'), 'pas une archive')
  await assert.rejects(inspectArchive(join(dir, 'x.tar.gz')), /illisible/)
})
