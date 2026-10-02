// Scénario de fumée dans un vrai Chromium : parcours bureau et mobile, lien partagé, captures d'écran.
// Prérequis : un serveur qui tourne (npm run dev ou npm run build && npm start) et Chromium pour Playwright
// (npx playwright install chromium, ou CHROME_EXE=/chemin/vers/chrome). Usage : npm run e2e [-- http://localhost:3000]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? process.env.BASE ?? "http://localhost:3000";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE || undefined });
const report = [];
const problems = [];
const check = (label, ok, detail = "") => {
  report.push(`${ok ? "✓" : "✗"} ${label}${detail ? ` · ${detail}` : ""}`);
  if (!ok) problems.push(label);
};

async function session(name, viewport, steps) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 600, isMobile: viewport.width < 600, locale: "fr-FR", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${name}] erreur de page : ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`[${name}] console : ${m.text().slice(0, 200)}`);
  });
  try {
    await steps(page);
  } catch (e) {
    problems.push(`[${name}] ${e.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

const waitCards = (page) => page.waitForSelector(".card", { timeout: 20000 });

await session("bureau", { width: 1360, height: 900 }, async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await waitCards(page);
  const cards = await page.locator(".card").count();
  check("grille : des escapades s'affichent", cards > 10, `${cards} cartes`);
  check("largeur du document", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  await page.screenshot({ path: join(OUT, "bureau-grille.png") });

  await page.locator(".card .btn").first().click();
  await page.waitForSelector(".drawer");
  const links = await page.locator(".drawer a[href^='https://']").count();
  check("fiche : liens de réservation", links >= 8, `${links} liens`);
  await page.screenshot({ path: join(OUT, "bureau-fiche.png") });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Carte" }).click();
  await page.waitForSelector(".map .mk");
  await page.locator(".map .mk").first().hover();
  await page.waitForTimeout(300);
  check("carte : bulles et arc au survol", (await page.locator(".map .mk").count()) > 10 && (await page.locator(".map .arc").count()) === 1);
  await page.screenshot({ path: join(OUT, "bureau-carte.png") });

  await page.getByRole("button", { name: "Swipe" }).click();
  await page.waitForSelector(".sc");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  check("swipe : flèche droite ajoute un favori", (await page.locator("header nav .num").first().innerText()) === "1");

  await page.locator("header nav button").last().click();
  await page.waitForSelector(".modal");
  await page.fill("#add-city-input", "Marseille");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.waitForTimeout(800);
  check("réglages : ajout d'une ville", (await page.locator(".dep h4").allInnerTexts()).some((t) => t.includes("Marseille")));
  await page.screenshot({ path: join(OUT, "bureau-villes.png") });
});

await session("partage", { width: 1360, height: 900 }, async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const month = await page.locator("#month option").first().getAttribute("value");
  await page.goto(`${BASE}/?d=Paris,Lille&m=${month}&du=long&t=3&b=500&v=city&view=map&open=lon`, { waitUntil: "networkidle" });
  await page.waitForSelector(".drawer", { timeout: 20000 });
  check("lien partagé : villes", (await page.locator("header nav .lbl").innerText()) === "Paris · Lille");
  check("lien partagé : fiche ouverte", (await page.locator(".drawer h2").innerText()) === "Londres");
  check("lien partagé : vue, voyageurs, budget", (await page.locator('.view button[aria-pressed="true"]').innerText()) === "Carte" && (await page.locator(".stepper output").innerText()) === "3" && (await page.locator("#budget").inputValue()) === "500");
  await page.keyboard.press("Escape");
  await page.locator('.stepper button[aria-label="Un voyageur de plus"]').click();
  await page.waitForTimeout(600);
  check("l'adresse suit la recherche", (await page.evaluate(() => location.search)).includes("t=4"));
});

await session("mobile", { width: 390, height: 844 }, async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await waitCards(page);
  check("mobile : pas de débordement horizontal", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  await page.screenshot({ path: join(OUT, "mobile-grille.png") });
  await page.locator(".fab").click();
  await page.waitForTimeout(500);
  check("mobile : feuille de recherche", await page.locator(".rail.open").isVisible());
  await page.screenshot({ path: join(OUT, "mobile-recherche.png") });
  await page.locator(".rail .close").first().click();
  await page.locator(".card .btn").first().click();
  await page.waitForSelector(".drawer");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "mobile-fiche.png") });
});

await browser.close();
const summary = [...report, ...problems.map((p) => `✗ ${p}`)].join("\n");
writeFileSync(join(OUT, "rapport.txt"), summary);
console.log(summary);
console.log(problems.length ? `\n${problems.length} problème(s). Captures dans ${OUT}` : `\nTout est passé. Captures dans ${OUT}`);
process.exit(problems.length ? 1 : 0);
