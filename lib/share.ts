import type { DateMode, DurationPreset, TransportMode, VibeId, ViewMode } from "@/types";
import { VIBES } from "./data/vibes";

/**
 * État d'une recherche tel qu'il voyage dans l'URL (« ?d=Lyon,Genève&m=2026-11&du=weekend&t=2&b=400&open=pmo »).
 * Les clés sont courtes pour que le lien reste lisible dans une conversation ; tout ce qui est absent garde sa valeur par défaut.
 */
export interface ShareState {
  /** Libellés des villes de départ (résolus côté serveur à l'ouverture). */
  departures: string[];
  includeNearby: boolean;
  excludedNearby: string[];
  dateMode: DateMode;
  month: string;
  duration: DurationPreset;
  dateOut: string;
  dateIn: string;
  travelers: number;
  budget: number;
  modes: Record<TransportMode, boolean>;
  directOnly: boolean;
  vibes: VibeId[];
  view: ViewMode;
  /** Identifiant de la destination dont la fiche est ouverte. */
  open: string | null;
}

export type SharedInput = Partial<ShareState>;

const MODES: TransportMode[] = ["plane", "train", "bus", "car"];
const DURATIONS = new Set<string>(["weekend", "long", "week"]);
const VIEWS = new Set<string>(["grid", "swipe", "map"]);
const VIBE_IDS = new Set<string>(VIBES.map((v) => v.id));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;

export function encodeShare(s: ShareState): string {
  const p = new URLSearchParams();
  if (s.departures.length) p.set("d", s.departures.join(","));
  if (!s.includeNearby) p.set("n", "0");
  if (s.excludedNearby.length) p.set("x", s.excludedNearby.join(","));
  if (s.dateMode === "fixed") {
    p.set("o", s.dateOut);
    p.set("r", s.dateIn);
  } else {
    p.set("m", s.month);
    p.set("du", s.duration);
  }
  p.set("t", String(s.travelers));
  p.set("b", String(s.budget));
  const off = MODES.filter((m) => !s.modes[m]);
  if (off.length) p.set("off", off.join(","));
  if (s.directOnly) p.set("dir", "1");
  if (s.vibes.length) p.set("v", s.vibes.join(","));
  if (s.view !== "grid") p.set("view", s.view);
  if (s.open) p.set("open", s.open);
  return p.toString();
}

/** Forme des searchParams tels que Next les fournit à une page. */
export type RawParams = Record<string, string | string[] | undefined>;

const one = (raw: RawParams, key: string): string | undefined => {
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
};
const list = (raw: RawParams, key: string): string[] =>
  (one(raw, key) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Lit l'URL avec méfiance : toute valeur hors bornes ou mal formée est ignorée. */
export function decodeShare(raw: RawParams): SharedInput {
  const out: SharedInput = {};
  const d = list(raw, "d").slice(0, 6);
  if (d.length) out.departures = d;
  if (one(raw, "n") === "0") out.includeNearby = false;
  const x = list(raw, "x")
    .map((s) => s.toUpperCase())
    .filter((s) => /^[A-Z]{3}$/.test(s));
  if (x.length) out.excludedNearby = x;
  const o = one(raw, "o");
  const r = one(raw, "r");
  const m = one(raw, "m");
  if (o && r && ISO.test(o) && ISO.test(r)) {
    out.dateMode = "fixed";
    out.dateOut = o;
    out.dateIn = r;
  } else if (m && YM.test(m)) {
    out.dateMode = "flex";
    out.month = m;
  }
  const du = one(raw, "du");
  if (du && DURATIONS.has(du)) out.duration = du as DurationPreset;
  const t = Number(one(raw, "t"));
  if (Number.isInteger(t) && t >= 1 && t <= 8) out.travelers = t;
  const b = Number(one(raw, "b"));
  if (Number.isFinite(b) && b >= 100 && b <= 1000) out.budget = Math.round(b / 10) * 10;
  const off = new Set(list(raw, "off"));
  if (off.size) out.modes = Object.fromEntries(MODES.map((mode) => [mode, !off.has(mode)])) as Record<TransportMode, boolean>;
  if (one(raw, "dir") === "1") out.directOnly = true;
  const v = list(raw, "v").filter((id) => VIBE_IDS.has(id)) as VibeId[];
  if (v.length) out.vibes = v;
  const view = one(raw, "view");
  if (view && VIEWS.has(view)) out.view = view as ViewMode;
  const open = one(raw, "open");
  if (open && /^[a-z]{3}$/.test(open)) out.open = open;
  return out;
}
