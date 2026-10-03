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
  const mobile = viewport.width < 600;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, locale: "fr-FR", reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
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
  const links = await page.locator(".drawer a[href^='https://']").evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.href]));
  check("fiche : liens de réservation", links.length >= 12, `${links.length} liens`);
  // Formats vérifiés à la main dans un navigateur : voir lib/links.ts.
  const linkIs = (label, re) => links.some(([t, h]) => t.includes(label) && re.test(h));
  check("fiche : formats des liens", linkIs("Google Flights", /\?tfs=[A-Za-z0-9%]+&hl=fr/) && linkIs("Trainline", /trainline\.fr\/search\/[a-z-]+\/[a-z-]+\/\d{4}-\d\d-\d\d\/\d{4}-\d\d-\d\d$/) && linkIs("FlixBus", /shop\.flixbus\.fr\/search\?.*rideDate=\d\d\.\d\d\.\d{4}&backRideDate=.*&adult=\d/) && linkIs("Aviasales", /currency=eur/));
  await page.waitForSelector(".drawer .plan .day", { timeout: 10000 });
  const days = await page.locator(".drawer .plan .day").count();
  const acts = await page.locator(".drawer .plan .days .act:not(.free)").count();
  check("fiche : programme d'activités", days === 3 && acts >= 3 && (await page.locator(".budget tr.extra").count()) === 1, `${days} jours, ${acts} activités`);
  const before = await page.locator(".drawer .plan .days").innerText();
  await page.getByRole("button", { name: "Remélanger" }).click();
  await page.waitForTimeout(600);
  check("fiche : Remélanger", (await page.locator(".drawer .plan .days").innerText()) !== before);
  await page.screenshot({ path: join(OUT, "bureau-fiche.png") });
  await page.keyboard.press("Escape");

  // « Qui part ? » : famille avec enfants, le programme n'a plus de soirée en boîte ni de bar.
  await page.locator(".rail .chip", { hasText: "Famille" }).click();
  await page.locator(".rail .chip.sm", { hasText: "Enfants" }).click();
  await page.locator(".card .btn").first().click();
  await page.waitForSelector(".drawer .plan .day");
  const kinds = await page.locator(".drawer .plan .days .tag").allInnerTexts();
  check("profil famille : programme adapté", kinds.length > 0 && !kinds.some((k) => k === "Soirée" || k === "Verre"), `${kinds.length} étiquettes`);
  await page.waitForTimeout(500); // l'adresse suit la recherche avec un léger délai
  check("profil famille : dans l'adresse", (await page.evaluate(() => location.search)).includes("g=family"));
  await page.keyboard.press("Escape");
  await page.locator(".rail .chip", { hasText: "Potes" }).click();
  await page.locator(".rail .chip.sm", { hasText: "Enfants" }).click();

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
  await page.goto(`${BASE}/?d=Paris,Lille&m=${month}&du=long&t=3&b=500&g=couple&a=adults&v=city&view=map&open=lon`, { waitUntil: "networkidle" });
  await page.waitForSelector(".drawer", { timeout: 20000 });
  check("lien partagé : villes", (await page.locator("header nav .lbl").innerText()) === "Paris · Lille");
  check("lien partagé : fiche ouverte", (await page.locator(".drawer h2").innerText()) === "Londres");
  check("lien partagé : vue, voyageurs, budget", (await page.locator('.view button[aria-pressed="true"]').innerText()) === "Carte" && (await page.locator(".stepper output").innerText()) === "3" && (await page.locator("#budget").inputValue()) === "500");
  check("lien partagé : qui part", (await page.locator(".rail .chip.on", { hasText: "Couple" }).count()) === 1 && (await page.locator(".rail .chip.sm.on").allInnerTexts()).join() === "30–50");
  await page.keyboard.press("Escape");
  await page.locator('.stepper button[aria-label="Un voyageur de plus"]').click();
  await page.waitForTimeout(600);
  check("l'adresse suit la recherche", (await page.evaluate(() => location.search)).includes("t=4"));

  // « Partager » copie un lien ; ouvert dans un contexte vierge (fenêtre privée), il rejoue la recherche à l'identique.
  await page.getByRole("button", { name: "Partager" }).click();
  await page.waitForTimeout(300);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "fr-FR" });
  const replay = await fresh.newPage();
  await replay.goto(copied, { waitUntil: "networkidle" });
  await replay.waitForSelector(".map .mk", { timeout: 20000 });
  await replay.waitForTimeout(600);
  check("lien copié : rejoué à l'identique", copied.startsWith(`${BASE}/?`) && new URL(copied).search === (await replay.evaluate(() => location.search)), new URL(copied).search);
  await fresh.close();
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
  await page.waitForTimeout(400);

  // Gestes tactiles réels (protocole Chrome) : swipe d'une carte, pincement sur la carte.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  await page.getByRole("button", { name: "Swipe" }).click();
  await page.waitForSelector(".sc");
  await page.locator(".sc").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const card = await page.locator(".sc").first().boundingBox();
  const cx = card.x + card.width / 2;
  const cy = card.y + card.height / 2;
  await touch("touchStart", [{ x: cx, y: cy }]);
  for (let i = 1; i <= 10; i++) await touch("touchMove", [{ x: cx + i * 22, y: cy }]);
  await touch("touchEnd", []);
  await page.waitForTimeout(700);
  check("mobile : swipe tactile vers la droite = favori", (await page.locator("header nav .num").first().innerText()) === "1");

  await page.getByRole("button", { name: "Carte" }).click();
  await page.waitForSelector(".map .mk");
  const map = await page.locator(".map").boundingBox();
  const mx = map.x + map.width / 2;
  const my = map.y + map.height / 2;
  const viewWidth = async () => Number((await page.locator(".map").getAttribute("viewBox")).split(/\s+/)[2]);
  const before = await viewWidth();
  await touch("touchStart", [{ x: mx - 20, y: my }, { x: mx + 20, y: my }]);
  for (let i = 1; i <= 8; i++) await touch("touchMove", [{ x: mx - 20 - i * 12, y: my }, { x: mx + 20 + i * 12, y: my }]);
  await touch("touchEnd", []);
  await page.waitForTimeout(400);
  check("mobile : pincement = zoom de la carte", (await viewWidth()) < before);

  await page.getByRole("button", { name: "Grille" }).click();
  await page.locator(".card .btn").first().click();
  await page.waitForSelector(".drawer");
  await page.waitForTimeout(400);
  const drawer = await page.locator(".drawer").boundingBox();
  check("mobile : fiche en feuille du bas", drawer.y > 20 && Math.round(drawer.width) === 390 && Math.abs(drawer.y + drawer.height - 844) < 2);
  check("mobile : pas de débordement (fiche)", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  await page.screenshot({ path: join(OUT, "mobile-fiche.png") });
});

await browser.close();
const summary = [...report, ...problems.map((p) => `✗ ${p}`)].join("\n");
writeFileSync(join(OUT, "rapport.txt"), summary);
console.log(summary);
console.log(problems.length ? `\n${problems.length} problème(s). Captures dans ${OUT}` : `\nTout est passé. Captures dans ${OUT}`);
process.exit(problems.length ? 1 : 0);
