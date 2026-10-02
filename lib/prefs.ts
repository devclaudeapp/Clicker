import type { DeparturePoint } from "@/types";
import { localStore } from "./storage";

/** Réglages conservés d'une visite à l'autre. */
export interface Prefs {
  saved: DeparturePoint[];
  activeIds: string[];
  includeNearby: boolean;
  excludedNearby: string[];
  favs: string[];
  travelers: number;
  budget: number;
}

export const defaultPrefs = (departures: DeparturePoint[]): Prefs => ({
  saved: departures,
  activeIds: departures.map((d) => d.id),
  includeNearby: true,
  excludedNearby: [],
  favs: [],
  travelers: 2,
  budget: 400,
});

/**
 * Store externe minimal au-dessus de lib/storage, consommé via useSyncExternalStore :
 * le rendu serveur ne connaît pas les réglages (snapshot null), le client les lit une fois puis
 * reçoit chaque mise à jour. Le même objet est renvoyé tant que rien n'a changé.
 */
const KEY = "prefs";
const listeners = new Set<() => void>();
let current: Prefs | null | undefined;

function isPrefs(v: unknown): v is Prefs {
  return !!v && typeof v === "object" && Array.isArray((v as Prefs).saved) && (v as Prefs).saved.length > 0;
}

export function getPrefsSnapshot(): Prefs | null {
  if (current === undefined) {
    const stored = localStore.get<unknown>(KEY, null);
    current = isPrefs(stored) ? stored : null;
  }
  return current;
}

export const getServerPrefsSnapshot = (): Prefs | null => null;

export function subscribePrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function updatePrefs(update: (p: Prefs) => Prefs, fallback: Prefs): void {
  current = update(getPrefsSnapshot() ?? fallback);
  localStore.set(KEY, current);
  listeners.forEach((l) => l());
}
