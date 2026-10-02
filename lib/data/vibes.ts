import type { VibeId } from "@/types";

export interface Vibe {
  id: VibeId;
  label: string;
  /** Nom d'icône Lucide (voir components/ui/Icon). */
  icon: string;
}

/** Envies proposées sous le titre : les six premières sont les plus concrètes, les suivantes plus généralistes. */
export const VIBES: Vibe[] = [
  { id: "sun", label: "Soleil", icon: "sun" },
  { id: "chill", label: "Chill", icon: "armchair" },
  { id: "culture", label: "Culture", icon: "landmark" },
  { id: "party", label: "Fête", icon: "party" },
  { id: "city", label: "City trip", icon: "building" },
  { id: "beach", label: "Plage", icon: "waves" },
  { id: "nature", label: "Nature", icon: "mountain" },
  { id: "food", label: "Food", icon: "utensils" },
  { id: "love", label: "Romantique", icon: "heart" },
  { id: "friends", label: "Entre potes", icon: "users" },
  { id: "shop", label: "Shopping", icon: "bag" },
  { id: "exotic", label: "Dépaysement", icon: "compass" },
];

export const VIBE_BY_ID: Record<VibeId, Vibe> = Object.fromEntries(VIBES.map((v) => [v.id, v])) as Record<VibeId, Vibe>;
