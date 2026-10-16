import { randomBytes } from 'crypto'
import pool from '../config/database.js'
import { encryptSecret, decryptSecret, isEncrypted } from './secrets.service.js'

// Clés sensibles : chiffrées en base, jamais renvoyées en clair par l'API admin
export const SECRET_KEYS = new Set([
  'security.jwt_secret',
  'discord.client_secret',
  'email.brevo_key',
  'email.smtp_password',
  'email.resend_key',
  'email.mailgun_key',
  'email.sendgrid_key',
  'b2.key_id',
  'b2.key',
  's3.access_key',
  's3.secret_key',
  'ftp.password',
  'sftp.password',
  'sftp.key',
  'webdav.password',
  'gdrive.client_secret',
  'notif.discord.webhook',
])

// Clés internes : ni lisibles ni modifiables depuis l'interface
export const INTERNAL_KEYS = new Set(['security.jwt_secret'])

// Valeur renvoyée à l'interface à la place d'un secret déjà défini.
// Si elle revient telle quelle dans un PATCH, le secret existant est conservé.
export const MASKED_VALUE = '••••••••'

function decodeRow(row) {
  if (!SECRET_KEYS.has(row.key)) return row.value
  try {
    return decryptSecret(row.value)
  } catch {
    console.error(`⚠️  Impossible de déchiffrer "${row.key}" (clé maître différente ?)`)
    return ''
  }
}

// Lit des clés de system_config (secrets déchiffrés). Les valeurs vides sont ignorées.
export async function getConfigValues(keys) {
  try {
    const { rows } = await pool.query('SELECT key, value FROM system_config WHERE key = ANY($1)', [keys])
    return Object.fromEntries(
      rows.map((r) => [r.key, decodeRow(r)]).filter(([, v]) => v !== '' && v !== null)
    )
  } catch {
    return {}
  }
}

export async function getConfigValue(key) {
  return (await getConfigValues([key]))[key]
}

// Écrit des valeurs (secrets chiffrés). `client` permet de participer à une transaction.
export async function setConfigValues(entries, client = pool) {
  for (const [key, raw] of entries) {
    const value = raw === null || raw === undefined ? '' : String(raw)
    const stored = SECRET_KEYS.has(key) && value !== '' ? encryptSecret(value) : value
    await client.query(
      `INSERT INTO system_config (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, stored]
    )
  }
}

// Configuration complète pour l'interface admin : secrets masqués, clés internes absentes
export async function getConfigForAdmin() {
  const { rows } = await pool.query('SELECT key, value FROM system_config ORDER BY key')
  const result = {}
  for (const row of rows) {
    if (INTERNAL_KEYS.has(row.key)) continue
    result[row.key] = SECRET_KEYS.has(row.key) ? (row.value ? MASKED_VALUE : '') : row.value
  }
  return result
}

// URL publique de l'instance (définie à l'installation, modifiable dans Paramètres → Général)
export async function getAppUrl() {
  const url = (await getConfigValue('app.url')) || process.env.APP_URL || ''
  return url.replace(/\/+$/, '')
}

// ── Démarrage ────────────────────────────────────────────────────────────────

// Anciennes variables .env → paramètres en base (importées une seule fois si absentes).
// Les installations existantes continuent donc de fonctionner sans rien changer.
const LEGACY_ENV_MAPPING = {
  APP_URL: 'app.url',
  JWT_ACCESS_SECRET: 'security.jwt_secret',
  DISCORD_CLIENT_ID: 'discord.client_id',
  DISCORD_CLIENT_SECRET: 'discord.client_secret',
  DISCORD_REDIRECT_URI: 'discord.redirect_uri',
  EMAIL_PROVIDER: 'email.provider',
  EMAIL_FROM: 'email.from',
  BREVO_API_KEY: 'email.brevo_key',
  SMTP_HOST: 'email.smtp_host',
  SMTP_PORT: 'email.smtp_port',
  SMTP_USER: 'email.smtp_user',
  SMTP_PASSWORD: 'email.smtp_password',
  SMTP_SECURE: 'email.smtp_secure',
  RESEND_API_KEY: 'email.resend_key',
  MAILGUN_API_KEY: 'email.mailgun_key',
  MAILGUN_DOMAIN: 'email.mailgun_domain',
  SENDGRID_API_KEY: 'email.sendgrid_key',
  B2_APPLICATION_KEY_ID: 'b2.key_id',
  B2_APPLICATION_KEY: 'b2.key',
  B2_BUCKET_NAME: 'b2.bucket',
}

// Valeurs d'exemple de l'ancien .env.example : à ne pas importer
const PLACEHOLDERS = /^(changeme.*|https:\/\/votre-domaine\.com.*|noreply@votre-domaine\.com)$/

export async function importLegacyEnvSettings() {
  const imported = []
  for (const [envName, key] of Object.entries(LEGACY_ENV_MAPPING)) {
    const value = process.env[envName]?.trim()
    if (!value || PLACEHOLDERS.test(value)) continue
    // JWT : un ancien secret trop court n'est pas repris (un nouveau sera généré)
    if (key === 'security.jwt_secret' && value.length < 32) continue
    const { rows } = await pool.query("SELECT 1 FROM system_config WHERE key = $1 AND value <> ''", [key])
    if (rows.length) continue
    await setConfigValues([[key, value]])
    imported.push(envName)
  }
  if (imported.length) {
    console.log(`📥 Paramètres importés depuis .env vers la base : ${imported.join(', ')}`)
    console.log('   Vous pouvez désormais les retirer du .env et les gérer depuis Paramètres admin.')
  }
}

// Vérifie que la clé maître correspond aux secrets déjà chiffrés en base.
// Une mauvaise clé ne doit pas passer inaperçue (secrets illisibles, 2FA cassée…).
export async function verifyMasterKey() {
  const { rows } = await pool.query("SELECT key, value FROM system_config WHERE value LIKE 'enc:v1:%' ORDER BY key = 'security.jwt_secret' DESC LIMIT 1")
  const { rows: totp } = rows.length ? { rows: [] } : await pool.query("SELECT totp_secret AS value FROM users WHERE totp_secret LIKE 'enc:v1:%' LIMIT 1")
  const sample = rows[0]?.value || totp[0]?.value
  if (!sample) return true
  try {
    decryptSecret(sample)
    return true
  } catch {
    return false
  }
}

// Clé maître perdue : efface les secrets chiffrés (à ressaisir) et désactive la 2FA
export async function resetEncryptedSecrets() {
  const { rowCount } = await pool.query("DELETE FROM system_config WHERE value LIKE 'enc:v1:%'")
  const { rowCount: totpCount } = await pool.query(
    "UPDATE users SET totp_secret = NULL, totp_enabled = false WHERE totp_secret LIKE 'enc:v1:%'"
  )
  console.warn(`⚠️  MASTER_KEY_RESET : ${rowCount} secret(s) supprimé(s), 2FA désactivée pour ${totpCount} utilisateur(s). Ressaisissez les secrets dans Paramètres admin.`)
}

// Chiffre les secrets encore stockés en clair (installations antérieures)
export async function encryptPlaintextSecrets() {
  const { rows } = await pool.query("SELECT key, value FROM system_config WHERE key = ANY($1) AND value <> ''", [[...SECRET_KEYS]])
  const plain = rows.filter((r) => !isEncrypted(r.value))
  if (plain.length) await setConfigValues(plain.map((r) => [r.key, r.value]))

  // Secrets TOTP des utilisateurs
  const { rows: users } = await pool.query("SELECT id, totp_secret FROM users WHERE totp_secret IS NOT NULL AND totp_secret NOT LIKE 'enc:%'")
  for (const u of users) {
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [encryptSecret(u.totp_secret), u.id])
  }
}

// Secret de signature des JWT : généré automatiquement, stocké chiffré en base
export async function ensureJwtSecret() {
  let secret = await getConfigValue('security.jwt_secret')
  if (!secret) {
    secret = randomBytes(48).toString('base64url')
    await setConfigValues([['security.jwt_secret', secret]])
    console.log('🔐 Secret JWT généré et stocké chiffré en base')
  }
  return secret
}
