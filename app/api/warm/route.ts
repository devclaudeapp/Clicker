import type { NextRequest } from "next/server";
import { runWarm } from "@/lib/warm";

/** Le préchauffage dure plusieurs minutes : plafond de la fonction, et budget en deçà pour finir proprement. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";
const BUDGET_MS = 200_000;

/**
 * GET /api/warm : préchauffe le cache des prix pour les recherches courantes. Appelée chaque nuit par la tâche
 * planifiée Vercel (vercel.json), qui présente « Authorization: Bearer CRON_SECRET » ; sans ce secret, refusée.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Non autorisé", { status: 401 });
  const result = await runWarm(BUDGET_MS);
  console.info(`[warm] ${result.done.length} recherches préchauffées, ${result.skipped.length} reportées, ${result.seconds} s`);
  return Response.json(result);
}
