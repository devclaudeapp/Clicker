import { describe, expect, it } from "vitest";
import type { Photo } from "@/types";
import { DESTINATIONS } from "./data/destinations";
import { PHOTOS } from "./data/photos";
import { photoCredit, photoFor, photoUrl } from "./photos";

const sample: Photo = {
  src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Evening_light_over_Barcelona.jpg/1280px-Evening_light_over_Barcelona.jpg",
  w: 1280,
  h: 853,
  widths: [500, 960, 1280],
  author: "Jorge Franganillo",
  license: "CC BY 2.0",
  page: "https://commons.wikimedia.org/wiki/File:Evening_light_over_Barcelona.jpg",
};

describe("photos des destinations", () => {
  it("photoUrl : se cale sur une largeur disponible, sans jamais en inventer", () => {
    const base = "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Evening_light_over_Barcelona.jpg/";
    expect(photoUrl(sample, 320)).toBe(`${base}500px-Evening_light_over_Barcelona.jpg`);
    expect(photoUrl(sample, 500)).toBe(`${base}500px-Evening_light_over_Barcelona.jpg`);
    expect(photoUrl(sample, 640)).toBe(`${base}960px-Evening_light_over_Barcelona.jpg`);
    expect(photoUrl(sample, 1280)).toBe(sample.src);
    expect(photoUrl(sample, 2560)).toBe(sample.src);
    const small = { ...sample, w: 500, widths: [500], src: `${base}500px-Evening_light_over_Barcelona.jpg` };
    expect(photoUrl(small, 1280)).toBe(small.src);
    const tif = { ...sample, src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Floating_city.tif/lossy-page1-1280px-Floating_city.tif.jpg" };
    expect(photoUrl(tif, 500)).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Floating_city.tif/lossy-page1-500px-Floating_city.tif.jpg");
  });

  it("photoCredit et photoFor", () => {
    expect(photoCredit(sample)).toBe("Photo : Jorge Franganillo · CC BY 2.0");
    expect(photoCredit({ ...sample, license: "" })).toBe("Photo : Jorge Franganillo");
    expect(photoFor("bcn")?.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(photoFor("xyz")).toBeNull();
  });

  it("données générées : une miniature créditée, aux largeurs vérifiées, par destination connue", () => {
    const ids = new Set(DESTINATIONS.map((d) => d.id));
    const entries = Object.entries(PHOTOS);
    expect(entries.length).toBeGreaterThanOrEqual(40);
    for (const [id, p] of entries) {
      expect(ids.has(id), `${id} n'est pas une destination`).toBe(true);
      expect(p.src, id).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\/.*\/\d+px-[^?]+$/);
      expect(p.src, id).toContain(`/${p.w}px-`);
      expect(p.page, id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.author.length, id).toBeGreaterThan(0);
      expect(p.license.length, id).toBeGreaterThan(0);
      expect(p.widths.length, id).toBeGreaterThan(0);
      expect([...p.widths].sort((a, b) => a - b), id).toEqual(p.widths);
      expect(p.widths[p.widths.length - 1], id).toBe(p.w);
      expect(p.w, id).toBeGreaterThanOrEqual(500);
      expect(p.h, id).toBeGreaterThan(0);
    }
  });
});
