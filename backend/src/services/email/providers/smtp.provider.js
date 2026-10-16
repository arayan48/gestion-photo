import { createTransport } from 'nodemailer'
import { buildProvider } from '../templates.js'

export default function createSmtpProvider(settings) {
  return buildProvider(async ({ to, subject, html }) => {
    if (!settings.smtpHost) throw new Error('Provider email SMTP non configuré (hôte manquant)')
    const transport = createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort) || 587,
      secure: settings.smtpSecure === 'true',
      auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPassword } : undefined,
    })
    await transport.sendMail({ from: settings.from, to, subject, html })
  }, settings)
}
