/** Géométrie : distances, projection de la carte et tracés. */

export interface LatLon {
  lat: number;
  lon: number;
}

const toRad = (x: number) => (x * Math.PI) / 180;

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Temps d'accès estimé à un aéroport voisin : 20 min d'approche puis ~85 km/h. */
export const accessMinutes = (km: number): number => Math.round(20 + (km / 85) * 60);

/** Projection de Mercator sur une boîte Europe + Maghreb, en unités SVG. */
export const MAP = { lon0: -14, lon1: 24, lat0: 30, lat1: 57, W: 1000, H: 0 };
const mercY = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const K = MAP.W / (MAP.lon1 - MAP.lon0);
MAP.H = (mercY(MAP.lat1) - mercY(MAP.lat0)) * K;

export function project(lon: number, lat: number): [number, number] {
  return [(lon - MAP.lon0) * K, (mercY(MAP.lat1) - mercY(lat)) * K];
}

/** Arc quadratique qui bombe vers le haut de l'écran, entre deux points projetés. */
export function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const off = len * 0.18;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${(mx + nx * off).toFixed(1)},${(my + ny * off).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/** Tracé SVG des contours terrestres à partir d'anneaux [lon, lat]. */
export function landPath(rings: number[][][]): string {
  return rings
    .map(
      (ring) =>
        ring
          .map(([lon, lat], i) => {
            const [x, y] = project(lon, lat);
            return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join("") + "Z",
    )
    .join("");
}
