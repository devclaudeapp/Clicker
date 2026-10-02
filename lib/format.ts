/** Formatage et petits utilitaires partagés entre le serveur et le client. */

export const eur = (n: number): string => `${Math.round(n).toLocaleString("fr-FR")} €`;

export const parseISO = (s: string): Date => new Date(`${s}T00:00:00Z`);
export const toISO = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const SHORT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
const LONG: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" };
export const fmtShort = (iso: string): string => parseISO(iso).toLocaleDateString("fr-FR", SHORT);
export const fmtLong = (iso: string): string => parseISO(iso).toLocaleDateString("fr-FR", LONG);

/** « Lyon, Genève et Paris ». */
export const listFr = (items: string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;

/** 105 → « 1 h 45 », 55 → « 55 min ». */
export const minutesLabel = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};

export const tempClass = (t: number): "warm" | "mild" | "cool" => (t >= 18 ? "warm" : t >= 10 ? "mild" : "cool");

/** Hachage FNV-1a ramené dans [0, 1) : sert à rendre les données fictives stables. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export const slugify = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const plural = (n: number, one: string, many = `${one}s`): string => (n > 1 ? many : one);
