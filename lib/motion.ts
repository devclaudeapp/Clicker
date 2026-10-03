import { flushSync } from "react-dom";

/** Durées du système de mouvement, en millisecondes ; mêmes valeurs que les jetons CSS --dur-1, --dur-2 et --dur-3. */
export const MOTION = { micro: 160, component: 280, overlay: 420 } as const;

let reducedQuery: MediaQueryList | null = null;

/** Vrai quand l'utilisateur demande moins de mouvement ; la requête média n'est créée qu'une fois. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  reducedQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedQuery.matches;
}

/** Durée effective d'une animation : nulle quand le mouvement est réduit. */
export const motionMs = (ms: number): number => (prefersReducedMotion() ? 0 : ms);

interface ViewTransitionDocument {
  startViewTransition?: (update: () => void) => unknown;
}

/**
 * Applique une mise à jour d'état dans une transition de vue : les éléments qui portent un `view-transition-name`
 * glissent vers leur nouvelle place, ceux qui disparaissent s'estompent. Sans l'API, ou en mouvement réduit, la mise à
 * jour est appliquée directement.
 */
export function withViewTransition(update: () => void): void {
  const doc = typeof document !== "undefined" ? (document as unknown as ViewTransitionDocument) : null;
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
