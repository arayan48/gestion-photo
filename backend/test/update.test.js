import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, latestStable } from '../src/services/update.service.js'

test('compare les versions numériquement', () => {
  assert.equal(compareVersions('v1.10.0', 'v1.9.3'), 1)
  assert.equal(compareVersions('v1.1.0', 'v1.1.0'), 0)
  assert.equal(compareVersions('v1.0.9', 'v1.1.0'), -1)
})

test('une version non numérotée ne déclenche rien', () => {
  assert.equal(compareVersions('v2.0.0', 'dev'), 0)
})

test('dernière version stable parmi les tags', () => {
  assert.equal(latestStable(['latest', 'v1.2.0', 'v1.10.0', 'v2.0.0-rc.1', 'v1.9.0']), 'v1.10.0')
  assert.equal(latestStable(['latest']), null)
})
