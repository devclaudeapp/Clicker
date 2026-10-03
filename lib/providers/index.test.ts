import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider } from "./index";

afterEach(() => vi.unstubAllEnvs());

describe("choix du fournisseur de prix", () => {
  it("prix fictifs par défaut et pour toute valeur inconnue de PRICE_PROVIDER", () => {
    vi.stubEnv("PRICE_PROVIDER", "");
    expect(getProvider().name).toBe("mock");
    vi.stubEnv("PRICE_PROVIDER", "amadeus");
    expect(getProvider().name).toBe("mock");
  });

  it("travelpayouts sans jeton retombe sur les prix fictifs en prévenant une seule fois", () => {
    vi.stubEnv("PRICE_PROVIDER", "travelpayouts");
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getProvider().name).toBe("mock");
    expect(getProvider().name).toBe("mock");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("travelpayouts avec jeton, quelle que soit la casse", () => {
    vi.stubEnv("PRICE_PROVIDER", "Travelpayouts");
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "T");
    expect(getProvider().name).toBe("travelpayouts");
  });
});
