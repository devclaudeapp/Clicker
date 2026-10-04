import type { Metadata } from "next";
import EscapadeApp from "@/components/EscapadeApp";
import { nextMonths } from "@/lib/dates";
import { eur, fmtLong, listFr } from "@/lib/format";
import { DEFAULT_DEPARTURES, resolveDeparture } from "@/lib/places";
import { paramsFromShared, searchTrips } from "@/lib/search-server";
import { decodeShare, type RawParams } from "@/lib/share";

// La liste des mois dépend de la date du jour et l'URL peut porter une recherche partagée : rendu à chaque requête.
export const dynamic = "force-dynamic";

const SHARE_KEYS = ["d", "n", "x", "m", "du", "o", "r", "t", "b", "off", "dir", "v", "view", "open"];
const MODE_LABEL = { plane: "avion", train: "train", bus: "bus", car: "covoiturage" } as const;

/** Titre, description et image d'aperçu adaptés au lien : une escapade précise ou la recherche entière. */
export async function generateMetadata(props: PageProps<"/">): Promise<Metadata> {
  const raw: RawParams = await props.searchParams;
  const qs = new URLSearchParams();
  for (const k of SHARE_KEYS) {
    const v = raw[k];
    if (typeof v === "string" && v) qs.set(k, v);
  }
  const shared = decodeShare(raw);
  const image = `/api/og${qs.size ? `?${qs}` : ""}`;
  let title = "Escapade";
  let description = "Où partir ce week-end depuis tes villes, au meilleur prix, en dix secondes.";
  if (shared.open) {
    try {
      const params = paramsFromShared(shared);
      const trip = (await searchTrips(params, { only: [shared.open] })).trips.find((t) => t.destination.id === shared.open);
      if (trip) {
        title = `${trip.destination.city} dès ${trip.estimated ? "~" : ""}${eur(trip.perPerson)} par personne`;
        description = `${fmtLong(trip.window.out)} → ${fmtLong(trip.window.ret)} · ${MODE_LABEL[trip.best.mode]} depuis ${listFr(params.departures.map((d) => d.label))} + ${trip.window.nights} nuits · ${eur(trip.total)} pour ${params.travelers}.`;
      }
    } catch {
      // Sans prix, on garde le titre générique : la page reste partageable.
    }
  }
  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "fr_FR", siteName: "Escapade", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Home(props: PageProps<"/">) {
  const months = nextMonths(6);
  const shared = decodeShare(await props.searchParams);
  const initialDepartures = DEFAULT_DEPARTURES.map(resolveDeparture).filter((d) => d !== null);
  const sharedDepartures = (shared.departures ?? []).map(resolveDeparture).filter((d) => d !== null);
  return <EscapadeApp initialDepartures={initialDepartures} months={months} shared={shared} sharedDepartures={sharedDepartures} />;
}
