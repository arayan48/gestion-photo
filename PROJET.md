# PROJET.md — Documentation complète Obscura

> Document de référence complet du projet Obscura. Contient la vision, les fonctionnalités, les décisions techniques et les règles métier.

---

## 🎯 Vision du projet

**Obscura** (anciennement WubalStore) est une plateforme d'hébergement de médias privée et auto-hébergée, conçue pour stocker des images et vidéos de manière sécurisée sur un VPS personnel. Elle permet de générer des liens d'accès contrôlés par liste blanche IP, utilisables dans des projets externes (serveurs FiveM, sites web, etc.).

Le projet est open source, déployable via Docker sur n'importe quel VPS Ubuntu 22.04, et pensé pour être partagé sur GitHub.

**Auteur / Super Admin** : wubal
**GitHub** : github.com/wubal
**Langue de l'interface** : Français intégral

---

## 🖥️ Infrastructure cible

- **OS** : Ubuntu 22.04 LTS
- **CPU** : 2 cœurs
- **RAM** : 4 Go
- **Stockage** : 50 Go

---

## 🏗️ Stack technique

| Couche | Technologie | Raison |
|--------|-------------|--------|
| Backend | Node.js + Fastify | Rapide, natif JWT, excellent pour fichiers |
| Base de données | PostgreSQL | Robuste, adapté aux données structurées complexes |
| Frontend | React + Vite | Léger, performant, excellent écosystème |
| Reverse proxy | Nginx | HTTPS, rate limiting bas niveau, filtrage IP |
| Conteneurisation | Docker + Docker Compose | Isolation, portabilité, déploiement simple |
| Stockage | Système de fichiers local | Simple, maîtrisé, 50Go sur VPS |
| Sauvegardes | Local + Rclone → Backblaze B2 | Redondance gratuite |
| Emails | Brevo (modulaire) | Gratuit au démarrage, extensible |
| Auth externe | OAuth2 Discord | Pratique pour équipes FiveM |
| Temps réel | WebSocket | Notifications instantanées |
| Traitement images | Sharp | Conversion, compression, redimensionnement |
| Traitement vidéos | FFmpeg | Métadonnées, miniatures, conversion |

---

## 👥 Système de comptes

### Inscription
L'inscription est fermée au public. Tout nouvel utilisateur doit :
1. Remplir un formulaire de demande (email, mot de passe, pseudo, prénom/nom facultatif, photo de profil facultative, raison de la demande)
2. Attendre la validation manuelle du Super Admin ou d'un utilisateur avec la permission `users.accept_requests`
3. Recevoir un email de confirmation à l'acceptation

### Connexion
- Formulaire email + mot de passe
- Bouton "Se connecter avec Discord" (OAuth2, récupère avatar + pseudo Discord)
- 2FA optionnel : TOTP via QR code (Google Authenticator, Authy) ou OTP par email
- Mot de passe oublié par email

### Profil utilisateur
Modifiable depuis les paramètres :
- Mot de passe
- Photo de profil
- Lier / délier compte Discord (affiche avatar + pseudo Discord)

Non modifiable : email (lié à la validation du compte)

---

## 🔑 Rôles et permissions

### Super Admin
- Créé lors du setup initial (premier lancement)
- Unique, intouchable, accès total
- Seul au-dessus de tous les autres rôles

### Rôles personnalisés
Créés librement depuis le dashboard avec un nom personnalisé et des permissions choisies parmi les catégories suivantes :

#### Catégorie : Fichiers & Médias
| Clé | Description |
|-----|-------------|
| `files.upload` | Uploader des fichiers |
| `files.delete_own` | Supprimer ses propres fichiers |
| `files.delete_others` | Supprimer les fichiers des autres |
| `files.create_folder` | Créer des dossiers |
| `files.rename_move` | Renommer et déplacer des fichiers |
| `files.toggle_link` | Activer / désactiver un lien |
| `files.view_others` | Voir les fichiers des autres utilisateurs |
| `files.create_tags` | Créer des tags |

#### Catégorie : Utilisateurs
| Clé | Description |
|-----|-------------|
| `users.view_list` | Voir la liste des utilisateurs |
| `users.accept_requests` | Accepter / refuser les demandes de compte |
| `users.suspend` | Suspendre un utilisateur |
| `users.change_role` | Modifier le rôle d'un utilisateur |
| `users.change_quota` | Modifier le quota d'un utilisateur |
| `users.delete` | Supprimer un utilisateur |

#### Catégorie : Sécurité
| Clé | Description |
|-----|-------------|
| `security.view_whitelist` | Voir la liste blanche IP |
| `security.manage_whitelist` | Ajouter / modifier / supprimer des IPs |
| `security.view_logs` | Voir les logs de sécurité |
| `security.revoke_tokens` | Révoquer des tokens JWT |
| `security.unban` | Débannir un utilisateur |

#### Catégorie : Système
| Clé | Description |
|-----|-------------|
| `system.view_logs` | Voir les logs système |
| `system.view_stats` | Voir les statistiques globales |
| `system.manage_backups` | Gérer les sauvegardes |
| `system.manage_config` | Modifier la configuration générale |
| `system.manage_storage` | Modifier les seuils de stockage |

---

## 🔒 Sécurité

### Authentification JWT
- Access token : expiration 15 minutes
- Refresh token : expiration 7 jours, httpOnly cookie
- Rotation des refresh tokens à chaque renouvellement

### Bannissement progressif
| Tentatives | Durée du ban |
|-----------|-------------|
| 5 échecs | 2 minutes |
| Récidive | 15 minutes |
| Récidive | 1 heure |
| Récidive | 24 heures |
| Ban permanent | Manuel par Super Admin uniquement |

Chaque ban génère un **ID unique** pour faciliter le débannissement depuis le dashboard.

### Fingerprinting des attaquants
Croisement de signaux pour identifier un attaquant même s'il change d'IP :
- Adresse IP
- User-Agent navigateur
- Token JWT (si existant)
- Empreinte navigateur (browser fingerprint)

Si plusieurs signaux correspondent malgré un changement d'IP → même suspect → ban maintenu.

### Liste blanche IP pour les médias
- Toute requête vers un lien de média vérifie l'IP appelante
- IP absente de la whitelist → 403 immédiat
- Double vérification : Nginx + Fastify
- Modifiable uniquement par les utilisateurs avec `security.manage_whitelist`

### Autres mesures
- HTTPS obligatoire (Nginx)
- Rate limiting Nginx + Fastify
- Sanitisation des noms de fichiers avant stockage
- Validation des types MIME côté serveur
- Les URLs publiques n'exposent jamais les chemins réels (token unique par fichier)

---

## 📁 Explorateur de fichiers

### Navigation latérale
- **Mon espace** → fichiers et dossiers personnels
- **Espace commun** → vue lecture sur tous les fichiers du serveur (triable par nom, date, type, utilisateur)
- **Récents** → derniers fichiers uploadés ou consultés
- **Favoris** → fichiers marqués comme favoris (personnels à chaque utilisateur)
- **Corbeille** → fichiers supprimés, rétention 48h puis suppression définitive

### Interface
- Vue **grille** et vue **liste** switchables
- Fil d'Ariane visible pour la navigation dans les dossiers
- Barre de recherche : filtre par nom, tag, dossier, type de fichier + filtre date séparé
- Sélection multiple par zone (cliquer-glisser)
- Drag & drop pour déplacer fichiers et dossiers
- **Clic droit contextuel** : Copier, Coller, Supprimer, Télécharger, Informations, Renommer, Déplacer

### Tags
- Créés librement si permission `files.create_tags`
- Bouton "+" dans le sélecteur de tags pour créer un nouveau tag à la volée

### Avertissements
- Message de confirmation avant toute suppression (lien actif ou non)

---

## 📤 Upload

### Processus
1. Sélection des fichiers (glisser-déposer ou bouton)
2. Upload multiple simultané avec barre de progression individuelle par fichier
3. Pour chaque fichier, formulaire pré-validation :
   - **Nom** (modifiable, renommage automatique anti-doublon)
   - **Dossier de destination**
   - **Usage prévu** :
     - 🖼️ Grande qualité → original conservé
     - ⚖️ Usage standard → optimisation légère (~85% qualité)
     - 🔹 Miniature / Icône → compression forte, conversion possible en `.ico`

### Panel latéral pendant l'upload
Pour chaque fichier : nom original → nom final, résolution, FPS (vidéo), durée (vidéo), taille, format, statut

### Vérification quota
Si l'upload dépasse le quota disponible → message d'erreur clair avant validation

### Formats acceptés
- **Images** : JPG, PNG, WEBP, GIF, SVG, AVIF
- **Vidéos** : MP4, WEBM, MOV

---

## 🔗 Liens de médias

- Généré **automatiquement** à l'upload (token unique)
- **Permanent** tant que le fichier existe
- **Activable / Désactivable** : lien grisé + icône rouge si désactivé (si permission `files.toggle_link`)
- **Protégé par liste blanche IP** : seules les IPs autorisées peuvent accéder au média
- **Statistiques** : compteur d'accès par lien visible dans les informations du fichier
- Liens uniquement pour fichiers individuels, jamais pour dossiers

---

## 🎬 Visionneuse

### Vidéos
Lecteur style YouTube : pause, plein écran, barre de progression, contrôle qualité, miniature automatique générée depuis la première frame

### Images
Affichage plein écran qualité maximale

---

## 📊 Logs

### Catégories
- **Authentification** : connexions, échecs, bans, débannissements
- **Fichiers** : upload, suppression, renommage, déplacement, liens activés/désactivés
- **Utilisateurs** : création, modification de rôle, suspension, suppression
- **Sécurité** : accès non autorisés via liens, tentatives suspectes
- **Système** : utilisation CPU, RAM, stockage

### Filtres disponibles
- Par catégorie
- Par utilisateur
- Par niveau de gravité (info, warning, erreur)
- Par date précise ou plage de dates
- Recherche par mot clé

---

## 🔔 Notifications

- Cloche en haut à droite avec badge compteur
- Historique des notifications pendant l'absence
- Temps réel via WebSocket
- **Jamais par email**

### Événements notifiés
- Nouvelle demande de création de compte
- Tentative de connexion suspecte / ban automatique
- Quota utilisateur presque atteint (90%)
- Limite de stockage serveur atteinte
- Sauvegarde réussie ou échouée
- Upload terminé
- Fichier supprimé par un utilisateur

---

## 💾 Gestion du stockage

### Calcul automatique
Au démarrage, le backend interroge le système pour connaître le stockage réel disponible, retire 5% de sécurité et répartit intelligemment l'espace.

### Répartition par défaut (configurable depuis le dashboard Super Admin)
| Usage | Allocation |
|-------|-----------|
| Médias (images/vidéos) | ~70% de l'espace sécurisé |
| Zips temporaires | 5 Go fixe |
| Logs | 2 Go fixe (avec rotation) |
| Sauvegardes locales | ~10% de l'espace sécurisé |
| Système réservé | Reste |

### Quota utilisateur
- **Par défaut** : 1 Go par utilisateur
- Modifiable individuellement par un utilisateur avec `users.change_quota`

### Alertes et blocages
- À 90% de la limite médias : alerte dans la cloche + bandeau dashboard admin
- À 100% : blocage automatique de tous les nouveaux uploads
- Message affiché aux utilisateurs bloqués : *"Le serveur a atteint sa limite de stockage. Veuillez contacter l'administrateur."*

---

## 💿 Sauvegardes

- **Stockage** : local + Rclone vers Backblaze B2 (gratuit jusqu'à 10 Go)
- **Planification** : automatique (configurable : quotidien, hebdomadaire)
- **Gestion depuis l'interface** : lancer manuellement, voir l'historique (succès / échec)
- **Rotation** : conservation des N dernières sauvegardes locales (configurable)

---

## 📧 Système email

Provider actif configurable depuis le dashboard admin ou via variable d'environnement.

### Providers supportés
| Provider | Usage recommandé |
|----------|-----------------|
| **Brevo** | Par défaut, gratuit au démarrage |
| SMTP custom | Serveur mail personnel futur |
| Resend | Alternative moderne |
| Mailgun | Usage avancé |
| SendGrid | Usage en production |

### Emails envoyés
- Confirmation de création de compte (à l'acceptation)
- Code OTP pour double authentification
- Lien de réinitialisation de mot de passe

---

## 🎨 Interface

- **Thème** : clair et sombre avec switch, sombre par défaut
- **Langue** : français intégral
- **Navigation principale** : explorateur de fichiers à l'arrivée (tout rôle confondu)
- **Accès dashboard admin** : menu profil en haut à droite → "Dashboard" (visible selon les droits)

---

## 🚀 Déploiement

### Prérequis
- Docker + Docker Compose installés
- Ubuntu 22.04 (ou compatible)
- Nom de domaine avec HTTPS

### Premier lancement
1. Cloner le repo
2. Copier `.env.example` → `.env` et remplir les variables
3. `docker-compose up -d`
4. Accéder à l'URL du projet → page de setup automatique
5. Créer le compte Super Admin
6. La plateforme est prête

---

## 📋 Règles métier importantes

- Les **UUID** sont utilisés comme identifiants partout (jamais d'auto-increment)
- Toutes les dates sont en **UTC**
- Les **zips temporaires** sont supprimés après **1 heure** (cron job)
- La **corbeille** est vidée après **48 heures** (cron job)
- Les **noms de fichiers** sont sanitisés et rendus uniques avant stockage
- Les **URLs publiques** n'exposent jamais les chemins réels des fichiers
- La **validation des types MIME** se fait côté serveur, pas seulement sur l'extension
- Chaque action sensible génère un **log** sans exception
