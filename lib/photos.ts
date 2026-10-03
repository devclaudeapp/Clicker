import type { Photo } from "@/types";
import { PHOTOS } from "./data/photos";

/** Photo d'une destination, ou null quand elle garde son paysage SVG. */
export const photoFor = (id: string): Photo | null => PHOTOS[id] ?? null;

/**
 * Adresse de la miniature pour une largeur d'affichage : la plus petite largeur disponible qui la couvre, sinon la plus
 * grande. Wikimedia ne sert que les largeurs générées par le script (`widths`), jamais une largeur inventée.
 */
export const photoUrl = (p: Photo, width: number): string => {
  const w = p.widths.find((x) => x >= width) ?? p.widths[p.widths.length - 1];
  return w === p.w ? p.src : p.src.replace(/(\/(?:lossy-page1-)?)\d+px-/, `$1${w}px-`);
};

/** « Photo : Nom de l'auteur · CC BY-SA 4.0 ». */
export const photoCredit = (p: Photo): string => `Photo : ${p.author}${p.license ? ` · ${p.license}` : ""}`;
