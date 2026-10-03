import type { NextRequest } from "next/server";
import type { GroupType, VibeId } from "@/types";
import { ACTIVITIES_BY_DEST } from "@/lib/data/activities";
import { DESTINATIONS } from "@/lib/data/destinations";
import { DEFAULT_AGES, DEFAULT_GROUP, GROUP_IDS, normalizeAges } from "@/lib/data/profile";
import { VIBES } from "@/lib/data/vibes";
import { isValidISO } from "@/lib/dates";
import { parseISO } from "@/lib/format";
import { planTrip } from "@/lib/planner";

const VIBE_IDS = new Set<string>(VIBES.map((v) => v.id));
const int = (v: string | null, min: number, max: number, fallback: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const list = (v: string | null): string[] => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * GET /api/plan?dest=bcn&out=2026-11-13&nights=2&g=friends&a=young&v=party,beach&t=4&seed=0
 * Compose le programme d'activités d'une escapade pour un profil. Le catalogue reste côté serveur ;
 * la réponse est déterministe pour des paramètres donnés, donc mise en cache.
 */
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const destId = q.get("dest") ?? "";
  const dest = DESTINATIONS.find((d) => d.id === destId);
  const activities = ACTIVITIES_BY_DEST[destId];
  if (!dest || !activities) return Response.json({ error: "Destination inconnue." }, { status: 404 });
  const out = q.get("out") ?? "";
  if (!isValidISO(out)) return Response.json({ error: "Date de départ invalide." }, { status: 400 });
  const nights = int(q.get("nights"), 1, 30, 0);
  if (!nights) return Response.json({ error: "Nombre de nuits invalide." }, { status: 400 });

  const g = q.get("g");
  const ages = normalizeAges(list(q.get("a")));
  const vibes = list(q.get("v")).filter((v) => VIBE_IDS.has(v)) as VibeId[];
  const itinerary = planTrip(activities, {
    nights,
    out,
    temp: dest.temps[parseISO(out).getUTCMonth()],
    seed: int(q.get("seed"), 0, 9999, 0),
    profile: {
      group: g && GROUP_IDS.has(g) ? (g as GroupType) : DEFAULT_GROUP,
      ages: ages.length ? ages : DEFAULT_AGES,
      vibes,
      travelers: int(q.get("t"), 1, 8, 2),
    },
  });
  return Response.json({ itinerary }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
