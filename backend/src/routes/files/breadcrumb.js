import pool from '../../config/database.js'

// Chaîne racine → dossier courant, limitée aux dossiers de l'utilisateur
export async function getFolderBreadcrumb(folderId, ownerId) {
  const { rows } = await pool.query(
    `WITH RECURSIVE chain AS (
       SELECT id, name, parent_id, 0 AS depth FROM folders WHERE id = $1 AND owner_id = $2
       UNION ALL
       SELECT f.id, f.name, f.parent_id, c.depth + 1
       FROM folders f JOIN chain c ON f.id = c.parent_id
       WHERE c.depth < 100 -- garde-fou contre une éventuelle boucle
     )
     SELECT id, name, parent_id FROM chain ORDER BY depth DESC`,
    [folderId, ownerId]
  )
  return rows
}
