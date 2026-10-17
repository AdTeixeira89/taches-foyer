# Family Play

Application familiale : tâches, calendrier partagé, points, défis, bonus et roulette des récompenses.

Une seule page HTML autonome (`index.html`), sans installation. Le logo (`logo.svg`, icônes PNG et `manifest.json`) sert d'icône d'onglet et d'écran d'accueil du téléphone.

## Lien de l'application

**https://adteixeira89.github.io/taches-foyer/** (GitHub Pages, comme les autres applications).

Activation : Settings, Pages, Deploy from a branch, branche `main`, dossier `/ (root)`.

## Ajouter des membres

Au départ, la famille compte trois profils (Adao, Maman, Fille). Pour en ajouter (grands-parents, cousins, autre enfant…) : **Famille > + Ajouter un membre**, ou **Paramètres > Autres membres**, ou dans « Qui utilise cet appareil ? ». Chaque membre a son prénom, son avatar et sa couleur, et joue comme les autres : colonne de tâches, points, classement, jokers et un tour de roulette par semaine. Jusqu'à 8 membres au total. Décocher « Afficher ce membre » le masque sans rien effacer (ses points et son historique restent).

## Avoir les mêmes données pour toute la famille (lien GitHub)

Les données sont rangées dans une base Firebase (Firestore), comme pour app-sante. À faire une seule fois :

1. Sur https://console.firebase.google.com, créer un projet (déjà créé : `taches-foyer`).
2. **Build > Authentication > Get started**, puis activer le fournisseur **Anonyme**.
3. **Build > Firestore Database > Create database** (région `europe-west`), puis onglet **Règles** : coller le contenu de `firestore.rules` et publier.
4. **Paramètres du projet > Vos applications > Web (</>)** : enregistrer une application et copier l'objet `firebaseConfig`.
5. Fait : la configuration du projet `taches-foyer` est déjà dans `index.html` (`FIREBASE_CONFIG`). Ces valeurs sont publiques, la protection vient des règles.
6. Dans **Authentication > Settings > Authorized domains**, vérifier que `adteixeira89.github.io` est présent (sinon l'ajouter).

Ensuite, sur le premier téléphone : ouvrir le lien, **Créer un foyer**. Un code de 12 caractères s'affiche (Paramètres, « Gérer le foyer »). Sur les autres téléphones : ouvrir le même lien et entrer ce code. Tout le monde voit alors les mêmes données, en direct.

Le code du foyer sert de clé : ne le donner qu'à la famille. Les tâches saisies en mode local sur le téléphone qui crée le foyer y sont recopiées.

Tant que `FIREBASE_CONFIG` vaut `null`, le lien GitHub fonctionne en mode local : les données restent sur chaque appareil.

## Notifications push (même application fermée)

Un téléphone est prévenu quand : une tâche lui est confiée par quelqu'un d'autre, un échange de joker ou une demande d'aide le concerne (et la réponse), un événement du calendrier est créé pour lui ou pour toute la famille, ou la semaine a un champion. Celui qui agit n'est jamais notifié de sa propre action. Elles suivent le profil choisi sur l'appareil. Elles n'existent que sur le lien GitHub (mode Firebase), pas sur la page claude.ai.

À faire une seule fois :

1. **Forfait Blaze** : console Firebase, roue dentée, *Utilisation et facturation*, *Modifier le forfait*, Blaze (carte bancaire demandée par Google). L'usage d'une famille reste dans les quotas gratuits. Ajoute une alerte de budget (par exemple 1 €).
2. **Clé Web Push** : faite. La clé publique du projet est déjà dans `index.html` (`FCM_VAPID_KEY`). Pour la changer : *Paramètres du projet*, onglet *Cloud Messaging*, section *Configuration Web*, *Générer une paire de clés*.
3. **Déployer les fonctions** depuis Google Cloud Shell (https://shell.cloud.google.com, avec le compte Google du projet) :
   ```
   git clone https://github.com/AdTeixeira89/taches-foyer.git && cd taches-foyer
   npm --prefix functions install
   npx firebase-tools login --no-localhost
   npx firebase-tools deploy --only functions,firestore:rules --project taches-foyer
   ```
   Accepte l'activation des services Google proposés au premier déploiement. Si le déploiement signale que la région ne correspond pas à celle de Firestore, change `REGION` dans `functions/index.js`.
4. **Sur chaque téléphone** : ouvre le lien, *Paramètres*, *Activer les notifications*. Sur iPhone (iOS 16.4 ou plus), ajoute d'abord l'application à l'écran d'accueil (Partager, *Sur l'écran d'accueil*) et active les notifications depuis son icône.

Les tests du code d'envoi se lancent avec `cd functions && npm install && npm test`. Les règles de `firestore.rules` doivent être publiées (étape 3) : les jetons des téléphones sont enregistrés sous `foyers/<code>/devices`, sans lecture possible depuis l'application.

## Déploiement automatique depuis GitHub

Alternative à Cloud Shell, utilisable depuis un iPhone. Une fois configuré, les fonctions et les règles Firestore se déploient en un appui (onglet *Actions*, *Déploiement Firebase (notifications)*, *Run workflow*), et automatiquement quand `functions/`, `firestore.rules` ou `firebase.json` changent sur `main`. Avant de déployer, le workflow `.github/workflows/firebase-deploy.yml` relance les tests des fonctions. Même principe que l'application App-Contremaitres.

À faire une seule fois, dans un navigateur (sur iPhone, utilise *Demander le site web pour ordinateur* si la page est trop serrée) :

1. **Compte de service** : https://console.cloud.google.com, choisis le projet `taches-foyer` (sélecteur en haut), *IAM et administration*, *Comptes de service*, *Créer un compte de service*. Nom : `github-deploy`. À l'étape des rôles, ajoute : **Éditeur** (`roles/editor`), **Administrateur Firebase** (`roles/firebase.admin`) et **Utilisateur du compte de service** (`roles/iam.serviceAccountUser`).
2. **Clé** : ouvre ce compte de service, onglet *Clés*, *Ajouter une clé*, *Créer une clé*, format **JSON**. Un fichier est téléchargé.
3. **Secret GitHub** : dans le dépôt, *Settings*, *Secrets and variables*, *Actions*, *New repository secret*. Nom : `FIREBASE_SERVICE_ACCOUNT`. Valeur : tout le contenu du fichier JSON, de `{` à `}`. Sur iPhone, ouvre le fichier dans l'app *Fichiers*, sélectionne tout le texte et copie-le. Ne partage jamais cette clé (ni message, ni code, ni capture d'écran).
4. **Lancer** : onglet *Actions*, *Déploiement Firebase (notifications)*, *Run workflow*. Un déploiement réussi s'affiche en vert (compte 5 à 10 minutes la première fois).

Si le journal signale un droit manquant ou un service non activé, ajoute le rôle ou active le service indiqué dans le message, puis relance. Si Google refuse la création de clé (règle d'organisation), utilise Cloud Shell à la place. En cas de fuite, supprime la clé dans l'onglet *Clés* du compte de service et recrées-en une.

Sans le secret, un changement poussé sur `main` ne déploie rien (simple avertissement) ; un lancement manuel échoue avec un message clair.

## Version claude.ai

La même page est publiée sur claude.ai : https://claude.ai/artifact/XyDceVrGTqUB2qQG4faGsM. Elle utilise la base intégrée à claude.ai (indépendante de Firebase). Pour la partager, inviter chaque membre par e-mail avec le niveau **Éditeur**, sans lien public.

## Remarques

- Indépendante de toute application de budget : données propres.
- Aucune clé secrète ni donnée personnelle dans ce dépôt.
