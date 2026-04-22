import pool from '../config/database.js'

const PERMISSIONS = [
  // Fichiers & Médias
  { key: 'files.upload', label: 'Uploader des fichiers', category: 'Fichiers & Médias' },
  { key: 'files.delete_own', label: 'Supprimer ses propres fichiers', category: 'Fichiers & Médias' },
  { key: 'files.delete_others', label: 'Supprimer les fichiers des autres', category: 'Fichiers & Médias' },
  { key: 'files.create_folder', label: 'Créer des dossiers', category: 'Fichiers & Médias' },
  { key: 'files.rename_move', label: 'Renommer et déplacer des fichiers', category: 'Fichiers & Médias' },
  { key: 'files.toggle_link', label: 'Activer / désactiver un lien', category: 'Fichiers & Médias' },
  { key: 'files.view_others', label: 'Voir les fichiers des autres utilisateurs', category: 'Fichiers & Médias' },
  { key: 'files.create_tags', label: 'Créer des tags', category: 'Fichiers & Médias' },
  // Utilisateurs
  { key: 'users.view_list', label: 'Voir la liste des utilisateurs', category: 'Utilisateurs' },
  { key: 'users.accept_requests', label: 'Accepter / refuser les demandes de compte', category: 'Utilisateurs' },
  { key: 'users.suspend', label: 'Suspendre un utilisateur', category: 'Utilisateurs' },
  { key: 'users.change_role', label: 'Modifier le rôle d\'un utilisateur', category: 'Utilisateurs' },
  { key: 'users.change_quota', label: 'Modifier le quota d\'un utilisateur', category: 'Utilisateurs' },
  { key: 'users.delete', label: 'Supprimer un utilisateur', category: 'Utilisateurs' },
  // Sécurité
  { key: 'security.view_whitelist', label: 'Voir la liste blanche IP', category: 'Sécurité' },
  { key: 'security.manage_whitelist', label: 'Ajouter / modifier / supprimer des IPs', category: 'Sécurité' },
  { key: 'security.view_logs', label: 'Voir les logs de sécurité', category: 'Sécurité' },
  { key: 'security.revoke_tokens', label: 'Révoquer des tokens JWT', category: 'Sécurité' },
  { key: 'security.unban', label: 'Débannir un utilisateur', category: 'Sécurité' },
  // Système
  { key: 'system.view_logs', label: 'Voir les logs système', category: 'Système' },
  { key: 'system.view_stats', label: 'Voir les statistiques globales', category: 'Système' },
  { key: 'system.manage_backups', label: 'Gérer les sauvegardes', category: 'Système' },
  { key: 'system.manage_config', label: 'Modifier la configuration générale', category: 'Système' },
  { key: 'system.manage_storage', label: 'Modifier les seuils de stockage', category: 'Système' },
]

export async function seedPermissions() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const perm of PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (key, label, category)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category`,
        [perm.key, perm.label, perm.category]
      )
    }

    const { rows: existing } = await client.query('SELECT id FROM roles WHERE is_super_admin = true')
    if (existing.length === 0) {
      await client.query(
        `INSERT INTO roles (name, is_super_admin) VALUES ($1, true) ON CONFLICT (name) DO NOTHING`,
        ['Super Admin']
      )
    }

    await client.query(
      `INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      ['email.provider', process.env.EMAIL_PROVIDER || 'brevo']
    )

    await client.query('COMMIT')
    console.log(`✅ Seed: ${PERMISSIONS.length} permissions insérées/mises à jour`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Erreur seed:', err.message)
    throw err
  } finally {
    client.release()
  }
}

// Exécution directe via CLI
if (process.argv[1].endsWith('seed.js')) {
  seedPermissions()
    .then(() => { console.log('✅ Seed terminé.'); process.exit(0) })
    .catch((err) => { console.error('Erreur fatale seed:', err); process.exit(1) })
}
