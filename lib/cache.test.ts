import { afterEach, describe, expect, it, vi } from "vitest";
import { createSharedCache } from "./cache";

afterEach(() => vi.unstubAllEnvs());

/** Faux Upstash : note chaque requête et répond comme l'API REST. */
function fakeUpstash(calls: { path: string; body: unknown }[]) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body));
    calls.push({ path: url.replace("https://cache.test", ""), body });
    const payload = url.endsWith("/pipeline") ? (body as unknown[]).map(() => ({ result: "OK" })) : { result: (body as string[]).slice(1).map((k) => (k === "tp:v1:hit" ? '[{"price":1}]' : null)) };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("cache partagé", () => {
  it("absent sans configuration, présent avec les variables Upstash ou KV", () => {
    expect(createSharedCache()).toBeNull();
    vi.stubEnv("KV_REST_API_URL", "https://kv.test/");
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    expect(createSharedCache()).not.toBeNull();
  });

  it("lit en une commande MGET et écrit en un pipeline de SET avec expiration", async () => {
    const calls: { path: string; body: unknown }[] = [];
    const cache = createSharedCache({ url: "https://cache.test", token: "secret", fetchImpl: fakeUpstash(calls) })!;
    expect(await cache.mget(["tp:v1:hit", "tp:v1:miss"])).toEqual(['[{"price":1}]', null]);
    await cache.set([{ key: "tp:v1:a", value: "[]", ttlSeconds: 86400 }]);
    expect(calls).toEqual([
      { path: "", body: ["MGET", "tp:v1:hit", "tp:v1:miss"] },
      { path: "/pipeline", body: [["SET", "tp:v1:a", "[]", "EX", "86400"]] },
    ]);
  });

  it("signale une erreur HTTP sans la masquer", async () => {
    const failing = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const cache = createSharedCache({ url: "https://cache.test", token: "secret", fetchImpl: failing })!;
    await expect(cache.mget(["k"])).rejects.toThrow(/HTTP 500/);
  });
});
