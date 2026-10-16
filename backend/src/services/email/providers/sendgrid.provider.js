import axios from 'axios'
import { buildProvider, missingConfig } from '../templates.js'

export default function createSendgridProvider(settings) {
  return buildProvider(async ({ to, subject, html }) => {
    if (!settings.sendgridKey) throw missingConfig('SendGrid')
    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      { personalizations: [{ to: [{ email: to }] }], from: { email: settings.from }, subject, content: [{ type: 'text/html', value: html }] },
      { headers: { Authorization: `Bearer ${settings.sendgridKey}` } }
    )
  }, settings)
}
