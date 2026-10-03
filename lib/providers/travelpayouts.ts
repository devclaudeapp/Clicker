import type { DateWindow, Fare } from "@/types";
import { createSharedCache, type SharedCache } from "../cache";
import { minutesLabel } from "../format";
import type { FareQuery, PriceProvider } from "./types";

/**
 * Travelpayouts / Aviasales Data API (gratuite, prix en cache actualisés toutes les 48 h).
 * Endpoint utilisé : GET https://api.travelpayouts.com/aviasales/v3/prices_for_dates
 * Une requête par (aéroport d'origine, destination, mois) en dates flexibles, par (origine, destination, dates) en dates fixes.
 * Les réponses sont gardées 24 h en mémoire (10 min pour un échec), les appels identiques en vol sont dédoublonnés, et le
 * débit est bridé sous la limite de 600 requêtes par minute de l'API. Avec un cache partagé (lib/cache.ts), les réponses
 * sont aussi lues et écrites dans Redis : toutes les instances du serveur en profitent pendant 24 h.
 */
const ENDPOINT = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
/** Préfixe des clés dans le cache partagé ; à changer si la forme des entrées évolue. */
const SHARED_PREFIX = "tp:v1:";
const TTL_MS = 24 * 3600 * 1000;
/** Un appel en erreur (429, panne) n'est pas retenté avant ce délai : la recherche suivante ne relance pas la rafale. */
const NEG_TTL_MS = 10 * 60 * 1000;
const CONCURRENCY = 4;
/** Au plus un appel toutes les 110 ms, soit ~540 par minute. */
const MIN_INTERVAL_MS = 110;
/** Attente avant l'unique relance d'un 429 sans en-tête Retry-After, et plafond quand il y en a un. */
const RETRY_MS = 2000;
const RETRY_MAX_MS = 60_000;

/** Codes IATA des compagnies les plus fréquentes au départ de France et de Suisse. */
const AIRLINES: Record<string, string> = {
  U2: "easyJet", EC: "easyJet Europe", DS: "easyJet Switzerland", FR: "Ryanair", RK: "Ryanair UK", VY: "Vueling", TO: "Transavia", HV: "Transavia",
  AF: "Air France", KL: "KLM", BA: "British Airways", W6: "Wizz Air", W4: "Wizz Air Malta", EI: "Aer Lingus", SK: "SAS", DY: "Norwegian", D8: "Norwegian",
  OS: "Austrian", LH: "Lufthansa", LX: "Swiss", EW: "Eurowings", IB: "Iberia", I2: "Iberia Express", TP: "TAP", AZ: "ITA Airways", V7: "Volotea",
  AT: "Royal Air Maroc", "3O": "Air Arabia Maroc", PC: "Pegasus", TK: "Turkish Airlines", A3: "Aegean", OK: "Czech Airlines", LO: "LOT", SN: "Brussels Airlines",
  EN: "Air Dolomiti", BT: "airBaltic", FI: "Icelandair", LS: "Jet2", UX: "Air Europa", HC: "Air Senegal",
};

interface TpItem {
  origin: string;
  destination: string;
  price: number;
  airline: string;
  departure_at: string;
  return_at?: string;
  transfers: number;
  return_transfers?: number;
  duration_to?: number;
  duration?: number;
  link?: string;
}

interface Task {
  origin: string;
  destId: string;
  destination: string;
  params: Record<string, string>;
  key: string;
}

export interface TravelpayoutsOptions {
  token?: string;
  marker?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Attente (tests : une fonction qui ne dort pas). */
  sleep?: (ms: number) => Promise<void>;
  /** Cache partagé ; absent : celui de la configuration, null : aucun. */
  shared?: SharedCache | null;
}

const cache = new Map<string, { at: number; ttl: number; data: TpItem[] }>();
const inflight = new Map<string, Promise<TpItem[]>>();

const isDirect = (it: TpItem) => (it.transfers ?? 0) === 0 && (it.return_transfers ?? 0) === 0;
const stopsOf = (it: TpItem) => Math.max(it.transfers ?? 0, it.return_transfers ?? 0);

/** Délai demandé par l'API après un 429, borné ; à défaut, une attente fixe. */
function retryAfterMs(res: Response): number {
  const s = Number(res.headers.get("retry-after"));
  return Number.isFinite(s) && s > 0 ? Math.min(s * 1000, RETRY_MAX_MS) : RETRY_MS;
}

/**
 * Ne garde, par couple de dates (aller, retour), que le tarif le moins cher et le direct le moins cher :
 * c'est tout ce dont le moteur a besoin, et le cache reste léger (quelques dizaines d'entrées par mois au lieu de mille).
 */
function compact(items: TpItem[]): TpItem[] {
  const best = new Map<string, TpItem>();
  for (const it of items) {
    if (!it.return_at || typeof it.price !== "number") continue;
    const pair = `${it.departure_at.slice(0, 10)}|${it.return_at.slice(0, 10)}`;
    for (const k of isDirect(it) ? [pair, `${pair}|d`] : [pair]) {
      const prev = best.get(k);
      if (!prev || it.price < prev.price) best.set(k, it);
    }
  }
  return [...new Set(best.values())];
}

/** Exécute les tâches avec quelques travailleurs en parallèle ; le débit lui-même est tenu par `slot`. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function createTravelpayoutsProvider(opts: TravelpayoutsOptions = {}): PriceProvider {
  const token = opts.token ?? process.env.TRAVELPAYOUTS_TOKEN;
  const marker = opts.marker ?? process.env.TRAVELPAYOUTS_MARKER;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const shared = opts.shared === undefined ? createSharedCache() : opts.shared;
  let sharedWarned = false;
  /** Le cache partagé ne doit jamais faire échouer une recherche : une panne est signalée une fois, puis ignorée. */
  const sharedFailed = (e: unknown) => {
    if (sharedWarned) return;
    sharedWarned = true;
    console.warn("[travelpayouts] cache partagé indisponible :", (e as Error).message);
  };
  const isFresh = (key: string) => {
    const hit = cache.get(key);
    return !!hit && now() - hit.at < hit.ttl;
  };

  /** Avant les appels : les clés inconnues en mémoire sont lues en une fois dans le cache partagé. */
  async function warm(tasks: Task[]): Promise<void> {
    if (!shared) return;
    const missing = tasks.filter((t) => !isFresh(t.key));
    if (!missing.length) return;
    try {
      const values = await shared.mget(missing.map((t) => SHARED_PREFIX + t.key));
      values.forEach((v, i) => {
        if (v == null) return;
        try {
          cache.set(missing[i].key, { at: now(), ttl: TTL_MS, data: JSON.parse(v) as TpItem[] });
        } catch {
          // Entrée illisible : elle sera simplement rechargée.
        }
      });
    } catch (e) {
      sharedFailed(e);
    }
  }

  /** Après les appels : les réponses fraîches (jamais les échecs) sont écrites en une fois dans le cache partagé. */
  async function store(fresh: { key: string; data: TpItem[] }[]): Promise<void> {
    if (!shared || !fresh.length) return;
    try {
      await shared.set(fresh.map((f) => ({ key: SHARED_PREFIX + f.key, value: JSON.stringify(f.data), ttlSeconds: TTL_MS / 1000 })));
    } catch (e) {
      sharedFailed(e);
    }
  }

  /** Réserve le prochain créneau d'appel : les appels sont espacés d'au moins MIN_INTERVAL_MS, quel que soit le parallélisme. */
  let nextSlot = 0;
  const slot = async () => {
    const t = now();
    const at = Math.max(t, nextSlot);
    nextSlot = at + MIN_INTERVAL_MS;
    if (at > t) await sleep(at - t);
  };

  /** Lien de réservation Aviasales renvoyé par l'API, en euros et avec le marker partenaire. */
  const aviasalesLink = (path: string): string => {
    const u = new URL(path, "https://www.aviasales.com");
    u.searchParams.set("currency", "eur");
    if (marker) u.searchParams.set("marker", marker);
    return u.toString();
  };

  /** Un appel bridé en débit ; sur 429, une seule relance après le délai demandé par l'API. */
  async function request(task: Task): Promise<TpItem[]> {
    const url = `${ENDPOINT}?${new URLSearchParams({ ...task.params, currency: "eur", sorting: "price", one_way: "false", direct: "false", limit: "1000", token: token! })}`;
    const call = async () => {
      await slot();
      return fetchImpl(url, { cache: "no-store", headers: { Accept: "application/json" } });
    };
    let res = await call();
    if (res.status === 429) {
      await sleep(retryAfterMs(res));
      res = await call();
    }
    if (!res.ok) throw new Error(`Travelpayouts ${res.status} pour ${task.origin}→${task.destination}`);
    const body = (await res.json()) as { success?: boolean; data?: TpItem[] };
    return Array.isArray(body.data) ? body.data : [];
  }

  async function load(task: Task, fresh: { key: string; data: TpItem[] }[]): Promise<TpItem[]> {
    const hit = cache.get(task.key);
    if (hit && now() - hit.at < hit.ttl) return hit.data;
    if (hit) cache.delete(task.key);
    const pending = inflight.get(task.key);
    if (pending) return pending;
    const p = (async () => {
      try {
        const data = compact(await request(task));
        cache.set(task.key, { at: now(), ttl: TTL_MS, data });
        fresh.push({ key: task.key, data });
        return data;
      } catch (e) {
        cache.set(task.key, { at: now(), ttl: NEG_TTL_MS, data: [] });
        throw e;
      }
    })();
    inflight.set(task.key, p);
    try {
      return await p;
    } finally {
      inflight.delete(task.key);
    }
  }

  return {
    name: "travelpayouts",
    async fares(q: FareQuery): Promise<Fare[]> {
      if (!token) throw new Error("TRAVELPAYOUTS_TOKEN manquant : ajoute-le dans .env.local (voir docs/APIS.md).");
      if (!q.windows.length || !q.origins.length) return [];

      // Dates fixes : une fenêtre unique, interrogée avec ses dates exactes. Dates flexibles : un appel par mois de départ.
      const fixed = q.windows.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(q.windows[0].key);
      const months = fixed ? [] : [...new Set(q.windows.map((w) => w.out.slice(0, 7)))];
      const tasks: Task[] = [];
      for (const origin of q.origins) {
        for (const dest of q.destinations) {
          if (fixed) {
            const w = q.windows[0];
            tasks.push({ origin, destId: dest.id, destination: dest.iata, params: { origin, destination: dest.iata, departure_at: w.out, return_at: w.ret }, key: `${origin}|${dest.iata}|${w.out}|${w.ret}` });
          } else {
            for (const month of months) tasks.push({ origin, destId: dest.id, destination: dest.iata, params: { origin, destination: dest.iata, departure_at: month }, key: `${origin}|${dest.iata}|${month}` });
          }
        }
      }

      const byWindow = new Map<string, DateWindow>();
      for (const w of q.windows) byWindow.set(`${w.out}|${w.ret}`, w);
      const best = new Map<string, Fare>();
      await warm(tasks);
      const fresh: { key: string; data: TpItem[] }[] = [];
      const results = await pool(tasks, CONCURRENCY, async (t) => {
        try {
          return { t, items: await load(t, fresh) };
        } catch (e) {
          console.warn("[travelpayouts]", (e as Error).message);
          return { t, items: [] as TpItem[] };
        }
      });
      await store(fresh);
      for (const { t, items } of results) {
        for (const it of items) {
          if (!it.return_at || typeof it.price !== "number") continue;
          const w = byWindow.get(`${it.departure_at.slice(0, 10)}|${it.return_at.slice(0, 10)}`);
          if (!w) continue;
          const direct = isDirect(it);
          if (q.directOnly && !direct) continue;
          const key = `${t.origin}|${t.destId}|${w.key}`;
          const prev = best.get(key);
          if (prev && prev.price <= it.price) continue;
          const minutes = it.duration_to ?? (it.duration ? Math.round(it.duration / 2) : undefined);
          best.set(key, {
            origin: t.origin,
            destId: t.destId,
            windowKey: w.key,
            price: Math.round(it.price),
            airline: AIRLINES[it.airline] ?? it.airline,
            duration: minutes ? minutesLabel(minutes) : "durée inconnue",
            direct,
            stops: stopsOf(it),
            link: it.link ? aviasalesLink(it.link) : undefined,
          });
        }
      }
      return [...best.values()];
    },
  };
}

/** Vide le cache (tests). */
export function clearTravelpayoutsCache(): void {
  cache.clear();
  inflight.clear();
}
