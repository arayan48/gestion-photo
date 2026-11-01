import { readFileSync } from 'fs'
import { notifyAdmins } from '../utils/logger.js'
import { getConfigValue, setConfigValues } from './config.service.js'

const CHECK_INTERVAL = 12 * 3600 * 1000
// Le dépôt du code est privé : on lit les versions publiées dans les tags de l'image publique
const IMAGE = process.env.UPDATE_CHECK_IMAGE || 'arayan48/obscura'

// Version gravée dans l'image au build (tag Git), sinon celle du package.json (développement)
const pkgVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))).version

export const updateState = {
  current: (process.env.APP_VERSION || `v${pkgVersion}`).replace(/^(\d)/, 'v$1'),
  latest: null,
  checkedAt: null,
  updateAvailable: false,
}

function parse(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim())
  return m ? [+m[1], +m[2], +m[3]] : null
}

// 1 si a > b, -1 si a < b, 0 si égales. Les pré-versions et tags non numérotés sont ignorés.
export function compareVersions(a, b) {
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return 0
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  return 0
}

export function latestStable(tags) {
  return tags.filter(parse).sort((a, b) => compareVersions(b, a))[0] ?? null
}

async function fetchTags() {
  const opts = { headers: { 'User-Agent': `obscura/${updateState.current}` }, signal: AbortSignal.timeout(10000) }
  const auth = await fetch(`https://ghcr.io/token?scope=repository:${IMAGE}:pull`, opts).then((r) => r.json())
  const res = await fetch(`https://ghcr.io/v2/${IMAGE}/tags/list?n=1000`, {
    ...opts,
    headers: { ...opts.headers, Authorization: `Bearer ${auth.token}` },
  })
  if (!res.ok) throw new Error(`GHCR a répondu ${res.status}`)
  return (await res.json()).tags || []
}

export async function checkForUpdate() {
  const latest = latestStable(await fetchTags())
  updateState.checkedAt = new Date().toISOString()
  if (!latest) return updateState
  updateState.latest = latest
  updateState.updateAvailable = compareVersions(latest, updateState.current) > 0

  // Une seule notification par version, même après un redémarrage. Pas encore d'admin
  // (setup non fait) : on réessaiera à la prochaine vérification.
  if (updateState.updateAvailable && (await getConfigValue('update.notified_version')) !== latest) {
    console.log(`⬆️  Obscura ${latest} est disponible (version installée : ${updateState.current})`)
    const notified = await notifyAdmins({
      type: 'update_available',
      message: `Obscura ${latest} est disponible (version installée : ${updateState.current}).`,
    })
    if (notified) await setConfigValues([['update.notified_version', latest]])
  }
  return updateState
}

export function startUpdateCheck() {
  if (process.env.UPDATE_CHECK === 'false') return
  const run = () => checkForUpdate().catch((err) => console.warn('Vérification des mises à jour impossible :', err.message))
  run()
  setInterval(run, CHECK_INTERVAL).unref()
}
