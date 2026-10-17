<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark.svg">
    <img src="docs/brand/logo-light.svg" alt="Obscura" height="72">
  </picture>
</p>

<p align="center"><em>Vos photos et vidéos, hors de vue.</em></p>

# Obscura

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

Trois façons de déployer, avec les mêmes images :

| Fichier | Usage |
| --- | --- |
| `docker-compose.yml` | **Production** sur un VPS / serveur : nginx publie 80/443, HTTPS Let's Encrypt automatique |
| `docker-compose.coolify.yml` | **Coolify** (ou tout proxy qui gère déjà le TLS) : aucun port publié |
| `docker-compose.dev.yml` | **Développement** : rechargement à chaud, interface sur `http://localhost:5173` |

### 1. Cloner le dépôt

```bash
git clone https://github.com/arayan48/gestion-photo
cd gestion-photo
```

### 2. Créer le fichier d'environnement

```bash
cp .env.example .env
```

### 3. Éditer `.env`

Le `.env` ne contient que l'infrastructure :

```bash
openssl rand -base64 32   # → copier dans DB_PASSWORD
```

| Variable | Description |
| --- | --- |
| `DB_PASSWORD` | Mot de passe PostgreSQL (**obligatoire**, le démarrage échoue sinon) |
| `DOMAIN` | Domaine public (ex. `photos.mondomaine.fr`) : active le HTTPS Let's Encrypt automatique |
| `LETSENCRYPT_EMAIL` | Email pour les alertes d'expiration du certificat (recommandé) |
| `DB_NAME`, `DB_USER` | Nom de la base et utilisateur (défaut : `obscura`) |
| `MASTER_KEY` | *Optionnel* — clé de chiffrement des secrets (sinon générée automatiquement) |
| `HTTP_PORT`, `HTTPS_PORT` | *Optionnel* — ports publiés sur l'hôte (défaut : 80 / 443) |
| `TRUSTED_PROXIES` | *Optionnel* — proxys placés devant nginx (Cloudflare…), voir ci-dessous |

Tout le reste se configure dans l'interface (voir [Configuration](#configuration)).

### 4. Lancer les conteneurs

```bash
docker compose up -d --build
```

Les services démarrés :

- `postgres` — base de données
- `backend` — API Fastify (interne, non exposée)
- `frontend` — interface React (interne, servie via nginx)
- `nginx` — reverse proxy, seul service exposé (ports 80 / 443)
- `certbot` — obtient et renouvelle le certificat HTTPS (inactif si `DOMAIN` est vide)

Les migrations de la base sont appliquées **automatiquement** à chaque démarrage du backend.

### 5. HTTPS

**HTTPS est obligatoire en production** : le cookie de session n'est envoyé qu'en HTTPS. Sans lui, la connexion expire au bout de 15 minutes.

- **Avec `DOMAIN`** : faites pointer le DNS du domaine vers le serveur et ouvrez les ports 80 et 443. Le certificat est obtenu en moins d'une minute après le démarrage, puis renouvelé automatiquement. nginx bascule seul en HTTPS et redirige HTTP → HTTPS. Suivi : `docker compose logs certbot nginx`.
- **Derrière un proxy qui gère déjà le TLS** (Caddy, Traefik, nginx de l'hôte…) : laissez `DOMAIN` vide et faites pointer le proxy vers le port `HTTP_PORT`.
- **Test en réseau local en HTTP** (IP sans domaine) : ajoutez `COOKIE_SECURE=false` au `.env`. Ne jamais l'utiliser sur Internet.

**Vraie IP des visiteurs** : les bans et la liste blanche IP reposent sur l'IP du visiteur. Si un proxy est placé devant nginx, nginx lit l'en-tête `X-Forwarded-For` qu'il envoie, mais seulement depuis les adresses de `TRUSTED_PROXIES` (par défaut les réseaux privés : proxy sur le même serveur ou sur le réseau Docker). Derrière **Cloudflare**, ajoutez ses plages d'IP ([cloudflare.com/ips](https://www.cloudflare.com/ips/)) à `TRUSTED_PROXIES`.

### 6. Premier lancement

Ouvrir `https://votre-domaine` dans le navigateur. La page de setup s'affiche automatiquement : elle demande l'**URL publique**, le **nom de l'instance** et le **compte Super Admin**. Une fois validé, la plateforme est opérationnelle.

> ⚠️ Le premier visiteur de la page de setup devient Super Admin : faites le setup juste après le premier démarrage.

### Mise à jour

```bash
git pull
docker compose up -d --build
```

### Déploiement avec Coolify

1. Nouvelle ressource → dépôt Git → build pack **Docker Compose**.
2. **Docker Compose Location** : `/docker-compose.coolify.yml`.
3. Variables d'environnement : `DB_PASSWORD` (obligatoire), `MASTER_KEY` (optionnel). Cochez « Runtime only » si Coolify affiche un avertissement sur `NODE_ENV`.
4. Domaine : **uniquement sur le service `nginx`**, port 80 (ex. `https://photos.mondomaine.fr`). Ne mettez pas de domaine sur `backend` ni `frontend` : nginx route `/api`, `/ws` et `/media` vers le backend, et le reste vers le frontend.
5. Déployez, puis ouvrez le domaine pour faire le setup.

Coolify termine le TLS. La vraie IP des visiteurs est lue dans l'en-tête envoyé par son proxy, sans réglage supplémentaire.

### Développement

```bash
docker compose -f docker-compose.dev.yml up --build
```

Interface sur `http://localhost:5173` (rechargement à chaud du frontend et du backend), API sur `http://localhost:3000`.

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

## Identité visuelle

Le nom **Obscura** vient de la *camera obscura*, l'ancêtre de l'appareil photo : une chambre noire où l'image se forme à l'abri des regards — comme vos médias, accessibles uniquement aux IP autorisées.

Le logo représente un **diaphragme d'objectif** à six lames : il évoque la photo et la vidéo, et l'idée d'une ouverture que l'on contrôle.

| Fichier | Usage |
|---------|-------|
| `docs/brand/icon.svg` / `frontend/public/icon.svg` | Icône seule, favicon |
| `docs/brand/logo-dark.svg` | Logo complet sur fond sombre |
| `docs/brand/logo-light.svg` | Logo complet sur fond clair |

Couleurs : violet `#7c3aed` (principal), `#a78bfa` → `#4c1d95` (dégradé de l'icône). Police du logotype : Inter Display SemiBold.

> **Migration depuis WubalStore** : la base, l'utilisateur Postgres, les conteneurs et le réseau Docker s'appellent désormais `obscura`. Sur une installation existante, mettez `DB_NAME=obscura` et `DB_USER=obscura` dans votre `.env`, puis recréez le volume Postgres (`docker compose down -v && docker compose up -d`) — **cela efface la base**, faites une sauvegarde avant si vous avez des données à garder. Les utilisateurs devront aussi se reconnecter une fois.

---

## Auteur

wubal — [github.com/wubal](https://github.com/wubal)
