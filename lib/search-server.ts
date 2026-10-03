import type { DateWindow, SearchParams, TripOption } from "@/types";
import { DESTINATIONS } from "./data/destinations";
import { buildWindows, nextMonths } from "./dates";
import { DEFAULT_DEPARTURES, resolveDeparture } from "./places";
import { computeTrips, originsFor } from "./pricing";
import { getProvider } from "./providers";
import type { SharedInput } from "./share";

/** Plafond d'aéroports d'origine par recherche : borne les appels aux fournisseurs de prix. */
export const MAX_ORIGINS = 24;

export interface SearchResult {
  trips: TripOption[];
  windows: DateWindow[];
  provider: string | null;
}

export interface SearchOptions {
  /** Identifiants de destinations à chiffrer seules (aperçu d'une fiche partagée) : évite d'interroger les 45 destinations. */
  only?: string[];
}

/** Exécute une recherche complète côté serveur : fenêtres de dates, tarifs du fournisseur actif, chiffrage des escapades. */
export async function searchTrips(params: SearchParams, opts: SearchOptions = {}): Promise<SearchResult> {
  const windows = buildWindows(params);
  if (!params.departures.length || !windows.length) return { trips: [], windows, provider: null };
  const provider = getProvider();
  const origins = [...originsFor(params).keys()].slice(0, MAX_ORIGINS);
  const destinations = opts.only ? DESTINATIONS.filter((d) => opts.only!.includes(d.id)) : DESTINATIONS;
  const fares = await provider.fares({ origins, destinations, windows, directOnly: params.directOnly });
  return { trips: computeTrips(params, windows, destinations, fares), windows, provider: provider.name };
}

/** Reconstruit des paramètres de recherche complets depuis une URL partagée, avec les mêmes défauts que l'app. */
export function paramsFromShared(shared: SharedInput): SearchParams {
  const labels = shared.departures?.length ? shared.departures : DEFAULT_DEPARTURES;
  const departures = labels.map(resolveDeparture).filter((d) => d !== null);
  return {
    departures,
    includeNearby: shared.includeNearby ?? true,
    excludedNearby: shared.excludedNearby ?? [],
    dateMode: shared.dateMode ?? "flex",
    month: shared.month ?? nextMonths(1)[0].value,
    duration: shared.duration ?? "weekend",
    dateOut: shared.dateOut ?? "",
    dateIn: shared.dateIn ?? "",
    travelers: shared.travelers ?? 2,
    budget: shared.budget ?? 400,
    modes: shared.modes ?? { plane: true, train: true, bus: true, car: true },
    directOnly: shared.directOnly ?? false,
    vibes: shared.vibes ?? [],
  };
}
