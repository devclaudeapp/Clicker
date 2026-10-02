import { mockProvider } from "./mock";
import { createTravelpayoutsProvider } from "./travelpayouts";
import type { PriceProvider } from "./types";

let travelpayouts: PriceProvider | null = null;
let warned = false;

/**
 * Fournisseur actif, choisi par PRICE_PROVIDER : « mock » (défaut, prix fictifs) ou « travelpayouts » (prix réels en cache).
 * Sans TRAVELPAYOUTS_TOKEN, on retombe sur le mock en le signalant une fois dans les logs serveur.
 */
export function getProvider(): PriceProvider {
  const name = (process.env.PRICE_PROVIDER ?? "mock").toLowerCase();
  if (name === "travelpayouts") {
    if (!process.env.TRAVELPAYOUTS_TOKEN) {
      if (!warned) {
        console.warn("[providers] PRICE_PROVIDER=travelpayouts mais TRAVELPAYOUTS_TOKEN est vide : prix fictifs utilisés (voir docs/APIS.md).");
        warned = true;
      }
      return mockProvider;
    }
    travelpayouts ??= createTravelpayoutsProvider();
    return travelpayouts;
  }
  return mockProvider;
}

export type { FareQuery, PriceProvider } from "./types";
