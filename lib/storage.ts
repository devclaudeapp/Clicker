/**
 * Persistance côté client derrière une interface minimale, pour pouvoir passer du localStorage
 * à Supabase sans toucher aux composants. Les lectures et écritures ne lèvent jamais.
 */
export interface KeyValueStore {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

const PREFIX = "escapade.";

export const localStore: KeyValueStore = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = globalThis.localStorage?.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Stockage indisponible (navigation privée, quota) : on continue sans persister.
    }
  },
  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(PREFIX + key);
    } catch {
      // idem
    }
  },
};
