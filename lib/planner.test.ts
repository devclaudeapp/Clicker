import { describe, expect, it } from "vitest";
import type { TravelProfile } from "@/types";
import { ACTIVITIES_BY_DEST } from "./data/activities";
import { DESTINATIONS } from "./data/destinations";
import { itineraryToText, planTrip, scoreActivity, slotsForDay, activityOptions } from "./planner";

const friends: TravelProfile = { group: "friends", ages: ["young"], vibes: ["party", "beach"], travelers: 4 };
const family: TravelProfile = { group: "family", ages: ["kids", "adults"], vibes: ["sun", "nature"], travelers: 4 };
const bcn = ACTIVITIES_BY_DEST.bcn;

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
      }
    }
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
    expect(scoreActivity(club, family, 20, 0)).toBeNull();
    expect(scoreActivity(club, friends, 20, 0)!).toBeGreaterThan(scoreActivity(beach, { ...friends, vibes: ["party"] }, 20, 0)!);
  });
  it("pénalise la plage par temps froid", () => {
    const beach = bcn.find((a) => a.kind === "beach")!;
    expect(scoreActivity(beach, friends, 10, 0)!).toBeLessThan(scoreActivity(beach, friends, 25, 0)!);
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
