import type { NextRequest } from "next/server";
import type { SearchParams, TransportMode } from "@/types";
import { DESTINATIONS } from "@/lib/data/destinations";
import { buildWindows } from "@/lib/dates";
import { computeTrips, originsFor } from "@/lib/pricing";
import { getProvider } from "@/lib/providers";

const MODES: TransportMode[] = ["plane", "train", "bus", "car"];

/** Valide le corps reçu et le ramène à des bornes sûres. Rend null si la forme est inattendue. */
function sanitize(body: unknown): SearchParams | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.departures)) return null;
  const modes = (b.modes ?? {}) as Record<string, unknown>;
  return {
    departures: b.departures.filter((d) => d && typeof d === "object" && typeof (d as { id?: unknown }).id === "string") as SearchParams["departures"],
    includeNearby: b.includeNearby !== false,
    excludedNearby: Array.isArray(b.excludedNearby) ? b.excludedNearby.filter((x): x is string => typeof x === "string") : [],
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

  const provider = getProvider();
  const origins = [...originsFor(params).keys()];
  try {
    const fares = await provider.fares({ origins, destinations: DESTINATIONS, windows, directOnly: params.directOnly });
    const trips = computeTrips(params, windows, DESTINATIONS, fares);
    return Response.json({ trips, windows, provider: provider.name });
  } catch (e) {
    console.error("[api/search]", e);
    return Response.json({ error: "Le fournisseur de prix n'a pas répondu." }, { status: 502 });
  }
}
