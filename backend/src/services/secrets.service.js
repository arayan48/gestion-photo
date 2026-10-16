import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { mkdir, readFile, writeFile, chmod } from 'fs/promises'
import { dirname } from 'path'
import { config } from '../config/env.js'

// Chiffrement des secrets stockés en base (clés API, mots de passe SMTP, secrets TOTP…).
// AES-256-GCM : confidentialité + intégrité (une valeur modifiée en base est rejetée).
// Un hash ne conviendrait pas : le serveur doit pouvoir relire ces valeurs pour s'en servir.
//
// La clé maître n'est JAMAIS stockée en base ni dans les sauvegardes :
//   1. variable MASTER_KEY si définie (64 caractères hex, ou n'importe quelle phrase longue)
//   2. sinon fichier MASTER_KEY_FILE (défaut /app/data/master.key), généré au premier démarrage

const PREFIX = 'enc:v1:'
let masterKey = null

function deriveKey(raw) {
  const value = raw.trim()
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex')
  return createHash('sha256').update(value).digest()
}

export async function initMasterKey() {
  if (masterKey) return masterKey

  if (config.secrets.masterKey) {
    masterKey = deriveKey(config.secrets.masterKey)
    return masterKey
  }

  const file = config.secrets.masterKeyFile
  try {
    masterKey = deriveKey(await readFile(file, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    await mkdir(dirname(file), { recursive: true })
    const generated = randomBytes(32).toString('hex')
    await writeFile(file, generated + '\n', { mode: 0o600, flag: 'wx' })
    await chmod(file, 0o600).catch(() => {})
    masterKey = Buffer.from(generated, 'hex')
    console.log(`🔑 Clé maître générée dans ${file} — sauvegardez ce fichier à part (sans lui, les secrets en base sont illisibles)`)
  }
  return masterKey
}

function getKey() {
  if (!masterKey) throw new Error('Clé maître non initialisée (initMasterKey() doit être appelé au démarrage)')
  return masterKey
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(plain) {
  if (plain === null || plain === undefined || plain === '') return plain ?? null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`
}

// Les valeurs en clair (anciennes installations) sont renvoyées telles quelles
export function decryptSecret(value) {
  if (!isEncrypted(value)) return value
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
