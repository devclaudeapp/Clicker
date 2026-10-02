/**
 * Villes de départ connues : coordonnées et gares principales.
 * Les aéroports (principaux et à ~2 h) sont déduits du jeu OurAirports par lib/places.ts.
 * Une ville absente d'ici reste utilisable : on la cherche alors parmi les communes des aéroports.
 */
export interface City {
  label: string;
  en: string;
  country: string;
  lat: number;
  lon: number;
  stations: string[];
  aliases?: string[];
}

export const CITIES: City[] = [
  // France
  { label: "Paris", en: "Paris", country: "FR", lat: 48.857, lon: 2.352, stations: ["Paris Gare de Lyon", "Paris Montparnasse", "Paris Nord", "Paris Est", "Paris Saint-Lazare", "Paris Austerlitz"] },
  { label: "Lyon", en: "Lyon", country: "FR", lat: 45.764, lon: 4.836, stations: ["Lyon Part-Dieu", "Lyon Perrache", "Lyon Saint-Exupéry TGV"] },
  { label: "Marseille", en: "Marseille", country: "FR", lat: 43.296, lon: 5.37, stations: ["Marseille Saint-Charles"] },
  { label: "Toulouse", en: "Toulouse", country: "FR", lat: 43.604, lon: 1.444, stations: ["Toulouse Matabiau"] },
  { label: "Nice", en: "Nice", country: "FR", lat: 43.71, lon: 7.262, stations: ["Nice Ville"] },
  { label: "Nantes", en: "Nantes", country: "FR", lat: 47.218, lon: -1.553, stations: ["Nantes"] },
  { label: "Montpellier", en: "Montpellier", country: "FR", lat: 43.611, lon: 3.877, stations: ["Montpellier Saint-Roch", "Montpellier Sud de France"] },
  { label: "Strasbourg", en: "Strasbourg", country: "FR", lat: 48.573, lon: 7.752, stations: ["Strasbourg"] },
  { label: "Bordeaux", en: "Bordeaux", country: "FR", lat: 44.838, lon: -0.579, stations: ["Bordeaux Saint-Jean"] },
  { label: "Lille", en: "Lille", country: "FR", lat: 50.629, lon: 3.057, stations: ["Lille Europe", "Lille Flandres"] },
  { label: "Rennes", en: "Rennes", country: "FR", lat: 48.117, lon: -1.678, stations: ["Rennes"] },
  { label: "Reims", en: "Reims", country: "FR", lat: 49.258, lon: 4.032, stations: ["Reims", "Champagne-Ardenne TGV"] },
  { label: "Saint-Étienne", en: "Saint-Etienne", country: "FR", lat: 45.44, lon: 4.387, stations: ["Saint-Étienne Châteaucreux"], aliases: ["Saint Etienne", "St-Étienne", "St Etienne"] },
  { label: "Toulon", en: "Toulon", country: "FR", lat: 43.124, lon: 5.928, stations: ["Toulon"] },
  { label: "Grenoble", en: "Grenoble", country: "FR", lat: 45.188, lon: 5.724, stations: ["Grenoble"] },
  { label: "Dijon", en: "Dijon", country: "FR", lat: 47.322, lon: 5.041, stations: ["Dijon Ville"] },
  { label: "Angers", en: "Angers", country: "FR", lat: 47.478, lon: -0.563, stations: ["Angers Saint-Laud"] },
  { label: "Nîmes", en: "Nimes", country: "FR", lat: 43.837, lon: 4.36, stations: ["Nîmes Centre", "Nîmes Pont du Gard"] },
  { label: "Clermont-Ferrand", en: "Clermont-Ferrand", country: "FR", lat: 45.777, lon: 3.087, stations: ["Clermont-Ferrand"], aliases: ["Clermont"] },
  { label: "Aix-en-Provence", en: "Aix-en-Provence", country: "FR", lat: 43.53, lon: 5.447, stations: ["Aix-en-Provence TGV"], aliases: ["Aix"] },
  { label: "Brest", en: "Brest", country: "FR", lat: 48.39, lon: -4.486, stations: ["Brest"] },
  { label: "Tours", en: "Tours", country: "FR", lat: 47.394, lon: 0.685, stations: ["Tours", "Saint-Pierre-des-Corps"] },
  { label: "Limoges", en: "Limoges", country: "FR", lat: 45.834, lon: 1.262, stations: ["Limoges Bénédictins"] },
  { label: "Amiens", en: "Amiens", country: "FR", lat: 49.894, lon: 2.296, stations: ["Amiens"] },
  { label: "Annecy", en: "Annecy", country: "FR", lat: 45.899, lon: 6.129, stations: ["Annecy"] },
  { label: "Perpignan", en: "Perpignan", country: "FR", lat: 42.699, lon: 2.895, stations: ["Perpignan"] },
  { label: "Metz", en: "Metz", country: "FR", lat: 49.12, lon: 6.177, stations: ["Metz Ville", "Lorraine TGV"] },
  { label: "Besançon", en: "Besancon", country: "FR", lat: 47.238, lon: 6.024, stations: ["Besançon Viotte", "Besançon Franche-Comté TGV"] },
  { label: "Orléans", en: "Orleans", country: "FR", lat: 47.902, lon: 1.909, stations: ["Orléans"] },
  { label: "Rouen", en: "Rouen", country: "FR", lat: 49.443, lon: 1.099, stations: ["Rouen Rive Droite"] },
  { label: "Mulhouse", en: "Mulhouse", country: "FR", lat: 47.75, lon: 7.335, stations: ["Mulhouse Ville"] },
  { label: "Caen", en: "Caen", country: "FR", lat: 49.182, lon: -0.371, stations: ["Caen"] },
  { label: "Nancy", en: "Nancy", country: "FR", lat: 48.692, lon: 6.184, stations: ["Nancy Ville"] },
  { label: "Avignon", en: "Avignon", country: "FR", lat: 43.949, lon: 4.806, stations: ["Avignon Centre", "Avignon TGV"] },
  { label: "Chambéry", en: "Chambery", country: "FR", lat: 45.564, lon: 5.918, stations: ["Chambéry-Challes-les-Eaux"], aliases: ["Chambery"] },
  { label: "Valence", en: "Valence", country: "FR", lat: 44.933, lon: 4.892, stations: ["Valence Ville", "Valence TGV"] },
  { label: "Pau", en: "Pau", country: "FR", lat: 43.296, lon: -0.37, stations: ["Pau"] },
  { label: "Bayonne", en: "Bayonne", country: "FR", lat: 43.493, lon: -1.475, stations: ["Bayonne"] },
  { label: "Biarritz", en: "Biarritz", country: "FR", lat: 43.483, lon: -1.558, stations: ["Biarritz"] },
  { label: "La Rochelle", en: "La Rochelle", country: "FR", lat: 46.16, lon: -1.152, stations: ["La Rochelle"] },
  { label: "Poitiers", en: "Poitiers", country: "FR", lat: 46.58, lon: 0.34, stations: ["Poitiers"] },
  { label: "Le Mans", en: "Le Mans", country: "FR", lat: 48.008, lon: 0.2, stations: ["Le Mans"] },
  { label: "Le Havre", en: "Le Havre", country: "FR", lat: 49.494, lon: 0.108, stations: ["Le Havre"] },
  { label: "Lorient", en: "Lorient", country: "FR", lat: 47.748, lon: -3.366, stations: ["Lorient"] },
  { label: "Ajaccio", en: "Ajaccio", country: "FR", lat: 41.919, lon: 8.739, stations: ["Ajaccio"] },
  { label: "Bastia", en: "Bastia", country: "FR", lat: 42.697, lon: 9.45, stations: ["Bastia"] },
  // Suisse
  { label: "Genève", en: "Geneva", country: "CH", lat: 46.204, lon: 6.143, stations: ["Genève Cornavin", "Genève Aéroport"], aliases: ["Geneve", "Geneva"] },
  { label: "Lausanne", en: "Lausanne", country: "CH", lat: 46.52, lon: 6.633, stations: ["Lausanne"] },
  { label: "Berne", en: "Bern", country: "CH", lat: 46.948, lon: 7.447, stations: ["Bern"], aliases: ["Bern"] },
  { label: "Zurich", en: "Zurich", country: "CH", lat: 47.377, lon: 8.541, stations: ["Zürich HB"], aliases: ["Zürich"] },
  { label: "Bâle", en: "Basel", country: "CH", lat: 47.559, lon: 7.588, stations: ["Basel SBB"], aliases: ["Basel", "Bale"] },
  { label: "Lugano", en: "Lugano", country: "CH", lat: 46.005, lon: 8.952, stations: ["Lugano"] },
  { label: "Sion", en: "Sion", country: "CH", lat: 46.233, lon: 7.36, stations: ["Sion"] },
  { label: "Fribourg", en: "Fribourg", country: "CH", lat: 46.806, lon: 7.161, stations: ["Fribourg"] },
  { label: "Neuchâtel", en: "Neuchatel", country: "CH", lat: 46.99, lon: 6.931, stations: ["Neuchâtel"], aliases: ["Neuchatel"] },
  // Belgique, Luxembourg
  { label: "Bruxelles", en: "Brussels", country: "BE", lat: 50.847, lon: 4.352, stations: ["Bruxelles-Midi", "Bruxelles-Central"], aliases: ["Brussels", "Brussel"] },
  { label: "Liège", en: "Liege", country: "BE", lat: 50.633, lon: 5.567, stations: ["Liège-Guillemins"], aliases: ["Liege"] },
  { label: "Namur", en: "Namur", country: "BE", lat: 50.467, lon: 4.867, stations: ["Namur"] },
  { label: "Charleroi", en: "Charleroi", country: "BE", lat: 50.411, lon: 4.444, stations: ["Charleroi-Central"] },
  { label: "Anvers", en: "Antwerp", country: "BE", lat: 51.22, lon: 4.402, stations: ["Antwerpen-Centraal"], aliases: ["Antwerpen", "Antwerp"] },
  { label: "Gand", en: "Ghent", country: "BE", lat: 51.054, lon: 3.725, stations: ["Gent-Sint-Pieters"], aliases: ["Gent", "Ghent"] },
  { label: "Luxembourg", en: "Luxembourg", country: "LU", lat: 49.612, lon: 6.13, stations: ["Luxembourg"] },
  // Voisins frontaliers
  { label: "Turin", en: "Turin", country: "IT", lat: 45.07, lon: 7.687, stations: ["Torino Porta Susa", "Torino Porta Nuova"], aliases: ["Torino"] },
  { label: "Milan", en: "Milan", country: "IT", lat: 45.464, lon: 9.19, stations: ["Milano Centrale", "Milano Porta Garibaldi"], aliases: ["Milano"] },
  { label: "Fribourg-en-Brisgau", en: "Freiburg", country: "DE", lat: 47.999, lon: 7.842, stations: ["Freiburg Hbf"], aliases: ["Freiburg", "Fribourg en Brisgau"] },
  { label: "Stuttgart", en: "Stuttgart", country: "DE", lat: 48.776, lon: 9.183, stations: ["Stuttgart Hbf"] },
  { label: "Sarrebruck", en: "Saarbrucken", country: "DE", lat: 49.24, lon: 6.997, stations: ["Saarbrücken Hbf"], aliases: ["Saarbrücken", "Saarbrucken"] },
  { label: "Barcelone", en: "Barcelona", country: "ES", lat: 41.387, lon: 2.17, stations: ["Barcelona Sants"], aliases: ["Barcelona"] },
];
