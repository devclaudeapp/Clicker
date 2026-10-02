import { describe, expect, it } from "vitest";
import { resolveDeparture, suggestCities } from "./places";

describe("resolveDeparture", () => {
  it("Paris : ses deux aéroports, Beauvais en voisin, les grandes gares", () => {
    const p = resolveDeparture("Paris");
    expect(p).not.toBeNull();
    expect(p!.id).toBe("paris");
    expect(p!.airports).toEqual(expect.arrayContaining(["CDG", "ORY"]));
    expect(p!.nearby.map((n) => n.iata)).toContain("BVA");
    expect(p!.stations).toContain("Paris Gare de Lyon");
  });
  it("Lyon : Saint-Exupéry principal, Genève, Grenoble et Chambéry à ~2 h", () => {
    const p = resolveDeparture("lyon")!;
    expect(p.airports).toEqual(["LYS"]);
    const codes = p.nearby.map((n) => n.iata);
    expect(codes).toEqual(expect.arrayContaining(["GVA", "GNB", "CMF"]));
    const gva = p.nearby.find((n) => n.iata === "GVA")!;
    expect(gva.km).toBeGreaterThan(100);
    expect(gva.km).toBeLessThan(130);
    expect(gva.minutes).toBeGreaterThan(60);
  });
  it("accepte les accents absents et les alias", () => {
    expect(resolveDeparture("geneve")!.id).toBe("geneve");
    expect(resolveDeparture("Geneva")!.label).toBe("Genève");
    expect(resolveDeparture("Bale")!.airports).toContain("BSL");
  });
  it("une ville hors liste retombe sur la commune d'un aéroport", () => {
    const p = resolveDeparture("Porto");
    expect(p).not.toBeNull();
    expect(p!.airports).toContain("OPO");
  });
  it("rend null sur une saisie vide ou inconnue", () => {
    expect(resolveDeparture("")).toBeNull();
    expect(resolveDeparture("Zzzzville")).toBeNull();
  });
});

describe("suggestCities", () => {
  it("propose les villes qui commencent par la saisie, sans doublon", () => {
    const s = suggestCities("ly");
    expect(s[0].label).toBe("Lyon");
    expect(new Set(s.map((x) => x.label)).size).toBe(s.length);
  });
  it("ne propose rien sous deux caractères", () => {
    expect(suggestCities("l")).toEqual([]);
  });
});
