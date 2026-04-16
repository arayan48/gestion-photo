import axios from 'axios'
import { config } from '../../../config/env.js'

const API_URL = 'https://api.brevo.com/v3/smtp/email'

async function send({ to, subject, html }) {
  if (!process.env.BREVO_API_KEY) {
    console.warn(`[Email/Brevo] Clé API manquante, email non envoyé à ${to}`)
    return
  }

  await axios.post(
    API_URL,
    {
      sender: { email: config.email.from, name: 'WubalStore' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    },
    { headers: { 'api-key': process.env.BREVO_API_KEY } }
  )
}

export default {
  async sendAccountAccepted(to, pseudo) {
    await send({
      to,
      subject: 'Votre compte WubalStore a été accepté',
      html: `<h2>Bienvenue ${pseudo} !</h2><p>Votre demande de compte a été acceptée. Vous pouvez maintenant vous connecter.</p>`,
    })
  },

  async sendOTP(to, code) {
    await send({
      to,
      subject: 'Votre code de vérification WubalStore',
      html: `<h2>Code de vérification</h2><p>Votre code OTP : <strong style="font-size:24px">${code}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
    })
  },

  async sendPasswordReset(to, token) {
    const link = `${config.appUrl}/reset-password?token=${token}`
    await send({
      to,
      subject: 'Réinitialisation de votre mot de passe WubalStore',
      html: `<h2>Réinitialisation du mot de passe</h2><p><a href="${link}">Cliquez ici pour réinitialiser votre mot de passe</a></p><p>Ce lien expire dans 30 minutes.</p>`,
    })
  },
}
