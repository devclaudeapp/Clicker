import type { Fare } from "@/types";
import { hash } from "../format";
import { seasonMultiplier } from "../pricing";
import type { FareQuery, PriceProvider } from "./types";

/** Variation stable de ±14 % autour du tarif de référence, propre à chaque destination et chaque fenêtre. */
const jitter = (key: string): number => 0.9 + hash(key) * 0.28;

/** Fournisseur de prix fictifs : tarifs de référence × saison × variation stable. Aucun appel réseau. */
export const mockProvider: PriceProvider = {
  name: "mock",
  async fares(q: FareQuery): Promise<Fare[]> {
    const origins = new Set(q.origins);
    const out: Fare[] = [];
    for (const dest of q.destinations) {
      for (const w of q.windows) {
        const mult = seasonMultiplier(w.monthIndex, w.nights) * jitter(`${dest.iata}|${w.key}`);
        for (const f of dest.fares) {
          if (!origins.has(f.origin)) continue;
          if (q.directOnly && !f.direct) continue;
          out.push({ origin: f.origin, destId: dest.id, windowKey: w.key, price: Math.round(f.price * mult), airline: f.airline, duration: f.duration, direct: f.direct });
        }
      }
    }
    return out;
  },
};
