// Génère lib/data/flixbus.ts : l'identifiant FlixBus de chaque ville de départ (lib/data/cities.ts) et de chaque
// destination (lib/data/destinations.ts), via l'autocomplétion publique du site FlixBus. Sans identifiant, la boutique
// FlixBus ne pré-remplit pas la recherche ; les villes absentes du réseau (îles, Maghreb) gardent la page de ligne.
// Usage : node scripts/build-flixbus.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://global.api.flixbus.com/search/autocomplete/cities";
const UA = "Mozilla/5.0 (compatible; escapade-build-flixbus)";

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Pays des destinations, tels qu'écrits dans lib/data/destinations.ts, vers le code ISO utilisé par FlixBus. */
const COUNTRY = {
  Allemagne: "de", Autriche: "at", Belgique: "be", Croatie: "hr", Danemark: "dk", Écosse: "gb", Espagne: "es", France: "fr",
  Grèce: "gr", Hongrie: "hu", Irlande: "ie", Islande: "is", Italie: "it", Malte: "mt", Maroc: "ma", Norvège: "no",
  "Pays-Bas": "nl", Pologne: "pl", Portugal: "pt", "Royaume-Uni": "gb", Suède: "se", Tchéquie: "cz", Tunisie: "tn", Turquie: "tr",
};

const read = (file) => readFileSync(join(root, "lib", "data", file), "utf8");
const cities = [...read("cities.ts").matchAll(/label: "([^"]+)", en: "([^"]+)", country: "([A-Z]{2})"/g)].map((m) => ({ fr: m[1], en: m[2], country: m[3].toLowerCase() }));
const destinations = [...read("destinations.ts").matchAll(/city: "([^"]+)", en: "([^"]+)", country: "([^"]+)"/g)].map((m) => {
  const country = COUNTRY[m[3]];
  if (!country) throw new Error(`Pays inconnu dans destinations.ts : ${m[3]}`);
  return { fr: m[1], en: m[2], country };
});

async function lookup(query, country) {
  const url = `${API}?q=${encodeURIComponent(query)}&lang=fr&country=${country}&flixbus_cities_only=true`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`FlixBus ${res.status} pour ${query}`);
  return res.json();
}

/** Une ville correspond quand le pays est le bon et que le nom (sans sa parenthèse) est celui cherché. */
const matches = (hit, names, country) => hit.country === country && names.includes(slugify(hit.name.replace(/\s*\(.*\)$/, "")));

const out = {};
const missing = [];
for (const c of [...cities, ...destinations]) {
  const key = slugify(c.en);
  if (out[key]) continue;
  const names = [slugify(c.fr), slugify(c.en)];
  let hit = null;
  for (const q of [c.fr, c.en]) {
    hit = (await lookup(q, c.country)).find((h) => matches(h, names, c.country)) ?? null;
    if (hit) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  if (hit) out[key] = hit.id;
  else missing.push(`${c.fr} (${c.country})`);
}

const lines = Object.entries(out).map(([k, id]) => `  "${k}": "${id}",`);
const file = `/**
 * Identifiants FlixBus des villes connues, par nom anglais en minuscules (clé = slugify(en)) : ils servent à pré-remplir
 * la recherche de la boutique FlixBus. Généré par scripts/build-flixbus.mjs ; les villes absentes ne sont pas desservies.
 */
export const FLIXBUS_CITY: Record<string, string> = {
${lines.join("\n")}
};
`;
writeFileSync(join(root, "lib", "data", "flixbus.ts"), file);
console.log(`${lines.length} villes écrites dans lib/data/flixbus.ts`);
if (missing.length) console.log(`Sans identifiant FlixBus : ${missing.join(", ")}`);
