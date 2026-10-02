import type { DateWindow, DurationPreset, SearchParams } from "@/types";
import { addDays, parseISO, toISO } from "./format";

export const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
export const MONTHS_SHORT_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export interface MonthOption {
  /** « YYYY-MM » */
  value: string;
  /** « Novembre 2026 » */
  label: string;
  /** « nov. 2026 » */
  short: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Les prochains mois à proposer, en commençant par le mois courant. */
export function nextMonths(count = 6, from = new Date()): MonthOption[] {
  const out: MonthOption[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  for (let i = 0; i < count; i++) {
    out.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${cap(MONTHS_FR[m])} ${y}`, short: `${MONTHS_SHORT_FR[m]} ${y}` });
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  return out;
}

/** Tous les vendredis d'un mois « YYYY-MM », en ISO. */
export function fridaysOf(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    if (d.getUTCDay() === 5) out.push(toISO(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const NIGHTS: Record<DurationPreset, number> = { weekend: 2, long: 3, week: 7 };

/**
 * Fenêtres de dates candidates. En mode flexible : un départ par vendredi du mois
 * (samedi pour une semaine) ; en mode fixe : une seule fenêtre, ou aucune si les dates sont incohérentes.
 */
export function buildWindows(p: Pick<SearchParams, "dateMode" | "month" | "duration" | "dateOut" | "dateIn">): DateWindow[] {
  if (p.dateMode === "fixed") {
    if (!p.dateOut || !p.dateIn) return [];
    const out = parseISO(p.dateOut);
    const ret = parseISO(p.dateIn);
    const nights = Math.round((ret.getTime() - out.getTime()) / 86400000);
    if (!(nights > 0) || Number.isNaN(nights)) return [];
    return [{ out: p.dateOut, ret: p.dateIn, nights, monthIndex: out.getUTCMonth(), key: p.dateOut }];
  }
  const nights = NIGHTS[p.duration];
  return fridaysOf(p.month).map((friday, i) => {
    const start = p.duration === "week" ? addDays(parseISO(friday), 1) : parseISO(friday);
    return { out: toISO(start), ret: toISO(addDays(start, nights)), nights, monthIndex: start.getUTCMonth(), key: `${p.month}|${i}` };
  });
}
