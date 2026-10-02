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
| `npm run build:icons` | régénère les icônes PNG de `public/icons/` depuis `app/icon.svg` |

La CI GitHub Actions (`.github/workflows/ci.yml`) rejoue lint, types, tests et build à chaque push.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · polices auto-hébergées (Unbounded, Manrope via Fontsource). Aucune base de données pour l'instant : les réglages et favoris vivent dans le `localStorage`, derrière une interface `lib/storage` prévue pour basculer sur Supabase.

## Structure

```
app/            pages et routes API (App Router)
  api/          routes serveur : recherche de prix, résolution des villes de départ
components/     composants React (ui/, search/, results/, settings/)
lib/            logique métier pure : moteur de prix, liens, géo, paysages, fournisseurs
  data/         jeux de données embarqués (aéroports, destinations, contours de carte)
  providers/    fournisseurs de prix : mock (défaut) et Travelpayouts
types/          types TypeScript partagés
scripts/        outils de génération de données
docs/           guides (création des comptes API, etc.)
```

## Données et sources de prix

- **Vols** : Travelpayouts / Aviasales Data API (gratuit, prix en cache actualisés toutes les 48 h). Amadeus Self-Service a fermé le 17 juillet 2026 et n'est plus une option. Par défaut l'app tourne en mode `mock` avec des prix fictifs cohérents.
- **Train, bus, covoiturage, hébergement** : pas d'API gratuite ; l'app construit des liens pré-remplis (SNCF Connect, BlaBlaCar, FlixBus, Booking, Airbnb, Google Flights, Skyscanner, Kayak, Rome2Rio) et affiche des estimations.
- **Aéroports** : OurAirports (domaine public), filtrés sur l'Europe, le Maghreb et le Proche-Orient.
- **Carte** : contours Natural Earth 110m (domaine public) dessinés en SVG, sans tuiles externes.

Les clés API ne sont jamais commitées : elles vont dans `.env.local` (voir `.env.example` et `docs/APIS.md`, qui explique pas à pas comment créer le compte Travelpayouts et passer aux prix réels).

## Partager et installer

Le bouton **Partager** copie un lien qui rejoue la recherche telle quelle (villes, dates, voyageurs, budget, envies, vue, fiche ouverte) ; l'adresse du navigateur suit d'ailleurs chaque changement. L'app a un manifeste PWA : sur téléphone, « Ajouter à l'écran d'accueil » l'ouvre en plein écran.

## Villes de départ

Tape n'importe quelle ville (« Paris », « Marseille », « Annecy ») dans *Villes de départ* : l'app retrouve ses aéroports principaux, les aéroports à moins de 2 h (cochables un par un, avec distance et temps d'accès estimé) et ses grandes gares. Le prix de chaque escapade retient le point de départ le moins cher, et la fiche indique lequel (« via Bâle · 2 h »).
