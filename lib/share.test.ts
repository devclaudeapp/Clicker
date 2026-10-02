import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, type ShareState } from "./share";

const full: ShareState = {
  departures: ["Lyon", "Genève"],
  includeNearby: false,
  excludedNearby: ["GNB", "CMF"],
  dateMode: "flex",
  month: "2026-11",
  duration: "long",
  dateOut: "",
  dateIn: "",
  travelers: 3,
  budget: 350,
  modes: { plane: true, train: false, bus: true, car: false },
  directOnly: true,
  vibes: ["sun", "beach"],
  view: "map",
  open: "pmo",
};

describe("lien de partage", () => {
  it("fait l'aller-retour sans perte en dates flexibles", () => {
    const qs = encodeShare(full);
    expect(qs).toBe("d=Lyon%2CGen%C3%A8ve&n=0&x=GNB%2CCMF&m=2026-11&du=long&t=3&b=350&off=train%2Ccar&dir=1&v=sun%2Cbeach&view=map&open=pmo");
    const back = decodeShare(Object.fromEntries(new URLSearchParams(qs)));
    expect(back).toEqual({ ...full, dateOut: undefined, dateIn: undefined });
  });
  it("encode les dates fixes et laisse le reste au défaut", () => {
    const qs = encodeShare({ ...full, dateMode: "fixed", dateOut: "2026-11-13", dateIn: "2026-11-15", includeNearby: true, excludedNearby: [], modes: { plane: true, train: true, bus: true, car: true }, directOnly: false, vibes: [], view: "grid", open: null });
    expect(qs).toBe("d=Lyon%2CGen%C3%A8ve&o=2026-11-13&r=2026-11-15&t=3&b=350");
    expect(decodeShare(Object.fromEntries(new URLSearchParams(qs)))).toEqual({ departures: ["Lyon", "Genève"], dateMode: "fixed", dateOut: "2026-11-13", dateIn: "2026-11-15", travelers: 3, budget: 350 });
  });
  it("ignore ce qui est mal formé ou hors bornes", () => {
    const bad = decodeShare({ d: "", m: "novembre", du: "forever", t: "42", b: "9999", off: "rocket", v: "sun,yolo", view: "3d", open: "DROP TABLE", x: "gnb,zz" });
    expect(bad).toEqual({ vibes: ["sun"], excludedNearby: ["GNB"], modes: { plane: true, train: true, bus: true, car: true } });
    expect(decodeShare({})).toEqual({});
  });
  it("accepte une clé répétée en prenant la première valeur", () => {
    expect(decodeShare({ t: ["2", "5"], m: ["2027-01"] })).toEqual({ travelers: 2, dateMode: "flex", month: "2027-01" });
  });
});
