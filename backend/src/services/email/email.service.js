import pool from '../../config/database.js'
import { config } from '../../config/env.js'

async function getActiveProvider() {
  try {
    const { rows } = await pool.query('SELECT value FROM system_config WHERE key = $1', ['email.provider'])
    return rows[0]?.value || config.email.provider
  } catch {
    return config.email.provider
  }
}

async function loadProvider(name) {
  switch (name) {
    case 'brevo':
      return (await import('./providers/brevo.provider.js')).default
    case 'smtp':
      return (await import('./providers/smtp.provider.js')).default
    case 'resend':
      return (await import('./providers/resend.provider.js')).default
    case 'mailgun':
      return (await import('./providers/mailgun.provider.js')).default
    case 'sendgrid':
      return (await import('./providers/sendgrid.provider.js')).default
    default:
      return (await import('./providers/brevo.provider.js')).default
  }
}

export async function sendEmail({ type, to, data = {} }) {
  const providerName = await getActiveProvider()
  const provider = await loadProvider(providerName)

  switch (type) {
    case 'accountAccepted':
      return provider.sendAccountAccepted(to, data.pseudo)
    case 'otp':
      return provider.sendOTP(to, data.code)
    case 'passwordReset':
      return provider.sendPasswordReset(to, data.token)
    default:
      throw new Error(`Type email inconnu: ${type}`)
  }
}
