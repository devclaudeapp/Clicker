/**
 * Cache partagé entre toutes les instances du serveur : un Redis Upstash interrogé par son API REST (aucune
 * dépendance). Les réponses du fournisseur de prix y vivent 24 h, quelle que soit l'instance Vercel qui a fait l'appel ;
 * sans variables de connexion (local, mode fictif), tout reste en mémoire et rien ne change.
 */
export interface SharedCache {
  /** Valeurs des clés demandées, dans l'ordre ; null quand la clé est absente ou expirée. */
  mget(keys: string[]): Promise<(string | null)[]>;
  /** Écrit plusieurs valeurs avec leur durée de vie, en un seul aller-retour. */
  set(entries: { key: string; value: string; ttlSeconds: number }[]): Promise<void>;
}

export interface SharedCacheOptions {
  url?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

/** Au-delà, les commandes sont envoyées en plusieurs lots. */
const BATCH = 400;

/**
 * Client du cache partagé, ou null sans configuration. Les variables acceptées sont celles de l'intégration Upstash
 * de Vercel (UPSTASH_REDIS_REST_URL / _TOKEN) et leurs anciens noms KV (KV_REST_API_URL / _TOKEN).
 */
export function createSharedCache(opts: SharedCacheOptions = {}): SharedCache | null {
  const url = (opts.url ?? process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.replace(/\/$/, "");
  const token = opts.token ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const call = async (path: string, body: unknown): Promise<unknown> => {
    const res = await fetchImpl(`${url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`cache partagé : HTTP ${res.status}`);
    return res.json();
  };

  return {
    async mget(keys) {
      const out: (string | null)[] = [];
      for (let i = 0; i < keys.length; i += BATCH) {
        const data = (await call("", ["MGET", ...keys.slice(i, i + BATCH)])) as { result?: (string | null)[] };
        out.push(...(data.result ?? []));
      }
      return out;
    },
    async set(entries) {
      for (let i = 0; i < entries.length; i += BATCH) {
        await call(
          "/pipeline",
          entries.slice(i, i + BATCH).map((e) => ["SET", e.key, e.value, "EX", String(e.ttlSeconds)]),
        );
      }
    },
  };
}
