import type { Airport, DeparturePoint, NearbyAirport } from "@/types";
import airportsJson from "./data/airports.json";
import { CITIES, type City } from "./data/cities";
import { accessMinutes, haversineKm } from "./geo";
import { slugify } from "./format";

export const AIRPORTS = airportsJson as Airport[];
export const AIRPORT_BY_IATA: ReadonlyMap<string, Airport> = new Map(AIRPORTS.map((a) => [a.iata, a]));

/** Un aéroport à moins de MAIN_KM du centre est « principal » ; jusqu'à NEARBY_KM il est « voisin » (~2 h). */
const MAIN_KM = 35;
const NEARBY_KM = 180;

export interface CitySuggestion {
  label: string;
  country: string;
  /** Vrai quand la ville vient du jeu d'aéroports plutôt que de la liste éditoriale. */
  fromAirport?: boolean;
}

const norm = (s: string) => slugify(s);

function findCity(query: string): City | undefined {
  const q = norm(query);
  if (!q) return undefined;
  const exact = CITIES.find((c) => norm(c.label) === q || norm(c.en) === q || c.aliases?.some((a) => norm(a) === q));
  if (exact) return exact;
  return CITIES.find((c) => norm(c.label).startsWith(q) || c.aliases?.some((a) => norm(a).startsWith(q)));
}

/** Suggestions d'autocomplétion : villes éditoriales d'abord, puis communes des aéroports. */
export function suggestCities(query: string, limit = 8): CitySuggestion[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const seen = new Set<string>();
  const out: CitySuggestion[] = [];
  const push = (label: string, country: string, fromAirport?: boolean) => {
    const key = norm(label);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, country, fromAirport });
  };
  for (const c of CITIES) {
    if (norm(c.label).startsWith(q) || c.aliases?.some((a) => norm(a).startsWith(q))) push(c.label, c.country);
  }
  for (const c of CITIES) {
    if (out.length >= limit) break;
    if (norm(c.label).includes(q) && !seen.has(norm(c.label))) push(c.label, c.country);
  }
  for (const a of AIRPORTS) {
    if (out.length >= limit) break;
    if (norm(a.city).startsWith(q)) push(a.city, a.country, true);
  }
  return out.slice(0, limit);
}

/** Construit un point de départ depuis une ville connue, en déduisant ses aéroports du jeu OurAirports. */
export function departureFromCity(city: City): DeparturePoint {
  const main: string[] = [];
  const nearby: NearbyAirport[] = [];
  for (const a of AIRPORTS) {
    const km = haversineKm(city, a);
    if (km > NEARBY_KM) continue;
    // Principal : il dessert la ville elle-même, ou c'est un grand aéroport tout proche (Orly pour Paris).
    const sameCity = norm(a.city) === norm(city.label) || norm(a.city) === norm(city.en);
    if (sameCity || (km <= MAIN_KM && a.size === "L")) main.push(a.iata);
    else nearby.push({ iata: a.iata, name: a.name, city: a.city, km: Math.round(km), minutes: accessMinutes(km) });
  }
  // Les gros aéroports d'abord parmi les principaux, puis les plus proches parmi les voisins.
  main.sort((x, y) => (AIRPORT_BY_IATA.get(y)?.size === "L" ? 1 : 0) - (AIRPORT_BY_IATA.get(x)?.size === "L" ? 1 : 0));
  nearby.sort((x, y) => x.km - y.km);
  return { id: slugify(city.label), label: city.label, en: city.en, lat: city.lat, lon: city.lon, airports: main, stations: city.stations, nearby };
}

/**
 * Résout une saisie libre (« Paris », « geneve », « Bâle ») en point de départ.
 * Ville inconnue de la liste éditoriale : on se rabat sur la commune d'un aéroport.
 */
export function resolveDeparture(query: string): DeparturePoint | null {
  const city = findCity(query);
  if (city) return departureFromCity(city);
  const q = norm(query);
  if (q.length < 2) return null;
  const a = AIRPORTS.find((x) => norm(x.city) === q) ?? AIRPORTS.find((x) => norm(x.city).startsWith(q));
  if (!a) return null;
  return departureFromCity({ label: a.city, en: a.city, country: a.country, lat: a.lat, lon: a.lon, stations: [] });
}

/** Points de départ proposés au premier lancement. */
export const DEFAULT_DEPARTURES = ["Lyon", "Genève"];
