import { beforeEach, describe, expect, it, vi } from "vitest";
import { DESTINATIONS } from "../data/destinations";
import { buildWindows } from "../dates";
import { clearTravelpayoutsCache, createTravelpayoutsProvider } from "./travelpayouts";

const bcn = DESTINATIONS.find((d) => d.id === "bcn")!;
const windows = buildWindows({ dateMode: "flex", month: "2026-11", duration: "weekend", dateOut: "", dateIn: "" }, new Date("2026-10-01T00:00:00Z"));
const query = { origins: ["LYS"], destinations: [bcn], windows, directOnly: false };
/** Les tests ne dorment jamais : les attentes demandées sont seulement notées. */
const noWait = async () => {};

/** Faux serveur Travelpayouts : deux tarifs pour le week-end du 13 nov. (un avec escale), un hors fenêtre, un pour le 20 nov. */
const sample = {
  success: true,
  data: [
    { origin: "LYS", destination: "BCN", price: 41, airline: "VY", departure_at: "2026-11-13T07:10:00+01:00", return_at: "2026-11-15T21:00:00+01:00", transfers: 0, return_transfers: 0, duration_to: 95, link: "/search/LYS1311BCN15111?t=abc" },
    { origin: "LYS", destination: "BCN", price: 35, airline: "U2", departure_at: "2026-11-13T18:00:00+01:00", return_at: "2026-11-15T10:00:00+01:00", transfers: 1, return_transfers: 2, duration_to: 240, link: "/search/LYS1311BCN15111?t=def" },
    { origin: "LYS", destination: "BCN", price: 20, airline: "FR", departure_at: "2026-11-12T06:00:00+01:00", return_at: "2026-11-15T10:00:00+01:00", transfers: 0, return_transfers: 0, duration_to: 100 },
    { origin: "LYS", destination: "BCN", price: 58, airline: "VY", departure_at: "2026-11-20T07:10:00+01:00", return_at: "2026-11-22T21:00:00+01:00", transfers: 0, return_transfers: 0, duration_to: 95, link: "/search/LYS2011BCN22111" },
  ],
};

const ok = () => new Response(JSON.stringify(sample), { status: 200, headers: { "content-type": "application/json" } });

function fakeFetch(calls: string[]) {
  return vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url));
    return ok();
  }) as unknown as typeof fetch;
}

beforeEach(() => clearTravelpayoutsCache());

describe("fournisseur Travelpayouts", () => {
  it("convertit la réponse en tarifs par fenêtre, le moins cher d'abord, avec le lien Aviasales en euros et marqué", async () => {
    const calls: string[] = [];
    const p = createTravelpayoutsProvider({ token: "T", marker: "123", fetchImpl: fakeFetch(calls), sleep: noWait });
    const fares = await p.fares(query);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("origin=LYS&destination=BCN&departure_at=2026-11");
    expect(calls[0]).toContain("token=T");
    expect(fares.map((f) => f.windowKey).sort()).toEqual(["2026-11|1", "2026-11|2"]);
    const w1 = fares.find((f) => f.windowKey === "2026-11|1")!;
    expect(w1).toMatchObject({ origin: "LYS", destId: "bcn", price: 35, airline: "easyJet", direct: false, stops: 2, duration: "4 h" });
    expect(w1.link).toBe("https://www.aviasales.com/search/LYS1311BCN15111?t=def&currency=eur&marker=123");
    const w2 = fares.find((f) => f.windowKey === "2026-11|2")!;
    expect(w2).toMatchObject({ direct: true, stops: 0 });
    expect(w2.link).toBe("https://www.aviasales.com/search/LYS2011BCN22111?currency=eur&marker=123");
  });

  it("en vols directs seulement, retient le direct même s'il est plus cher", async () => {
    const p = createTravelpayoutsProvider({ token: "T", fetchImpl: fakeFetch([]), sleep: noWait });
    const fares = await p.fares({ ...query, directOnly: true });
    expect(fares.find((f) => f.windowKey === "2026-11|1")).toMatchObject({ price: 41, airline: "Vueling", direct: true, duration: "1 h 35" });
  });

  it("met en cache une journée et dédoublonne les appels en vol", async () => {
    const calls: string[] = [];
    let t = 1_000;
    const p = createTravelpayoutsProvider({ token: "T", fetchImpl: fakeFetch(calls), now: () => t, sleep: noWait });
    await Promise.all([p.fares(query), p.fares(query)]);
    await p.fares(query);
    expect(calls).toHaveLength(1);
    t += 25 * 3600 * 1000;
    await p.fares(query);
    expect(calls).toHaveLength(2);
  });

  it("dates fixes : interroge les dates exactes", async () => {
    const calls: string[] = [];
    const p = createTravelpayoutsProvider({ token: "T", fetchImpl: fakeFetch(calls), sleep: noWait });
    const fixed = buildWindows({ dateMode: "fixed", month: "", duration: "weekend", dateOut: "2026-11-13", dateIn: "2026-11-15" });
    const fares = await p.fares({ ...query, windows: fixed });
    expect(calls[0]).toContain("departure_at=2026-11-13&return_at=2026-11-15");
    expect(fares).toHaveLength(1);
    expect(fares[0].windowKey).toBe("2026-11-13");
  });

  it("espace les appels d'au moins 110 ms, même en parallèle", async () => {
    const waits: number[] = [];
    const p = createTravelpayoutsProvider({ token: "T", fetchImpl: fakeFetch([]), now: () => 5_000, sleep: async (ms) => void waits.push(ms) });
    await p.fares({ ...query, origins: ["LYS", "GVA", "BSL"] });
    expect(waits).toEqual([110, 220]);
  });

  it("sur 429, attend le délai Retry-After puis relance une seule fois", async () => {
    const waits: number[] = [];
    let n = 0;
    const flaky = vi.fn(async () => (n++ === 0 ? new Response("", { status: 429, headers: { "retry-after": "3" } }) : ok())) as unknown as typeof fetch;
    const p = createTravelpayoutsProvider({ token: "T", fetchImpl: flaky, now: () => 5_000, sleep: async (ms) => void waits.push(ms) });
    const fares = await p.fares(query);
    expect(flaky).toHaveBeenCalledTimes(2);
    expect(waits).toContain(3000);
    expect(fares).toHaveLength(2);
  });

  it("refuse de tourner sans token, et garde un échec en cache dix minutes", async () => {
    await expect(createTravelpayoutsProvider({ token: "", fetchImpl: fakeFetch([]), sleep: noWait }).fares(query)).rejects.toThrow(/TRAVELPAYOUTS_TOKEN/);
    let t = 1_000;
    const failing = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = createTravelpayoutsProvider({ token: "T", fetchImpl: failing, now: () => t, sleep: noWait });
    expect(await p.fares(query)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await p.fares(query)).toEqual([]);
    expect(failing).toHaveBeenCalledTimes(1);
    t += 11 * 60 * 1000;
    await p.fares(query);
    expect(failing).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
