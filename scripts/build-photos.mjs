// Génère lib/data/photos.ts : une photo libre par destination, avec son attribution, affichée par-dessus le paysage SVG.
// Source : l'image représentative (propriété P18) de l'élément Wikidata de la ville, ou un fichier Commons épinglé dans
// OVERRIDES quand cette image ne convient pas (vue satellite, montage). Les miniatures sont servies par Wikimedia Commons,
// qui ne les fabrique plus à la demande par simple URL : chaque largeur utile est demandée ici par l'API, puis vérifiée.
// Usage : node scripts/build-photos.mjs [--candidats]   (--candidats liste toutes les images P18 de chaque ville, sans écrire)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "escapade-build-photos/0.1 (https://github.com/devclaudeapp/Clicker)";
/** Largeurs de miniature utilisées par l'app : cartes et bulle (500, 960 sur écran dense), fiche (1280). */
const WIDTHS = [500, 960, 1280];
const listOnly = process.argv.includes("--candidats");

/** Titres Wikipédia (en) quand le nom anglais seul est ambigu ou désigne autre chose. */
const TITLE = { fao: "Faro, Portugal", spu: "Split, Croatia", pmi: "Mallorca", mla: "Malta", tfs: "Tenerife", cfu: "Corfu" };
/** Fichiers Commons choisis à la main quand l'image P18 ne convient pas (vue satellite, montage, illustration, original trop petit). */
const OVERRIDES = {
  ams: "Amsterdam Prinsengracht Wallpaper.jpg",
  bru: "Grand-Place, Brussels - panorama, June 2018.jpg",
  fao: "Praia da Marinha 2017.jpg",
  ist: "Historical peninsula and modern skyline of Istanbul.jpg",
  lis: "Alfama Rooftops and Tagus River View, Lisbon (54733828355).jpg",
  pmi: "La Seu, The Cathedral of Santa Maria of Palma (7197921788).jpg",
  sto: "Stockholm Gamla Stan and Riddarholmen 02.jpg",
  tfs: "Teide y roques de García, parque nacional del Teide, Tenerife, España, 2022-01-07, DD 18.jpg",
  vce: "Panorama of Canal Grande and Ponte di Rialto, Venice - September 2017.jpg",
};

const destinations = [...readFileSync(join(root, "lib", "data", "destinations.ts"), "utf8").matchAll(/id: "([a-z]{3})", city: "([^"]+)", en: "([^"]+)"/g)].map((m) => ({ id: m[1], city: m[2], en: m[3] }));

async function api(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${host} a répondu ${res.status}`);
  return res.json();
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const strip = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(parseInt(e[1] === "x" ? e.slice(2) : e.slice(1), e[1] === "x" ? 16 : 10)) : (ENTITIES[e.toLowerCase()] ?? m)))
    .replace(/\s+/g, " ")
    .trim();

/** Toutes les images P18 de la ville, dans l'ordre de Wikidata. */
async function candidates(d) {
  const page = (await api("en.wikipedia.org", { action: "query", prop: "pageprops", titles: TITLE[d.id] ?? d.en, redirects: "1" })).query.pages[0];
  if (!page || page.missing) throw new Error(`${d.id} : page Wikipédia « ${TITLE[d.id] ?? d.en} » introuvable, ajouter un titre dans TITLE`);
  if (page.pageprops?.disambiguation !== undefined) throw new Error(`${d.id} : « ${page.title} » est une page d'homonymie, ajouter un titre dans TITLE`);
  const item = page.pageprops?.wikibase_item;
  if (!item) throw new Error(`${d.id} : pas d'élément Wikidata pour « ${page.title} »`);
  const entity = (await api("www.wikidata.org", { action: "wbgetentities", ids: item, props: "claims" })).entities[item];
  return (entity?.claims?.P18 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
}

/** Miniature d'un fichier à une largeur donnée, demandée à l'API (ce qui la fait générer). Null si Commons renvoie l'original. */
async function thumb(file, width) {
  const i = (await api("commons.wikimedia.org", { action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: String(width), iiextmetadatafilter: "Artist|LicenseShortName|Credit" })).query.pages[0]?.imageinfo?.[0];
  if (!i?.url) return { miss: "fichier Commons introuvable" };
  if (!i.thumburl?.includes("/thumb/")) return { info: i, url: null };
  const u = new URL(i.thumburl);
  return { info: i, url: `${u.origin}${u.pathname}`, w: i.thumbwidth, h: i.thumbheight };
}

/** Photo d'un fichier : toutes les largeurs utiles générées et vérifiées, la plus grande servant de référence. */
async function photoOf(file) {
  if (!/\.(jpe?g|png|webp|tiff?)$/i.test(file)) return { miss: `format non pris en charge (${file.split(".").pop()})` };
  const got = [];
  let info = null;
  for (const width of WIDTHS) {
    const t = await thumb(file, width);
    if (t.miss) return t;
    info = t.info;
    if (!t.url) continue; // original plus petit que cette largeur
    const res = await fetch(t.url, { method: "HEAD", headers: { "user-agent": UA } });
    if (res.ok && /^image\//.test(res.headers.get("content-type") ?? "")) got.push({ width, url: t.url, w: t.w, h: t.h });
  }
  if (!got.length) return { miss: `aucune miniature servie (original ${info?.width ?? "?"} px)` };
  const meta = info.extmetadata ?? {};
  const author = strip(meta.Artist?.value ?? meta.Credit?.value ?? "").slice(0, 80);
  if (!author) return { miss: "auteur inconnu, impossible à créditer" };
  const best = got[got.length - 1];
  return { photo: { src: best.url, w: best.w, h: best.h, widths: got.map((g) => g.width), author, license: meta.LicenseShortName?.value ?? "", page: info.descriptionurl } };
}

const out = {};
const misses = [];
const licenses = {};
let overridden = 0;
for (const d of destinations) {
  const files = await candidates(d);
  if (listOnly) {
    console.log(`${d.id} ${d.city} : ${files.join(" | ") || "(aucune image P18)"}`);
    continue;
  }
  const file = OVERRIDES[d.id] ?? files[0];
  if (OVERRIDES[d.id]) overridden++;
  if (!file) {
    misses.push(`${d.city} : aucune image P18`);
    continue;
  }
  const r = await photoOf(file);
  if (r.photo) {
    out[d.id] = r.photo;
    const l = r.photo.license || "(sans licence)";
    licenses[l] = (licenses[l] ?? 0) + 1;
  } else misses.push(`${d.city} (${file}) : ${r.miss}`);
  await new Promise((r) => setTimeout(r, 150));
}
if (listOnly) process.exit(0);

const esc = JSON.stringify;
const lines = Object.keys(out)
  .sort()
  .map((id) => {
    const p = out[id];
    return `  ${id}: { src: ${esc(p.src)}, w: ${p.w}, h: ${p.h}, widths: [${p.widths.join(", ")}], author: ${esc(p.author)}, license: ${esc(p.license)}, page: ${esc(p.page)} },`;
  });
writeFileSync(
  join(root, "lib", "data", "photos.ts"),
  `import type { Photo } from "@/types";

/**
 * Photo de chaque destination, par identifiant : miniature Wikimedia Commons (image P18 de Wikidata, ou fichier épinglé
 * dans le script), aux largeurs vérifiées, avec l'auteur et la licence à créditer. Généré par scripts/build-photos.mjs ;
 * une destination absente garde son paysage SVG.
 */
export const PHOTOS: Record<string, Photo> = {
${lines.join("\n")}
};
`,
);
const partial = Object.values(out).filter((p) => p.widths.length < WIDTHS.length).length;
console.log(`${lines.length} photos écrites dans lib/data/photos.ts (${overridden} choisies à la main, ${partial} sans toutes les largeurs)`);
console.log(`Licences : ${Object.entries(licenses).map(([l, n]) => `${l} × ${n}`).join(", ")}`);
if (misses.length) console.log(`Sans photo : ${misses.join(" ; ")}`);
