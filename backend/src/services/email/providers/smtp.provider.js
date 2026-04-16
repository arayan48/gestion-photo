import { createTransport } from 'nodemailer'
import { config } from '../../../config/env.js'

function getTransport() {
  return createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

async function send({ to, subject, html }) {
  const transport = getTransport()
  await transport.sendMail({ from: config.email.from, to, subject, html })
}

export default {
  async sendAccountAccepted(to, pseudo) {
    await send({ to, subject: 'Votre compte WubalStore a été accepté', html: `<h2>Bienvenue ${pseudo} !</h2><p>Votre demande a été acceptée.</p>` })
  },
  async sendOTP(to, code) {
    await send({ to, subject: 'Code de vérification WubalStore', html: `<p>Code : <strong>${code}</strong></p>` })
  },
  async sendPasswordReset(to, token) {
    const link = `${config.appUrl}/reset-password?token=${token}`
    await send({ to, subject: 'Réinitialisation mot de passe', html: `<a href="${link}">Réinitialiser</a>` })
  },
}
