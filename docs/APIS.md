# Brancher les vrais prix

Par défaut, Escapade tourne en mode **mock** : des prix fictifs mais cohérents (saison, durée, nombre de chambres), sans aucune clé. Ce guide explique comment passer aux prix réels des vols avec **Travelpayouts / Aviasales**, la seule API de prix de vols gratuite encore ouverte à un développeur indépendant en 2026.

> Amadeus Self-Service, souvent cité dans les tutoriels, a fermé le 17 juillet 2026 : plus d'inscription, clés désactivées. Ne perds pas de temps dessus.

## 1. Ce que donne Travelpayouts, et ce qu'il ne donne pas

- **Données** : les prix les moins chers trouvés par les utilisateurs d'Aviasales dans les **48 dernières heures**, par origine, destination et dates. C'est un cache, pas une recherche en direct : parfait pour « où partir pas cher ce mois-ci », moins fiable pour un vol précis à J-2. Le prix final se confirme toujours sur le site au clic.
- **Couverture** : excellente depuis les grands aéroports (Lyon, Genève, Paris, Bâle…), parfois vide depuis les petits (Grenoble, Chambéry, Annecy). Dans ce cas la destination n'apparaît simplement pas pour cet aéroport.
- **Prix par adulte**, en euros si on le demande. L'app multiplie par le nombre de voyageurs.
- **Limites** : 600 requêtes par minute sur l'endpoint utilisé ; au-delà, HTTP 429 jusqu'à la minute suivante. L'app bride son débit à ~9 appels par seconde, relance une seule fois un 429 après le délai demandé, et garde chaque réponse 24 h en mémoire (10 min pour un appel en erreur, pour ne pas relancer une rafale). Une recherche coûte un appel par aéroport d'origine × destination × mois : ~45 pour une ville à un seul aéroport, plusieurs centaines avec « Inclure les alentours » (Lyon + Genève, soit une dizaine d'aéroports, ≈ 450 appels, environ une minute la première fois), puis 0 pendant 24 h. Le cache vit en mémoire : sur Vercel, chaque instance a le sien. L'aperçu d'un lien partagé vers une fiche n'interroge que cette destination.
- **Pas d'hôtels, pas de train** : Booking, SNCF Connect, BlaBlaCar et FlixBus n'ont pas d'API gratuite ; l'app continue d'y envoyer par liens pré-remplis.

## 2. Créer le compte (gratuit, 10 minutes)

1. Va sur https://www.travelpayouts.com et crée un compte. Aucun site web n'est exigé pour s'inscrire.
2. Dans le tableau de bord, crée un **projet** (« Mon app », type site ou application). Depuis avril 2026 les projets sont connectés automatiquement aux programmes compatibles ; le programme **Aviasales** est celui qui sert les prix de vols.
3. Récupère deux valeurs :
   - le **token de l'API** : menu du profil → *API token* (une longue chaîne hexadécimale) ;
   - le **marker** : l'identifiant de partenaire affiché dans le projet (un nombre, parfois suivi d'un suffixe). Il est ajouté aux liens Aviasales pour que les réservations te soient attribuées.

Ne partage jamais le token : il donne accès à ton compte partenaire.

## 3. Configurer l'app

1. À la racine du projet, copie le modèle si ce n'est pas déjà fait :
   ```bash
   cp .env.example .env.local
   ```
2. Ouvre `.env.local` et renseigne :
   ```
   PRICE_PROVIDER=travelpayouts
   TRAVELPAYOUTS_TOKEN=ton_token_ici
   TRAVELPAYOUTS_MARKER=ton_marker_ici
   NEXT_PUBLIC_TRAVELPAYOUTS_MARKER=ton_marker_ici
   ```
   La quatrième reprend le marker pour les liens Aviasales construits dans le navigateur (quand l'API n'en fournit pas) ; ce n'est pas un secret, il figure dans tous les liens de réservation.
3. Redémarre le serveur (`npm run dev` ou `npm run build && npm start`). Les variables d'environnement ne sont lues qu'au démarrage, et celle en `NEXT_PUBLIC_` est figée dans le build.

`.env.local` est ignoré par Git (règle `.env*` du `.gitignore`) : les clés restent sur ta machine. Sur Vercel, saisis les mêmes quatre variables dans *Settings → Environment Variables*, puis redéploie.

## 4. Vérifier que ça marche

- Dans l'en-tête de l'app, la pastille passe de **« Prix fictifs »** à **« Prix Aviasales · cache 48 h »**.
- En ligne de commande, la réponse de l'API indique le fournisseur :
  ```bash
  curl -s localhost:3000/api/places?resolve=Lyon | head -c 200   # récupère un point de départ
  # puis une recherche (voir lib/pricing.test.ts pour un corps complet) : le champ "provider" doit valoir "travelpayouts"
  ```
- Dans les logs serveur, `[travelpayouts] ...` signale un appel en erreur (token invalide → 401, quota → 429). Si le token est vide, l'app le dit une fois et repasse en mode mock plutôt que de planter.

## 5. Comprendre un résultat vide

Une destination absente depuis un petit aéroport n'est pas un bug : personne n'a cherché ce trajet sur Aviasales ces deux derniers jours, le cache est vide. Deux pistes :

- garder « Inclure les alentours » coché : les grands aéroports voisins (Genève pour Lyon, Bâle pour Genève) ont presque toujours des données ;
- préférer les dates flexibles aux dates fixes : l'app cherche alors tous les week-ends du mois.

## 6. Cache partagé entre les instances (Upstash Redis)

Le cache de 24 h vit en mémoire, donc par instance : sur Vercel, une instance recyclée ou une seconde instance repart de zéro et refait tous les appels (une recherche « Lyon + alentours » coûte ~300 appels, soit une trentaine de secondes). Un Redis partagé règle ça : la première recherche écrit ses réponses, toutes les suivantes, sur n'importe quelle instance, les lisent en quelques millisecondes pendant 24 h.

1. Dans Vercel : projet escapade → **Storage** → **Create Database** → **Upstash** → Redis (plan gratuit), puis connecte-le au projet. Les variables `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` (ou leurs anciens noms `KV_REST_API_URL` / `KV_REST_API_TOKEN`) sont ajoutées automatiquement.
2. Redéploie. Rien d'autre à configurer : `lib/cache.ts` parle à Upstash en REST, sans dépendance, et `lib/providers/travelpayouts.ts` lit toutes les clés inconnues en un seul `MGET` avant d'appeler l'API, puis écrit les réponses fraîches en un seul pipeline. Les échecs d'appel ne sont jamais partagés (ils restent locaux dix minutes).
3. Si Redis est indisponible, la recherche aboutit quand même (un avertissement `[travelpayouts] cache partagé indisponible` dans les logs) ; sans variables, tout reste comme avant.

En local, `vercel env pull .env.local` récupère ces variables si tu veux le même cache qu'en production.

## 7. Plus tard : prix frais à la demande

Pour une recherche vraiment en direct sur quelques trajets (par exemple au moment de réserver), **SerpApi** expose les résultats Google Flights avec 250 recherches gratuites par mois. La variable `SERPAPI_KEY` est prévue dans `.env.example` ; le connecteur n'est pas encore écrit. Les autres pistes (Skyscanner, Kiwi, Booking Demand API) sont réservées aux partenaires sous contrat et ne conviennent pas à un projet solo.
