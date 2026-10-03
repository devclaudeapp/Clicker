import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les polices de l'image d'aperçu sont lues sur le disque par /api/og : on les embarque dans le déploiement.
  outputFileTracingIncludes: { "/api/og": ["./assets/fonts/*.woff"] },
};

export default nextConfig;
