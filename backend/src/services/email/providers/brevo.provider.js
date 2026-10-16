import axios from 'axios'
import { buildProvider, missingConfig } from '../templates.js'

const API_URL = 'https://api.brevo.com/v3/smtp/email'

export default function createBrevoProvider(settings) {
  return buildProvider(async ({ to, subject, html }) => {
    if (!settings.brevoKey) throw missingConfig('Brevo')
    await axios.post(
      API_URL,
      {
        sender: { email: settings.from, name: settings.appName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      { headers: { 'api-key': settings.brevoKey } }
    )
  }, settings)
}
