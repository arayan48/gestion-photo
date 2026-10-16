import axios from 'axios'
import { buildProvider, missingConfig } from '../templates.js'

export default function createResendProvider(settings) {
  return buildProvider(async ({ to, subject, html }) => {
    if (!settings.resendKey) throw missingConfig('Resend')
    await axios.post('https://api.resend.com/emails', { from: settings.from, to, subject, html }, {
      headers: { Authorization: `Bearer ${settings.resendKey}` },
    })
  }, settings)
}
