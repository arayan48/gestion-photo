# WubalStore

Plateforme d'hébergement de médias auto-hébergée. Stockez vos images et vidéos sur votre propre serveur, partagez-les via des liens sécurisés, gérez des comptes avec rôles et permissions.

---

## Fonctionnalités

- Upload d'images (JPG, PNG, WEBP, GIF, SVG, AVIF) et vidéos (MP4, WEBM, MOV)
- Explorateur de fichiers style Google Drive (grille / liste, dossiers, drag & drop)
- Liens permanents protégés par liste blanche IP
- Miniatures automatiques (Sharp + FFmpeg)
- Gestion des comptes avec validation manuelle par l'admin
- Rôles et permissions granulaires
- Double authentification : TOTP (Google Authenticator, etc.) + OTP par email
- Connexion via Discord OAuth2
- Bannissement progressif des attaquants + fingerprinting
- Logs par catégorie, notifications temps réel
- Sauvegardes locales et vers Backblaze B2 (via Rclone)

---

## Prérequis

- Docker + Docker Compose
- Un serveur Linux (Ubuntu 22.04 recommandé) ou un poste local

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/wubal/wubalstore
cd wubalstore
```

### 2. Créer le fichier d'environnement

```bash
cp .env.example .env
```

### 3. Éditer `.env`

Le `.env` ne contient que l'infrastructure. Seul `DB_PASSWORD` est à changer :

```bash
openssl rand -base64 32   # → copier dans DB_PASSWORD
```

| Variable | Description |
| --- | --- |
| `DB_PASSWORD` | Mot de passe PostgreSQL (obligatoire) |
| `DB_NAME`, `DB_USER` | Nom de la base et utilisateur (défaut : `wubalstore`) |
| `MASTER_KEY` | *Optionnel* — clé de chiffrement des secrets (sinon générée automatiquement) |

Tout le reste se configure dans l'interface (voir [Configuration](#configuration)).

### 4. Lancer les conteneurs

```bash
docker compose up -d --build
```

Les services démarrés :

- `postgres` — base de données
- `backend` — API Fastify (port 3000)
- `frontend` — interface React (port 80 via nginx)
- `nginx` — reverse proxy (ports 80 / 443)

### 5. Base de données

Les migrations sont appliquées **automatiquement** à chaque démarrage du backend (seules les migrations manquantes sont exécutées). Pour les lancer manuellement si besoin :

```bash
docker compose run --rm backend node src/models/migrate.js
```

### 6. Premier lancement

Ouvrir `http://votre-serveur` dans le navigateur. La page de setup s'affiche automatiquement : elle demande l'**URL publique**, le **nom de l'instance** et le **compte Super Admin**. Une fois validé, la plateforme est opérationnelle.

---

## Configuration

Depuis **Admin → Configuration** (Super Admin ou rôle avec `system.manage_config`) :

| Onglet | Contenu |
| --- | --- |
| Général | Nom, URL publique, répartition du stockage |
| Email | Provider (Brevo, SMTP, Resend, Mailgun, SendGrid) et ses identifiants |
| Discord | Client ID / Secret OAuth2 (Redirect URI déduite de l'URL publique) |
| Sauvegardes | Planification, rétention, Backblaze B2 |

### Secrets et chiffrement

- Les clés API, mots de passe SMTP, secrets OAuth2 et secrets 2FA (TOTP) sont **chiffrés en base** (AES-256-GCM). L'interface ne les renvoie jamais en clair : un secret enregistré s'affiche masqué.
- Le secret de signature des JWT est **généré automatiquement** au premier démarrage et stocké chiffré.
- La **clé maître** est soit `MASTER_KEY` dans `.env`, soit le fichier `/app/data/master.key` (volume Docker `backend_data`), créé au premier démarrage.

> ⚠️ Sauvegardez la clé maître **à part** : elle n'est volontairement pas incluse dans les sauvegardes, pour qu'une archive volée ne suffise pas à lire les secrets. Sans elle, il faudra ressaisir les secrets et les utilisateurs devront réactiver leur 2FA.
>
> ```bash
> docker compose cp backend:/app/data/master.key ./master.key.backup
> ```

### Migration depuis une ancienne version

Les anciennes variables (`APP_URL`, `JWT_ACCESS_SECRET`, `DISCORD_*`, `EMAIL_*`, `SMTP_*`, `BREVO_API_KEY`, `B2_*`…) sont **importées automatiquement** en base au démarrage, puis chiffrées. Les sessions en cours restent valides. Vous pouvez ensuite les retirer du `.env`.

---

## Stack technique

| Couche | Technologie |
| --- | --- |
| Backend | Node.js + Fastify |
| Base de données | PostgreSQL 16 |
| Frontend | React + Vite + Tailwind CSS |
| Reverse proxy | Nginx |
| Conteneurisation | Docker + Docker Compose |
| Traitement médias | Sharp (images) + FFmpeg (vidéos) |

---

## Auteur

wubal — [github.com/wubal](https://github.com/wubal)
