import { useMemo } from "react";
import type { DeparturePoint, TripOption } from "@/types";
import land from "@/lib/data/land.json";
import { arcPath, landPath, project } from "@/lib/geo";
import { originOf } from "@/lib/pricing";

/** Tracé des contours, calculé une fois pour toute la session. */
let LAND_PATH = "";
export function getLandPath(): string {
  if (!LAND_PATH) LAND_PATH = landPath(land as number[][][]);
  return LAND_PATH;
}

/** Petite carte du trajet dans la fiche : origine réelle, destination, arc animé. */
export function MiniMap({ trip, departures }: { trip: TripOption; departures: DeparturePoint[] }) {
  const d = trip.destination;
  const o = originOf(trip, departures);
  const { vb, k, p, x1, y1, x2, y2 } = useMemo(() => {
    const [x1, y1] = project(o.lon, o.lat);
    const [x2, y2] = project(d.lon, d.lat);
    // Marge généreuse autour des deux points pour que les étiquettes au-dessus des repères restent visibles.
    let w = Math.abs(x2 - x1) * 1.7 + 90;
    let h = Math.abs(y2 - y1) * 1.9 + 110;
    const ratio = 2.6;
    if (w / h < ratio) w = h * ratio;
    else h = w / ratio;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return { vb: `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`, k: w / 560, p: arcPath(x1, y1, x2, y2), x1, y1, x2, y2 };
  }, [o.lon, o.lat, d.lon, d.lat]);
  return (
    <svg className="mini" viewBox={vb} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path className="land" d={getLandPath()} />
      <path className={o.ground ? "arc ground" : "arc"} d={p} />
      <circle r={(4.5 * k).toFixed(2)} fill="#fff">
        <animateMotion dur="2.6s" repeatCount="indefinite" path={p} />
      </circle>
      <g transform={`translate(${x1.toFixed(1)},${y1.toFixed(1)}) scale(${k.toFixed(3)})`}>
        <circle className="dep-dot" r={5} />
        <text y={-11} textAnchor="middle">
          {o.label}
        </text>
      </g>
      <g transform={`translate(${x2.toFixed(1)},${y2.toFixed(1)}) scale(${k.toFixed(3)})`}>
        <circle className="dst-dot" r={5} />
        <text y={-11} textAnchor="middle">
          {d.city}
        </text>
      </g>
    </svg>
  );
}
