import pool from '../config/database.js'

const migrations = [
  {
    name: '001_create_extensions',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `,
  },
  {
    name: '002_create_setup',
    sql: `
      CREATE TABLE IF NOT EXISTS setup (
        id INT PRIMARY KEY DEFAULT 1,
        is_completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      );
      INSERT INTO setup (id, is_completed) VALUES (1, false) ON CONFLICT DO NOTHING;
    `,
  },
  {
    name: '003_create_roles',
    sql: `
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        is_super_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: '004_create_permissions',
    sql: `
      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL
      );
    `,
  },
  {
    name: '005_create_role_permissions',
    sql: `
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `,
  },
  {
    name: '006_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        pseudo VARCHAR(100) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        avatar_path VARCHAR(500),
        discord_id VARCHAR(100),
        discord_avatar VARCHAR(500),
        discord_pseudo VARCHAR(100),
        role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
        storage_quota BIGINT DEFAULT 1073741824,
        storage_used BIGINT DEFAULT 0,
        is_active BOOLEAN DEFAULT false,
        is_banned BOOLEAN DEFAULT false,
        ban_id VARCHAR(100) UNIQUE,
        totp_secret VARCHAR(255),
        totp_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_pseudo ON users(pseudo);
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
    `,
  },
  {
    name: '007_create_refresh_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    `,
  },
  {
    name: '008_create_account_requests',
    sql: `
      CREATE TABLE IF NOT EXISTS account_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL,
        pseudo VARCHAR(100) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        avatar_path VARCHAR(500),
        password_hash VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused')),
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: '009_create_login_attempts',
    sql: `
      CREATE TABLE IF NOT EXISTS login_attempts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        identifier VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        fingerprint VARCHAR(255),
        jwt_hint VARCHAR(255),
        attempt_count INT DEFAULT 1,
        banned_until TIMESTAMP,
        ban_level INT DEFAULT 0,
        ban_id VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_fingerprint ON login_attempts(fingerprint);
    `,
  },
  {
    name: '010_create_folders',
    sql: `
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
      CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
    `,
  },
  {
    name: '011_create_files',
    sql: `
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        original_name VARCHAR(500) NOT NULL,
        stored_name VARCHAR(500) UNIQUE NOT NULL,
        folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        mime_type VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        width INT,
        height INT,
        fps FLOAT,
        duration FLOAT,
        codec VARCHAR(100),
        format VARCHAR(100),
        quality_preset VARCHAR(20) DEFAULT 'original' CHECK (quality_preset IN ('original', 'standard', 'thumbnail')),
        thumbnail_path VARCHAR(500),
        link_token VARCHAR(100) UNIQUE NOT NULL,
        link_active BOOLEAN DEFAULT true,
        link_access_count INT DEFAULT 0,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
      CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_files_token ON files(link_token);
      CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted);
    `,
  },
  {
    name: '012_create_tags',
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS file_tags (
        file_id UUID REFERENCES files(id) ON DELETE CASCADE,
        tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (file_id, tag_id)
      );
    `,
  },
  {
    name: '013_create_favorites',
    sql: `
      CREATE TABLE IF NOT EXISTS favorites (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        file_id UUID REFERENCES files(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, file_id)
      );
    `,
  },
  {
    name: '014_create_ip_whitelist',
    sql: `
      CREATE TABLE IF NOT EXISTS ip_whitelist (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ip_address VARCHAR(45) NOT NULL,
        label VARCHAR(255),
        added_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip_address);
    `,
  },
  {
    name: '015_create_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category VARCHAR(20) NOT NULL CHECK (category IN ('auth', 'files', 'users', 'security', 'system')),
        level VARCHAR(10) NOT NULL CHECK (level IN ('info', 'warning', 'error')),
        action VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ip_address VARCHAR(45),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
    `,
  },
  {
    name: '016_create_notifications',
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
    `,
  },
  {
    name: '017_create_system_config',
    sql: `
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: '018_create_backups',
    sql: `
      CREATE TABLE IF NOT EXISTS backups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type VARCHAR(20) NOT NULL CHECK (type IN ('local', 'backblaze')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
        size BIGINT,
        path VARCHAR(500),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: '019_create_temp_zips',
    sql: `
      CREATE TABLE IF NOT EXISTS temp_zips (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        path VARCHAR(500) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: '020_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: '021_create_password_reset_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_reset_tokens_email ON password_reset_tokens(email);
    `,
  },
  {
    name: '022_create_otp_codes',
    sql: `
      CREATE TABLE IF NOT EXISTS otp_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
    `,
  },
]

async function runMigrations() {
  const client = await pool.connect()
  try {
    // Table de suivi des migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `)

    const { rows: applied } = await client.query('SELECT name FROM schema_migrations')
    const appliedNames = new Set(applied.map((r) => r.name))

    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) continue

      console.log(`⚡ Migration : ${migration.name}`)
      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name])
        await client.query('COMMIT')
        console.log(`✅ ${migration.name}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`❌ Échec de la migration ${migration.name}:`, err.message)
        throw err
      }
    }

    console.log('✅ Toutes les migrations sont appliquées.')
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations().catch((err) => {
  console.error('Erreur fatale de migration:', err)
  process.exit(1)
})
