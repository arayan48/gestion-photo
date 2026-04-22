export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.APP_PORT) || 3000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_in_prod',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_prod',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || '',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'brevo',
    from: process.env.EMAIL_FROM || 'noreply@wubalstore.local',
  },

  storage: {
    path: process.env.STORAGE_PATH || '/app/storage',
  },

  totp: {
    // Clé AES-256 : 64 caractères hex (32 octets). Générer avec : openssl rand -hex 32
    encryptionKey: process.env.TOTP_ENCRYPTION_KEY || '',
  },
}
