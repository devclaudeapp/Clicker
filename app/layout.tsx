import type { Metadata, Viewport } from "next";
import "@fontsource-variable/unbounded";
import "@fontsource-variable/manrope";
import "./globals.css";
import { TravelpayoutsDrive } from "@/components/TravelpayoutsDrive";

/** Base des URL absolues (images d'aperçu) : le domaine public en production, Vercel ou localhost sinon. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Escapade", template: "%s · Escapade" },
  description: "Où partir ce week-end depuis tes villes, au meilleur prix, en dix secondes.",
  applicationName: "Escapade",
  // Déclaré explicitement : un objet `icons` dans les métadonnées remplace la convention de fichier app/icon.svg.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Escapade" },
};

export const viewport: Viewport = {
  themeColor: "#070a12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
            <body className="min-h-full flex flex-col">
        <TravelpayoutsDrive />
        <link rel="preconnect" href="https://upload.wikimedia.org" />
        <link rel="preconnect" href="https://thumb.wikimedia.org" />
        {/* Aurores animées en fond, derrière toute la page */}
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {children}
      </body>
    </html>
  );
}
