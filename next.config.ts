import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les polices de l'image d'aperçu sont lues sur le disque par /api/og : on les embarque dans le déploiement.
  outputFileTracingIncludes: { "/api/og": ["./assets/fonts/*.woff"] },
  // Le bouton de développement de Next, en bas à gauche, recouvrait l'onglet « Grille » de la barre du téléphone.
  devIndicators: false,
};

export default nextConfig;
