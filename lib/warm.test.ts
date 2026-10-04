import { describe, expect, it } from "vitest";
import { runWarm, warmPlan, WARM_DEPARTURES, WARM_MONTHS } from "./warm";

describe("préchauffage du cache des prix", () => {
  it("planifie les villes par défaut d'abord, sur le mois courant et le suivant", () => {
    const plan = warmPlan(new Date("2026-10-04T00:00:00Z"));
    expect(plan).toHaveLength(WARM_DEPARTURES.length * WARM_MONTHS);
    expect(plan[0]).toEqual({ departures: ["Lyon", "Genève"], month: "2026-10" });
    expect(plan[1]).toEqual({ departures: ["Lyon", "Genève"], month: "2026-11" });
    expect(plan[2].departures).toEqual(["Paris"]);
  });

  it("n'entame plus de recherche une fois le budget de temps dépassé", async () => {
    const r = await runWarm(0, new Date("2026-10-04T00:00:00Z"));
    expect(r.done).toHaveLength(1);
    expect(r.skipped).toHaveLength(WARM_DEPARTURES.length * WARM_MONTHS - 1);
    expect(r.seconds).toBeGreaterThanOrEqual(0);
  });
});
