# WubalStore — Guide d'installation Windows

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

## Installation de WubalStore

Ouvrir **PowerShell** ou **Git Bash** :

```powershell
git clone https://github.com/wubal/wubalstore
cd wubalstore
copy .env.example .env
```

Éditer le fichier `.env` avec le Bloc-notes ou VS Code :

```powershell
notepad .env
# ou
code .env
```

Modifier au minimum :

```env
DB_PASSWORD=votre_mot_de_passe
JWT_ACCESS_SECRET=une_chaine_aleatoire_longue
JWT_REFRESH_SECRET=une_autre_chaine_aleatoire_longue
APP_URL=http://localhost
```

Démarrer les conteneurs :

```powershell
docker compose up -d
```

## Premier lancement

1. Ouvrir `http://localhost` dans votre navigateur
2. La page de setup s'ouvre automatiquement
3. Créer le compte Super Admin
4. La plateforme est prête

## Migrations et seed

```powershell
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

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

Ou modifier le port dans `docker-compose.yml` :

```yaml
ports:
  - "8080:80"
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
git clone https://github.com/wubal/wubalstore
cd wubalstore
cp .env.example .env
docker compose up -d
```

Puis accéder à `http://localhost`.

### Erreur de permissions sur les volumes

Ouvrir Docker Desktop → Settings → Resources → File sharing, et ajouter le dossier du projet.

## Accès réseau local

Pour rendre WubalStore accessible sur votre réseau local (autres appareils) :

1. Trouver votre IP locale :

```powershell
ipconfig
# Chercher "Adresse IPv4" sous l'adaptateur actif
```

2. Modifier `APP_URL` dans `.env` :

```env
APP_URL=http://192.168.1.xxx
```

3. Ouvrir le port 80 dans le pare-feu Windows :

```powershell
# En tant qu'administrateur
New-NetFirewallRule -DisplayName "WubalStore" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

## Variables d'environnement

Voir [.env.example](.env.example) pour la liste complète.

## Auteur

wubal — [github.com/wubal](https://github.com/wubal)
