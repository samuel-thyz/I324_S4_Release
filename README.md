# I324 – S4 – Une version, une release

L'application de tâches se construit en image Docker. Il reste à la livrer **par versions** : chaque version a son tag, sa page de release et son image, et on peut revenir à la précédente en une commande.

Aujourd'hui, chacun travaille dans **sa propre copie** du dépôt : vos tags et vos releases ne gênent personne. Après chaque étape, un **bot** vérifie votre dépôt et vous répond par e-mail avec la demande suivante.

Dans tout le parcours, `<pseudo>` est votre nom d'utilisateur GitHub **en minuscules**.

## Mission 1 : votre propre dépôt

1. En haut de cette page : **Use this template** › **Create a new repository**. Propriétaire : votre compte. Nom : `I324_S4_Release`. Visibilité : **Public**.
2. Dans votre copie, onglet **Actions** : si GitHub le demande, cliquez sur **I understand my workflows, go ahead and enable them**.
3. **Cloner votre copie** dans VS Code, puis `npm install`. Vous travaillez directement sur `main`.
4. **Créer le fichier** `reponses/<pseudo>.md` :
   ```
   # Réponses de <pseudo>

   q1: ghcr.io/<pseudo>/i324_s4_release
   q2:
   q3:
   ```
   La ligne `q1` est le nom de votre image : remplacez `<pseudo>` par votre pseudo.
5. **Commit** `docs: ajoute ma fiche de réponses` et **push**.

Le bot vous répond quelques secondes plus tard, par e-mail.

## Règles du jeu

- Les messages de commit suivent la convention (`feat:`, `fix:`, `docs:`…) : le bot s'en sert.
- Ne modifiez pas `bot.yml` ni le dossier `.github/bot/`.
- Un tag déjà poussé ne se déplace pas et ne se supprime pas : on publie une nouvelle version.
- Pas de réponse du bot après une minute ? Regardez l'onglet **Actions** de votre copie, puis demandez à l'enseignant.

---

Application d'origine : [docker/getting-started-app](https://github.com/docker/getting-started-app), licence MIT.
