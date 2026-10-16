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
import { getConfigValues } from '../../services/config.service.js'
import { log, notifyAdmins } from '../../utils/logger.js'
import { extractIp } from '../../utils/fingerprint.js'
import { authenticate } from '../../middleware/auth.js'
import { sendEmail } from '../../services/email/email.service.js'
import {
  PASSWORD_MIN_LENGTH,
  isNonEmptyString,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  optionalString,
} from '../../utils/validation.js'

// Le cookie doit être envoyé à /refresh ET /logout (sinon la déconnexion ne peut pas
// révoquer le refresh token) → chemin commun /api/auth
const REFRESH_COOKIE_PATH = '/api/auth'
const LEGACY_REFRESH_COOKIE_PATH = '/api/auth/refresh'
const DISCORD_STATE_COOKIE = 'discord_oauth_state'

function setRefreshCookie(reply, token) {
  // Supprime l'ancien cookie (anciennes versions) pour éviter deux cookies homonymes
  reply.clearCookie('refresh_token', { path: LEGACY_REFRESH_COOKIE_PATH })
  reply.setCookie('refresh_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: 7 * 24 * 60 * 60,
  })
}

function clearRefreshCookie(reply) {
  reply.clearCookie('refresh_token', { path: LEGACY_REFRESH_COOKIE_PATH })
  reply.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH })
}

const PASSWORD_ERROR = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`

async function getDiscordConfig() {
  const db = await getConfigValues(['discord.client_id', 'discord.client_secret', 'discord.redirect_uri'])
  return {
    clientId: db['discord.client_id'] || config.discord.clientId,
    clientSecret: db['discord.client_secret'] || config.discord.clientSecret,
    redirectUri: db['discord.redirect_uri'] || config.discord.redirectUri,
  }
}

async function getUserPermissions(roleId, isSuperAdmin) {
  if (isSuperAdmin) {
    const { rows } = await pool.query('SELECT key FROM permissions ORDER BY key')
    return rows.map((r) => r.key)
  }
  if (!roleId) return []
  const { rows } = await pool.query(
    `SELECT p.key FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = $1 ORDER BY p.key`,
    [roleId]
  )
  return rows.map((r) => r.key)
}

export default async function authRoutes(fastify) {
  // ─── Setup : créer le super admin ───────────────────────────────────────
  fastify.post('/setup', async (request, reply) => {
    const { email, pseudo, password, firstName, lastName } = request.body || {}
    if (!isValidEmail(email) || !isNonEmptyString(pseudo, 100) || typeof password !== 'string') {
      return reply.code(400).send({ error: 'Email, pseudo et mot de passe requis' })
    }
    if (!isValidPassword(password)) return reply.code(400).send({ error: PASSWORD_ERROR })

    const passwordHash = await hashPassword(password)
    const userId = uuidv4()

    // Transaction + verrou sur la ligne setup : deux requêtes simultanées ne peuvent
    // pas créer deux Super Admins
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: setupRows } = await client.query('SELECT is_completed FROM setup WHERE id = 1 FOR UPDATE')
      if (setupRows[0]?.is_completed) {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'Le setup a déjà été effectué' })
      }

      let roleId
      const { rows: roleRows } = await client.query('SELECT id FROM roles WHERE is_super_admin = true LIMIT 1')
      if (roleRows.length) {
        roleId = roleRows[0].id
      } else {
        const { rows: newRole } = await client.query(
          `INSERT INTO roles (name, is_super_admin) VALUES ('Super Admin', true) RETURNING id`
        )
        roleId = newRole[0].id
      }

      await client.query(
        `INSERT INTO users (id, email, password_hash, pseudo, first_name, last_name, role_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [userId, normalizeEmail(email), passwordHash, pseudo.trim(), optionalString(firstName), optionalString(lastName), roleId]
      )

      await client.query('UPDATE setup SET is_completed = true, completed_at = NOW() WHERE id = 1')
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    await log({ category: 'system', level: 'info', action: 'setup_completed', userId, ipAddress: extractIp(request) })

    return reply.send({ message: 'Super Admin créé avec succès. Vous pouvez vous connecter.' })
  })

  // ─── Vérifier si setup complété ─────────────────────────────────────────
  fastify.get('/setup/status', async (_, reply) => {
    const { rows } = await pool.query('SELECT is_completed FROM setup WHERE id = 1')
    return reply.send({ isCompleted: rows[0]?.is_completed || false })
  })

  // ─── Demande de création de compte ──────────────────────────────────────
  fastify.post('/register/request', async (request, reply) => {
    const { email, pseudo, password, firstName, lastName, reason } = request.body || {}

    if (!isValidEmail(email) || !isNonEmptyString(pseudo, 100) || typeof password !== 'string' || !isNonEmptyString(reason, 2000)) {
      return reply.code(400).send({ error: 'Email, pseudo, mot de passe et raison requis' })
    }
    if (!isValidPassword(password)) return reply.code(400).send({ error: PASSWORD_ERROR })

    const normalizedEmail = normalizeEmail(email)
    const cleanPseudo = pseudo.trim()

    // Vérifier unicité (comptes existants et demandes encore en attente)
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM users WHERE email = $1 OR pseudo = $2
       UNION ALL
       SELECT 1 FROM account_requests WHERE status = 'pending' AND (email = $1 OR pseudo = $2)`,
      [normalizedEmail, cleanPseudo]
    )
    if (existing.length) {
      return reply.code(409).send({ error: 'Email ou pseudo déjà utilisé (ou demande déjà en attente)' })
    }

    const passwordHash = await hashPassword(password)

    await pool.query(
      `INSERT INTO account_requests (email, pseudo, first_name, last_name, password_hash, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [normalizedEmail, cleanPseudo, optionalString(firstName), optionalString(lastName), passwordHash, reason.trim()]
    )

    await log({ category: 'users', level: 'info', action: 'account_requested', ipAddress: extractIp(request), metadata: { email: normalizedEmail, pseudo: cleanPseudo } })

    // Notifier les admins (via websocket + DB)
    await notifyAdmins({
      type: 'new_account_request',
      message: `Nouvelle demande de compte de ${cleanPseudo} (${normalizedEmail})`,
    })

    return reply.send({ message: 'Demande envoyée avec succès. Un administrateur la traitera sous peu.' })
  })

  // ─── Connexion ──────────────────────────────────────────────────────────
  fastify.post('/login', async (request, reply) => {
    const { email, password, totp, browserFingerprint } = request.body || {}
    const ip = extractIp(request)
    const userAgent = request.headers['user-agent'] || ''

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return reply.code(400).send({ error: 'Email et mot de passe requis' })
    }

    const identifier = normalizeEmail(email)
    const fingerprint = typeof browserFingerprint === 'string' ? browserFingerprint.substring(0, 255) : ''
    const attempt = { ip, identifier, userAgent, browserFingerprint: fingerprint }

    // Vérifier le ban
    const banCheck = await checkBan(attempt)
    if (banCheck.banned) {
      return reply.code(429).send({
        error: banCheck.permanent
          ? 'Accès permanent interdit'
          : `Compte bloqué jusqu'au ${new Date(banCheck.bannedUntil).toLocaleString('fr-FR', { timeZone: 'UTC' })} (UTC)`,
        banId: banCheck.banId,
      })
    }

    const { rows } = await pool.query(
      `SELECT u.*, r.is_super_admin, r.name AS role_name FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [identifier]
    )

    if (!rows.length || !rows[0].password_hash) {
      await recordFailedAttempt(attempt)
      await log({ category: 'auth', level: 'warning', action: 'login_failed', ipAddress: ip, metadata: { email: identifier } })
      return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })
    }

    const user = rows[0]

    // Le mot de passe est vérifié AVANT l'état du compte : on ne révèle pas
    // l'existence d'un compte suspendu / inactif à quelqu'un qui ne connaît pas le mot de passe
    const valid = await verifyPassword(user.password_hash, password)
    if (!valid) {
      await recordFailedAttempt(attempt)
      await log({ category: 'auth', level: 'warning', action: 'login_failed', userId: user.id, ipAddress: ip })
      return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })
    }

    if (!user.is_active) {
      return reply.code(403).send({ error: 'Compte inactif ou en attente de validation' })
    }
    if (user.is_banned) {
      return reply.code(403).send({ error: 'Compte suspendu' })
    }

    // Vérifier TOTP si activé
    if (user.totp_enabled) {
      if (!totp) {
        return reply.code(200).send({ requireTotp: true })
      }
      if (!verifyTotp(user.totp_secret, String(totp))) {
        // Compte aussi comme tentative échouée : sinon le code TOTP serait brute-forçable
        await recordFailedAttempt(attempt)
        await log({ category: 'auth', level: 'warning', action: 'login_totp_failed', userId: user.id, ipAddress: ip })
        return reply.code(401).send({ error: 'Code TOTP invalide' })
      }
    }

    await resetAttempts({ ip, identifier })

    const { accessToken, refreshToken } = generateTokenPair(fastify, user.id, user.email)
    await saveRefreshToken(user.id, refreshToken, ip, userAgent)
    setRefreshCookie(reply, refreshToken)

    await log({ category: 'auth', level: 'info', action: 'login_success', userId: user.id, ipAddress: ip })

    return reply.send({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_path: user.avatar_path,
        discord_id: user.discord_id,
        discord_avatar: user.discord_avatar,
        discord_pseudo: user.discord_pseudo,
        role_id: user.role_id,
        role_name: user.role_name,
        is_super_admin: user.is_super_admin,
        storage_quota: user.storage_quota,
        storage_used: user.storage_used,
        totp_enabled: user.totp_enabled,
        created_at: user.created_at,
        permissions: await getUserPermissions(user.role_id, user.is_super_admin),
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
    if (!result) {
      clearRefreshCookie(reply)
      return reply.code(401).send({ error: 'Refresh token invalide ou expiré' })
    }

    setRefreshCookie(reply, result.refreshToken)

    return reply.send({ accessToken: result.accessToken })
  })

  // ─── Déconnexion ─────────────────────────────────────────────────────────
  // Pas d'authenticate : on doit pouvoir se déconnecter même avec un access token expiré
  fastify.post('/logout', async (request, reply) => {
    const rawToken = request.cookies?.refresh_token
    let userId = null
    if (rawToken) {
      const { rows } = await pool.query(
        'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1 RETURNING user_id',
        [hashToken(rawToken)]
      )
      userId = rows[0]?.user_id || null
    }

    clearRefreshCookie(reply)
    if (userId) await log({ category: 'auth', level: 'info', action: 'logout', userId, ipAddress: extractIp(request) })

    return reply.send({ message: 'Déconnecté avec succès' })
  })

  // ─── OAuth2 Discord ──────────────────────────────────────────────────────
  // Le paramètre `state` (JWT signé + nonce en cookie) protège contre le CSRF OAuth
  // et transporte l'ID de l'utilisateur lorsqu'il s'agit de lier un compte.
  async function buildDiscordAuthorizeUrl(reply, linkUserId = null) {
    const discord = await getDiscordConfig()
    if (!discord.clientId || !discord.redirectUri) return null

    const nonce = nanoid(24)
    const state = fastify.jwt.sign(
      { purpose: 'discord_oauth', nonce, linkUserId },
      { expiresIn: '10m' }
    )

    reply.setCookie(DISCORD_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax', // envoyé lors de la redirection retour depuis discord.com
      path: '/api/auth/discord',
      maxAge: 10 * 60,
    })

    const params = new URLSearchParams({
      client_id: discord.clientId,
      redirect_uri: discord.redirectUri,
      response_type: 'code',
      scope: 'identify email',
      state,
    })
    return `https://discord.com/api/oauth2/authorize?${params}`
  }

  fastify.get('/discord', async (_, reply) => {
    const url = await buildDiscordAuthorizeUrl(reply)
    if (!url) return reply.redirect(`${config.appUrl}/login?error=discord_not_configured`)
    return reply.redirect(url)
  })

  // Lier Discord au compte connecté (appelé depuis Paramètres → Comptes liés)
  fastify.post('/discord/link', { preHandler: [authenticate] }, async (request, reply) => {
    const url = await buildDiscordAuthorizeUrl(reply, request.currentUser.id)
    if (!url) return reply.code(400).send({ error: 'Discord OAuth2 n\'est pas configuré sur ce serveur' })
    return reply.send({ url })
  })

  fastify.get('/discord/callback', async (request, reply) => {
    const { code, state, error: oauthError } = request.query
    const ip = extractIp(request)
    const expectedNonce = request.cookies?.[DISCORD_STATE_COOKIE]
    reply.clearCookie(DISCORD_STATE_COOKIE, { path: '/api/auth/discord' })

    let statePayload
    try {
      statePayload = fastify.jwt.verify(state)
    } catch {
      statePayload = null
    }
    const linkMode = !!statePayload?.linkUserId
    const failRedirect = (reason) =>
      reply.redirect(linkMode ? `${config.appUrl}/settings?discord_error=${reason}` : `${config.appUrl}/login?error=${reason}`)

    if (oauthError) return failRedirect('discord_cancelled')
    if (!code) return reply.code(400).send({ error: 'Code OAuth2 manquant' })
    if (!statePayload || statePayload.purpose !== 'discord_oauth' || !expectedNonce || statePayload.nonce !== expectedNonce) {
      await log({ category: 'security', level: 'warning', action: 'discord_invalid_state', ipAddress: ip })
      return failRedirect('discord_failed')
    }

    try {
      const { default: axios } = await import('axios')
      const discord = await getDiscordConfig()

      const tokenRes = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: discord.clientId,
          client_secret: discord.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: discord.redirectUri,
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
      const discordPseudo = discordUser.global_name || discordUser.username

      // ── Mode liaison : rattacher le compte Discord à l'utilisateur connecté ──
      if (linkMode) {
        const { rows: taken } = await pool.query(
          'SELECT 1 FROM users WHERE discord_id = $1 AND id != $2',
          [discordUser.id, statePayload.linkUserId]
        )
        if (taken.length) return failRedirect('discord_already_linked')

        await pool.query(
          `UPDATE users SET discord_id = $1, discord_avatar = $2, discord_pseudo = $3, updated_at = NOW()
           WHERE id = $4`,
          [discordUser.id, discordAvatar, discordPseudo, statePayload.linkUserId]
        )
        await log({ category: 'auth', level: 'info', action: 'discord_linked', userId: statePayload.linkUserId, ipAddress: ip })
        return reply.redirect(`${config.appUrl}/settings?discord=linked`)
      }

      // ── Mode connexion ──
      let { rows } = await pool.query('SELECT * FROM users WHERE discord_id = $1', [discordUser.id])

      // Rattachement automatique par email uniquement si Discord l'a vérifié :
      // sinon n'importe qui pourrait créer un compte Discord avec l'email d'une victime
      if (!rows.length && discordUser.email && discordUser.verified) {
        ;({ rows } = await pool.query('SELECT * FROM users WHERE email = $1', [discordUser.email.toLowerCase()]))
      }

      if (!rows.length) {
        return reply.redirect(`${config.appUrl}/login?error=account_not_found`)
      }

      const user = rows[0]
      if (!user.is_active || user.is_banned) {
        return reply.redirect(`${config.appUrl}/login?error=account_inactive`)
      }

      await pool.query(
        `UPDATE users SET discord_id = $1, discord_avatar = $2, discord_pseudo = $3, updated_at = NOW()
         WHERE id = $4`,
        [discordUser.id, discordAvatar, discordPseudo, user.id]
      )

      const { refreshToken } = generateTokenPair(fastify, user.id, user.email)
      await saveRefreshToken(user.id, refreshToken, ip, request.headers['user-agent'] || '')
      setRefreshCookie(reply, refreshToken)

      await log({ category: 'auth', level: 'info', action: 'login_discord', userId: user.id, ipAddress: ip })

      // L'access token n'est jamais placé dans l'URL (historique, logs, Referer) :
      // le frontend le récupère via /refresh grâce au cookie httpOnly
      return reply.redirect(`${config.appUrl}/login?discord=success`)
    } catch (err) {
      request.log.warn({ err: err.message }, 'Échec OAuth2 Discord')
      return failRedirect('discord_failed')
    }
  })

  // ─── Mot de passe oublié ─────────────────────────────────────────────────
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body || {}
    if (!isValidEmail(email)) return reply.code(400).send({ error: 'Email requis' })

    const normalizedEmail = normalizeEmail(email)
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])

    // Toujours répondre 200 pour ne pas révéler l'existence du compte
    if (rows.length) {
      try {
        const token = await generatePasswordResetToken(normalizedEmail)
        await sendEmail({ type: 'passwordReset', to: normalizedEmail, data: { token } })
        await log({ category: 'auth', level: 'info', action: 'password_reset_requested', userId: rows[0].id, ipAddress: extractIp(request) })
      } catch (err) {
        // Une erreur d'envoi ne doit pas révéler l'existence du compte (réponse identique)
        await log({ category: 'system', level: 'error', action: 'email_failed', metadata: { type: 'passwordReset', error: err.message } })
      }
    }

    return reply.send({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' })
  })

  fastify.post('/reset-password', async (request, reply) => {
    const { token, password } = request.body || {}
    if (typeof token !== 'string' || !token || typeof password !== 'string') {
      return reply.code(400).send({ error: 'Token et mot de passe requis' })
    }
    if (!isValidPassword(password)) return reply.code(400).send({ error: PASSWORD_ERROR })

    const email = await verifyPasswordResetToken(token)
    if (!email) return reply.code(400).send({ error: 'Token invalide ou expiré' })

    const passwordHash = await hashPassword(password)
    const { rows } = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id',
      [passwordHash, email]
    )

    if (rows.length) {
      // Déconnecter toutes les sessions existantes (le compte était peut-être compromis)
      await revokeAllUserTokens(rows[0].id)
      await log({ category: 'auth', level: 'info', action: 'password_reset', userId: rows[0].id, ipAddress: extractIp(request) })
    }

    return reply.send({ message: 'Mot de passe réinitialisé avec succès.' })
  })

  // ─── TOTP Setup ──────────────────────────────────────────────────────────
  fastify.post('/totp/setup', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    // Ne pas remplacer silencieusement un secret actif (il faut d'abord désactiver avec un code)
    if (user.totp_enabled) return reply.code(400).send({ error: '2FA déjà activée' })

    const secret = generateTotpSecret()
    const qrCode = await generateTotpQrCode(secret, user.email)

    // Stocker le secret temporairement (avant confirmation)
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, user.id])

    return reply.send({ secret, qrCode })
  })

  fastify.post('/totp/confirm', { preHandler: [authenticate] }, async (request, reply) => {
    const { code } = request.body || {}
    const user = request.currentUser

    const { rows } = await pool.query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [user.id])
    if (!rows[0]?.totp_secret) return reply.code(400).send({ error: 'TOTP non initialisé' })
    if (rows[0].totp_enabled) return reply.code(400).send({ error: '2FA déjà activée' })

    if (!verifyTotp(rows[0].totp_secret, String(code ?? ''))) {
      return reply.code(401).send({ error: 'Code TOTP invalide' })
    }

    await pool.query('UPDATE users SET totp_enabled = true WHERE id = $1', [user.id])
    await log({ category: 'security', level: 'info', action: 'totp_enabled', userId: user.id, ipAddress: extractIp(request) })
    return reply.send({ message: '2FA TOTP activé avec succès' })
  })

  fastify.post('/totp/disable', { preHandler: [authenticate] }, async (request, reply) => {
    const { code } = request.body || {}
    const user = request.currentUser

    const { rows } = await pool.query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [user.id])
    if (!rows[0]?.totp_enabled) return reply.code(400).send({ error: 'TOTP non activé' })

    if (!verifyTotp(rows[0].totp_secret, String(code ?? ''))) {
      return reply.code(401).send({ error: 'Code TOTP invalide' })
    }

    await pool.query('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [user.id])
    await log({ category: 'security', level: 'warning', action: 'totp_disabled', userId: user.id, ipAddress: extractIp(request) })
    return reply.send({ message: '2FA TOTP désactivé' })
  })

  // ─── OTP email ───────────────────────────────────────────────────────────
  fastify.post('/otp/send', async (request, reply) => {
    const { email } = request.body || {}
    if (!isValidEmail(email)) return reply.code(400).send({ error: 'Email requis' })

    const normalizedEmail = normalizeEmail(email)
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (rows.length) {
      try {
        const code = await generateOtp(normalizedEmail)
        await sendEmail({ type: 'otp', to: normalizedEmail, data: { code } })
      } catch (err) {
        await log({ category: 'system', level: 'error', action: 'email_failed', metadata: { type: 'otp', error: err.message } })
      }
    }

    // Réponse identique que le compte existe ou non
    return reply.send({ message: 'Code OTP envoyé si le compte existe.' })
  })

  fastify.post('/otp/verify', async (request, reply) => {
    const { email, code } = request.body || {}
    if (!isValidEmail(email) || !code) return reply.code(400).send({ error: 'Email et code requis' })

    const ip = extractIp(request)
    const identifier = normalizeEmail(email)
    const attempt = { ip, identifier: `otp:${identifier}`, userAgent: request.headers['user-agent'] || '' }

    // Même protection anti brute-force que la connexion
    const banCheck = await checkBan(attempt)
    if (banCheck.banned) return reply.code(429).send({ error: 'Trop de tentatives, réessayez plus tard', banId: banCheck.banId })

    const valid = await verifyOtp(identifier, code)
    if (!valid) {
      await recordFailedAttempt(attempt)
      return reply.code(401).send({ error: 'Code OTP invalide ou expiré' })
    }

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
    const me = rows[0]
    me.permissions = await getUserPermissions(me.role_id, me.is_super_admin)
    return reply.send(me)
  })
}
