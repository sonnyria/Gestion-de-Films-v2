# MyMovieDB

Une application de gestion de collection de films moderne, connectée à Google Sheets.

## Installation

1. Cloner le repo
2. Installer les dépendances :
   ```bash
   npm install
   ```
3. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```

## 🆘 Dépannage : Erreur "Something went wrong"

Si la synchronisation VS Code échoue, suivez ces étapes dans le terminal (`Terminal > Nouveau Terminal`) :

### 1. Nettoyer le cache Git
Si vous avez envoyé par erreur le dossier `node_modules` (très lourd), cela bloque tout. Lancez :
```bash
npm run fix-git
```
Puis essayez de synchroniser.

### 2. Forcer l'envoi (Force Push)
Si vous avez une erreur "Updates were rejected" ou que la synchronisation tourne en rond, c'est qu'il y a un conflit d'historique. 
Pour forcer votre version locale à écraser celle de GitHub (solution radicale mais efficace pour un projet perso) :

```bash
git push -f origin main
```

### 3. Vérifier la connexion
Tapez `git status`. Si cela indique "Your branch is ahead of 'origin/main' by X commits", essayez simplement un `git push`.

## Déploiement sur GitHub Pages

Ce projet utilise GitHub Actions. Une fois le code envoyé sur GitHub (push) :
1. Allez sur votre repo GitHub > **Settings** > **Pages**.
2. Dans "Source", assurez-vous que **GitHub Actions** est sélectionné (pas "Deploy from a branch").
3. Le site sera visible sur : `https://[votre-pseudo].github.io/Gestion-de-Films-v2/`

## Recherche et actualisation

La collection est préchargée à l’ouverture de la page de recherche. Les recherches
de titres se font ensuite localement, sans appel Google Apps Script pour chaque
requête, y compris les correspondances sans accents et la recherche approchée.

Le cache mémoire est partagé avec la bibliothèque pendant cinq minutes. Il est
invalide après un ajout, une modification, une suppression ou un changement
d’URL du script. Le bouton d’actualisation de la bibliothèque force un nouveau
chargement, utile après une modification directe dans Google Sheets. Un
rechargement de l’application recharge également la collection. Le premier
chargement reste dépendant du temps de réponse de Google Apps Script.

Vérifications avant déploiement : `npm test`, `npx tsc --noEmit`, `npm run build`.
