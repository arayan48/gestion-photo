import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAutoSafe, computeLimits, findMount, readDisk, detectDiskDevice, readCgroupLimits, GB } from '../src/utils/infra.js'

test('auto : 95% du disque quand il est vide', () => {
  assert.equal(computeAutoSafe(100 * GB, 100 * GB, 0), 95 * GB)
})

test('auto : un disque partagé réduit l\'espace atteignable', () => {
  // 100 Go, 40 Go libres, Obscura utilise 10 Go → 40 + 10 − 5 = 45 Go
  assert.equal(computeAutoSafe(100 * GB, 40 * GB, 10 * GB), 45 * GB)
})

test('auto : jamais négatif sur un disque plein', () => {
  assert.equal(computeAutoSafe(100 * GB, 1 * GB, 0), 0)
})

test('limites : réglage manuel plafonné à la taille du disque', () => {
  const l = computeLimits({ size: 50 * GB, autoSafe: 40 * GB }, { 'storage.total_gb': '80' })
  assert.equal(l.safeBytes, 50 * GB)
  assert.equal(l.mediaLimit, 35 * GB)
})

test('limites : valeurs par défaut en mode auto', () => {
  const l = computeLimits({ size: 100 * GB, autoSafe: 60 * GB }, {})
  assert.equal(l.mediaLimit, 42 * GB)
  assert.equal(l.backupLimit, 6 * GB)
  assert.equal(l.logLimit, 2 * GB)
})

test('montage le plus spécifique', () => {
  const info = [
    '22 1 8:1 / / rw - ext4 /dev/sda1 rw',
    '30 22 8:17 / /app/storage rw - xfs /dev/sdb1 rw',
    '31 22 8:33 / /app/storage2 rw - ext4 /dev/sdc1 rw',
  ].join('\n')
  assert.deepEqual(findMount(info, '/app/storage/media'), { point: '/app/storage', devId: '8:17', fsType: 'xfs', source: '/dev/sdb1' })
  assert.equal(findMount(info, '/app/storage2').devId, '8:33')
  assert.equal(findMount(info, '/etc').devId, '8:1')
})

test('détection réelle sur cette machine', async () => {
  const disk = await readDisk('/')
  assert.ok(disk.size > 0 && disk.free >= 0 && disk.free <= disk.size)
  await detectDiskDevice('/')
  await readCgroupLimits()
})
