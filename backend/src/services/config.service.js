import pool from '../config/database.js'

// Lit des clés de system_config (modifiables depuis Paramètres admin).
// Une valeur vide en base est ignorée pour laisser la variable d'environnement s'appliquer.
export async function getConfigValues(keys) {
  try {
    const { rows } = await pool.query('SELECT key, value FROM system_config WHERE key = ANY($1)', [keys])
    return Object.fromEntries(rows.filter((r) => r.value !== '').map((r) => [r.key, r.value]))
  } catch {
    return {}
  }
}
