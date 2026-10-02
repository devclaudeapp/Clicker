import { describe, expect, it } from "vitest";
import { buildWindows, fridaysOf, nextMonths } from "./dates";

describe("fridaysOf", () => {
  it("liste les vendredis de novembre 2026", () => {
    expect(fridaysOf("2026-11")).toEqual(["2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27"]);
  });
});

describe("buildWindows", () => {
  const base = { month: "2026-11", dateOut: "", dateIn: "" } as const;
  it("un week-end par vendredi, deux nuits", () => {
    const w = buildWindows({ ...base, dateMode: "flex", duration: "weekend" });
    expect(w).toHaveLength(4);
    expect(w[0]).toMatchObject({ out: "2026-11-06", ret: "2026-11-08", nights: 2, monthIndex: 10, key: "2026-11|0" });
  });
  it("une semaine part le samedi", () => {
    const w = buildWindows({ ...base, dateMode: "flex", duration: "week" });
    expect(w[0]).toMatchObject({ out: "2026-11-07", ret: "2026-11-14", nights: 7 });
  });
  it("dates fixes cohérentes → une fenêtre, incohérentes → aucune", () => {
    expect(buildWindows({ ...base, dateMode: "fixed", duration: "weekend", dateOut: "2026-11-14", dateIn: "2026-11-16" })).toEqual([
      { out: "2026-11-14", ret: "2026-11-16", nights: 2, monthIndex: 10, key: "2026-11-14" },
    ]);
    expect(buildWindows({ ...base, dateMode: "fixed", duration: "weekend", dateOut: "2026-11-16", dateIn: "2026-11-14" })).toEqual([]);
  });
});

describe("nextMonths", () => {
  it("commence au mois courant et passe l'année", () => {
    const m = nextMonths(3, new Date("2026-11-15T12:00:00Z"));
    expect(m.map((x) => x.value)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(m[0].label).toBe("Novembre 2026");
    expect(m[2].short).toBe("janv. 2027");
  });
});
