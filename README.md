# Au Croissant d'Or

Un jeu clicker sur le thème d'une boulangerie parisienne. Cliquez sur le croissant pour le cuire, embauchez des apprentis, achetez des fours et des moulins, et faites grandir la maison jusqu'aux Halles et à l'export.

## Jouer

Ouvrez `index.html` dans un navigateur. Il n'y a rien à installer : le jeu tient en trois fichiers (`index.html`, `style.css`, `game.js`), sans dépendance ni étape de build.

Pour le publier en ligne, activez GitHub Pages sur la branche du dépôt : la page d'accueil est `index.html`.

## Règles

- **Clic** : chaque clic sur le croissant en cuit un (ou plus, selon vos améliorations).
- **Production** : neuf bâtiments produisent des croissants chaque seconde, de l'apprenti au comptoir export. Le prix d'un bâtiment augmente de 15 % à chaque achat. On peut en acheter par 1, 10 ou 100.
- **Améliorations** : elles se débloquent au fil de la partie. Elles doublent le rendement d'un bâtiment, renforcent les clics ou augmentent toute la production de 10 %.
- **Croissant doré** : de temps en temps, un croissant doré apparaît dans la vitrine pendant 13 secondes. L'attraper déclenche l'un de ces effets :
  - *Fournée dorée* : production × 7 pendant 77 secondes ;
  - *Coup de feu* : clics × 77 pendant 13 secondes ;
  - *Pourboire d'un habitué* : un gain immédiat de croissants.
- **Succès** : 19 succès à obtenir. Chacun augmente toute la production de 1 %.
- **Registre** : statistiques de la partie, nom de la boutique modifiable, sauvegarde et remise à zéro.

Les grands nombres suivent l'échelle longue française : million, milliard, billion, billiard, trillion…

## Sauvegarde

La partie est enregistrée dans le `localStorage` du navigateur toutes les 10 secondes et à la fermeture de la page. Pendant votre absence, le four continue à mi-régime, pendant 3 heures au maximum.
