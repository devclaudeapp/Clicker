import { FLIXBUS_CITY } from "./data/flixbus";
import { parseISO, slugify } from "./format";

/**
 * Liens pré-remplis vers les comparateurs et vendeurs. Aucune API : on construit l'URL de recherche de chaque site.
 * Dates en ISO « YYYY-MM-DD », codes IATA en majuscules, nombre d'adultes ≥ 1.
 * Chaque format a été vérifié dans un navigateur en octobre 2026 (villes, dates et voyageurs pré-remplis) ; les limites
 * connues sont notées sur place. lib/links.test.ts fige un exemple de chacun.
 */
const two = (n: number) => String(n).padStart(2, "0");
const parts = (iso: string) => {
  const d = parseISO(iso);
  return { y: String(d.getUTCFullYear()), m: two(d.getUTCMonth() + 1), d: two(d.getUTCDate()) };
};
/** « 1411 » */
const ddmm = (iso: string) => parts(iso).d + parts(iso).m;
/** « 261114 » */
const yymmdd = (iso: string) => parts(iso).y.slice(2) + parts(iso).m + parts(iso).d;
/** « 14/11 » */
const ddsmm = (iso: string) => `${parts(iso).d}/${parts(iso).m}`;
/** « 14.11.2026 » */
const dmy = (iso: string) => `${parts(iso).d}.${parts(iso).m}.${parts(iso).y}`;
const enc = encodeURIComponent;
const adultsOf = (n: number) => Math.max(1, Math.round(n));

export interface FlightLinkParams {
  origin: string;
  destination: string;
  out: string;
  ret: string;
  adults: number;
  /** Identifiant partenaire Travelpayouts, ajouté aux liens Aviasales quand il existe. */
  marker?: string;
}

/*
 * Google Flights ne lit qu'un paramètre : `tfs`, un message protobuf en base64 décrivant la recherche (le paramètre
 * `q=` en langage naturel renvoie à l'accueil). Encodeur minimal du message, champs :
 *   Info       { data = 3 (FlightData, un par trajet) · passengers = 8 (énumération, 1 = adulte) · seat = 9 (1 = éco) · trip = 19 (1 = A/R) }
 *   FlightData { date = 2 · from = 13 (Airport) · to = 14 (Airport) }
 *   Airport    { code = 2 }
 */
const varint = (n: number): number[] => {
  const out: number[] = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
};
const tag = (field: number, wire: 0 | 2) => varint((field << 3) | wire);
const message = (field: number, payload: number[]) => [...tag(field, 2), ...varint(payload.length), ...payload];
const text = (field: number, s: string) => message(field, Array.from(new TextEncoder().encode(s)));
const number = (field: number, v: number) => [...tag(field, 0), ...varint(v)];
const leg = (date: string, from: string, to: string) => [...text(2, date), ...message(13, text(2, from)), ...message(14, text(2, to))];

/** Paramètre `tfs` d'une recherche aller-retour en économique. */
export function googleFlightsTfs({ origin, destination, out, ret, adults }: FlightLinkParams): string {
  const bytes = [
    ...message(3, leg(out, origin, destination)),
    ...message(3, leg(ret, destination, origin)),
    ...message(8, new Array<number>(adultsOf(adults)).fill(1)),
    ...number(9, 1),
    ...number(19, 1),
  ];
  return btoa(String.fromCharCode(...bytes));
}

export const LINKS = {
  aviasales: ({ origin, destination, out, ret, adults, marker }: FlightLinkParams): string =>
    `https://www.aviasales.com/search/${origin}${ddmm(out)}${destination}${ddmm(ret)}${adultsOf(adults)}?currency=eur${marker ? `&marker=${enc(marker)}` : ""}`,
  googleFlights: (p: FlightLinkParams): string => `https://www.google.com/travel/flights?tfs=${enc(googleFlightsTfs(p))}&hl=fr&gl=fr&curr=EUR`,
  /** Skyscanner protège ses pages par un contrôle anti-robot : le format est celui de ses propres recherches, vérifié à la main. */
  skyscanner: ({ origin, destination, out, ret, adults }: FlightLinkParams): string =>
    `https://www.skyscanner.fr/transport/vols/${origin.toLowerCase()}/${destination.toLowerCase()}/${yymmdd(out)}/${yymmdd(ret)}/?adults=${adultsOf(adults)}&adultsv2=${adultsOf(adults)}&cabinclass=economy&rtn=1&preferdirects=false`,
  kayak: ({ origin, destination, out, ret, adults }: FlightLinkParams): string =>
    `https://www.kayak.fr/flights/${origin}-${destination}/${out}/${ret}/${adultsOf(adults)}adults?sort=bestflight_a`,

  /** Recherche en langage naturel : villes et date d'aller sont lues, pas le nombre de voyageurs. */
  sncfConnect: (fromCity: string, toCity: string, out: string): string =>
    `https://www.sncf-connect.com/app/home/search?userInput=${enc(`${fromCity} ${toCity} ${ddsmm(out)}`)}`,
  /** Villes et dates pré-remplies à partir des noms ; le nombre de passagers ne passe pas par l'URL (1 adulte par défaut). */
  trainline: (fromCity: string, toCity: string, out: string, ret: string): string =>
    `https://www.trainline.fr/search/${slugify(fromCity)}/${slugify(toCity)}/${out}/${ret}`,
  /**
   * La boutique FlixBus veut l'identifiant de chaque ville (lib/data/flixbus.ts, clé = nom anglais) : une ville inconnue
   * laisse simplement son champ vide, dates et passagers restent pré-remplis.
   */
  flixbus: (fromEn: string, toEn: string, out: string, ret: string, adults: number): string => {
    const p = new URLSearchParams();
    const from = FLIXBUS_CITY[slugify(fromEn)];
    const to = FLIXBUS_CITY[slugify(toEn)];
    if (from) p.set("departureCity", from);
    if (to) p.set("arrivalCity", to);
    p.set("rideDate", dmy(out));
    p.set("backRideDate", dmy(ret));
    p.set("adult", String(adultsOf(adults)));
    p.set("_locale", "fr");
    return `https://shop.flixbus.fr/search?${p}`;
  },
  blablacar: (fromCity: string, toCity: string, date: string, seats: number): string =>
    `https://www.blablacar.fr/search?fn=${enc(fromCity)}&tn=${enc(toCity)}&db=${date}&seats=${adultsOf(seats)}&search_origin=HOME`,
  rome2rio: (fromEn: string, toEn: string): string => `https://www.rome2rio.com/fr/s/${enc(fromEn)}/${enc(toEn)}`,

  booking: (city: string, out: string, ret: string, adults: number): string =>
    `https://www.booking.com/searchresults.fr.html?ss=${enc(city)}&checkin=${out}&checkout=${ret}&group_adults=${adultsOf(adults)}&no_rooms=${Math.ceil(adultsOf(adults) / 2)}&group_children=0&selected_currency=EUR`,
  airbnb: (city: string, out: string, ret: string, adults: number): string =>
    `https://www.airbnb.fr/s/${enc(city)}/homes?checkin=${out}&checkout=${ret}&adults=${adultsOf(adults)}`,

  /** Une activité sur Google Maps : « Park Güell Barcelone ». */
  maps: (place: string, city: string): string => `https://www.google.com/maps/search/?api=1&query=${enc(`${place} ${city}`)}`,
  /** Billets et visites guidées : recherche pré-remplie sur GetYourGuide. */
  getYourGuide: (activity: string, city: string): string => `https://www.getyourguide.fr/s/?q=${enc(`${activity} ${city}`)}`,
};
