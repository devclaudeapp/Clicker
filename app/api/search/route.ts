import type { NextRequest } from "next/server";
import type { AirportPoint, DeparturePoint, NearbyAirport, SearchParams, TransportMode } from "@/types";
import { DESTINATIONS } from "@/lib/data/destinations";
import { buildWindows } from "@/lib/dates";
import { computeTrips, originsFor } from "@/lib/pricing";
import { getProvider } from "@/lib/providers";

const MODES: TransportMode[] = ["plane", "train", "bus", "car"];
const MAX_DEPARTURES = 6;
const MAX_ORIGINS = 24;
const isIata = (v: unknown): v is string => typeof v === "string" && /^[A-Z]{3}$/.test(v);
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Reconstruit une ville de départ depuis le JSON reçu, en ne gardant que des champs de forme et de taille attendues. */
function sanitizeDeparture(d: unknown): DeparturePoint | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const id = text(o.id, 40);
  const label = text(o.label, 40);
  if (!id || !label) return null;
  const nearby: NearbyAirport[] = (Array.isArray(o.nearby) ? o.nearby : [])
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object" && isIata((n as Record<string, unknown>).iata))
    .slice(0, 12)
    .map((n) => ({ iata: n.iata as string, name: text(n.name, 60) ?? (n.iata as string), city: text(n.city, 40) ?? "", km: num(n.km), minutes: num(n.minutes) }));
  const points: Record<string, AirportPoint> = {};
  if (o.points && typeof o.points === "object") {
    for (const [code, p] of Object.entries(o.points as Record<string, unknown>).slice(0, 20)) {
      if (!isIata(code) || !p || typeof p !== "object") continue;
      const q = p as Record<string, unknown>;
      const name = text(q.name, 60);
      if (!name || typeof q.lat !== "number" || typeof q.lon !== "number") continue;
      points[code] = { name, city: text(q.city, 40) ?? name, lat: num(q.lat), lon: num(q.lon) };
    }
  }
  return {
    id,
    label,
    en: text(o.en, 40) ?? label,
    lat: num(o.lat),
    lon: num(o.lon),
    airports: (Array.isArray(o.airports) ? o.airports : []).filter(isIata).slice(0, 4),
    stations: (Array.isArray(o.stations) ? o.stations : []).filter((s): s is string => typeof s === "string").slice(0, 8),
    nearby,
    points,
  };
}

/** Valide le corps reçu et le ramène à des bornes sûres. Rend null si la forme est inattendue. */
function sanitize(body: unknown): SearchParams | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.departures)) return null;
  const modes = (b.modes ?? {}) as Record<string, unknown>;
  return {
    departures: b.departures.map(sanitizeDeparture).filter((d): d is DeparturePoint => d !== null).slice(0, MAX_DEPARTURES),
    includeNearby: b.includeNearby !== false,
    excludedNearby: Array.isArray(b.excludedNearby) ? b.excludedNearby.filter(isIata) : [],
    dateMode: b.dateMode === "fixed" ? "fixed" : "flex",
    month: typeof b.month === "string" && /^\d{4}-\d{2}$/.test(b.month) ? b.month : "",
    duration: b.duration === "long" || b.duration === "week" ? b.duration : "weekend",
    dateOut: typeof b.dateOut === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dateOut) ? b.dateOut : "",
    dateIn: typeof b.dateIn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dateIn) ? b.dateIn : "",
    travelers: Math.min(8, Math.max(1, Math.round(Number(b.travelers) || 2))),
    budget: Math.max(0, Number(b.budget) || 0),
    modes: Object.fromEntries(MODES.map((m) => [m, modes[m] !== false])) as Record<TransportMode, boolean>,
    directOnly: b.directOnly === true,
    vibes: [],
  };
}

/** POST /api/search : paramètres de recherche → escapades chiffrées. Les clés des fournisseurs restent ici, côté serveur. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON attendu." }, { status: 400 });
  }
  const params = sanitize(body);
  if (!params) return Response.json({ error: "Paramètres de recherche invalides." }, { status: 400 });
  if (params.dateMode === "flex" && !params.month) return Response.json({ error: "Mois manquant." }, { status: 400 });

  const windows = buildWindows(params);
  if (!params.departures.length || !windows.length) return Response.json({ trips: [], windows, provider: null });

  try {
    const provider = getProvider();
    // Les principaux passent avant les voisins dans originsFor ; le plafond borne les appels aux fournisseurs.
    const origins = [...originsFor(params).keys()].slice(0, MAX_ORIGINS);
    const fares = await provider.fares({ origins, destinations: DESTINATIONS, windows, directOnly: params.directOnly });
    const trips = computeTrips(params, windows, DESTINATIONS, fares);
    return Response.json({ trips, windows, provider: provider.name });
  } catch (e) {
    console.error("[api/search]", e);
    return Response.json({ error: "Le fournisseur de prix n'a pas répondu." }, { status: 502 });
  }
}
