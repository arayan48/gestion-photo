import pool from '../../config/database.js'

export async function getFolderBreadcrumb(folderId) {
  const chain = []
  let currentId = folderId

  while (currentId) {
    const { rows } = await pool.query('SELECT id, name, parent_id FROM folders WHERE id = $1', [currentId])
    if (!rows.length) break
    chain.unshift(rows[0])
    currentId = rows[0].parent_id
  }

  return chain
}
