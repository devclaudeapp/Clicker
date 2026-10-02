import EscapadeApp from "@/components/EscapadeApp";
import { nextMonths } from "@/lib/dates";
import { DEFAULT_DEPARTURES, resolveDeparture } from "@/lib/places";
import { decodeShare } from "@/lib/share";

// La liste des mois dépend de la date du jour et l'URL peut porter une recherche partagée : rendu à chaque requête.
export const dynamic = "force-dynamic";

export default async function Home(props: PageProps<"/">) {
  const months = nextMonths(6);
  const shared = decodeShare(await props.searchParams);
  const initialDepartures = DEFAULT_DEPARTURES.map(resolveDeparture).filter((d) => d !== null);
  const sharedDepartures = (shared.departures ?? []).map(resolveDeparture).filter((d) => d !== null);
  return <EscapadeApp initialDepartures={initialDepartures} months={months} shared={shared} sharedDepartures={sharedDepartures} />;
}
