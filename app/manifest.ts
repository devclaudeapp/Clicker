import type { MetadataRoute } from "next";

/** Manifeste PWA : l'app s'ajoute à l'écran d'accueil et s'ouvre sans barre d'adresse. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Escapade",
    short_name: "Escapade",
    description: "Où partir ce week-end depuis tes villes, au meilleur prix, en dix secondes.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#070a12",
    theme_color: "#070a12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
