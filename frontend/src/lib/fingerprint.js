// Empreinte navigateur légère, croisée côté serveur avec IP + User-Agent
// pour reconnaître un même attaquant malgré un changement d'IP (bannissement progressif)
let cached = null

export async function getBrowserFingerprint() {
  if (cached) return cached
  const parts = [
    navigator.userAgent,
    navigator.language,
    (navigator.languages || []).join(','),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    navigator.hardwareConcurrency,
    navigator.platform,
    navigator.maxTouchPoints,
  ].join('|')

  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts))
    cached = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // crypto.subtle indisponible (HTTP non sécurisé) : hachage simple
    let h = 0
    for (let i = 0; i < parts.length; i++) h = (Math.imul(31, h) + parts.charCodeAt(i)) | 0
    cached = `fb${(h >>> 0).toString(16)}`
  }
  return cached
}
