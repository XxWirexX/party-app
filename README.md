# Zeste

Application web pour organiser une soirée à plusieurs, sur téléphone comme sur ordinateur, avec Limo le citron vert comme guide.

## Ce qu'elle fait

- **Soirée partagée** : l'orga envoie un lien (ou un QR code). Chacun répond depuis son téléphone et voit les changements des autres en direct.
- **Rôles** :
  - *Orga* : gère tout, y compris les membres et le lien d'invitation. Il peut y en avoir plusieurs.
  - *Participe* : modifie les courses, la check-list, le bar et les comptes.
  - *Suit* : voit tout, gère sa réponse et poste ses photos.

  À la création, l'orga choisit le rôle donné aux nouveaux venus (« tout le monde participe » ou « les invités suivent »). Ce choix se change ensuite dans la fenêtre d'invitation, ou personne par personne.
- **Invités sans l'appli** : on les ajoute à la main et on gère leur réponse. S'ils rejoignent plus tard, ils se reconnaissent dans la liste (« C'est moi, Karim »), ou reçoivent un lien perso qui les reconnaît directement. Pas de doublon.
- **Courses, stock et comptes** :
  - Celui qui coche un article est noté comme payeur, ce qui reste modifiable.
  - On peut ajouter des dépenses hors liste (taxi, location).
  - L'onglet Comptes montre ce que chacun a payé, sa part (accompagnants compris, on peut exclure quelqu'un), ce qui reste à acheter par responsable, et les remboursements conseillés en un minimum de virements. « Réglé » les solde.
- **Bar** :
  - 16 recettes intégrées, plus des cocktails maison (création, ou duplication d'une recette existante).
  - « Ajouter les ingrédients manquants » met les quantités pour N verres dans la liste de courses.
  - La carte du soir peut s'imprimer.
- **Check-list** modifiable : ajouter, renommer, supprimer, cocher.
- **Mode soirée** : 7 jeux, trois intensités, rôle de Sam.
- **Galerie** : tout le monde ajoute ses photos, likes, diaporama.
- **Comptes sans mot de passe** : un cookie de session. Pour changer d'appareil : Ton compte → « Créer le lien », un lien à usage unique valable 15 minutes.

## Lancer en local

Il faut Node 20 ou plus et Postgres 14 ou plus.

```bash
docker compose up -d
```

```bash
npm install
```

```bash
npm run dev
```

L'app tourne sur http://localhost:3000. Le schéma est créé au démarrage (`server/migrations`).

`DATABASE_URL` pointe par défaut sur `postgres://zeste:zeste@127.0.0.1:5432/zeste` (voir `.env.example`).

## Tests

Ils tournent sur une vraie base, `zeste_test` par défaut. Pour en utiliser une autre, définis `TEST_DATABASE_URL`.

```bash
npm test
```

## Mise en ligne

N'importe quel hébergeur Node avec une base Postgres convient : Render, Railway, Fly.io, ou un VPS.

1. Définis `DATABASE_URL`, ajoute `?sslmode=require` si la base l'exige, et `NODE_ENV=production`.
2. Lance avec `npm start`.

L'app doit être servie en HTTPS : le cookie de session est `Secure` en production.

## Structure

| Dossier | Rôle |
| --- | --- |
| `server/index.js` | API JSON, droits par rôle, flux temps réel (SSE), fichiers statiques |
| `server/migrations/` | Schéma Postgres |
| `public/index.html` | Styles et squelette (mobile, tablette, bureau, impression) |
| `public/js/store.js` | Appels à l'API, mises à jour optimistes, écoute du flux temps réel |
| `public/js/accounts.js` | Calcul des parts et des remboursements (testé) |
| `public/js/screens.js` | Écrans et fenêtres |
| `public/js/main.js` | Actions et démarrage |
| `public/js/night.js` | Mode soirée |
| `test/` | Tests d'API et de calcul des comptes |

L'abus d'alcool est dangereux pour la santé. Le mode Soft et le rôle de Sam sont là pour ça.
