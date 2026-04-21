import argon2 from 'argon2'
import { randomBytes, createHash } from 'crypto'
import { nanoid } from 'nanoid'
import { v4 as uuidv4 } from 'uuid'
import { authenticator } from 'otplib'
import qrcode from 'qrcode'
import pool from '../config/database.js'
import { config } from '../config/env.js'
import { log } from '../utils/logger.js'

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash, password) {
  return argon2.verify(hash, password)
}

export function generateTokenPair(fastify, userId, email) {
  const accessToken = fastify.jwt.sign(
    { id: userId, email },
    { expiresIn: config.jwt.accessExpiry, secret: config.jwt.accessSecret }
  )
  const refreshToken = nanoid(64)
  return { accessToken, refreshToken }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function saveRefreshToken(userId, rawToken, ip, userAgent) {
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, ip, userAgent, expiresAt]
  )
}

export async function rotateRefreshToken(fastify, oldRawToken, ip, userAgent) {
  const oldHash = hashToken(oldRawToken)

  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()`,
    [oldHash]
  )

  if (!rows.length) return null

  const old = rows[0]

  // Révoquer l'ancien
  await pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [old.id])

  // Générer nouveau token
  const newRefresh = nanoid(64)
  await saveRefreshToken(old.user_id, newRefresh, ip, userAgent)

  const { rows: userRows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [old.user_id])
  if (!userRows.length) return null

  const user = userRows[0]
  const accessToken = fastify.jwt.sign(
    { id: user.id, email: user.email },
    { expiresIn: config.jwt.accessExpiry, secret: config.jwt.accessSecret }
  )

  return { accessToken, refreshToken: newRefresh, userId: user.id }
}

export async function revokeAllUserTokens(userId) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
    [userId]
  )
}

// Mot de passe oublié — stocké en base
export async function generatePasswordResetToken(email) {
  const token = nanoid(48)
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await pool.query('DELETE FROM password_reset_tokens WHERE email = $1', [email])
  await pool.query(
    'INSERT INTO password_reset_tokens (token_hash, email, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, email, expiresAt]
  )
  return token
}

export async function verifyPasswordResetToken(token) {
  const tokenHash = hashToken(token)
  const { rows } = await pool.query(
    'DELETE FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING email',
    [tokenHash]
  )
  return rows[0]?.email || null
}

// TOTP
export function generateTotpSecret() {
  return authenticator.generateSecret()
}

export async function generateTotpQrCode(secret, email) {
  const otpauthUrl = authenticator.keyuri(email, 'WubalStore', secret)
  return qrcode.toDataURL(otpauthUrl)
}

export function verifyTotp(secret, token) {
  return authenticator.verify({ token, secret })
}

// OTP email (6 chiffres)
const otpStore = new Map()

export function generateOtp(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  otpStore.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 })
  return code
}

export function verifyOtp(email, code) {
  const entry = otpStore.get(email)
  if (!entry || entry.expiresAt < Date.now()) return false
  if (entry.code !== code) return false
  otpStore.delete(email)
  return true
}
