import { describe, expect, it } from "vitest";
import { accessMinutes, arcPath, haversineKm, landPath, MAP, project } from "./geo";

describe("géo", () => {
  it("Lyon → Barcelone ≈ 530 km à vol d'oiseau", () => {
    const km = haversineKm({ lat: 45.764, lon: 4.836 }, { lat: 41.387, lon: 2.17 });
    expect(km).toBeGreaterThan(520);
    expect(km).toBeLessThan(545);
  });
  it("temps d'accès : 112 km ≈ 1 h 40", () => {
    expect(accessMinutes(112)).toBe(99);
  });
  it("projette Lyon au milieu de la carte, le nord en haut", () => {
    const [x, y] = project(4.836, 45.764);
    expect(x).toBeGreaterThan(400);
    expect(x).toBeLessThan(600);
    expect(y).toBeGreaterThan(300);
    expect(y).toBeLessThan(MAP.H / 2);
    const [, yNorth] = project(4.836, 50);
    expect(yNorth).toBeLessThan(y);
  });
  it("l'arc bombe vers le haut de l'écran", () => {
    expect(arcPath(0, 0, 100, 50)).toBe("M0.0,0.0 Q59.0,7.0 100.0,50.0");
  });
  it("trace un anneau fermé", () => {
    const d = landPath([[[0, 40], [10, 40], [10, 50]]]);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.split("L").length).toBe(3);
  });
});
