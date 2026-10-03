import type { AgeBand, GroupType } from "@/types";

/** Compositions de groupe proposées dans « Qui part ? ». */
export const GROUPS: { id: GroupType; label: string; icon: string; travelers?: number }[] = [
  { id: "solo", label: "Solo", icon: "user", travelers: 1 },
  { id: "couple", label: "Couple", icon: "heart", travelers: 2 },
  { id: "friends", label: "Potes", icon: "users" },
  { id: "family", label: "Famille", icon: "home" },
];

/** Tranches d'âge présentes dans le groupe (plusieurs possibles). */
export const AGES: { id: AgeBand; label: string }[] = [
  { id: "kids", label: "Enfants" },
  { id: "teens", label: "Ados" },
  { id: "young", label: "18–30" },
  { id: "adults", label: "30–50" },
  { id: "seniors", label: "50+" },
];

export const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.id, g.label])) as Record<GroupType, string>;
export const AGE_LABEL = Object.fromEntries(AGES.map((a) => [a.id, a.label])) as Record<AgeBand, string>;
export const GROUP_IDS = new Set<string>(GROUPS.map((g) => g.id));
export const AGE_IDS = new Set<string>(AGES.map((a) => a.id));

export const DEFAULT_GROUP: GroupType = "friends";
export const DEFAULT_AGES: AgeBand[] = ["young"];

/** Garde l'ordre canonique des tranches, sans doublon ni valeur inconnue. Rend [] si rien n'est valide. */
export const normalizeAges = (v: unknown): AgeBand[] =>
  Array.isArray(v) ? AGES.map((a) => a.id).filter((id) => v.includes(id)) : [];
