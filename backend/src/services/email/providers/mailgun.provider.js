import axios from 'axios'
import { buildProvider, missingConfig } from '../templates.js'

export default function createMailgunProvider(settings) {
  return buildProvider(async ({ to, subject, html }) => {
    if (!settings.mailgunKey || !settings.mailgunDomain) throw missingConfig('Mailgun')
    const formData = new URLSearchParams({ from: settings.from, to, subject, html })
    await axios.post(
      `https://api.mailgun.net/v3/${encodeURIComponent(settings.mailgunDomain)}/messages`,
      formData,
      { auth: { username: 'api', password: settings.mailgunKey } }
    )
  }, settings)
}
