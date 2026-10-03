import type { DateWindow, Fare } from "@/types";
import { minutesLabel } from "../format";
import type { FareQuery, PriceProvider } from "./types";

/**
 * Travelpayouts / Aviasales Data API (gratuite, prix en cache actualisés toutes les 48 h).
 * Endpoint utilisé : GET https://api.travelpayouts.com/aviasales/v3/prices_for_dates
 * Une requête par (aéroport d'origine, destination, mois) en dates flexibles, par (origine, destination, dates) en dates fixes.
 * Les réponses sont gardées 24 h en mémoire et les appels identiques en vol sont dédoublonnés.
 */
const ENDPOINT = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const TTL_MS = 24 * 3600 * 1000;
const CONCURRENCY = 8;

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
}

const cache = new Map<string, { at: number; data: TpItem[] }>();
const inflight = new Map<string, Promise<TpItem[]>>();

const isDirect = (it: TpItem) => (it.transfers ?? 0) === 0 && (it.return_transfers ?? 0) === 0;

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

/** Exécute les tâches par lots pour rester loin de la limite de 600 requêtes par minute. */
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

  async function load(task: Task): Promise<TpItem[]> {
    const hit = cache.get(task.key);
    if (hit && now() - hit.at < TTL_MS) return hit.data;
    if (hit) cache.delete(task.key);
    const pending = inflight.get(task.key);
    if (pending) return pending;
    const p = (async () => {
      const url = `${ENDPOINT}?${new URLSearchParams({ ...task.params, currency: "eur", sorting: "price", one_way: "false", direct: "false", limit: "1000", token: token! })}`;
      const res = await fetchImpl(url, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Travelpayouts ${res.status} pour ${task.origin}→${task.destination}`);
      const body = (await res.json()) as { success?: boolean; data?: TpItem[] };
      const data = compact(Array.isArray(body.data) ? body.data : []);
      cache.set(task.key, { at: now(), data });
      return data;
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
      const results = await pool(tasks, CONCURRENCY, async (t) => {
        try {
          return { t, items: await load(t) };
        } catch (e) {
          console.warn("[travelpayouts]", (e as Error).message);
          return { t, items: [] as TpItem[] };
        }
      });
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
            link: it.link ? `https://www.aviasales.com${it.link}${marker ? `${it.link.includes("?") ? "&" : "?"}marker=${encodeURIComponent(marker)}` : ""}` : undefined,
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
