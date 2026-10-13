# Mon Foyer

Application familiale : tâches, calendrier partagé, idées avec dictée vocale, points, défis, bonus et roulette des récompenses.

Une seule page HTML autonome (`index.html`), sans installation.

## Lien de l'application

**https://adteixeira89.github.io/taches-foyer/** (GitHub Pages, comme les autres applications).

Activation : Settings, Pages, Deploy from a branch, branche `main`, dossier `/ (root)`.

## Avoir les mêmes données pour toute la famille (lien GitHub)

Les données sont rangées dans une base Firebase (Firestore), comme pour app-sante. À faire une seule fois :

1. Sur https://console.firebase.google.com, créer un projet (par exemple `mon-foyer`).
2. **Build > Authentication > Get started**, puis activer le fournisseur **Anonyme**.
3. **Build > Firestore Database > Create database** (région `europe-west`), puis onglet **Règles** : coller le contenu de `firestore.rules` et publier.
4. **Paramètres du projet > Vos applications > Web (</>)** : enregistrer une application et copier l'objet `firebaseConfig`.
5. Dans `index.html`, remplacer `const FIREBASE_CONFIG = null;` par cet objet (ces valeurs sont publiques, la protection vient des règles).
6. Dans **Authentication > Settings > Authorized domains**, vérifier que `adteixeira89.github.io` est présent (sinon l'ajouter).

Ensuite, sur le premier téléphone : ouvrir le lien, **Créer un foyer**. Un code de 12 caractères s'affiche (Paramètres, « Gérer le foyer »). Sur les autres téléphones : ouvrir le même lien et entrer ce code. Tout le monde voit alors les mêmes données, en direct.

Le code du foyer sert de clé : ne le donner qu'à la famille. Les tâches saisies en mode local sur le téléphone qui crée le foyer y sont recopiées.

Tant que `FIREBASE_CONFIG` vaut `null`, le lien GitHub fonctionne en mode local : les données restent sur chaque appareil.

## Version claude.ai

La même page est publiée sur claude.ai : https://claude.ai/artifact/XyDceVrGTqUB2qQG4faGsM. Elle utilise la base intégrée à claude.ai (indépendante de Firebase). Pour la partager, inviter chaque membre par e-mail avec le niveau **Éditeur**, sans lien public.

## Remarques

- Indépendante de toute application de budget : données propres.
- Aucune clé secrète ni donnée personnelle dans ce dépôt.
