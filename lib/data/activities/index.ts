import type { Activity } from "@/types";
import { ACTIVITIES_A } from "./catalogue-a";
import { ACTIVITIES_B } from "./catalogue-b";

/** Catalogue complet, par identifiant de destination. */
export const ACTIVITIES: Activity[] = [...ACTIVITIES_A, ...ACTIVITIES_B];

export const ACTIVITIES_BY_DEST: Record<string, Activity[]> = ACTIVITIES.reduce<Record<string, Activity[]>>((acc, a) => {
  (acc[a.destId] ??= []).push(a);
  return acc;
}, {});

export { KIND_LABEL } from "./kinds";
