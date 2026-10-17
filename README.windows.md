# Obscura — Guide d'installation Windows

Plateforme d'hébergement de médias privée et auto-hébergée. Ce guide couvre l'installation sur Windows 10/11 via Docker Desktop.

## Prérequis

- Windows 10 version 2004+ ou Windows 11
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (avec WSL2 backend activé)
- [Git pour Windows](https://git-scm.com/download/win)
- WSL2 activé (voir ci-dessous)

## Activer WSL2

Ouvrir PowerShell en tant qu'administrateur :

```powershell
wsl --install
wsl --set-default-version 2
```

Redémarrer l'ordinateur, puis vérifier :

```powershell
wsl --list --verbose
```

## Installer Docker Desktop

1. Télécharger Docker Desktop sur [docker.com](https://www.docker.com/products/docker-desktop/)
2. Lancer l'installateur et cocher **"Use WSL 2 instead of Hyper-V"**
3. Redémarrer
4. Vérifier l'installation dans PowerShell :

```powershell
docker --version
docker compose version
```

## Installation d'Obscura

Ouvrir **PowerShell** ou **Git Bash** :

```powershell
git clone https://github.com/arayan48/gestion-photo
cd gestion-photo
copy .env.example .env
```

Éditer le fichier `.env` avec le Bloc-notes ou VS Code :

```powershell
notepad .env
# ou
code .env
```

Modifier au minimum le mot de passe de la base :

```env
DB_PASSWORD=votre_mot_de_passe
```

Tout le reste (URL publique, email, Discord, sauvegardes) se configure dans l'interface : à l'installation puis dans **Admin → Configuration**. Les secrets JWT sont générés automatiquement.

Démarrer les conteneurs :

```powershell
docker compose up -d --build
```

Les migrations de la base sont appliquées automatiquement au démarrage du backend.

## Premier lancement

1. Ouvrir `http://localhost` dans votre navigateur
2. La page de setup s'ouvre automatiquement
3. Créer le compte Super Admin
4. La plateforme est prête

## Commandes utiles

```powershell
# Voir les logs en temps réel
docker compose logs -f

# Arrêter les conteneurs
docker compose down

# Redémarrer après modification du .env
docker compose down
docker compose up -d

# Accéder au shell du backend
docker compose exec backend sh

# Voir l'état des conteneurs
docker compose ps
```

## Problèmes fréquents sur Windows

### Port 80 déjà utilisé

Si le port 80 est occupé (IIS, Skype, etc.) :

```powershell
# Identifier le processus
netstat -ano | findstr :80

# Désactiver IIS si nécessaire
iisreset /stop
```

Ou changer le port publié dans `.env` :

```env
HTTP_PORT=8080
```

Puis accéder à `http://localhost:8080`.

### Docker Desktop ne démarre pas

- Vérifier que la virtualisation est activée dans le BIOS
- Vérifier que WSL2 est à jour : `wsl --update`
- Redémarrer le service Docker Desktop depuis la barre des tâches

### Performances lentes

Les performances sont meilleures si le projet est cloné **dans le système de fichiers WSL2** et non dans `C:\`. Depuis le terminal WSL2 :

```bash
cd ~
git clone https://github.com/arayan48/gestion-photo
cd gestion-photo
cp .env.example .env
docker compose up -d
```

Puis accéder à `http://localhost`.

### Erreur de permissions sur les volumes

Ouvrir Docker Desktop → Settings → Resources → File sharing, et ajouter le dossier du projet.

## Accès réseau local

Pour rendre Obscura accessible sur votre réseau local (autres appareils) :

1. Trouver votre IP locale :

```powershell
ipconfig
# Chercher "Adresse IPv4" sous l'adaptateur actif
```

2. Ajouter `COOKIE_SECURE=false` dans `.env` puis relancer (`docker compose up -d`) : en HTTP simple, le navigateur refuse sinon le cookie de session (`http://localhost` n'est pas concerné). À ne jamais faire sur un serveur exposé à Internet.

3. Ouvrir `http://192.168.1.xxx` depuis l'autre appareil et, si l'installation est déjà faite, mettre à jour l'**URL publique** dans **Admin → Configuration → Général**.

4. Ouvrir le port 80 dans le pare-feu Windows :

```powershell
# En tant qu'administrateur
New-NetFirewallRule -DisplayName "Obscura" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

## Variables d'environnement

Voir [.env.example](.env.example) pour la liste complète.

## Auteur

wubal — [github.com/wubal](https://github.com/wubal)
