# WubalStore

Plateforme d'hébergement de médias privée et auto-hébergée. Stocker vos images et vidéos sur votre VPS, générer des liens protégés par liste blanche IP, gérer des comptes avec rôles granulaires.

## Stack

- **Backend** : Node.js + Fastify
- **Base de données** : PostgreSQL 16
- **Frontend** : React + Vite + Tailwind CSS
- **Reverse proxy** : Nginx
- **Conteneurisation** : Docker + Docker Compose
- **Traitement médias** : Sharp (images) + FFmpeg (vidéos)

## Déploiement rapide

### Prérequis

- Docker + Docker Compose
- Ubuntu 22.04 (ou compatible)

### Installation

```bash
git clone https://github.com/wubal/wubalstore
cd wubalstore
cp .env.example .env
# Éditer .env avec vos valeurs
```

Générer des secrets JWT sécurisés :

```bash
openssl rand -base64 64
```

Lancer la commande deux fois et copier les valeurs dans `.env` pour `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET`.

```bash
docker-compose up -d
```

### Premier lancement

1. Accéder à `http://votre-serveur`
2. La page de setup s'ouvre automatiquement
3. Créer le compte Super Admin
4. La plateforme est prête

### Migrations et seed

```bash
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
```

## Variables d'environnement

Voir [.env.example](.env.example) pour la liste complète.

## Fonctionnalités

- Upload images (JPG, PNG, WEBP, GIF, SVG, AVIF) et vidéos (MP4, WEBM, MOV)
- Génération automatique de miniatures
- Explorateur de fichiers style Google Drive (grille / liste)
- Liens permanents protégés par liste blanche IP
- Gestion de comptes avec validation manuelle
- Rôles et permissions granulaires
- 2FA TOTP + OTP email
- Connexion Discord OAuth2
- Ban progressif des attaquants
- Fingerprinting navigateur
- Logs complets par catégorie
- Notifications temps réel (WebSocket)
- Sauvegardes locales + Backblaze B2 (Rclone)
- Gestion automatique du stockage

## Sécurité

- JWT (access 15min + refresh 7j httpOnly)
- Bannissement progressif : 2min → 15min → 1h → 24h → permanent
- Double vérification IP whitelist (Nginx + Fastify)
- Validation MIME côté serveur
- Sanitisation des noms de fichiers
- URLs publiques uniquement via tokens (jamais les chemins réels)

## Auteur

wubal — [github.com/wubal](https://github.com/wubal)
