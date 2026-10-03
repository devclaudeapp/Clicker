"use client";

import { useSyncExternalStore } from "react";

const subscribe = (query: string) => (onChange: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};

/** Vrai quand la requête média correspond ; faux au rendu serveur et avant l'hydratation. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Mise en page téléphone : feuilles du bas, bouton flottant (même seuil que le CSS). */
export const useIsMobile = (): boolean => useMediaQuery("(max-width: 880px)");
