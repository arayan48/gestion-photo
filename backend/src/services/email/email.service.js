import { getConfigValues, getAppUrl } from '../config.service.js'

// Clés éditables dans Paramètres admin → Email (les clés API sont stockées chiffrées)
const CONFIG_KEYS = [
  'email.provider', 'email.from', 'app.name',
  'email.brevo_key',
  'email.smtp_host', 'email.smtp_port', 'email.smtp_user', 'email.smtp_password', 'email.smtp_secure',
  'email.resend_key',
  'email.mailgun_key', 'email.mailgun_domain',
  'email.sendgrid_key',
]

function hostnameOf(url) {
  try { return new URL(url).hostname } catch { return 'localhost' }
}

async function getEmailSettings() {
  const db = await getConfigValues(CONFIG_KEYS)
  const appUrl = await getAppUrl()
  return {
    provider: db['email.provider'] || 'brevo',
    from: db['email.from'] || `noreply@${hostnameOf(appUrl)}`,
    appName: db['app.name'] || 'Obscura',
    appUrl,
    brevoKey: db['email.brevo_key'],
    smtpHost: db['email.smtp_host'],
    smtpPort: db['email.smtp_port'],
    smtpUser: db['email.smtp_user'],
    smtpPassword: db['email.smtp_password'],
    smtpSecure: db['email.smtp_secure'],
    resendKey: db['email.resend_key'],
    mailgunKey: db['email.mailgun_key'],
    mailgunDomain: db['email.mailgun_domain'],
    sendgridKey: db['email.sendgrid_key'],
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
