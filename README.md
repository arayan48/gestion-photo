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

Les variables obligatoires à changer :

| Variable | Description |
| --- | --- |
| `APP_URL` | URL publique de l'application |
| `DB_PASSWORD` | Mot de passe PostgreSQL |
| `JWT_ACCESS_SECRET` | Secret JWT access token (min. 32 chars) |
| `JWT_REFRESH_SECRET` | Secret JWT refresh token (min. 32 chars) |
| `EMAIL_PROVIDER` | Provider email : `brevo`, `smtp`, `resend`, `mailgun`, `sendgrid` |
| `EMAIL_FROM` | Adresse d'expédition des emails |

Générer des secrets JWT sécurisés :

```bash
openssl rand -base64 64
```

Lancer la commande deux fois et copier les résultats dans `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET`.

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

Ouvrir `http://votre-serveur` dans le navigateur. La page de setup s'affiche automatiquement pour créer le compte Super Admin. Une fois validé, la plateforme est opérationnelle.

---

## Configuration email

Choisir un provider dans `.env` via `EMAIL_PROVIDER`, puis renseigner les clés correspondantes :

| Provider | Variable requise |
| --- | --- |
| Brevo | `BREVO_API_KEY` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| Resend | `RESEND_API_KEY` |
| Mailgun | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` |
| SendGrid | `SENDGRID_API_KEY` |

---

## Sauvegardes Backblaze B2 (optionnel)

Renseigner dans `.env` :

```env
B2_APPLICATION_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=
```

Les sauvegardes sont configurables depuis le dashboard admin.

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
