import argon2 from 'argon2'
import { createHash, randomInt } from 'crypto'
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

  // Révocation atomique : deux requêtes concurrentes avec le même token ne peuvent
  // pas obtenir chacune un nouveau couple de tokens
  const { rows } = await pool.query(
    `UPDATE refresh_tokens SET revoked = true
     WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()
     RETURNING user_id`,
    [oldHash]
  )

  if (!rows.length) return null

  const old = rows[0]

  const { rows: userRows } = await pool.query(
    'SELECT id, email, is_active, is_banned FROM users WHERE id = $1',
    [old.user_id]
  )
  if (!userRows.length || !userRows[0].is_active || userRows[0].is_banned) return null

  const user = userRows[0]

  // Générer nouveau token
  const newRefresh = nanoid(64)
  await saveRefreshToken(user.id, newRefresh, ip, userAgent)
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
  if (!secret || typeof token !== 'string') return false
  try {
    return authenticator.verify({ token: token.trim(), secret })
  } catch {
    return false
  }
}

// OTP email (6 chiffres) — persisté en base, code hashé
export async function generateOtp(email) {
  const code = randomInt(100000, 1000000).toString()
  const codeHash = hashToken(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await pool.query('DELETE FROM otp_codes WHERE email = $1', [email])
  await pool.query(
    'INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)',
    [email, codeHash, expiresAt]
  )
  return code
}

export async function verifyOtp(email, code) {
  const codeHash = hashToken(String(code))
  const { rows } = await pool.query(
    'DELETE FROM otp_codes WHERE email = $1 AND code_hash = $2 AND expires_at > NOW() RETURNING id',
    [email, codeHash]
  )
  return rows.length > 0
}
