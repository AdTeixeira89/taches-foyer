# Family Play : consignes pour Claude Code

Application familiale (tâches, calendrier, points, défis, bonus, roulette) pour un couple et leur fille.
Un seul fichier autonome : `index.html` (HTML, CSS et JavaScript, sans build ni dépendance), plus le logo (`logo.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) et `manifest.json`.
La section « Idées » (avec dictée vocale) a été retirée de l'interface à la demande de la famille : la collection `ideas` reste dans les données et n'est jamais effacée.

## Règles à respecter

- Application **totalement indépendante** de toute application de budget : données et interface propres.
- **Ne supprimer aucune donnée ni fonction existante.** Les nouveaux champs doivent être facultatifs (les anciennes données restent valides).
- Ne pas changer les règles de jeu sans accord explicite : points par difficulté (1, 2, 3, 5), points attribués une seule fois par tâche, aucun point jamais retiré, classement bienveillant, jokers (un de chaque par semaine, échange avec accord), roulette (5 segments égaux, un ticket tous les 10 points, un tour par semaine et par personne).
- Ne pas simuler une sauvegarde ou une synchronisation. Ne jamais mettre de fausses récompenses dans les données réelles.
- Interface en français, sobre et lisible sur téléphone, tablette et ordinateur. Animations et sons désactivables.
- Échapper tout texte affiché (`esc()`), car les données sont partagées entre plusieurs personnes.

## Données

- Mode **partagé** : la page publiée sur claude.ai utilise `window.claude.use('db')` (collections `tasks`, `ideas` (conservée, plus affichée), `events`, `points`, `weeks`, `pacts`, `jokers`, `spins`, `missions` et le document `settings/family`).
- Mode **Firebase** (GitHub Pages, https://adteixeira89.github.io/taches-foyer/) : quand `FIREBASE_CONFIG` est renseigné, mêmes collections sous `foyers/<code famille>/` dans Firestore (connexion anonyme, code de 12 caractères gardé dans `localStorage` sous `famille.firebase.code`). Règles dans `firestore.rules`.
- Mode **local** (`FIREBASE_CONFIG` à `null`, fichier ouvert directement) : repli sur `localStorage`, clés `famille.local.*`. Les données ne sont alors pas partagées.
- Les bases claude.ai et Firebase sont distinctes. Après toute modification du code, pousser sur `main` (GitHub Pages) et republier la page claude.ai.

## Vérifier avant de livrer

- Le script s'exécute sans erreur (vérifier la syntaxe, ouvrir la page).
- Créer, modifier, terminer, masquer une tâche ; points attribués une seule fois ; roulette un seul tour par semaine ; anciennes données toujours lisibles.
- Contrôler l'affichage sur petit écran et en mode sombre.
