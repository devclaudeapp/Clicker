import type { NextRequest } from "next/server";
import { resolveDeparture, suggestCities } from "@/lib/places";

/**
 * GET /api/places?q=lyo        → suggestions de villes
 * GET /api/places?resolve=Lyon → point de départ complet (aéroports principaux, voisins à ~2 h, gares)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const resolve = sp.get("resolve");
  if (resolve !== null) {
    const departure = resolveDeparture(resolve);
    if (!departure) return Response.json({ error: "Ville inconnue." }, { status: 404 });
    return Response.json({ departure });
  }
  const q = sp.get("q") ?? "";
  return Response.json({ suggestions: suggestCities(q) });
}
