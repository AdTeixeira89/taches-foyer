# Family Play

Application familiale : tâches, calendrier partagé, points, défis, bonus et roulette des récompenses.

Une seule page HTML autonome (`index.html`), sans installation. Le logo (`logo.svg`, icônes PNG et `manifest.json`) sert d'icône d'onglet et d'écran d'accueil du téléphone.

## Lien de l'application

**https://adteixeira89.github.io/taches-foyer/** (GitHub Pages, comme les autres applications).

Activation : Settings, Pages, Deploy from a branch, branche `main`, dossier `/ (root)`.

## Ajouter des membres

Au départ, la famille compte trois profils aux noms de démonstration (Parent 1, Parent 2, Enfant) : chacun les remplace par les vrais prénoms dans les Réglages. Pour en ajouter (grands-parents, cousins, autre enfant…) : **Famille > + Ajouter un membre**, ou **Paramètres > Autres membres**, ou dans « Qui utilise cet appareil ? ». Chaque membre a son prénom, son avatar et sa couleur, et joue comme les autres : colonne de tâches, points, classement, jokers et un tour de roulette par semaine. Jusqu'à 8 membres au total. Décocher « Afficher ce membre » le masque sans rien effacer (ses points et son historique restent).

**Un code personnel par membre (version familiale)** : quand on crée un foyer, le créateur devient l'organisateur (profil 1) et chaque profil reçoit un code personnel de 6 caractères, visible dans Réglages > Codes personnels (l'organisateur seul voit tous les codes ; chaque membre ne voit que le sien). Sur un nouveau téléphone, on entre le code du foyer puis son code personnel : l'appareil reste relié à ce profil et il est impossible de passer sur celui d'un autre (le profil affiché est « Mon profil »). L'organisateur peut renouveler un code (l'ancien cesse de fonctionner et l'appareil concerné le redemande). Un foyer créé avant cette fonction peut l'activer dans Réglages > « Activer les codes personnels » ; tant que ce n'est pas fait, chacun choisit son profil comme avant. Ce verrouillage est un confort dans l'application : la base ne distingue pas les membres, ce n'est pas une sécurité forte, il faut donc garder le code du foyer privé.

**Plusieurs participants** : une tâche peut être confiée à plusieurs personnes (cases « Responsable(s) »). À la fin, l'app demande qui a participé ; chaque participant reçoit les points complets, une seule fois par tâche. Le défi de la famille compte la tâche une seule fois.

**Tâches en retard** : quand la date limite d'une tâche est passée, l'accueil affiche « À confirmer » avec un bouton « Fait ? » : on indique qui l'a faite (points attribués) ou on repousse la date. En mode Firebase avec notifications, chaque matin à 9 h (heure de Paris), le responsable (ou toute la famille si la tâche est « à prendre ») reçoit une alerte qui ouvre directement cette question, une seule fois par date limite.

**Tâche terminée = les autres sont prévenus** (mode Firebase avec notifications) : quand quelqu'un valide une tâche, tous les autres reçoivent « Tâche terminée ! X a terminé « … » · +N pts. Bravo ! » (sur Android, avec une vibration spéciale). Si l'application est ouverte, elle joue aussi un son « ta-ding » dédié (un carillon discret pour les autres messages). Quand l'application est fermée, le son est celui de notification du téléphone : le navigateur ne permet pas d'imposer un son personnalisé à une notification.

**Liste de courses** (menu « Plus » > Courses) : liste partagée en direct. On ajoute plusieurs articles d'un coup (séparés par des virgules, ou une liste collée ligne par ligne) ; ils sont classés par rayon (deviné d'après le nom, modifiable en touchant l'article). On coche ce qui est pris, « Vider le panier » archive sans rien effacer et propose ensuite les articles habituels (« Souvent »). « Copier la liste » et « Partager » envoient la liste en texte. « Mon drive » (Leclerc, Intermarché ou une adresse personnalisée avec `{produit}`) ajoute à chaque article un bouton qui ouvre la recherche sur le site du drive ; l'app ne remplit pas le panier du drive à ta place (les enseignes ne le permettent pas depuis une autre app) et les adresses de recherche sont indicatives, à vérifier. Le réglage du drive est propre à chaque appareil. Après la mise à jour, republier les règles Firestore (`firebase deploy --only firestore`) pour autoriser la collection `courses`.

**Repas de la semaine** (menu « Plus » > Repas) : une grille du lundi au dimanche avec un repas pour le midi et un pour le soir. Les boutons « Midi et soir / Midi / Soir » choisissent ce qui s'affiche (réglage d'appareil). Chaque case s'ouvre pour saisir le plat, avec des idées (les plats déjà utilisés d'abord) et des ingrédients facultatifs ; le bouton panier ajoute ces ingrédients à la liste de courses sans doublon. Le repas du jour apparaît sur l'accueil (« Au menu aujourd'hui »). Collection `repas` (id = `date_midi` ou `date_soir`), déjà autorisée dans `firestore.rules` avec la liste de courses.

**Sons rigolos** : un petit son pour chaque étape (tâche créée, commencée, terminée, grande réussite, joker gagné ou envoyé, accord, lot de la roulette avec cliquetis, champion de la semaine). Ils sont activés par défaut ; Réglages > « Sons rigolos » les coupe sur l'appareil, et « Écouter un exemple » les fait entendre. Les sons sont synthétisés dans le navigateur, sans fichier audio.

**Actualiser** : sur téléphone, tire la page vers le bas depuis le haut de l'écran (ou Paramètres > Actualiser l'app) pour charger la dernière version.

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

Un téléphone est prévenu quand : une tâche est ajoutée par quelqu'un d'autre (tout le monde sauf l'auteur ; la personne à qui elle est confiée reçoit un message qui lui est destiné, et un seul), une tâche lui est confiée par la suite, un échange de joker ou une demande d'aide le concerne (et la réponse), un événement du calendrier est créé pour lui ou pour toute la famille, ou la semaine a un champion. **La veille d'un événement du calendrier**, à 18 h (heure de Paris, à changer dans `functions/notify.js` si besoin), la personne concernée est prévenue, ou toute la famille si l'événement est pour tous. **Rappel d'une tâche** : en créant ou modifiant une tâche, on peut choisir un jour et une heure (champ « Rappel ») ; une notification part à ce moment-là au responsable, ou à toute la famille si la tâche est « à prendre ». Les rappels sont envoyés par une fonction planifiée (Cloud Scheduler, une vérification par minute, quelques centimes au plus par mois). Celui qui agit n'est jamais notifié de sa propre action. Elles suivent le profil choisi sur l'appareil. Elles n'existent que sur le lien GitHub (mode Firebase), pas sur la page claude.ai.

À faire une seule fois :

1. **Forfait Blaze** : console Firebase, roue dentée, *Utilisation et facturation*, *Modifier le forfait*, Blaze (carte bancaire demandée par Google). L'usage d'une famille reste dans les quotas gratuits. Ajoute une alerte de budget (par exemple 1 €).
2. **Clé Web Push** : faite. La clé publique du projet est déjà dans `index.html` (`FCM_VAPID_KEY`). Pour la changer : *Paramètres du projet*, onglet *Cloud Messaging*, section *Configuration Web*, *Générer une paire de clés*.
3. **Déployer les fonctions** depuis Google Cloud Shell (https://shell.cloud.google.com, avec le compte Google du projet) :
   ```
   git clone https://github.com/AdTeixeira89/taches-foyer.git && cd taches-foyer
   npm --prefix functions install
   npx firebase-tools login --no-localhost
   npx firebase-tools deploy --only functions,firestore --project taches-foyer
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
