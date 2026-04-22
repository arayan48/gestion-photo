# CLAUDE.md — Instructions de développement WubalStore

> Ce fichier est lu automatiquement par Claude Code. Il contient toutes les instructions nécessaires pour construire le projet WubalStore de A à Z.

---

## 🎯 Objectif du projet

Construire **WubalStore** : une plateforme d'hébergement de médias (images & vidéos) auto-hébergée, sécurisée, avec gestion de comptes, rôles granulaires, liste blanche IP, et interface style Google Drive. Le projet doit être open source, déployable via Docker sur n'importe quel VPS Ubuntu 22.04.

---

## 🏗️ Stack technique — NE PAS DÉVIER

| Couche | Technologie |
|--------|-------------|
| Backend | Node.js + Fastify |
| Base de données | PostgreSQL |
| Frontend | React + Vite |
| Reverse proxy | Nginx |
| Conteneurisation | Docker + Docker Compose |
| Stockage fichiers | Système de fichiers local structuré |
| Sauvegardes | Local + Rclone vers Backblaze B2 |
| Emails | Brevo par défaut (modulaire : SMTP, Resend, Mailgun, SendGrid) |
| Auth externe | OAuth2 Discord |
| Temps réel | WebSocket (notifications) |
| Traitement médias | FFmpeg (vidéos) + Sharp (images) |

---

## 📁 Architecture des dossiers

```
wubalstore/
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration app, env, storage
│   │   ├── plugins/          # Plugins Fastify (JWT, CORS, rate-limit)
│   │   ├── routes/           # Routes API groupées par domaine
│   │   │   ├── auth/
│   │   │   ├── files/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── admin/
│   │   │   ├── logs/
│   │   │   ├── backups/
│   │   │   └── storage/
│   │   ├── services/         # Logique métier
│   │   │   ├── auth.service.js
│   │   │   ├── files.service.js
│   │   │   ├── storage.service.js
│   │   │   ├── email/
│   │   │   │   ├── email.service.js      # Interface commune
│   │   │   │   ├── providers/
│   │   │   │   │   ├── brevo.provider.js
│   │   │   │   │   ├── smtp.provider.js
│   │   │   │   │   ├── resend.provider.js
│   │   │   │   │   ├── mailgun.provider.js
│   │   │   │   │   └── sendgrid.provider.js
│   │   ├── middleware/       # Auth, permissions, IP whitelist
│   │   ├── models/           # Schémas PostgreSQL
│   │   ├── utils/            # Helpers, fingerprint, logs
│   │   └── websocket/        # Notifications temps réel
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── explorer/     # Explorateur de fichiers
│   │   │   ├── upload/       # Panel upload
│   │   │   ├── viewer/       # Visionneuse images/vidéos
│   │   │   ├── admin/        # Dashboard admin
│   │   │   ├── logs/         # Interface logs
│   │   │   ├── notifications/ # Cloche + historique
│   │   │   └── shared/       # Composants réutilisables
│   │   ├── pages/
│   │   │   ├── Setup.jsx     # Page setup premier lancement
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Explorer.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Admin/
│   │   │   └── Profile.jsx
│   │   ├── hooks/
│   │   ├── stores/           # État global (Zustand)
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── PROJET.md
└── README.md
```

---

## 🗃️ Schéma base de données

### Tables principales

```sql
-- Utilisateurs
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR,
  pseudo VARCHAR UNIQUE NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  avatar_path VARCHAR,
  discord_id VARCHAR,
  discord_avatar VARCHAR,
  discord_pseudo VARCHAR,
  role_id UUID REFERENCES roles(id),
  storage_quota BIGINT DEFAULT 1073741824, -- 1Go en bytes
  storage_used BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT false, -- false = en attente validation
  is_banned BOOLEAN DEFAULT false,
  ban_id VARCHAR UNIQUE,
  totp_secret VARCHAR,
  totp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Demandes de compte
account_requests (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  pseudo VARCHAR NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  avatar_path VARCHAR,
  password_hash VARCHAR NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'accepted', 'refused') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
)

-- Rôles
roles (
  id UUID PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Permissions
permissions (
  id UUID PRIMARY KEY,
  key VARCHAR UNIQUE NOT NULL,      -- ex: 'files.delete_others'
  label VARCHAR NOT NULL,            -- ex: 'Supprimer les fichiers des autres'
  category VARCHAR NOT NULL          -- ex: 'Fichiers & Médias'
)

-- Liaison rôles <-> permissions
role_permissions (
  role_id UUID REFERENCES roles(id),
  permission_id UUID REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
)

-- Dossiers
folders (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  parent_id UUID REFERENCES folders(id),
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

-- Fichiers
files (
  id UUID PRIMARY KEY,
  original_name VARCHAR NOT NULL,
  stored_name VARCHAR UNIQUE NOT NULL,
  folder_id UUID REFERENCES folders(id),
  owner_id UUID REFERENCES users(id),
  mime_type VARCHAR NOT NULL,
  size BIGINT NOT NULL,
  width INT,
  height INT,
  fps FLOAT,
  duration FLOAT,
  codec VARCHAR,
  format VARCHAR,
  quality_preset ENUM('original', 'standard', 'thumbnail'),
  thumbnail_path VARCHAR,
  link_token VARCHAR UNIQUE NOT NULL,
  link_active BOOLEAN DEFAULT true,
  link_access_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Tags
tags (
  id UUID PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

-- Liaison fichiers <-> tags
file_tags (
  file_id UUID REFERENCES files(id),
  tag_id UUID REFERENCES tags(id),
  PRIMARY KEY (file_id, tag_id)
)

-- Favoris
favorites (
  user_id UUID REFERENCES users(id),
  file_id UUID REFERENCES files(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, file_id)
)

-- Liste blanche IP
ip_whitelist (
  id UUID PRIMARY KEY,
  ip_address VARCHAR NOT NULL,
  label VARCHAR,
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

-- Tentatives de connexion / bans
login_attempts (
  id UUID PRIMARY KEY,
  identifier VARCHAR NOT NULL,  -- email ou IP
  ip_address VARCHAR NOT NULL,
  user_agent VARCHAR,
  fingerprint VARCHAR,
  jwt_hint VARCHAR,
  attempt_count INT DEFAULT 1,
  banned_until TIMESTAMP,
  ban_level INT DEFAULT 0,       -- 0=non banni, 1=2min, 2=15min, 3=1h, 4=24h, 5=permanent
  ban_id VARCHAR UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Logs
logs (
  id UUID PRIMARY KEY,
  category ENUM('auth', 'files', 'users', 'security', 'system') NOT NULL,
  level ENUM('info', 'warning', 'error') NOT NULL,
  action VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  ip_address VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Notifications
notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),  -- NULL = tous les admins
  type VARCHAR NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Configuration système
system_config (
  key VARCHAR PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Sauvegardes
backups (
  id UUID PRIMARY KEY,
  type ENUM('local', 'backblaze') NOT NULL,
  status ENUM('success', 'failed') NOT NULL,
  size BIGINT,
  path VARCHAR,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Zips temporaires
temp_zips (
  id UUID PRIMARY KEY,
  path VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Setup
setup (
  id INT PRIMARY KEY DEFAULT 1,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP
)
```

---

## 🔐 Sécurité — règles strictes

### JWT
- Access token : expiration 15 minutes
- Refresh token : expiration 7 jours, stocké en httpOnly cookie
- Rotation des refresh tokens à chaque renouvellement

### Bannissement progressif
```
5 tentatives échouées → ban 2 minutes (niveau 1)
Récidive             → ban 15 minutes (niveau 2)
Récidive             → ban 1 heure (niveau 3)
Récidive             → ban 24 heures (niveau 4)
Ban permanent        → uniquement manuel par Super Admin
```

### Fingerprinting attaquant
Croiser : IP + User-Agent + JWT token hint + browser fingerprint
→ Si correspondance malgré changement d'IP : même suspect, ban maintenu

### Liste blanche IP pour médias
- Toute requête vers `/media/:token` vérifie l'IP appelante
- Si IP absente de la whitelist → 403 immédiat
- Vérification dans Nginx ET dans Fastify (double couche)

---

## 📧 Système email modulaire

```javascript
// Interface commune — tous les providers implémentent ceci
class EmailProvider {
  async sendAccountAccepted(to, pseudo) {}
  async sendOTP(to, code) {}
  async sendPasswordReset(to, token) {}
}
```
Provider actif configurable via `system_config` table ou variable `.env`.

---

## 💾 Gestion du stockage

### Calcul automatique au démarrage
```javascript
// Au démarrage du backend
const diskInfo = await checkDisk('/')
const totalBytes = diskInfo.total
const safeBytes = totalBytes * 0.95  // -5% sécurité
// Répartition intelligente stockée dans system_config
```

### Répartition par défaut
- Médias : 70% de safeBytes
- Zips temporaires : 5Go fixe
- Logs : 2Go fixe avec rotation
- Sauvegardes locales : 10% de safeBytes
- Reste : système

### Limites configurables depuis dashboard Super Admin
- Alerte à 90% de la limite médias
- Blocage automatique des uploads à 100%
- Message utilisateur : "Le serveur a atteint sa limite de stockage. Veuillez contacter l'administrateur."

---

## 🗂️ Permissions — liste complète des clés

```
FICHIERS & MÉDIAS
files.upload
files.delete_own
files.delete_others
files.create_folder
files.rename_move
files.toggle_link
files.view_others
files.create_tags

UTILISATEURS
users.view_list
users.accept_requests
users.suspend
users.change_role
users.change_quota
users.delete

SÉCURITÉ
security.view_whitelist
security.manage_whitelist
security.view_logs
security.revoke_tokens
security.unban

SYSTÈME
system.view_logs
system.view_stats
system.manage_backups
system.manage_config
system.manage_storage
```

---

## 🚀 Ordre de développement recommandé

### Phase 1 — Fondations
1. Docker Compose (PostgreSQL + backend + frontend + Nginx)
2. Migrations PostgreSQL complètes
3. Seed des permissions et du rôle Super Admin
4. Page de setup premier lancement

### Phase 2 — Authentification
5. Inscription / demande de compte
6. Connexion email + JWT
7. OAuth2 Discord
8. 2FA TOTP + OTP email
9. Mot de passe oublié
10. Système de ban progressif + fingerprinting

### Phase 3 — Gestion des rôles
11. CRUD rôles avec permissions granulaires
12. Middleware de vérification des permissions

### Phase 4 — Fichiers
13. Upload multiple avec Sharp + FFmpeg
14. Explorateur de fichiers (grille/liste, dossiers, drag & drop)
15. Visionneuse images + lecteur vidéo
16. Système de liens + liste blanche IP
17. Tags, favoris, corbeille 48h
18. Téléchargement simple + zip temporaire

### Phase 5 — Administration
19. Dashboard admin (stats, stockage, utilisateurs)
20. Gestion liste blanche IP
21. Logs complets avec filtres
22. Notifications WebSocket + cloche

### Phase 6 — Système
23. Calcul automatique stockage
24. Sauvegardes local + Rclone Backblaze B2
25. Système email modulaire
26. Rate limiting avancé

### Phase 7 — Finalisation
27. README.md complet
28. .env.example documenté
29. Tests et sécurisation finale

---

## 🌐 Variables d'environnement requises (.env.example)

```env
# Application
NODE_ENV=production
APP_URL=https://votre-domaine.com
APP_PORT=3000

# Base de données
DB_HOST=postgres
DB_PORT=5432
DB_NAME=wubalstore
DB_USER=wubalstore
DB_PASSWORD=changeme

# JWT
JWT_ACCESS_SECRET=changeme_access
JWT_REFRESH_SECRET=changeme_refresh

# Discord OAuth2
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=

# Email (choisir un provider)
EMAIL_PROVIDER=brevo  # brevo | smtp | resend | mailgun | sendgrid
EMAIL_FROM=noreply@votre-domaine.com

# Brevo
BREVO_API_KEY=

# SMTP custom
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false

# Resend
RESEND_API_KEY=

# Mailgun
MAILGUN_API_KEY=
MAILGUN_DOMAIN=

# SendGrid
SENDGRID_API_KEY=

# Backblaze B2
B2_APPLICATION_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=

# Stockage
STORAGE_PATH=/app/storage
```

---

## ⚠️ Règles importantes

- Toujours utiliser les **UUID** comme identifiants, jamais d'auto-increment
- Toutes les dates en **UTC**
- Tout le texte de l'interface en **français**
- Logs de chaque action sensible sans exception
- Ne jamais exposer les chemins réels des fichiers dans les URLs publiques (utiliser uniquement les `link_token`)
- Valider les types MIME côté serveur, pas seulement l'extension
- Nettoyer les noms de fichiers (sanitize) avant stockage
- Les zips temporaires sont supprimés après **1 heure** via un cron job
- La corbeille est vidée après **48 heures** via un cron job
- Thème par défaut : **sombre**
- Language interface : **français**
