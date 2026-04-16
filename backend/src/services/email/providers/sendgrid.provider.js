import axios from 'axios'
import { config } from '../../../config/env.js'

async function send({ to, subject, html }) {
  if (!process.env.SENDGRID_API_KEY) return
  await axios.post(
    'https://api.sendgrid.com/v3/mail/send',
    { personalizations: [{ to: [{ email: to }] }], from: { email: config.email.from }, subject, content: [{ type: 'text/html', value: html }] },
    { headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` } }
  )
}

export default {
  async sendAccountAccepted(to, pseudo) { await send({ to, subject: 'Compte accepté', html: `<p>Bienvenue ${pseudo}</p>` }) },
  async sendOTP(to, code) { await send({ to, subject: 'Code OTP', html: `<p>${code}</p>` }) },
  async sendPasswordReset(to, token) { await send({ to, subject: 'Réinitialisation', html: `<a href="${config.appUrl}/reset-password?token=${token}">Réinitialiser</a>` }) },
}
