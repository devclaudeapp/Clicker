import { nextMonths } from "./dates";
import { paramsFromShared, searchTrips } from "./search-server";

/** Villes de départ préchauffées chaque nuit : celles proposées par défaut d'abord, puis les plus grandes. */
export const WARM_DEPARTURES: string[][] = [["Lyon", "Genève"], ["Paris"], ["Marseille"], ["Lille"], ["Bordeaux"]];
/** Mois préchauffés : le mois courant et le suivant. */
export const WARM_MONTHS = 2;

export interface WarmStep {
  departures: string[];
  month: string;
}

export interface WarmResult {
  done: WarmStep[];
  skipped: WarmStep[];
  seconds: number;
}

/** Les recherches à préchauffer, par ordre d'importance : la recherche par défaut de l'app vient en premier. */
export function warmPlan(now = new Date()): WarmStep[] {
  const months = nextMonths(WARM_MONTHS, now).map((m) => m.value);
  const out: WarmStep[] = [];
  for (const departures of WARM_DEPARTURES) for (const month of months) out.push({ departures, month });
  return out;
}

/**
 * Lance les recherches du plan l'une après l'autre (le fournisseur bride déjà son débit) et n'en commence plus une
 * fois le temps alloué dépassé : le reste attendra la nuit suivante, ou la première recherche d'un visiteur.
 * Avec le cache partagé, chaque recherche faite ici profite à toutes les instances pendant 24 h.
 */
export async function runWarm(budgetMs: number, now = new Date()): Promise<WarmResult> {
  const t0 = Date.now();
  const done: WarmStep[] = [];
  const skipped: WarmStep[] = [];
  for (const step of warmPlan(now)) {
    if (Date.now() - t0 > budgetMs) {
      skipped.push(step);
      continue;
    }
    await searchTrips(paramsFromShared({ departures: step.departures, month: step.month, includeNearby: true }));
    done.push(step);
  }
  return { done, skipped, seconds: Math.round((Date.now() - t0) / 1000) };
}
