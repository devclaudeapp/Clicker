import EscapadeApp from "@/components/EscapadeApp";
import { nextMonths } from "@/lib/dates";
import { DEFAULT_DEPARTURES, resolveDeparture } from "@/lib/places";

// La liste des mois dépend de la date du jour : la page se rend à chaque requête plutôt qu'au build.
export const dynamic = "force-dynamic";

export default function Home() {
  const months = nextMonths(6);
  const initialDepartures = DEFAULT_DEPARTURES.map(resolveDeparture).filter((d) => d !== null);
  return <EscapadeApp initialDepartures={initialDepartures} months={months} />;
}
