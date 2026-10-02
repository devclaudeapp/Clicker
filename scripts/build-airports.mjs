// Génère lib/data/airports.json à partir du CSV OurAirports (domaine public).
// Usage : node scripts/build-airports.mjs chemin/vers/airports.csv
// Ne garde que les aéroports grands et moyens, desservis par des vols réguliers,
// avec un code IATA, en Europe, au Maghreb et au Proche-Orient.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
if (!src) {
  console.error("Usage : node scripts/build-airports.mjs airports.csv");
  process.exit(1);
}

// Boîte englobante : Canaries/Islande à l'ouest, Oural à l'est, Sahara au sud, cap Nord au nord.
const BBOX = { lonMin: -26, lonMax: 45, latMin: 26, latMax: 72 };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const rows = parseCsv(readFileSync(src, "utf8"));
const header = rows[0];
const col = (name) => header.indexOf(name);
const C = {
  type: col("type"),
  name: col("name"),
  lat: col("latitude_deg"),
  lon: col("longitude_deg"),
  country: col("iso_country"),
  city: col("municipality"),
  scheduled: col("scheduled_service"),
  iata: col("iata_code"),
};

// Noms d'affichage en français pour les aéroports les plus utilisés depuis la France et la Suisse ;
// pour les autres, on nettoie la commune OurAirports (« Nice, Alpes-Maritimes » → « Nice »).
const OVERRIDES = {
  LYS: ["Lyon Saint-Exupéry", "Lyon"], GVA: ["Genève", "Genève"], GNB: ["Grenoble Alpes Isère", "Grenoble"],
  CMF: ["Chambéry Savoie Mont Blanc", "Chambéry"], BSL: ["Bâle-Mulhouse (EuroAirport)", "Bâle"], BRN: ["Berne-Belp", "Berne"],
  ZRH: ["Zurich", "Zurich"], CDG: ["Paris Charles-de-Gaulle", "Paris"], ORY: ["Paris Orly", "Paris"], BVA: ["Beauvais-Tillé", "Beauvais"],
  LIL: ["Lille-Lesquin", "Lille"], MRS: ["Marseille Provence", "Marseille"], NCE: ["Nice Côte d'Azur", "Nice"], TLS: ["Toulouse-Blagnac", "Toulouse"],
  BOD: ["Bordeaux-Mérignac", "Bordeaux"], NTE: ["Nantes Atlantique", "Nantes"], MPL: ["Montpellier Méditerranée", "Montpellier"],
  SXB: ["Strasbourg-Entzheim", "Strasbourg"], CFE: ["Clermont-Ferrand Auvergne", "Clermont-Ferrand"], BIQ: ["Biarritz Pays Basque", "Biarritz"],
  RNS: ["Rennes Bretagne", "Rennes"], BES: ["Brest Bretagne", "Brest"], AJA: ["Ajaccio Napoléon Bonaparte", "Ajaccio"], BIA: ["Bastia Poretta", "Bastia"],
  BRU: ["Bruxelles-Zaventem", "Bruxelles"], CRL: ["Bruxelles-Charleroi", "Charleroi"], LUX: ["Luxembourg-Findel", "Luxembourg"],
  BCN: ["Barcelone-El Prat", "Barcelone"], LIS: ["Lisbonne", "Lisbonne"], FCO: ["Rome-Fiumicino", "Rome"], CIA: ["Rome-Ciampino", "Rome"],
  RAK: ["Marrakech-Ménara", "Marrakech"], SVQ: ["Séville", "Séville"], NAP: ["Naples-Capodichino", "Naples"],
  LHR: ["Londres Heathrow", "Londres"], LGW: ["Londres Gatwick", "Londres"], STN: ["Londres Stansted", "Londres"], LTN: ["Londres Luton", "Londres"],
  AMS: ["Amsterdam-Schiphol", "Amsterdam"], PRG: ["Prague Václav-Havel", "Prague"], PMO: ["Palerme", "Palerme"], AGP: ["Malaga-Costa del Sol", "Malaga"],
  BER: ["Berlin-Brandebourg", "Berlin"], VIE: ["Vienne", "Vienne"], MXP: ["Milan Malpensa", "Milan"], LIN: ["Milan Linate", "Milan"],
  BGY: ["Milan Bergame", "Bergame"], CPH: ["Copenhague-Kastrup", "Copenhague"], DUB: ["Dublin", "Dublin"], VCE: ["Venise Marco Polo", "Venise"],
  ATH: ["Athènes", "Athènes"], IST: ["Istanbul", "Istanbul"], MAD: ["Madrid-Barajas", "Madrid"], EDI: ["Édimbourg", "Édimbourg"],
};
const cleanCity = (s) => s.split(/[,(]/)[0].trim();

const airports = [];
for (const r of rows.slice(1)) {
  const type = r[C.type];
  if (type !== "large_airport" && type !== "medium_airport") continue;
  if (r[C.scheduled] !== "yes") continue;
  const iata = r[C.iata];
  if (!iata || iata.length !== 3) continue;
  const lat = Number(r[C.lat]);
  const lon = Number(r[C.lon]);
  if (lon < BBOX.lonMin || lon > BBOX.lonMax || lat < BBOX.latMin || lat > BBOX.latMax) continue;
  const o = OVERRIDES[iata];
  airports.push({
    iata,
    name: o ? o[0] : r[C.name].replace(/\s+(International\s+)?Airport$/i, ""),
    city: o ? o[1] : cleanCity(r[C.city] || r[C.name]),
    country: r[C.country],
    lat: Math.round(lat * 1000) / 1000,
    lon: Math.round(lon * 1000) / 1000,
    size: type === "large_airport" ? "L" : "M",
  });
}
airports.sort((a, b) => a.iata.localeCompare(b.iata));

const out = join(here, "..", "lib", "data", "airports.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(airports));
console.log(`${airports.length} aéroports écrits dans ${out} (${(JSON.stringify(airports).length / 1024).toFixed(0)} Ko)`);
