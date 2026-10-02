import { parseISO, slugify } from "./format";

/**
 * Liens pré-remplis vers les comparateurs et vendeurs. Aucune API : on construit l'URL de recherche de chaque site.
 * Dates en ISO « YYYY-MM-DD », codes IATA en majuscules, nombre d'adultes ≥ 1.
 */
const two = (n: number) => String(n).padStart(2, "0");
const ddmm = (iso: string) => {
  const d = parseISO(iso);
  return two(d.getUTCDate()) + two(d.getUTCMonth() + 1);
};
const yymmdd = (iso: string) => {
  const d = parseISO(iso);
  return String(d.getUTCFullYear()).slice(2) + two(d.getUTCMonth() + 1) + two(d.getUTCDate());
};
const ddsmm = (iso: string) => {
  const d = parseISO(iso);
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}`;
};
const enc = encodeURIComponent;

export interface FlightLinkParams {
  origin: string;
  destination: string;
  out: string;
  ret: string;
  adults: number;
  /** Identifiant partenaire Travelpayouts, ajouté aux liens Aviasales quand il existe. */
  marker?: string;
}

export const LINKS = {
  aviasales: ({ origin, destination, out, ret, adults, marker }: FlightLinkParams): string =>
    `https://www.aviasales.com/search/${origin}${ddmm(out)}${destination}${ddmm(ret)}${adults}${marker ? `?marker=${enc(marker)}` : ""}`,
  googleFlights: ({ origin, destination, out, ret, adults }: FlightLinkParams): string =>
    `https://www.google.com/travel/flights?q=${enc(`Flights from ${origin} to ${destination} on ${out} through ${ret} for ${adults} adults`)}&hl=fr&gl=fr&curr=EUR`,
  skyscanner: ({ origin, destination, out, ret, adults }: FlightLinkParams): string =>
    `https://www.skyscanner.fr/transport/vols/${origin.toLowerCase()}/${destination.toLowerCase()}/${yymmdd(out)}/${yymmdd(ret)}/?adults=${adults}&adultsv2=${adults}&cabinclass=economy&rtn=1&preferdirects=false`,
  kayak: ({ origin, destination, out, ret, adults }: FlightLinkParams): string =>
    `https://www.kayak.fr/flights/${origin}-${destination}/${out}/${ret}/${adults}adults?sort=bestflight_a`,

  sncfConnect: (fromCity: string, toCity: string, out: string): string =>
    `https://www.sncf-connect.com/app/home/search?userInput=${enc(`${fromCity} ${toCity} ${ddsmm(out)}`)}`,
  flixbus: (fromEn: string, toEn: string): string => `https://global.flixbus.com/bus-routes/bus-${slugify(fromEn)}-${slugify(toEn)}`,
  blablacar: (fromCity: string, toCity: string, date: string, seats: number): string =>
    `https://www.blablacar.fr/search?fn=${enc(fromCity)}&tn=${enc(toCity)}&db=${date}&seats=${seats}&search_origin=HOME`,
  rome2rio: (fromEn: string, toEn: string): string => `https://www.rome2rio.com/s/${enc(fromEn)}/${enc(toEn)}`,

  booking: (city: string, out: string, ret: string, adults: number): string =>
    `https://www.booking.com/searchresults.fr.html?ss=${enc(city)}&checkin=${out}&checkout=${ret}&group_adults=${adults}&no_rooms=${Math.ceil(adults / 2)}&group_children=0&selected_currency=EUR`,
  airbnb: (city: string, out: string, ret: string, adults: number): string =>
    `https://www.airbnb.fr/s/${enc(city)}/homes?checkin=${out}&checkout=${ret}&adults=${adults}`,
};
