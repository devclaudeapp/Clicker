import { describe, expect, it } from "vitest";
import { paramsFromShared, searchTrips } from "./search-server";

describe("recherche côté serveur", () => {
  it("« only » restreint le chiffrage aux destinations demandées (aperçus de liens partagés)", async () => {
    const params = paramsFromShared({ departures: ["Lyon"], month: "2026-11" });
    const all = await searchTrips(params);
    const one = await searchTrips(params, { only: ["bcn"] });
    expect(all.trips.length).toBeGreaterThan(10);
    expect(one.trips.map((t) => t.destination.id)).toEqual(["bcn"]);
    expect(one.provider).toBe("mock");
    expect(one.windows).toEqual(all.windows);
  });

  it("sans ville de départ connue, rien n'est cherché", async () => {
    const params = paramsFromShared({ departures: ["Ville-inconnue-xyz"] });
    expect(await searchTrips(params)).toMatchObject({ trips: [], provider: null });
  });
});
