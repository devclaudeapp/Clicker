# Escapade

Organisateur de voyage rapide : où partir ce week-end ou cette semaine depuis tes villes, au meilleur prix. L'app compare vols, train, bus et covoiturage, ajoute l'hébergement, et classe les destinations par prix total par personne. Dates flexibles (« un week-end en novembre ») ou fixes, filtres par envie, vue grille, swipe ou carte.

Prototype validé : https://claude.ai/artifact/EQL6e5SAVT62om7QfemP9F

## Lancer

```bash
npm install
cp .env.example .env.local   # mode mock par défaut, aucune clé nécessaire
npm run dev                  # http://localhost:3000
```

Scripts :

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build de production et démarrage |
| `npm run lint` | ESLint |
| `npm run typecheck` | génération des types Next puis `tsc --noEmit` |
| `npm test` | tests unitaires (vitest, fichiers `lib/**/*.test.ts`) |
| `npm run e2e [-- http://localhost:3000]` | scénario de fumée dans Chromium contre un serveur qui tourne : bureau, mobile, lien partagé, captures dans `e2e/out/` (une fois : `npx playwright install chromium`) |
| `npm run build:airports -- chemin/airports.csv` | régénère `lib/data/airports.json` depuis le CSV OurAirports |
| `npm run build:flixbus` | régénère `lib/data/flixbus.ts` (identifiants de villes FlixBus) depuis l'autocomplétion publique du site |
| `npm run build:photos` | régénère `lib/data/photos.ts` (photo et crédit de chaque destination) depuis Wikidata et Wikimedia Commons ; `--candidats` liste les images possibles sans écrire |
| `npm run build:icons` | régénère les icônes PNG de `public/icons/` depuis `app/icon.svg` |

La CI GitHub Actions (`.github/workflows/ci.yml`) rejoue lint, types, tests et build à chaque push.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · polices auto-hébergées (Unbounded, Manrope via Fontsource). Aucune base de données pour l'instant : les réglages et favoris vivent dans le `localStorage`, derrière une interface `lib/storage` prévue pour basculer sur Supabase.

## Structure

```
app/            pages et routes API (App Router)
  api/          routes serveur : recherche de prix, résolution des villes de départ, programme d'activités, aperçu Open Graph
components/     composants React (ui/, search/, results/, settings/)
lib/            logique métier pure : moteur de prix, liens, géo, paysages, fournisseurs
  data/         jeux de données embarqués (aéroports, destinations, activités, contours de carte)
  providers/    fournisseurs de prix : mock (défaut) et Travelpayouts
types/          types TypeScript partagés
scripts/        outils de génération de données
docs/           guides (création des comptes API, etc.)
```

## Données et sources de prix

- **Vols** : Travelpayouts / Aviasales Data API (gratuit, prix en cache actualisés toutes les 48 h). Amadeus Self-Service a fermé le 17 juillet 2026 et n'est plus une option. Par défaut l'app tourne en mode `mock` avec des prix fictifs cohérents.
- **Train, bus, covoiturage, hébergement** : pas d'API gratuite ; l'app construit des liens pré-remplis (SNCF Connect, Trainline, BlaBlaCar, FlixBus, Booking, Airbnb, Google Flights, Skyscanner, Kayak, Rome2Rio) et affiche des estimations. Les formats sont dans `lib/links.ts`, vérifiés dans un vrai navigateur (villes, dates et voyageurs pré-remplis) ; limites connues : SNCF Connect et Trainline ne lisent pas le nombre de voyageurs dans l'URL. FlixBus veut l'identifiant de chaque ville : `lib/data/flixbus.ts` les embarque pour les villes de départ et les destinations connues (`npm run build:flixbus` les régénère).
- **Aéroports** : OurAirports (domaine public), filtrés sur l'Europe, le Maghreb et le Proche-Orient.
- **Carte** : contours Natural Earth 110m (domaine public) dessinés en SVG, sans tuiles externes.
- **Photos** : une image libre par destination, servie par Wikimedia Commons (voir plus bas), avec le paysage SVG généré en repli.

Les clés API ne sont jamais commitées : elles vont dans `.env.local` (voir `.env.example` et `docs/APIS.md`, qui explique pas à pas comment créer le compte Travelpayouts et passer aux prix réels). Les réponses du fournisseur sont gardées 24 h en mémoire et, si un Redis Upstash est configuré (intégration Vercel), partagées entre toutes les instances.

## Partager et installer

Le bouton **Partager** copie un lien qui rejoue la recherche telle quelle (villes, dates, voyageurs, budget, envies, vue, fiche ouverte) ; l'adresse du navigateur suit d'ailleurs chaque changement. L'app a un manifeste PWA : sur téléphone, « Ajouter à l'écran d'accueil » l'ouvre en plein écran.

## Programme d'activités

Chaque fiche se termine par **Ton programme** : un planning jour par jour (soir d'arrivée, journées pleines, matin du retour) composé à partir d'un catalogue éditorial de 7 à 10 activités par destination (`lib/data/activities/`). Il s'adapte à ce que tu indiques dans *Qui part ?* (solo, couple, potes, famille ; enfants, ados, 18–30, 30–50, 50+), aux envies cochées, au nombre de voyageurs et à la période du séjour. Les activités hors saison (marché de Noël en juillet, clubs d'Ibiza en janvier, bateaux d'été) et celles trop fraîches pour les dates (plage ou paddle sous 17 °C de moyenne) sont écartées et listées en bas du programme avec le moment où elles redeviennent possibles ; ce qui ne se fait qu'à cette période (marchés de Noël, Oktoberfest, carnavals, aurores, fêtes d'été) remonte en tête. Les enfants excluent les soirées en boîte, un couple voit remonter les adresses romantiques, etc.

Chaque activité ouvre Google Maps, propose un lien de réservation quand un billet est habituel (GetYourGuide), et affiche une durée et un prix indicatif qui s'ajoute au budget du séjour (« Séjour complet, programme d'activités compris »). **Remélanger** tire une autre composition, **Copier le programme** le met en texte pour le groupe. Le moteur (`lib/planner.ts`) remplit les créneaux au mieux ; sur une semaine, il détaille jusqu'à cinq journées et laisse les autres libres plutôt que de répéter. Le profil voyage dans le lien de partage (`g=family&a=kids,adults`).

## Photos des destinations

Chaque carte, chaque fiche et chaque bulle de la carte montre une photo de la destination par-dessus son paysage SVG, qui reste visible pendant le chargement et prend le relais si l'image ne charge pas (l'aperçu Open Graph, lui, garde le SVG). Les photos sont des miniatures Wikimedia Commons chargées directement depuis Wikimedia, sans clé ni compte : `lib/data/photos.ts` tient, par destination, l'adresse, les largeurs disponibles (Wikimedia ne fabrique plus de miniature à la demande : le script les fait générer par l'API en 500, 960 et 1 280 px, puis vérifie chacune), l'auteur, la licence (CC BY, CC BY-SA ou CC0) et la page du fichier. Le crédit s'affiche dans la fiche (lien vers la page Commons) et dans l'infobulle des cartes. `npm run build:photos` régénère le fichier à partir de l'image représentative de chaque ville sur Wikidata ; les villes dont cette image ne convient pas (vue satellite, montage) ont un fichier choisi à la main dans `OVERRIDES`, en tête du script.

## Villes de départ

Tape n'importe quelle ville (« Paris », « Marseille », « Annecy ») dans *Villes de départ* : l'app retrouve ses aéroports principaux, les aéroports à moins de 2 h (cochables un par un, avec distance et temps d'accès estimé) et ses grandes gares. Le prix de chaque escapade retient le point de départ le moins cher, et la fiche indique lequel (« via Bâle · 2 h »).
