import type { DateWindow, Destination, Fare } from "@/types";

export interface FareQuery {
  /** Codes IATA des aéroports d'origine utilisables. */
  origins: string[];
  destinations: Destination[];
  windows: DateWindow[];
  directOnly: boolean;
}

/** Un fournisseur renvoie, pour chaque (origine, destination, fenêtre) qu'il connaît, le tarif A/R par personne le moins cher. */
export interface PriceProvider {
  name: string;
  fares(query: FareQuery): Promise<Fare[]>;
}
