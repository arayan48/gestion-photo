import { config } from '../../config/env.js'
import { getConfigValues } from '../config.service.js'

// Clés éditables dans Paramètres admin → Email ; les variables d'environnement servent de repli
const CONFIG_KEYS = [
  'email.provider', 'email.from', 'app.name', 'app.url',
  'email.brevo_key',
  'email.smtp_host', 'email.smtp_port', 'email.smtp_user', 'email.smtp_password', 'email.smtp_secure',
  'email.resend_key',
  'email.mailgun_key', 'email.mailgun_domain',
  'email.sendgrid_key',
]

async function getEmailSettings() {
  const db = await getConfigValues(CONFIG_KEYS)
  const env = process.env
  return {
    provider: db['email.provider'] || config.email.provider,
    from: db['email.from'] || config.email.from,
    appName: db['app.name'] || 'WubalStore',
    appUrl: (db['app.url'] || config.appUrl).replace(/\/+$/, ''),
    brevoKey: db['email.brevo_key'] || env.BREVO_API_KEY,
    smtpHost: db['email.smtp_host'] || env.SMTP_HOST,
    smtpPort: db['email.smtp_port'] || env.SMTP_PORT,
    smtpUser: db['email.smtp_user'] || env.SMTP_USER,
    smtpPassword: db['email.smtp_password'] || env.SMTP_PASSWORD,
    smtpSecure: db['email.smtp_secure'] || env.SMTP_SECURE,
    resendKey: db['email.resend_key'] || env.RESEND_API_KEY,
    mailgunKey: db['email.mailgun_key'] || env.MAILGUN_API_KEY,
    mailgunDomain: db['email.mailgun_domain'] || env.MAILGUN_DOMAIN,
    sendgridKey: db['email.sendgrid_key'] || env.SENDGRID_API_KEY,
  }
}

async function loadProvider(name) {
  switch (name) {
    case 'smtp':
      return (await import('./providers/smtp.provider.js')).default
    case 'resend':
      return (await import('./providers/resend.provider.js')).default
    case 'mailgun':
      return (await import('./providers/mailgun.provider.js')).default
    case 'sendgrid':
      return (await import('./providers/sendgrid.provider.js')).default
    case 'brevo':
    default:
      return (await import('./providers/brevo.provider.js')).default
  }
}

export async function sendEmail({ type, to, data = {} }) {
  const settings = await getEmailSettings()
  const createProvider = await loadProvider(settings.provider)
  const provider = createProvider(settings)

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
