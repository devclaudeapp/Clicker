import type { DateWindow, Destination, Fare, SearchParams, SortKey, TransportCandidate, TripOption, VibeId } from "@/types";
import { AIRPORT_BY_IATA } from "./places";

/** Coefficient saisonnier par mois calendaire (janvier → décembre), appliqué aux vols et, atténué, aux nuits. */
export const SEASON = [0.88, 0.95, 0.94, 1.05, 1.05, 1.12, 1.3, 1.3, 1.05, 0.98, 1.0, 1.28];

export const seasonMultiplier = (monthIndex: number, nights: number): number =>
  SEASON[monthIndex] * (nights >= 7 ? 1.08 : 1);

export interface OriginInfo {
  depId: string;
  nearby: boolean;
  minutes?: number;
  label: string;
  city: string;
}

/** Aéroports d'origine utilisables, avec la ville de départ dont ils dépendent. Les principaux priment sur les voisins. */
export function originsFor(p: Pick<SearchParams, "departures" | "includeNearby" | "excludedNearby">): Map<string, OriginInfo> {
  const m = new Map<string, OriginInfo>();
  const excluded = new Set(p.excludedNearby);
  for (const dep of p.departures) {
    for (const code of dep.airports) {
      const a = AIRPORT_BY_IATA.get(code);
      m.set(code, { depId: dep.id, nearby: false, label: a?.name ?? code, city: a?.city ?? dep.label });
    }
  }
  if (p.includeNearby) {
    for (const dep of p.departures) {
      for (const n of dep.nearby) {
        if (excluded.has(n.iata) || m.has(n.iata)) continue;
        m.set(n.iata, { depId: dep.id, nearby: true, minutes: n.minutes, label: n.name, city: n.city });
      }
    }
  }
  return m;
}

export const fareKey = (origin: string, destId: string, windowKey: string): string => `${origin}|${destId}|${windowKey}`;

function quote(p: SearchParams, dest: Destination, w: DateWindow, origins: Map<string, OriginInfo>, fares: Map<string, Fare>): TripOption | null {
  const cands: TransportCandidate[] = [];
  if (p.modes.plane) {
    for (const [origin, info] of origins) {
      const f = fares.get(fareKey(origin, dest.id, w.key));
      if (!f) continue;
      if (p.directOnly && !f.direct) continue;
      cands.push({
        mode: "plane", price: f.price, duration: f.duration, depId: info.depId, originLabel: info.label, origin, originCity: info.city,
        airline: f.airline, direct: f.direct, viaNearby: info.nearby, nearbyMinutes: info.minutes, enabled: true, link: f.link,
      });
    }
  }
  const gm = SEASON[w.monthIndex];
  for (const dep of p.departures) {
    const g = dest.ground?.[dep.id];
    if (!g) continue;
    if (g.train) cands.push({ mode: "train", enabled: p.modes.train, price: Math.round(g.train.min * gm), max: g.train.max && Math.round(g.train.max * gm), duration: g.train.duration, depId: dep.id, originLabel: dep.label });
    if (g.bus) cands.push({ mode: "bus", enabled: p.modes.bus, price: Math.round(g.bus.min * gm), max: g.bus.max && Math.round(g.bus.max * gm), duration: g.bus.duration, depId: dep.id, originLabel: dep.label });
    if (g.car) cands.push({ mode: "car", enabled: p.modes.car, price: g.car.min, duration: g.car.duration, depId: dep.id, originLabel: dep.label });
  }
  const usable = cands.filter((c) => c.enabled).sort((a, b) => a.price - b.price);
  if (!usable.length) return null;
  const best = usable[0];
  const rooms = Math.ceil(p.travelers / 2);
  const nightly = Math.round(dest.stay * Math.sqrt(gm));
  const stayTotal = nightly * w.nights * rooms;
  const transportTotal = best.price * p.travelers;
  const total = transportTotal + stayTotal;
  return {
    destination: dest, window: w, best, candidates: cands, nightly, rooms, stayTotal, transportTotal, total,
    perPerson: Math.round(total / p.travelers), temp: dest.temps[w.monthIndex], alternatives: [],
  };
}

/**
 * Chiffre chaque destination sur chaque fenêtre de dates et retient, par destination, la fenêtre la moins chère.
 * Les tarifs viennent d'un fournisseur (mock ou réel) ; le budget et les envies sont appliqués ensuite, côté affichage.
 */
export function computeTrips(p: SearchParams, windows: DateWindow[], destinations: Destination[], fareList: Fare[]): TripOption[] {
  const origins = originsFor(p);
  const fares = new Map(fareList.map((f) => [fareKey(f.origin, f.destId, f.windowKey), f]));
  const out: TripOption[] = [];
  for (const dest of destinations) {
    let best: TripOption | null = null;
    const alternatives: TripOption["alternatives"] = [];
    for (const w of windows) {
      const q = quote(p, dest, w, origins, fares);
      if (!q) continue;
      alternatives.push({ window: w, perPerson: q.perPerson });
      if (!best || q.perPerson < best.perPerson) best = q;
    }
    if (best) {
      best.alternatives = alternatives;
      out.push(best);
    }
  }
  return out;
}

export const SORTERS: Record<SortKey, (a: TripOption, b: TripOption) => number> = {
  total: (a, b) => a.perPerson - b.perPerson,
  transport: (a, b) => a.best.price - b.best.price,
  temp: (a, b) => b.temp - a.temp || a.perPerson - b.perPerson,
  name: (a, b) => a.destination.city.localeCompare(b.destination.city, "fr"),
};

export const sortTrips = (trips: TripOption[], key: SortKey): TripOption[] => trips.slice().sort(SORTERS[key]);

/** Toutes les envies cochées doivent être présentes. */
export const matchesVibes = (trip: TripOption, vibes: VibeId[]): boolean => vibes.every((v) => trip.destination.vibes.includes(v));

/** Point de départ réel du meilleur transport : l'aéroport utilisé (voisin compris) ou la ville pour le terrestre. */
export function originOf(trip: TripOption, departures: Pick<SearchParams, "departures">["departures"]): { lat: number; lon: number; label: string; ground: boolean } {
  const b = trip.best;
  if (b.mode === "plane" && b.origin) {
    const a = AIRPORT_BY_IATA.get(b.origin);
    if (a) return { lat: a.lat, lon: a.lon, label: `${a.city} (${a.iata})`, ground: false };
  }
  const dep = departures.find((d) => d.id === b.depId) ?? departures[0];
  return { lat: dep.lat, lon: dep.lon, label: dep.label, ground: true };
}
