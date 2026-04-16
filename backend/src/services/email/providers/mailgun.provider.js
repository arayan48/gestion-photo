import axios from 'axios'
import { config } from '../../../config/env.js'

async function send({ to, subject, html }) {
  if (!process.env.MAILGUN_API_KEY) return
  const formData = new URLSearchParams({ from: config.email.from, to, subject, html })
  await axios.post(
    `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
    formData,
    { auth: { username: 'api', password: process.env.MAILGUN_API_KEY } }
  )
}

export default {
  async sendAccountAccepted(to, pseudo) { await send({ to, subject: 'Compte accepté', html: `<p>Bienvenue ${pseudo}</p>` }) },
  async sendOTP(to, code) { await send({ to, subject: 'Code OTP', html: `<p>${code}</p>` }) },
  async sendPasswordReset(to, token) { await send({ to, subject: 'Réinitialisation', html: `<a href="${config.appUrl}/reset-password?token=${token}">Réinitialiser</a>` }) },
}
