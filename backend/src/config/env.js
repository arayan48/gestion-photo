// Variables d'environnement : uniquement l'infrastructure, nécessaire avant d'atteindre la base.
// Tout le reste (URL publique, email, Discord, sauvegardes…) se configure à l'installation
// ou dans Paramètres admin, et est stocké en base (secrets chiffrés).
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.APP_PORT) || 3000,

  jwt: {
    // Renseigné au démarrage depuis la base (généré automatiquement, stocké chiffré)
    accessSecret: null,
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },

  storage: {
    path: process.env.STORAGE_PATH || '/app/storage',
  },

  secrets: {
    // Optionnel : sinon une clé est générée dans MASTER_KEY_FILE au premier démarrage
    masterKey: process.env.MASTER_KEY || '',
    masterKeyFile: process.env.MASTER_KEY_FILE || '/app/data/master.key',
  },
}
