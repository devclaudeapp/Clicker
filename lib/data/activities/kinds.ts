import type { Activity, ActivityKind, AgeBand, DaySlot, GroupType, VibeId } from "@/types";

const ALL_AGES: AgeBand[] = ["kids", "teens", "young", "adults", "seniors"];
const NO_KIDS: AgeBand[] = ["teens", "young", "adults", "seniors"];
const ADULTS: AgeBand[] = ["young", "adults"];
const ALL_GROUPS: GroupType[] = ["solo", "couple", "friends", "family"];
const DAY: DaySlot[] = ["morning", "afternoon"];

type Defaults = Pick<Activity, "ages" | "groups" | "slots" | "hours" | "price"> & { bookable?: boolean; minTemp?: number };

/** Valeurs par défaut par type d'activité ; chaque entrée du catalogue peut les surcharger. */
export const KIND_DEFAULTS: Record<ActivityKind, Defaults> = {
  sight: { ages: ALL_AGES, groups: ALL_GROUPS, slots: DAY, hours: 1.5, price: 1 },
  museum: { ages: ALL_AGES, groups: ALL_GROUPS, slots: DAY, hours: 2, price: 1 },
  walk: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["morning", "afternoon", "evening"], hours: 2, price: 0 },
  viewpoint: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["afternoon", "evening"], hours: 1, price: 0 },
  beach: { ages: ALL_AGES, groups: ALL_GROUPS, slots: DAY, hours: 3, price: 0, minTemp: 17 },
  nature: { ages: ALL_AGES, groups: ALL_GROUPS, slots: DAY, hours: 3, price: 0 },
  food: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["afternoon", "evening"], hours: 2, price: 2 },
  market: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["morning"], hours: 1.5, price: 1 },
  nightlife: { ages: ADULTS, groups: ["solo", "couple", "friends"], slots: ["evening"], hours: 3, price: 2 },
  bar: { ages: ["young", "adults", "seniors"], groups: ["solo", "couple", "friends"], slots: ["evening"], hours: 2, price: 1 },
  shop: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["afternoon"], hours: 2, price: 1 },
  spa: { ages: NO_KIDS, groups: ALL_GROUPS, slots: ["afternoon", "evening"], hours: 2, price: 2, bookable: true },
  boat: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["afternoon"], hours: 2, price: 2, bookable: true },
  sport: { ages: ["kids", "teens", "young", "adults"], groups: ALL_GROUPS, slots: DAY, hours: 2, price: 2, bookable: true },
  daytrip: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["morning"], hours: 7, price: 2, bookable: true },
  show: { ages: ALL_AGES, groups: ALL_GROUPS, slots: ["evening"], hours: 2, price: 3, bookable: true },
};

export const KIND_LABEL: Record<ActivityKind, string> = {
  sight: "Incontournable",
  museum: "Musée",
  walk: "Balade",
  viewpoint: "Point de vue",
  beach: "Plage",
  nature: "Nature",
  food: "Table",
  market: "Marché",
  nightlife: "Soirée",
  bar: "Verre",
  shop: "Shopping",
  spa: "Détente",
  boat: "Bateau",
  sport: "Sport",
  daytrip: "Excursion",
  show: "Spectacle",
};

/** Raccourci d'écriture du catalogue : identifiant, nom, phrase, type, envies, puis surcharges éventuelles. */
export const act = (destId: string, id: string, name: string, blurb: string, kind: ActivityKind, vibes: VibeId[], over: Partial<Omit<Activity, "id" | "destId" | "name" | "blurb" | "kind" | "vibes">> = {}): Activity => ({
  id: `${destId}-${id}`,
  destId,
  name,
  blurb,
  kind,
  vibes,
  ...KIND_DEFAULTS[kind],
  ...over,
});

export { ALL_AGES, NO_KIDS, ADULTS };
