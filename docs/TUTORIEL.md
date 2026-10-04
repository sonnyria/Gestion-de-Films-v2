# Tutoriel — Gestion-de-Films-v2

Gérez votre collection de films depuis un ordinateur ou un téléphone : recherche
par titre, lecture de codes-barres, ajout, modification et suppression. Les films
sont conservés dans **votre classeur Google Sheets**. Google Apps Script relie ce
classeur à l’application.

**[Ouvrir l’application](https://sonnyria.github.io/Gestion-de-Films-v2/)** ·
**[Retour à l’accueil du dépôt](../README.md)** · **[Script à copier](../Code.gs)**

## Sommaire

1. [Ce qu’il faut préparer](#1-ce-quil-faut-préparer)
2. [Organiser Google Sheets](#2-organiser-google-sheets)
3. [Installer le script Google](#3-installer-le-script-google)
4. [Obtenir l’adresse du script](#4-obtenir-ladresse-du-script)
5. [Configurer l’application](#5-configurer-lapplication)
6. [Activer la recherche par code-barres](#6-activer-la-recherche-par-code-barres)
7. [Utiliser la collection](#7-utiliser-la-collection)
8. [Actualiser les données et le script](#8-actualiser-les-données-et-le-script)
9. [Résoudre les problèmes courants](#9-résoudre-les-problèmes-courants)

## 1. Ce qu’il faut préparer

- Un compte Google et un classeur Google Sheets que vous pouvez modifier.
- Un navigateur récent et une connexion Internet.
- Pour le scanner : un appareil avec caméra et l’autorisation de l’utiliser.
- Pour identifier automatiquement un film à partir d’un code-barres : une clé
  CorsProxy. La recherche par titre fonctionne sans cette clé.

**Si votre installation fonctionne déjà**, conservez votre script Google et son
adresse. Les étapes d’installation du script ci-dessous servent à une nouvelle
installation ou à reconstruire une configuration. Le fichier `Code.gs` fourni
est un exemple compatible ; sa publication sur GitHub ne remplace pas le script
dans votre compte Google.

## 2. Organiser Google Sheets

Créez un classeur, par exemple **Ma collection de films**, puis nommez l’onglet
contenant les titres **Films**. Il s’agit du nom de l’onglet en bas de Sheets,
qui peut être différent du nom du classeur.

La collection utilise **quatre listes verticales indépendantes** : une colonne
par support. Chaque cellule contient le titre d’un film.

| Ligne | A — LASERDISC | B — DVD | C — Blu-Ray | D — à acheter |
| --- | --- | --- | --- | --- |
| 1 | LASERDISC | DVD | Blu-Ray | à acheter |
| 2 | Titanic | Inception | The Matrix | Interstellar |
| 3 | Jurassic Park | Pulp Fiction | Dune : Deuxième partie | Alien |
| 4 | | Amélie | Blade Runner 2049 | |

### Règles de saisie

- Inscrivez les quatre en-têtes sur la **ligne 1**, dans cet ordre.
- Placez les films à partir de la **ligne 2**.
- Saisissez **un titre par cellule**, en texte, sans fusionner les cellules.
- Les colonnes peuvent avoir des longueurs différentes ; les cellules vides
  sont ignorées.
- Une ligne n’est pas la fiche d’un seul film : les titres en A2, B2, C2 et D2
  représentent quatre entrées indépendantes.
- Un film possédé en DVD et en Blu-Ray peut figurer dans les deux colonnes.
- Évitez deux entrées strictement identiques dans une même colonne : l’édition
  et la suppression ciblent la première occurrence du titre et du support.
- Les colonnes A à D sont réservées aux titres. Des informations supplémentaires
  placées ailleurs ne sont pas affichées par cet exemple de script.

La correspondance des supports est fixée dans le script. Conservez donc
l’ordre des colonnes, même si vous personnalisez la présentation du classeur.

## 3. Installer le script Google

1. Ouvrez le classeur Google Sheets.
2. Choisissez **Extensions → Apps Script**.
3. Donnez un nom au projet, par exemple **API collection de films**.
4. Ouvrez [Code.gs dans ce dépôt](../Code.gs), puis **Raw / Brut** pour copier
   uniquement le code.
5. Pour cette nouvelle installation, remplacez le code par défaut dans l’éditeur
   Apps Script par le contenu copié. Un seul fichier contenant `doGet` suffit.
6. Renseignez `SPREADSHEET_ID` en tête du script.
7. Enregistrez.

### Où trouver l’identifiant du classeur ?

Dans l’adresse du classeur :

```text
https://docs.google.com/spreadsheets/d/IDENTIFIANT_DU_CLASSEUR/edit
```

Copiez uniquement la partie située **entre `/d/` et `/edit`**, puis remplacez le
texte d’exemple entre les guillemets :

```javascript
var SPREADSHEET_ID = "IDENTIFIANT_DU_CLASSEUR";
```

Cet identifiant désigne le classeur. Ce n’est ni une clé CorsProxy, ni l’adresse
à renseigner dans l’application.

L’exemple ouvre explicitement ce classeur et utilise son onglet `Films`.
Il fournit les actions `getAll`, `search`, `add`, `edit` et `delete` attendues
par l’application.

Référence : [ouvrir un classeur par son identifiant — Google](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#openById(String)).

## 4. Obtenir l’adresse du script

### Premier déploiement

Dans Apps Script :

1. Cliquez sur **Déployer → Nouveau déploiement**.
2. Sélectionnez le type **Application Web** via l’icône de sélection du type.
3. Ajoutez une description, par exemple **Collection de films v1**.
4. Choisissez **Exécuter en tant que : Moi**.
5. Pour cette application sans connexion Google intégrée, choisissez l’accès
   **Tout le monde**, y compris les visiteurs non connectés. Les choix proposés
   peuvent dépendre du compte et des règles Google Workspace.
6. Cliquez sur **Déployer**, puis autorisez les accès demandés pour votre propre
   projet et votre classeur.
7. Copiez **l’URL de l’application Web** fournie.

Elle ressemble à :

```text
https://script.google.com/macros/s/IDENTIFIANT_DU_DEPLOIEMENT/exec
```

**Utilisez l’adresse se terminant par `/exec`.** L’adresse `/dev` est destinée
aux tests et nécessite un accès au projet. L’adresse du classeur et celle de
l’éditeur Apps Script ne conviennent pas.

Références Google : [Applications Web](https://developers.google.com/apps-script/guides/web?hl=fr) ·
[Niveaux d’accès](https://developers.google.com/apps-script/manifest/web-app-api-executable?hl=fr).

### Retrouver une adresse déjà créée

Dans Apps Script, ouvrez **Déployer → Gérer les déploiements**. Sélectionnez le
déploiement actif de type Application Web et copiez son URL.

### Tester la connexion sans modifier les films

Ouvrez cette adresse, en remplaçant l’identifiant par le vôtre :

```text
https://script.google.com/macros/s/IDENTIFIANT_DU_DEPLOIEMENT/exec?action=getAll
```

Avec un film de test dans la colonne DVD, la réponse contient notamment :

```json
{
  "status": "success",
  "data": [
    { "title": "Inception", "support": "DVD" }
  ]
}
```

La liste réelle dépend du contenu de vos quatre colonnes. Une réponse
`{"status":"success","data":[]}` signifie que le script répond correctement,
mais ne trouve aucun titre sous les en-têtes.

**Accès aux données :** le classeur peut rester privé. En revanche, cette
version du script ne contient pas d’authentification supplémentaire : toute
personne connaissant son URL publique peut appeler ses actions de lecture et
d’écriture. Gardez votre URL personnelle hors des publications, captures et
commits publics.

## 5. Configurer l’application

1. Ouvrez [Gestion-de-Films-v2](https://sonnyria.github.io/Gestion-de-Films-v2/).
2. Dans le menu inférieur, ouvrez **Configuration**.
3. Collez l’URL `/exec` dans **URL Script Google**, sans `?action=getAll`.
4. Cliquez sur **Sauvegarder**.
5. Ouvrez **Bibliothèque** pour vérifier les titres et les quatre catégories.

L’adresse est mémorisée dans ce navigateur. Sur un autre appareil ou après
suppression des données du site, renseignez-la à nouveau. L’application ne
publie pas votre configuration dans le dépôt GitHub.

Pour essayer l’interface avant de connecter Google, saisissez `demo` à la place
de l’URL. Les films de démonstration ne sont pas enregistrés dans votre classeur
et les changements de démonstration sont perdus au rechargement.

## 6. Activer la recherche par code-barres

Le scanner lit un numéro : il ne contient pas directement le titre du film.
L’application utilise **UPCitemdb**, un catalogue de produits, pour retrouver
le titre. **CorsProxy** permet au navigateur d’interroger cette API depuis
GitHub Pages.

1. Créez un compte sur [CorsProxy](https://corsproxy.io/) et obtenez une clé API.
2. Dans **Configuration → Recherche par code-barres**, collez cette clé.
3. Cliquez sur **Sauvegarder**.
4. Cliquez sur **Tester la recherche Internet** pour vérifier séparément le
   proxy et le catalogue. Le test du catalogue utilise un code d’Inception.
5. Retournez à **Recherche** et lancez le scanner.

Référence : [format de requête et clé CorsProxy](https://corsproxy.io/docs/how-to-use/).

La clé est stockée dans ce navigateur. N’inscrivez pas votre clé dans le code
ou dans un message public. Les erreurs affichées par le diagnostic masquent la
clé utilisée.

Le parcours est : **code lu → titre identifié sur Internet → titre recherché
localement dans la collection**. Le titre trouvé remplace le numéro dans le
champ de recherche. Vous pouvez ensuite le corriger si l’édition ou la langue
emploie une autre formulation.

Le catalogue ne contient pas tous les codes, notamment certaines éditions
françaises. Des limites d’utilisation s’appliquent. Si l’identification échoue,
l’application distingue un code absent, une configuration manquante ou un accès
refusé. Elle propose aussi une vérification sur le Web et la saisie du titre.
Le numéro n’est pas ajouté automatiquement comme titre de film.

## 7. Utiliser la collection

### Rechercher un titre

Dans **Recherche**, saisissez un titre ou une partie de titre, puis lancez la
recherche avec la loupe ou la touche Entrée. La recherche ignore les accents et
la casse, et utilise une correspondance approchée lorsqu’aucune inclusion
simple ne correspond. Vérifiez les résultats : une correspondance approchée
peut désigner un titre proche.

Après le chargement de la collection, la recherche est faite dans le
navigateur, sans appel Google pour chaque titre.

### Parcourir la bibliothèque

Dans **Bibliothèque**, sélectionnez **Blu-Ray**, **DVD**, **LASERDISC** ou
**à acheter**. Le champ de filtre limite les titres de la catégorie affichée.
La liste est présentée par ordre alphabétique dans l’application.

### Ajouter un film

- Sans résultat : choisissez **Ajouter "votre titre"**.
- Avec des résultats existants : choisissez **Ajouter ce titre quand même**.

Dans le formulaire, vérifiez ou corrigez le titre, choisissez le support, puis
cliquez sur **Enregistrer**. Un ajout n’est enregistré dans Google Sheets que
si le serveur confirme son succès. Le support **à acheter** sert de liste de
souhaits.

L’ajout écrit dans la colonne du support choisi, en réutilisant une cellule
vide disponible ou en poursuivant la liste.

### Modifier ou supprimer

Cliquez sur un film dans les résultats ou la bibliothèque :

- Modifiez son titre, puis cliquez sur **Sauvegarder**.
- Pour supprimer, cliquez sur **Supprimer ce film**, puis confirmez.

L’édition actuelle modifie le titre, sans déplacer l’entrée vers un autre
support. Pour changer de support, ajoutez l’entrée dans le support voulu puis
supprimez l’ancienne après avoir vérifié l’enregistrement.

Dans l’exemple de script, une suppression compacte uniquement la colonne
concernée ; elle ne supprime pas une ligne entière contenant d’autres films.

## 8. Actualiser les données et le script

### Après une modification directe dans Google Sheets

Dans **Bibliothèque**, cliquez sur l’icône d’actualisation à côté du titre de
la page. Elle force un nouveau chargement de Google Sheets.

La version actuelle utilise un cache **en mémoire pendant cinq minutes**,
partagé entre recherche et bibliothèque. Il est invalidé après un ajout, une
édition, une suppression ou un changement d’URL. Un rechargement de
l’application recharge aussi la collection.

Les écritures sont envoyées immédiatement à Google. La version actuelle ne
propose pas encore de liste persistante utilisable hors connexion, de date de
synchronisation affichée ou de file d’ajouts à envoyer plus tard.

### Après une modification du code Apps Script

Enregistrer le code ne met pas à jour une version déjà déployée. Dans
**Déployer → Gérer les déploiements**, sélectionnez votre déploiement, cliquez
sur le crayon **Modifier**, choisissez une **nouvelle version**, puis déployez.
Modifier le déploiement existant permet de conserver son URL.

Si vous créez un déploiement distinct, copiez sa nouvelle URL `/exec` dans
l’application et sauvegardez la configuration.

Référence : [gestion des déploiements et versions — Google](https://developers.google.com/apps-script/concepts/deployments?hl=fr).

### Après une mise à jour de l’application

Rechargez la page. Sur ordinateur, **Ctrl + F5** permet de demander un
rechargement complet si vous voyez encore une ancienne interface.

## 9. Résoudre les problèmes courants

| Symptôme | Vérification ou action |
| --- | --- |
| Configuration API absente | Renseignez l’URL `/exec`, puis sauvegardez. |
| Impossible de charger la collection | Testez l’URL avec `?action=getAll` ; vérifiez Internet, le déploiement et ses autorisations. |
| Google demande une connexion au lieu de renvoyer du JSON | Vérifiez l’accès aux visiteurs non connectés et l’utilisation de `/exec`. Un compte Workspace peut limiter ce choix. |
| Erreur sur `SPREADSHEET_ID` | Copiez l’identifiant du classeur dans l’exemple de script et mettez à jour le déploiement. |
| Onglet Films introuvable | Nommez l’onglet `Films`, ou adaptez `SHEET_NAME` dans votre script puis redéployez. |
| Aucun film malgré des données dans Sheets | Vérifiez l’ordre A à D et la présence des titres dès la ligne 2. Cliquez sur actualiser. |
| Code lu, mais identification impossible | Vérifiez la clé dans la configuration et utilisez **Tester la recherche Internet**. |
| HTTP 403 | L’accès est bloqué par le proxy ou le catalogue ; cela ne prouve pas une erreur de clé. Consultez le détail affiché. |
| Restriction de domaine signalée | Si votre compte impose une liste de domaines autorisés, ajoutez `https://sonnyria.github.io`. |
| Limite atteinte / HTTP 429 | Attendez avant de relancer les recherches et vérifiez les quotas des services. |
| Caméra inaccessible | Autorisez la caméra pour le site et utilisez l’adresse HTTPS de l’application. Fermez les applications utilisant déjà la caméra. |
| Un titre ajouté à la main n’apparaît pas | Actualisez la bibliothèque pour relire Google Sheets. |
| Changement perdu en mode demo | Ce mode ne persiste pas les ajouts dans Google Sheets. |

Pour signaler un problème, indiquez le navigateur, le message affiché, le
code-barres si pertinent et les résultats du test Internet. Gardez votre clé
et votre URL de script personnelle hors du message.

Référence : [explication des erreurs 403 — CorsProxy](https://corsproxy.io/docs/403-forbidden/).
