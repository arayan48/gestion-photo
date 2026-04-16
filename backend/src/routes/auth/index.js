import { join } from 'path'
import { writeFile } from 'fs/promises'
import { nanoid } from 'nanoid'
import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/database.js'
import { config } from '../../config/env.js'
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  saveRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateTotpSecret,
  generateTotpQrCode,
  verifyTotp,
  generateOtp,
  verifyOtp,
  hashToken,
} from '../../services/auth.service.js'
import { checkBan, recordFailedAttempt, resetAttempts } from '../../services/ban.service.js'
import { log } from '../../utils/logger.js'
import { extractIp } from '../../utils/fingerprint.js'
import { authenticate } from '../../middleware/auth.js'
import { sendEmail } from '../../services/email/email.service.js'

export default async function authRoutes(fastify) {
  // ─── Setup : créer le super admin ───────────────────────────────────────
  fastify.post('/setup', async (request, reply) => {
    const { rows: setupRows } = await pool.query('SELECT is_completed FROM setup WHERE id = 1')
    if (setupRows[0]?.is_completed) {
      return reply.code(400).send({ error: 'Le setup a déjà été effectué' })
    }

    const { email, pseudo, password, firstName, lastName } = request.body
    if (!email || !pseudo || !password) {
      return reply.code(400).send({ error: 'Email, pseudo et mot de passe requis' })
    }

    const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE is_super_admin = true LIMIT 1')
    if (!roleRows.length) {
      return reply.code(500).send({ error: 'Rôle Super Admin introuvable. Lancez le seed d\'abord.' })
    }

    const passwordHash = await hashPassword(password)
    const userId = uuidv4()

    await pool.query(
      `INSERT INTO users (id, email, password_hash, pseudo, first_name, last_name, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [userId, email.toLowerCase(), passwordHash, pseudo, firstName || null, lastName || null, roleRows[0].id]
    )

    await pool.query('UPDATE setup SET is_completed = true, completed_at = NOW() WHERE id = 1')

    await log({ category: 'system', level: 'info', action: 'setup_completed', userId })

    return reply.send({ message: 'Super Admin créé avec succès. Vous pouvez vous connecter.' })
  })

  // ─── Vérifier si setup complété ─────────────────────────────────────────
  fastify.get('/setup/status', async (_, reply) => {
    const { rows } = await pool.query('SELECT is_completed FROM setup WHERE id = 1')
    return reply.send({ isCompleted: rows[0]?.is_completed || false })
  })

  // ─── Demande de création de compte ──────────────────────────────────────
  fastify.post('/register/request', async (request, reply) => {
    const { email, pseudo, password, firstName, lastName, reason } = request.body

    if (!email || !pseudo || !password || !reason) {
      return reply.code(400).send({ error: 'Email, pseudo, mot de passe et raison requis' })
    }

    // Vérifier unicité
    const { rows: existing } = await pool.query(
      'SELECT 1 FROM users WHERE email = $1 OR pseudo = $2',
      [email.toLowerCase(), pseudo]
    )
    if (existing.length) {
      return reply.code(409).send({ error: 'Email ou pseudo déjà utilisé' })
    }

    const passwordHash = await hashPassword(password)

    await pool.query(
      `INSERT INTO account_requests (email, pseudo, first_name, last_name, password_hash, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [email.toLowerCase(), pseudo, firstName || null, lastName || null, passwordHash, reason]
    )

    // Notifier les admins (via websocket + DB)
    const { notifyAdmins } = await import('../../utils/logger.js')
    await notifyAdmins({
      type: 'new_account_request',
      message: `Nouvelle demande de compte de ${pseudo} (${email})`,
    })

    return reply.send({ message: 'Demande envoyée avec succès. Un administrateur la traitera sous peu.' })
  })

  // ─── Connexion ──────────────────────────────────────────────────────────
  fastify.post('/login', async (request, reply) => {
    const { email, password, totp, browserFingerprint } = request.body
    const ip = extractIp(request)
    const userAgent = request.headers['user-agent'] || ''

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email et mot de passe requis' })
    }

    // Vérifier le ban
    const banCheck = await checkBan({ ip, identifier: email, userAgent, browserFingerprint })
    if (banCheck.banned) {
      return reply.code(429).send({
        error: banCheck.permanent
          ? 'Accès permanent interdit'
          : `Compte bloqué jusqu'au ${new Date(banCheck.bannedUntil).toLocaleString('fr-FR')}`,
        banId: banCheck.banId,
      })
    }

    const { rows } = await pool.query(
      `SELECT u.*, r.is_super_admin FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    )

    if (!rows.length || !rows[0].password_hash) {
      await recordFailedAttempt({ ip, identifier: email, userAgent, browserFingerprint })
      await log({ category: 'auth', level: 'warning', action: 'login_failed', ipAddress: ip, metadata: { email } })
      return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })
    }

    const user = rows[0]

    if (!user.is_active) {
      return reply.code(403).send({ error: 'Compte inactif ou en attente de validation' })
    }
    if (user.is_banned) {
      return reply.code(403).send({ error: 'Compte suspendu' })
    }

    const valid = await verifyPassword(user.password_hash, password)
    if (!valid) {
      await recordFailedAttempt({ ip, identifier: email, userAgent, browserFingerprint })
      await log({ category: 'auth', level: 'warning', action: 'login_failed', userId: user.id, ipAddress: ip })
      return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })
    }

    // Vérifier TOTP si activé
    if (user.totp_enabled) {
      if (!totp) {
        return reply.code(200).send({ requireTotp: true })
      }
      const totpValid = verifyTotp(user.totp_secret, totp)
      if (!totpValid) {
        return reply.code(401).send({ error: 'Code TOTP invalide' })
      }
    }

    await resetAttempts({ ip, identifier: email })

    const { accessToken, refreshToken } = generateTokenPair(fastify, user.id, user.email)
    await saveRefreshToken(user.id, refreshToken, ip, userAgent)

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    })

    await log({ category: 'auth', level: 'info', action: 'login_success', userId: user.id, ipAddress: ip })

    return reply.send({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        roleId: user.role_id,
        isSuperAdmin: user.is_super_admin,
        storageQuota: user.storage_quota,
        storageUsed: user.storage_used,
      },
    })
  })

  // ─── Refresh token ──────────────────────────────────────────────────────
  fastify.post('/refresh', async (request, reply) => {
    const rawToken = request.cookies?.refresh_token
    if (!rawToken) return reply.code(401).send({ error: 'Refresh token manquant' })

    const ip = extractIp(request)
    const userAgent = request.headers['user-agent'] || ''

    const result = await rotateRefreshToken(fastify, rawToken, ip, userAgent)
    if (!result) return reply.code(401).send({ error: 'Refresh token invalide ou expiré' })

    reply.setCookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    })

    return reply.send({ accessToken: result.accessToken })
  })

  // ─── Déconnexion ─────────────────────────────────────────────────────────
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const rawToken = request.cookies?.refresh_token
    if (rawToken) {
      const hash = hashToken(rawToken)
      await pool.query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [hash])
    }

    reply.clearCookie('refresh_token', { path: '/api/auth/refresh' })
    await log({ category: 'auth', level: 'info', action: 'logout', userId: request.currentUser.id })

    return reply.send({ message: 'Déconnecté avec succès' })
  })

  // ─── OAuth2 Discord ──────────────────────────────────────────────────────
  fastify.get('/discord', async (_, reply) => {
    const params = new URLSearchParams({
      client_id: config.discord.clientId,
      redirect_uri: config.discord.redirectUri,
      response_type: 'code',
      scope: 'identify email',
    })
    return reply.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
  })

  fastify.get('/discord/callback', async (request, reply) => {
    const { code } = request.query
    if (!code) return reply.code(400).send({ error: 'Code OAuth2 manquant' })

    const ip = extractIp(request)

    try {
      const { default: axios } = await import('axios')

      const tokenRes = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: config.discord.clientId,
          client_secret: config.discord.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.discord.redirectUri,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )

      const userRes = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      })

      const discordUser = userRes.data
      const discordAvatar = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null

      // Chercher utilisateur existant par discord_id ou email
      let { rows } = await pool.query(
        'SELECT * FROM users WHERE discord_id = $1 OR email = $2',
        [discordUser.id, discordUser.email?.toLowerCase()]
      )

      let user
      if (rows.length) {
        user = rows[0]
        await pool.query(
          `UPDATE users SET discord_id = $1, discord_avatar = $2, discord_pseudo = $3, updated_at = NOW()
           WHERE id = $4`,
          [discordUser.id, discordAvatar, discordUser.username, user.id]
        )
      } else {
        return reply.redirect(`${config.appUrl}/login?error=account_not_found&discord_id=${discordUser.id}`)
      }

      if (!user.is_active || user.is_banned) {
        return reply.redirect(`${config.appUrl}/login?error=account_inactive`)
      }

      const { accessToken, refreshToken } = generateTokenPair(fastify, user.id, user.email)
      await saveRefreshToken(user.id, refreshToken, ip, request.headers['user-agent'] || '')

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60,
      })

      await log({ category: 'auth', level: 'info', action: 'login_discord', userId: user.id, ipAddress: ip })

      return reply.redirect(`${config.appUrl}/explorer?token=${accessToken}`)
    } catch (err) {
      return reply.redirect(`${config.appUrl}/login?error=discord_failed`)
    }
  })

  // ─── Mot de passe oublié ─────────────────────────────────────────────────
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body
    if (!email) return reply.code(400).send({ error: 'Email requis' })

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])

    // Toujours répondre 200 pour ne pas révéler l'existence du compte
    if (rows.length) {
      const token = await generatePasswordResetToken(email.toLowerCase())
      await sendEmail({ type: 'passwordReset', to: email, data: { token } })
    }

    return reply.send({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' })
  })

  fastify.post('/reset-password', async (request, reply) => {
    const { token, password } = request.body
    if (!token || !password) return reply.code(400).send({ error: 'Token et mot de passe requis' })

    const email = await verifyPasswordResetToken(token)
    if (!email) return reply.code(400).send({ error: 'Token invalide ou expiré' })

    const passwordHash = await hashPassword(password)
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [passwordHash, email])

    return reply.send({ message: 'Mot de passe réinitialisé avec succès.' })
  })

  // ─── TOTP Setup ──────────────────────────────────────────────────────────
  fastify.post('/totp/setup', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const secret = generateTotpSecret()
    const qrCode = await generateTotpQrCode(secret, user.email)

    // Stocker le secret temporairement (avant confirmation)
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, user.id])

    return reply.send({ secret, qrCode })
  })

  fastify.post('/totp/confirm', { preHandler: [authenticate] }, async (request, reply) => {
    const { code } = request.body
    const user = request.currentUser

    const { rows } = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [user.id])
    if (!rows[0]?.totp_secret) return reply.code(400).send({ error: 'TOTP non initialisé' })

    if (!verifyTotp(rows[0].totp_secret, code)) {
      return reply.code(401).send({ error: 'Code TOTP invalide' })
    }

    await pool.query('UPDATE users SET totp_enabled = true WHERE id = $1', [user.id])
    return reply.send({ message: '2FA TOTP activé avec succès' })
  })

  fastify.post('/totp/disable', { preHandler: [authenticate] }, async (request, reply) => {
    const { code } = request.body
    const user = request.currentUser

    const { rows } = await pool.query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [user.id])
    if (!rows[0]?.totp_enabled) return reply.code(400).send({ error: 'TOTP non activé' })

    if (!verifyTotp(rows[0].totp_secret, code)) {
      return reply.code(401).send({ error: 'Code TOTP invalide' })
    }

    await pool.query('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [user.id])
    return reply.send({ message: '2FA TOTP désactivé' })
  })

  // ─── OTP email ───────────────────────────────────────────────────────────
  fastify.post('/otp/send', async (request, reply) => {
    const { email } = request.body
    if (!email) return reply.code(400).send({ error: 'Email requis' })

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (!rows.length) return reply.send({ message: 'Code OTP envoyé si le compte existe.' })

    const code = generateOtp(email.toLowerCase())
    await sendEmail({ type: 'otp', to: email, data: { code } })

    return reply.send({ message: 'Code OTP envoyé.' })
  })

  fastify.post('/otp/verify', async (request, reply) => {
    const { email, code } = request.body
    if (!email || !code) return reply.code(400).send({ error: 'Email et code requis' })

    const valid = verifyOtp(email.toLowerCase(), code)
    if (!valid) return reply.code(401).send({ error: 'Code OTP invalide ou expiré' })

    return reply.send({ valid: true })
  })

  // ─── Profil ───────────────────────────────────────────────────────────────
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.pseudo, u.first_name, u.last_name, u.avatar_path,
              u.discord_id, u.discord_avatar, u.discord_pseudo,
              u.storage_quota, u.storage_used, u.totp_enabled, u.created_at,
              r.id AS role_id, r.name AS role_name, r.is_super_admin
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [request.currentUser.id]
    )
    return reply.send(rows[0])
  })
}
