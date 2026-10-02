// Génère les icônes PNG (manifeste PWA, écran d'accueil iOS) à partir de app/icon.svg, avec le Chromium de Playwright.
// Usage : node scripts/build-icons.mjs   (CHROME_EXE=/chemin/vers/chrome pour forcer un binaire)
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "app", "icon.svg"), "utf8");
const out = join(root, "public", "icons");
mkdirSync(out, { recursive: true });

// L'icône « maskable » garde une marge de sécurité : le logo occupe 80 % du carré, le fond remplit tout.
const page = (size, maskable) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${maskable ? "#FF7F68" : "transparent"}}
  body{width:${size}px;height:${size}px;display:grid;place-items:center}svg{width:${maskable ? size * 0.8 : size}px;height:${maskable ? size * 0.8 : size}px}</style>${svg}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE || undefined });
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const tab = await ctx.newPage();
const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];
for (const [name, size, maskable] of targets) {
  await tab.setViewportSize({ width: size, height: size });
  await tab.setContent(page(size, maskable));
  await tab.screenshot({ path: join(out, name), omitBackground: !maskable, type: "png" });
  console.log("écrit", join("public", "icons", name));
}
await browser.close();
