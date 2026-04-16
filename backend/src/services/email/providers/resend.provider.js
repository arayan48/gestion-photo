import axios from 'axios'
import { config } from '../../../config/env.js'

async function send({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) return
  await axios.post('https://api.resend.com/emails', { from: config.email.from, to, subject, html }, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
}

export default {
  async sendAccountAccepted(to, pseudo) { await send({ to, subject: 'Compte WubalStore accepté', html: `<p>Bienvenue ${pseudo}</p>` }) },
  async sendOTP(to, code) { await send({ to, subject: 'Code OTP WubalStore', html: `<p>${code}</p>` }) },
  async sendPasswordReset(to, token) { await send({ to, subject: 'Réinitialisation', html: `<a href="${config.appUrl}/reset-password?token=${token}">Réinitialiser</a>` }) },
}
