import type { Activity, ActivityKind, DaySlot, Itinerary, PlanDay, PlanSlot, Season, SkippedActivity, TravelProfile } from "@/types";
import { MONTHS_FR } from "./dates";
import { addDays, hash, parseISO, toISO } from "./format";

/**
 * Ce qu'on cherche sur une carte ou un site de réservation pour une activité : la requête explicite s'il y en a une,
 * sinon le nom, découpé quand il propose une alternative (« Paddle ou kayak » → « Paddle », « Kayak »).
 */
export function activityOptions(a: Pick<Activity, "name" | "query">): string[] {
  if (a.query) return [a.query];
  const parts = a.name.split(/\s+ou\s+/i).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.map((s) => s.charAt(0).toUpperCase() + s.slice(1)) : [a.name];
}

/** Prix indicatif par personne pour chaque niveau du catalogue. */
export const PRICE_LEVEL = [0, 10, 25, 60] as const;
export const PRICE_LABEL = ["gratuit", "~10 €", "~25 €", "~60 €"] as const;

/** Au-delà, les journées restent libres : on garde les idées en réserve plutôt que de répéter. */
const MAX_PLANNED_DAYS = 5;
const DAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
/** Types où une longue sortie pèse par forte chaleur. */
const OUTDOOR_KINDS = new Set<ActivityKind>(["walk", "nature", "daytrip"]);

interface Scored {
  activity: Activity;
  score: number;
}

/** Période d'un séjour : les mois qu'il touche (1 à 12) et la température moyenne attendue. */
export interface Period {
  months: number[];
  temp: number;
}

/** Les mois (1 à 12) couverts par un séjour, du départ au retour. */
export function tripMonths(out: string, nights: number): number[] {
  const months: number[] = [];
  for (let i = 0; i <= nights; i++) {
    const m = addDays(parseISO(out), i).getUTCMonth() + 1;
    if (!months.includes(m)) months.push(m);
  }
  return months;
}

/** Vrai si le mois (1 à 12) tombe dans la saison, bornes incluses, y compris quand elle passe l'hiver (11 → 2). */
export const inSeason = (season: Season, month: number): boolean =>
  season.from <= season.to ? month >= season.from && month <= season.to : month >= season.from || month <= season.to;

/** Pourquoi la période écarte une activité, ou null si elle convient. */
export function periodFit(a: Activity, period: Period): SkippedActivity["reason"] | null {
  const season = a.season;
  if (season && !period.months.some((m) => inSeason(season, m))) return "season";
  if (a.minTemp !== undefined && period.temp < a.minTemp) return "cold";
  return null;
}

/** « de novembre », « d'avril » : la préposition s'élide devant une voyelle. */
const fromMonth = (m: number): string => (/^[aeiouéèê]/.test(MONTHS_FR[m - 1]) ? `d'${MONTHS_FR[m - 1]}` : `de ${MONTHS_FR[m - 1]}`);

/** Quand une activité écartée redevient possible : « de novembre à décembre », « d'avril à octobre », « en mars », « à partir de 17 °C ». */
export function whenLabel(s: SkippedActivity): string {
  const { season, minTemp } = s.activity;
  if (s.reason === "season" && season) return season.from === season.to ? `en ${MONTHS_FR[season.from - 1]}` : `${fromMonth(season.from)} à ${MONTHS_FR[season.to - 1]}`;
  return `à partir de ${minTemp} °C`;
}

/**
 * Note une activité pour un profil et une période : envies, groupe, saison, météo, et un peu de hasard stable pour
 * varier d'un tirage à l'autre. Null quand elle est exclue (période, âges).
 */
export function scoreActivity(a: Activity, profile: TravelProfile, period: Period, seed: number): number | null {
  if (periodFit(a, period)) return null;
  if (profile.ages.some((band) => !a.ages.includes(band))) return null;
  let s = 1;
  if (profile.vibes.length) s += 2 * profile.vibes.filter((v) => a.vibes.includes(v)).length;
  if (a.groups.includes(profile.group)) s += 1.5;
  // Ce qui ne se fait qu'à cette période de l'année passe devant : c'est une raison de venir maintenant.
  if (a.season) s += 1.5;
  // Baignade et sports d'eau : tièdes sous les 22 °C, à leur avantage par vraie chaleur.
  if (a.minTemp !== undefined) s += period.temp >= 26 ? 1 : period.temp < 22 ? -1.5 : 0;
  // Hammam, thermes et saunas réconfortent quand il fait froid ; une longue sortie pèse par canicule.
  if (a.kind === "spa" && period.temp < 12) s += 1;
  if (period.temp >= 30 && OUTDOOR_KINDS.has(a.kind) && a.hours >= 3) s -= 1;
  if (a.kind === "nightlife" && profile.group === "family") s -= 4;
  if (profile.group === "couple" && a.vibes.includes("love")) s += 1;
  if (profile.group === "friends" && a.vibes.includes("friends")) s += 1;
  s += hash(`${seed}|${a.id}`) * 1.5;
  return s;
}

/** Créneaux d'une journée selon sa place dans le séjour : on arrive le soir, on repart le matin. */
export function slotsForDay(index: number, totalDays: number): DaySlot[] {
  if (totalDays === 1) return ["afternoon", "evening"];
  if (index === 0) return ["evening"];
  if (index === totalDays - 1) return ["morning"];
  return ["morning", "afternoon", "evening"];
}

function dayLabel(index: number, totalDays: number, date: string): string {
  const d = parseISO(date);
  const name = DAYS_FR[d.getUTCDay()];
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  if (totalDays === 1) return `${cap} · journée`;
  if (index === 0) return `${cap} soir · arrivée`;
  if (index === totalDays - 1) return `${cap} matin · avant le retour`;
  return cap;
}

export interface PlanOptions {
  nights: number;
  /** Date de départ ISO. */
  out: string;
  temp: number;
  profile: TravelProfile;
  seed?: number;
}

export const SLOT_ORDER: DaySlot[] = ["morning", "afternoon", "evening"];
/** Une excursion ou une activité de six heures et plus occupe la matinée et l'après-midi. */
const isFullDay = (a: Activity): boolean => a.kind === "daytrip" || a.hours >= 6;
/** Borne de l'exploration : au-delà, on garde la meilleure composition trouvée (la première est la gloutonne). */
const SEARCH_BUDGET = 20000;

interface SlotRef {
  day: number;
  slot: DaySlot;
  /** Journée complète (trois créneaux), seule à pouvoir accueillir une excursion. */
  full: boolean;
}

/**
 * Remplit les créneaux de toutes les journées : d'abord le plus de créneaux possible, ensuite le meilleur score.
 * Exploration en profondeur avec élagage ; les candidats sont essayés par score décroissant, si bien que le premier
 * chemin complet est la composition gloutonne, améliorée ensuite si une permutation comble un créneau de plus.
 */
function fillSlots(scored: Scored[], days: DaySlot[][]): (Scored | null)[][] {
  const refs: SlotRef[] = days.flatMap((slots, day) => slots.map((slot) => ({ day, slot, full: slots.length === 3 })));
  const n = refs.length;
  const used = new Array<boolean>(scored.length).fill(false);
  const kinds = days.map(() => new Set<ActivityKind>());
  const current = new Array<Scored | null>(n).fill(null);
  const coveredByFullDay = new Array<boolean>(n).fill(false);
  let fullDayUsed = false;
  let best: { filled: number; score: number; picks: (Scored | null)[] } = { filled: -1, score: -Infinity, picks: [] };
  let nodes = 0;

  const dfs = (i: number, filled: number, score: number) => {
    if (nodes++ > SEARCH_BUDGET) return;
    if (filled + (n - i) < best.filled) return;
    if (i === n) {
      if (filled > best.filled || (filled === best.filled && score > best.score)) best = { filled, score, picks: current.slice() };
      return;
    }
    const ref = refs[i];
    if (coveredByFullDay[i]) {
      dfs(i + 1, filled + 1, score);
      return;
    }
    for (let c = 0; c < scored.length; c++) {
      const { activity: a, score: sc } = scored[c];
      if (used[c] || !a.slots.includes(ref.slot) || kinds[ref.day].has(a.kind)) continue;
      const full = isFullDay(a);
      if (full && (fullDayUsed || ref.slot !== "morning" || !ref.full)) continue;
      used[c] = true;
      kinds[ref.day].add(a.kind);
      current[i] = scored[c];
      if (full) {
        fullDayUsed = true;
        coveredByFullDay[i + 1] = true;
      }
      dfs(i + 1, filled + 1, score + sc);
      if (full) {
        fullDayUsed = false;
        coveredByFullDay[i + 1] = false;
      }
      current[i] = null;
      kinds[ref.day].delete(a.kind);
      used[c] = false;
    }
    dfs(i + 1, filled, score);
  };
  dfs(0, 0, 0);

  const out: (Scored | null)[][] = days.map(() => []);
  best.picks.forEach((pick, i) => out[refs[i].day].push(pick));
  return out;
}

const freeCount = (days: PlanDay[]): number => days.reduce((n, d) => n + d.free.length, 0);
/** Au plus un créneau libre pour deux journées détaillées. */
const acceptable = (days: PlanDay[]): boolean => freeCount(days) <= Math.floor(days.length / 2);

function compose(scored: Scored[], totalDays: number, planned: number, out: string): PlanDay[] {
  const indexes = Array.from({ length: planned }, (_, i) => (i === planned - 1 ? totalDays - 1 : i));
  const slotsPerDay = indexes.map((idx) => slotsForDay(idx, totalDays));
  const picks = fillSlots(scored, slotsPerDay);
  return indexes.map((indexInTrip, d) => {
    const date = toISO(addDays(parseISO(out), indexInTrip));
    const slots: PlanSlot[] = [];
    const free: DaySlot[] = [];
    let covered = false;
    slotsPerDay[d].forEach((slot, j) => {
      const pick = picks[d][j];
      if (pick) {
        slots.push({ slot, activity: pick.activity });
        if (isFullDay(pick.activity)) covered = true;
      } else if (covered && slot === "afternoon") covered = false;
      else free.push(slot);
    });
    return { index: indexInTrip, date, label: dayLabel(indexInTrip, totalDays, date), slots, free };
  });
}

/**
 * Compose un programme jour par jour : les créneaux de chaque journée reçoivent les meilleures activités du profil,
 * sans répéter un type dans la journée, une seule excursion par séjour (elle prend la journée). Les activités hors
 * saison ou trop fraîches pour les dates sont écartées et renvoyées à part. Sur un long séjour, on détaille autant de
 * journées que le catalogue en remplit sans trou, et le reste est laissé libre.
 */
export function planTrip(activities: Activity[], opts: PlanOptions): Itinerary {
  const seed = opts.seed ?? 0;
  const period: Period = { months: tripMonths(opts.out, opts.nights), temp: opts.temp };
  const skipped: SkippedActivity[] = [];
  const scored: Scored[] = [];
  for (const activity of activities) {
    const reason = periodFit(activity, period);
    if (reason) {
      skipped.push({ activity, reason });
      continue;
    }
    const score = scoreActivity(activity, opts.profile, period, seed);
    if (score !== null) scored.push({ activity, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const totalDays = Math.max(1, opts.nights + 1);
  const maxPlanned = Math.min(totalDays, MAX_PLANNED_DAYS);
  let days = compose(scored, totalDays, maxPlanned, opts.out);
  // Long séjour : un créneau libre de temps en temps passe, mais si le catalogue ne suit pas, on détaille une journée
  // de moins (jusqu'à deux : l'arrivée et le retour) plutôt que d'aligner des trous. À défaut, le moins de trous possible.
  if (totalDays > 4 && !acceptable(days)) {
    for (let planned = maxPlanned - 1; planned >= 2; planned--) {
      const candidate = compose(scored, totalDays, planned, opts.out);
      if (acceptable(candidate)) {
        days = candidate;
        break;
      }
      if (freeCount(candidate) < freeCount(days)) days = candidate;
    }
  }

  const used = new Set(days.flatMap((d) => d.slots.map((s) => s.activity.id)));
  const leftovers = scored.filter((s) => !used.has(s.activity.id) && s.score > 1).slice(0, 6).map((s) => s.activity);
  const costPerPerson = days.reduce((sum, d) => sum + d.slots.reduce((s, x) => s + PRICE_LEVEL[x.activity.price], 0), 0);
  return { days, freeDays: Math.max(0, totalDays - days.length), leftovers, skipped, costPerPerson, seed };
}

/** Programme en texte brut, prêt à coller dans une conversation de groupe. */
export function itineraryToText(city: string, it: Itinerary): string {
  const SLOT = { morning: "Matin", afternoon: "Après-midi", evening: "Soir" } as const;
  const lines = [`Programme à ${city}`];
  for (const d of it.days) {
    lines.push("", d.label);
    for (const slot of SLOT_ORDER) {
      const s = d.slots.find((x) => x.slot === slot);
      if (s) lines.push(`  ${SLOT[slot]} · ${s.activity.name}${s.activity.price ? ` (${PRICE_LABEL[s.activity.price]})` : ""}`);
      else if (d.free.includes(slot)) lines.push(`  ${SLOT[slot]} · libre`);
    }
  }
  if (it.freeDays) lines.push("", `+ ${it.freeDays} journée${it.freeDays > 1 ? "s" : ""} libre${it.freeDays > 1 ? "s" : ""}`);
  if (it.leftovers.length) lines.push("", `Autres idées : ${it.leftovers.map((a) => a.name).join(", ")}`);
  if (it.skipped.length) lines.push("", `Pas à cette période : ${it.skipped.map((s) => `${s.activity.name} (${whenLabel(s)})`).join(", ")}`);
  lines.push("", `Activités : ~${it.costPerPerson} € par personne`);
  return lines.join("\n");
}
