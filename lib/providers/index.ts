import { mockProvider } from "./mock";
import type { PriceProvider } from "./types";

/**
 * Fournisseur actif, choisi par la variable d'environnement PRICE_PROVIDER (« mock » par défaut).
 * Le fournisseur Travelpayouts arrive avec l'étape « adaptateurs de prix » ; en attendant toute autre valeur retombe sur le mock.
 */
export function getProvider(): PriceProvider {
  return mockProvider;
}

export type { FareQuery, PriceProvider } from "./types";
