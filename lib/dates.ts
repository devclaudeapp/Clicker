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

/** Premier jour de départ acceptable : demain. */
export const earliestDeparture = (today = new Date()): string => toISO(addDays(today, 1));

/** Vrai pour une date « YYYY-MM-DD » qui existe réellement. */
export const isValidISO = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISO(s);
  return !Number.isNaN(d.getTime()) && toISO(d) === s;
};

/** Les prochains mois à proposer, en commençant par le mois courant s'il lui reste un vendredi à venir. */
export function nextMonths(count = 6, from = new Date()): MonthOption[] {
  const out: MonthOption[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  const min = earliestDeparture(from);
  if (!fridaysOf(`${y}-${String(m + 1).padStart(2, "0")}`).some((f) => f >= min)) {
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
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
 * (samedi pour une semaine), les départs avant demain étant ignorés ;
 * en mode fixe : une seule fenêtre, ou aucune si les dates sont incohérentes.
 */
export function buildWindows(p: Pick<SearchParams, "dateMode" | "month" | "duration" | "dateOut" | "dateIn">, today = new Date()): DateWindow[] {
  if (p.dateMode === "fixed") {
    // Les deux dates doivent exister dans le calendrier (le 31 février est refusé) et le départ ne peut pas être passé.
    if (!isValidISO(p.dateOut) || !isValidISO(p.dateIn) || p.dateOut < earliestDeparture(today)) return [];
    const out = parseISO(p.dateOut);
    const ret = parseISO(p.dateIn);
    const nights = Math.round((ret.getTime() - out.getTime()) / 86400000);
    if (!(nights > 0) || nights > 30) return [];
    return [{ out: p.dateOut, ret: p.dateIn, nights, monthIndex: out.getUTCMonth(), key: p.dateOut }];
  }
  const nights = NIGHTS[p.duration];
  const min = earliestDeparture(today);
  return fridaysOf(p.month)
    .map((friday, i) => {
      const start = p.duration === "week" ? addDays(parseISO(friday), 1) : parseISO(friday);
      return { out: toISO(start), ret: toISO(addDays(start, nights)), nights, monthIndex: start.getUTCMonth(), key: `${p.month}|${i}` };
    })
    .filter((w) => w.out >= min);
}
