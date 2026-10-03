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

const strings = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);
const inRange = (v: unknown, min: number, max: number): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined);

/**
 * Rend un objet de réglages complet à partir d'une valeur stockée, quelle que soit sa forme :
 * champ manquant ou mal typé → valeur par défaut. Rend null si rien d'exploitable n'est stocké.
 */
export function normalizePrefs(stored: unknown, defaults: Prefs): Prefs | null {
  if (!stored || typeof stored !== "object") return null;
  const s = stored as Record<string, unknown>;
  const saved = Array.isArray(s.saved) ? (s.saved.filter((d) => d && typeof d === "object" && typeof (d as DeparturePoint).id === "string") as DeparturePoint[]) : [];
  if (!saved.length) return null;
  const ids = new Set(saved.map((d) => d.id));
  const activeIds = (strings(s.activeIds) ?? defaults.activeIds).filter((id) => ids.has(id));
  return {
    saved,
    activeIds: activeIds.length ? activeIds : saved.map((d) => d.id),
    includeNearby: typeof s.includeNearby === "boolean" ? s.includeNearby : defaults.includeNearby,
    excludedNearby: strings(s.excludedNearby) ?? defaults.excludedNearby,
    favs: strings(s.favs) ?? defaults.favs,
    travelers: inRange(s.travelers, 1, 8) ?? defaults.travelers,
    budget: inRange(s.budget, 100, 1000) ?? defaults.budget,
  };
}

/**
 * Store externe minimal au-dessus de lib/storage, consommé via useSyncExternalStore :
 * le rendu serveur ne connaît pas les réglages (snapshot null), le client les lit une fois puis
 * reçoit chaque mise à jour. Le même objet est renvoyé tant que rien n'a changé.
 */
const KEY = "prefs";
const listeners = new Set<() => void>();
let current: unknown = undefined;

export function getPrefsSnapshot(): unknown {
  if (current === undefined) current = localStore.get<unknown>(KEY, null);
  return current;
}

export const getServerPrefsSnapshot = (): unknown => null;

export function subscribePrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function updatePrefs(update: (p: Prefs) => Prefs, fallback: Prefs): void {
  current = update(normalizePrefs(getPrefsSnapshot(), fallback) ?? fallback);
  localStore.set(KEY, current);
  listeners.forEach((l) => l());
}
