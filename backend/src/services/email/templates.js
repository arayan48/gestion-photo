import { escapeHtml } from '../../utils/validation.js'

// Modèles communs à tous les providers (les valeurs utilisateur sont échappées)
export function buildProvider(send, { appUrl, appName = 'Obscura' }) {
  const name = escapeHtml(appName)
  return {
    async sendAccountAccepted(to, pseudo) {
      await send({
        to,
        subject: `Votre compte ${appName} a été accepté`,
        html: `<h2>Bienvenue ${escapeHtml(pseudo)} !</h2><p>Votre demande de compte ${name} a été acceptée. Vous pouvez maintenant vous connecter.</p><p><a href="${escapeHtml(appUrl)}/login">Se connecter</a></p>`,
      })
    },

    async sendOTP(to, code) {
      await send({
        to,
        subject: `Votre code de vérification ${appName}`,
        html: `<h2>Code de vérification</h2><p>Votre code OTP : <strong style="font-size:24px">${escapeHtml(code)}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
      })
    },

    async sendPasswordReset(to, token) {
      const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
      await send({
        to,
        subject: `Réinitialisation de votre mot de passe ${appName}`,
        html: `<h2>Réinitialisation du mot de passe</h2><p><a href="${escapeHtml(link)}">Cliquez ici pour réinitialiser votre mot de passe</a></p><p>Ce lien expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      })
    },
  }
}

export function missingConfig(provider) {
  return new Error(`Provider email ${provider} non configuré (clé API manquante)`)
}
