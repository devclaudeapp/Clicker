import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTION, motionMs, prefersReducedMotion, withViewTransition } from "./motion";

afterEach(() => vi.unstubAllGlobals());

describe("système de mouvement", () => {
  it("sans navigateur : pas de mouvement réduit, durées nominales", () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(motionMs(MOTION.overlay)).toBe(420);
  });

  it("withViewTransition : applique directement la mise à jour sans l'API", () => {
    vi.stubGlobal("document", {});
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("withViewTransition : passe par l'API quand elle existe", () => {
    const startViewTransition = vi.fn((cb: () => void) => cb());
    vi.stubGlobal("document", { startViewTransition });
    const update = vi.fn();
    withViewTransition(update);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
