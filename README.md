# Zeste

Application web mobile pour organiser une soirée de bout en bout, avec Limo le citron vert comme guide.

- **QG** : compte à rebours, jauges (invités, courses, budget par personne), conseils de Limo, check-list de J-7 à J+1.
- **Invités** : réponses (vient, peut-être, ne vient pas), accompagnants, « qui ramène quoi », texte d'invitation à copier.
- **Courses et stock** : liste par rayon, budget, calcul automatique des quantités, suivi du stock pendant la soirée.
- **Bar** : 16 recettes (dont 3 sans alcool) comparées à la liste de courses, quantités ajustables, carte du soir, shaker surprise.
- **Mode soirée** : 7 jeux (Je n'ai jamais, Action ou vérité, La roue, Qui de nous, La bouteille, La pioche, La bombe), trois intensités, rôle de Sam.
- **Galerie** : photos compressées dans le navigateur, visionneuse, diaporama.

## Structure

| Fichier | Rôle |
| --- | --- |
| `app.html` | Styles et squelette de la page (c'est ce fichier qui est publié comme artifact Claude) |
| `js/data.js` | Contenus : ambiances, cocktails, jeux, estimation des courses |
| `js/store.js` | Stockage : base partagée de l'artifact, sinon localStorage et IndexedDB |
| `js/core.js` | Icônes, mascotte, verres dessinés, feuilles, confettis |
| `js/screens.js` | Accueil, assistant de création, les cinq onglets |
| `js/night.js` | Mode soirée et jeux |
| `js/main.js` | Interactions et démarrage |
| `build.mjs` | Génère `index.html`, la version autonome |

Aucune dépendance, aucun bundler.

## Lancer en local

```bash
node build.mjs
```

```bash
npx serve .
```

Ouvert hors de Claude (en local ou sur GitHub Pages), Zeste fonctionne en mode solo : les données restent sur l'appareil.

L'abus d'alcool est dangereux pour la santé. Le mode Soft et le rôle de Sam sont là pour ça.
