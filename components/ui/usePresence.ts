"use client";

import { useEffect, useState } from "react";
import { motionMs } from "@/lib/motion";

export type PresencePhase = "open" | "exit";

/**
 * Garde un élément monté le temps de son animation de sortie. `open` est l'intention, `mounted` dit s'il faut rendre
 * l'élément, `phase` vaut « exit » pendant la fermeture (classe `is-exiting` côté CSS). En mouvement réduit, la sortie
 * est immédiate.
 */
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; phase: PresencePhase } {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<PresencePhase>(open ? "open" : "exit");
  // État dérivé pendant le rendu : l'ouverture monte aussitôt, la fermeture passe par la phase de sortie.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMounted(true);
      setPhase("open");
    } else {
      setPhase("exit");
    }
  }
  useEffect(() => {
    if (open || !mounted) return;
    const t = window.setTimeout(() => setMounted(false), motionMs(exitMs));
    return () => window.clearTimeout(t);
  }, [open, mounted, exitMs]);
  return { mounted, phase };
}
