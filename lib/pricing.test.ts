import { describe, expect, it } from "vitest";
import type { SearchParams } from "@/types";
import { DESTINATIONS } from "./data/destinations";
import { buildWindows } from "./dates";
import { resolveDeparture } from "./places";
import { computeTrips, matchesVibes, originOf, originsFor, sortTrips } from "./pricing";
import { mockProvider } from "./providers/mock";

const params: SearchParams = {
  departures: [resolveDeparture("Lyon")!, resolveDeparture("Genève")!],
  includeNearby: true,
  excludedNearby: [],
  dateMode: "flex",
  month: "2026-11",
  duration: "weekend",
  dateOut: "",
  dateIn: "",
  travelers: 2,
  budget: 400,
  modes: { plane: true, train: true, bus: true, car: true },
  directOnly: false,
  vibes: [],
};

async function run(p: SearchParams) {
  const windows = buildWindows(p);
  const origins = [...originsFor(p).keys()];
  const fares = await mockProvider.fares({ origins, destinations: DESTINATIONS, windows, directOnly: p.directOnly });
  return computeTrips(p, windows, DESTINATIONS, fares);
}

describe("originsFor", () => {
  it("les aéroports principaux priment sur les voisins", () => {
    const o = originsFor(params);
    expect(o.get("LYS")).toMatchObject({ depId: "lyon", nearby: false });
    expect(o.get("GVA")).toMatchObject({ depId: "geneve", nearby: false });
    expect(o.get("GNB")?.nearby).toBe(true);
  });
  it("respecte les voisins décochés et le réglage « alentours »", () => {
    expect(originsFor({ ...params, excludedNearby: ["GNB"] }).has("GNB")).toBe(false);
    expect(originsFor({ ...params, includeNearby: false }).has("GNB")).toBe(false);
  });
});

describe("computeTrips", () => {
  it("chiffre chaque destination et retient la fenêtre la moins chère", async () => {
    const trips = await run(params);
    expect(trips.length).toBe(DESTINATIONS.length);
    for (const t of trips) {
      expect(t.perPerson).toBeGreaterThan(0);
      expect(t.alternatives.length).toBe(4);
      expect(Math.min(...t.alternatives.map((a) => a.perPerson))).toBe(t.perPerson);
      expect(t.total).toBe(t.transportTotal + t.stayTotal);
      expect(t.perPerson).toBe(Math.round(t.total / 2));
    }
  });
  it("est déterministe", async () => {
    const a = await run(params);
    const b = await run(params);
    expect(a.map((t) => t.perPerson)).toEqual(b.map((t) => t.perPerson));
  });
  it("sans avion, retient le train ou la route quand ils existent", async () => {
    const trips = await run({ ...params, modes: { plane: false, train: true, bus: true, car: true } });
    const bcn = trips.find((t) => t.destination.id === "bcn")!;
    expect(bcn.best.mode).not.toBe("plane");
    expect(trips.find((t) => t.destination.id === "rak")).toBeUndefined();
  });
  it("compte une chambre pour deux", async () => {
    const solo = (await run({ ...params, travelers: 1 })).find((t) => t.destination.id === "bcn")!;
    const trio = (await run({ ...params, travelers: 3 })).find((t) => t.destination.id === "bcn")!;
    expect(solo.rooms).toBe(1);
    expect(trio.rooms).toBe(2);
  });
  it("tri et envies", async () => {
    const trips = await run(params);
    const byTotal = sortTrips(trips, "total");
    expect(byTotal[0].perPerson).toBeLessThanOrEqual(byTotal[1].perPerson);
    const byTemp = sortTrips(trips, "temp");
    expect(byTemp[0].temp).toBeGreaterThanOrEqual(byTemp[1].temp);
    expect(byTemp[0].temp).toBeGreaterThanOrEqual(byTemp[byTemp.length - 1].temp + 10);
    const sunny = trips.filter((t) => matchesVibes(t, ["sun", "beach"]));
    expect(sunny.map((t) => t.destination.id)).toContain("agp");
    expect(sunny.map((t) => t.destination.id)).not.toContain("prg");
  });
  it("originOf renvoie l'aéroport réellement utilisé, ou la ville pour le terrestre", async () => {
    const all = await run(params);
    const bcnAll = all.find((t) => t.destination.id === "bcn")!;
    // Toutes options ouvertes : depuis Lyon, le bus à ~25 € bat l'avion pour Barcelone.
    expect(bcnAll.best.mode).toBe("bus");
    expect(originOf(bcnAll, params.departures)).toMatchObject({ label: "Lyon", ground: true });

    const planeOnly = await run({ ...params, modes: { plane: true, train: false, bus: false, car: false } });
    const bcn = planeOnly.find((t) => t.destination.id === "bcn")!;
    expect(bcn.best.mode).toBe("plane");
    const o = originOf(bcn, params.departures);
    expect(o.label).toContain(bcn.best.origin!);
    expect(o.ground).toBe(false);
  });
});
