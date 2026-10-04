import { describe, expect, it } from "vitest";
import type { TravelProfile } from "@/types";
import { ACTIVITIES_BY_DEST } from "./data/activities";
import { DESTINATIONS } from "./data/destinations";
import { type Period, activityOptions, inSeason, itineraryToText, periodFit, planTrip, scoreActivity, slotsForDay, tripMonths, whenLabel } from "./planner";

const friends: TravelProfile = { group: "friends", ages: ["young"], vibes: ["party", "beach"], travelers: 4 };
const family: TravelProfile = { group: "family", ages: ["kids", "adults"], vibes: ["sun", "nature"], travelers: 4 };
const bcn = ACTIVITIES_BY_DEST.bcn;
const vie = ACTIVITIES_BY_DEST.vie;
const warm: Period = { months: [7], temp: 25 };
const mild: Period = { months: [5], temp: 19 };
const cold: Period = { months: [1], temp: 10 };

describe("catalogue d'activités", () => {
  it("chaque destination a au moins six activités, avec des identifiants uniques et des envies connues", () => {
    const ids = new Set<string>();
    for (const d of DESTINATIONS) {
      const acts = ACTIVITIES_BY_DEST[d.id] ?? [];
      expect(acts.length, d.city).toBeGreaterThanOrEqual(6);
      for (const a of acts) {
        expect(ids.has(a.id), a.id).toBe(false);
        ids.add(a.id);
        expect(a.vibes.length, a.id).toBeGreaterThan(0);
        expect(a.slots.length, a.id).toBeGreaterThan(0);
        if (a.season) {
          expect(a.season.from, a.id).toBeGreaterThanOrEqual(1);
          expect(a.season.from, a.id).toBeLessThanOrEqual(12);
          expect(a.season.to, a.id).toBeGreaterThanOrEqual(1);
          expect(a.season.to, a.id).toBeLessThanOrEqual(12);
        }
      }
    }
  });
  it("chaque destination garde au moins six activités en plein hiver", () => {
    for (const d of DESTINATIONS) {
      const acts = (ACTIVITIES_BY_DEST[d.id] ?? []).filter((a) => !periodFit(a, { months: [1], temp: d.temps[0] }));
      expect(acts.length, d.city).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("période du séjour", () => {
  it("liste les mois couverts, à cheval sur deux mois compris", () => {
    expect(tripMonths("2026-11-13", 2)).toEqual([11]);
    expect(tripMonths("2026-11-28", 3)).toEqual([11, 12]);
    expect(tripMonths("2026-12-30", 2)).toEqual([12, 1]);
  });
  it("une saison peut passer l'hiver", () => {
    expect(inSeason({ from: 5, to: 10 }, 7)).toBe(true);
    expect(inSeason({ from: 5, to: 10 }, 11)).toBe(false);
    expect(inSeason({ from: 11, to: 2 }, 1)).toBe(true);
    expect(inSeason({ from: 11, to: 2 }, 6)).toBe(false);
  });
  it("écarte le hors-saison et le trop-froid, et dit quand revenir", () => {
    const noel = vie.find((a) => a.id === "vie-noel")!;
    const beach = bcn.find((a) => a.kind === "beach")!;
    expect(periodFit(noel, warm)).toBe("season");
    expect(periodFit(noel, { months: [12], temp: 3 })).toBeNull();
    expect(periodFit(noel, { months: [10, 11], temp: 8 })).toBeNull();
    expect(periodFit(beach, cold)).toBe("cold");
    expect(periodFit(beach, warm)).toBeNull();
    expect(whenLabel({ activity: noel, reason: "season" })).toBe("de novembre à décembre");
    expect(whenLabel({ activity: { ...noel, season: { from: 3, to: 3 } }, reason: "season" })).toBe("en mars");
    expect(whenLabel({ activity: beach, reason: "cold" })).toBe("à partir de 17 °C");
    expect(whenLabel({ activity: { ...noel, season: { from: 4, to: 10 } }, reason: "season" })).toBe("d'avril à octobre");
  });
});

describe("slotsForDay", () => {
  it("soir d'arrivée, journées pleines, matin du retour", () => {
    expect(slotsForDay(0, 3)).toEqual(["evening"]);
    expect(slotsForDay(1, 3)).toEqual(["morning", "afternoon", "evening"]);
    expect(slotsForDay(2, 3)).toEqual(["morning"]);
    expect(slotsForDay(0, 1)).toEqual(["afternoon", "evening"]);
  });
});

describe("scoreActivity", () => {
  it("exclut les soirées quand des enfants sont là, et favorise les envies", () => {
    const club = bcn.find((a) => a.kind === "nightlife")!;
    const beach = bcn.find((a) => a.kind === "beach")!;
    expect(scoreActivity(club, family, warm, 0)).toBeNull();
    expect(scoreActivity(club, friends, warm, 0)!).toBeGreaterThan(scoreActivity(beach, { ...friends, vibes: ["party"] }, warm, 0)!);
  });
  it("écarte la plage par temps froid et la tempère quand il fait seulement doux", () => {
    const beach = bcn.find((a) => a.kind === "beach")!;
    expect(scoreActivity(beach, friends, cold, 0)).toBeNull();
    expect(scoreActivity(beach, friends, mild, 0)!).toBeLessThan(scoreActivity(beach, friends, warm, 0)!);
  });
  it("met en avant ce qui ne se fait qu'à cette saison, et l'exclut le reste de l'année", () => {
    const noel = vie.find((a) => a.id === "vie-noel")!;
    const december: Period = { months: [12], temp: 3 };
    expect(scoreActivity(noel, friends, warm, 0)).toBeNull();
    expect(scoreActivity(noel, friends, december, 0)!).toBeGreaterThan(scoreActivity({ ...noel, season: undefined }, friends, december, 0)!);
  });
});

describe("planTrip", () => {
  it("un week-end : trois jours, créneaux adaptés, pas de doublon ni de type répété dans la journée", () => {
    const it = planTrip(bcn, { nights: 2, out: "2026-11-13", temp: 14, profile: friends });
    expect(it.days).toHaveLength(3);
    expect(it.days[0].slots.map((s) => s.slot)).toEqual(["evening"]);
    expect(it.days[2].slots.map((s) => s.slot)).toEqual(["morning"]);
    expect(it.days[0].label).toBe("Vendredi soir · arrivée");
    expect(it.days[2].label).toBe("Dimanche matin · avant le retour");
    const ids = it.days.flatMap((d) => d.slots.map((s) => s.activity.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of it.days) {
      const kinds = d.slots.map((s) => s.activity.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
    expect(it.costPerPerson).toBeGreaterThan(0);
    expect(it.freeDays).toBe(0);
  });
  it("une famille ne se voit jamais proposer de boîte de nuit", () => {
    const it = planTrip(bcn, { nights: 3, out: "2026-11-13", temp: 14, profile: family });
    expect(it.days.flatMap((d) => d.slots).some((s) => s.activity.kind === "nightlife")).toBe(false);
  });
  it("une semaine : quatre ou cinq jours détaillés selon le catalogue, le dernier est bien le matin du retour, des journées libres", () => {
    const it = planTrip(bcn, { nights: 7, out: "2026-11-14", temp: 14, profile: friends });
    expect(it.days.length).toBeGreaterThanOrEqual(4);
    expect(it.days.length).toBeLessThanOrEqual(5);
    const last = it.days[it.days.length - 1];
    expect(last.index).toBe(7);
    expect(last.slots.map((s) => s.slot)).toEqual(["morning"]);
    expect(it.freeDays).toBe(8 - it.days.length);
    // Aucun créneau vide tant que le catalogue suffit : chaque journée détaillée est remplie.
    for (const d of it.days) expect(d.slots.length, d.label).toBeGreaterThan(0);
  });
  it("réduit les journées détaillées d'une semaine quand le catalogue est court, jamais celles d'un week-end", () => {
    const short = bcn.filter((a) => a.kind !== "nightlife" && a.kind !== "bar").slice(0, 5);
    const week = planTrip(short, { nights: 7, out: "2026-11-14", temp: 14, profile: friends });
    expect(week.days.length).toBeLessThan(5);
    expect(week.days[week.days.length - 1].index).toBe(7);
    expect(week.freeDays).toBe(8 - week.days.length);
    const weekend = planTrip(short.slice(0, 2), { nights: 3, out: "2026-11-13", temp: 14, profile: friends });
    expect(weekend.days).toHaveLength(4);
    expect(weekend.days.reduce((n, d) => n + d.free.length, 0)).toBeGreaterThan(0);
  });
  it("une excursion prend la journée et n'apparaît qu'une fois", () => {
    const it = planTrip(bcn, { nights: 4, out: "2026-11-13", temp: 14, profile: { ...friends, vibes: ["nature", "culture"] } });
    const trips = it.days.flatMap((d) => d.slots).filter((s) => s.activity.kind === "daytrip");
    expect(trips.length).toBeLessThanOrEqual(1);
    for (const d of it.days) if (d.slots.some((s) => s.activity.kind === "daytrip")) expect(d.slots.some((s) => s.slot === "afternoon")).toBe(false);
  });
  it("comble un créneau de plus quand une permutation le permet", () => {
    const walk = bcn.find((a) => a.kind === "walk")!;
    const view = bcn.find((a) => a.kind === "viewpoint")!;
    // Seule la balade accepte le matin : la composition gloutonne la mettrait le soir (meilleur score) et laisserait le matin vide.
    const it = planTrip([{ ...walk, slots: ["morning", "afternoon", "evening"] }, { ...view, slots: ["evening"] }], { nights: 1, out: "2026-11-13", temp: 14, profile: { ...friends, vibes: walk.vibes } });
    expect(it.days.map((d) => d.slots.map((s) => s.activity.kind))).toEqual([["viewpoint"], ["walk"]]);
    expect(it.days.every((d) => d.free.length === 0)).toBe(true);
  });
  it("signale les créneaux restés libres", () => {
    const it = planTrip(bcn.filter((a) => a.kind === "sight").slice(0, 1), { nights: 2, out: "2026-11-13", temp: 14, profile: friends });
    expect(it.days.flatMap((d) => d.slots)).toHaveLength(1);
    expect(it.days[0].free).toEqual(["evening"]);
    expect(itineraryToText("Barcelone", it)).toContain("Soir · libre");
  });
  it("est déterministe et change avec la graine", () => {
    const a = planTrip(bcn, { nights: 2, out: "2026-11-13", temp: 14, profile: friends, seed: 1 });
    const b = planTrip(bcn, { nights: 2, out: "2026-11-13", temp: 14, profile: friends, seed: 1 });
    expect(a).toEqual(b);
    const variants = new Set([0, 1, 2, 3, 4].map((seed) => JSON.stringify(planTrip(bcn, { nights: 2, out: "2026-11-13", temp: 14, profile: friends, seed }).days)));
    expect(variants.size).toBeGreaterThan(1);
  });
  it("produit un texte à coller", () => {
    const txt = itineraryToText("Barcelone", planTrip(bcn, { nights: 2, out: "2026-11-13", temp: 14, profile: friends }));
    expect(txt.startsWith("Programme à Barcelone")).toBe(true);
    expect(txt).toContain("Samedi");
    expect(txt).toContain("Activités : ~");
  });
  it("écarte la plage et la fête de septembre d'un week-end de novembre, et l'explique", () => {
    const it = planTrip(bcn, { nights: 2, out: "2026-11-13", temp: 14, profile: friends });
    const skipped = it.skipped.map((s) => s.activity.id);
    expect(skipped).toContain("bcn-barceloneta");
    expect(skipped).toContain("bcn-merce");
    const used = [...it.days.flatMap((d) => d.slots.map((s) => s.activity.id)), ...it.leftovers.map((a) => a.id)];
    expect(used.some((id) => skipped.includes(id))).toBe(false);
    expect(itineraryToText("Barcelone", it)).toContain("Pas à cette période : ");
  });
  it("un séjour fin octobre voit déjà le marché de Noël viennois, et encore le Prater", () => {
    const it = planTrip(vie, { nights: 3, out: "2026-10-30", temp: 8, profile: { group: "couple", ages: ["adults"], vibes: ["love", "culture"], travelers: 2 } });
    const skipped = it.skipped.map((s) => s.activity.id);
    expect(skipped).not.toContain("vie-noel");
    expect(skipped).not.toContain("vie-prater");
    expect(skipped).toContain("vie-danube");
  });
});

describe("activityOptions", () => {
  it("découpe une alternative « X ou Y » en une option par choix, capitalisée", () => {
    expect(activityOptions({ name: "Paddle ou kayak" })).toEqual(["Paddle", "Kayak"]);
    expect(activityOptions({ name: "Kayak sur le Guadalquivir" })).toEqual(["Kayak sur le Guadalquivir"]);
  });
  it("une requête explicite prime et n'est jamais découpée", () => {
    expect(activityOptions({ name: "Paddle ou kayak", query: "Location kayak plage de Nice" })).toEqual(["Location kayak plage de Nice"]);
  });
});
