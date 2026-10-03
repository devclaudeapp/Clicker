import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { DeparturePoint, TripOption } from "@/types";
import { eur, fmtShort } from "@/lib/format";
import { arcPath, MAP, project } from "@/lib/geo";
import { MOTION, prefersReducedMotion } from "@/lib/motion";
import { originOf } from "@/lib/pricing";
import { Icon } from "../ui/Icon";
import { Scene } from "../ui/Scene";
import { LandTags, MODE_LABEL, TempTag } from "./TripBits";
import { getLandPath } from "./MiniMap";

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  trips: TripOption[];
  inBudgetIds: Set<string>;
  bestId: string | null;
  favs: string[];
  departures: DeparturePoint[];
  /** Cadrage courant, tenu par le parent pour survivre aux changements de vue. */
  view: ViewBox;
  onView: Dispatch<SetStateAction<ViewBox>>;
  onOpen: (id: string) => void;
}

export const FULL_VIEW: ViewBox = { x: 0, y: 0, w: MAP.W, h: MAP.H };
const MIN_W = MAP.W / 8;
const MAX_W = MAP.W * 1.2;
/** Délai avant que l'info-bulle ne se ferme quand la souris quitte la carte. */
const LEAVE_MS = 150;
const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function clamp(v: ViewBox): ViewBox {
  const w = Math.max(MIN_W, Math.min(MAX_W, v.w));
  const h = (w * MAP.H) / MAP.W;
  return { w, h, x: Math.max(-w / 2, Math.min(MAP.W - w / 2, v.x)), y: Math.max(-h / 2, Math.min(MAP.H - h / 2, v.y)) };
}
function zoomAt(v: ViewBox, px: number, py: number, f: number): ViewBox {
  const nw = Math.max(MIN_W, Math.min(MAX_W, v.w / f));
  const rf = v.w / nw;
  return clamp({ x: px - (px - v.x) / rf, y: py - (py - v.y) / rf, w: nw, h: (nw * MAP.H) / MAP.W });
}
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Carte vectorielle : bulles de prix, arc depuis l'aéroport réellement utilisé, zoom à la molette, au pincement et aux boutons. */
export function MapView({ trips, inBudgetIds, bestId, favs, departures, view, onView, onOpen }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const leaveTimer = useRef<number | null>(null);
  const anim = useRef<number | null>(null);
  const k = view.w / MAP.W;

  /** Convertit un point écran en coordonnées SVG (préservation « meet » : la carte est centrée dans sa boîte). */
  const svgPoint = (cx: number, cy: number): [number, number, number] => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const s = Math.max(view.w / r.width, view.h / r.height);
    const ox = (r.width - view.w / s) / 2;
    const oy = (r.height - view.h / s) / 2;
    return [view.x + (cx - r.left - ox) * s, view.y + (cy - r.top - oy) * s, s];
  };

  // La molette doit pouvoir empêcher le défilement de la page : écouteur non passif, posé une fois, qui lit la vue courante.
  const onWheel = useEffectEvent((e: WheelEvent) => {
    e.preventDefault();
    const [px, py] = svgPoint(e.clientX, e.clientY);
    onView((v) => zoomAt(v, px, py, Math.pow(1.0015, -e.deltaY)));
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => onWheel(e);
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);
  useEffect(
    () => () => {
      if (anim.current) cancelAnimationFrame(anim.current);
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  /** Les boutons de zoom glissent vers le nouveau cadrage au lieu de sauter (immédiat en mouvement réduit). */
  const animateTo = (target: ViewBox) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    if (prefersReducedMotion()) {
      onView(target);
      return;
    }
    const from = view;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = easeOut(Math.min(1, (now - t0) / MOTION.component));
      onView({ x: from.x + (target.x - from.x) * p, y: from.y + (target.y - from.y) * p, w: from.w + (target.w - from.w) * p, h: from.h + (target.h - from.h) * p });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };

  const activeTrip = trips.find((t) => t.destination.id === active) ?? null;

  // Positionne l'info-bulle au-dessus de la bulle active, en restant dans le cadre.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const wrap = wrapRef.current;
    if (!tip || !wrap || !active) return;
    const mk = wrap.querySelector<SVGGElement>(`.mk[data-id="${active}"]`);
    if (!mk) return;
    const wr = wrap.getBoundingClientRect();
    const r = mk.getBoundingClientRect();
    const cx = r.left + r.width / 2 - wr.left;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const left = Math.max(8, Math.min(cx - tw / 2, wr.width - tw - 8));
    let y = r.top - wr.top - th - 10;
    if (y < 8) y = r.bottom - wr.top + 10;
    if (y + th > wr.height - 8) y = Math.max(8, wr.height - th - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${y}px`;
  }, [active, view, activeTrip]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest(".mk")) return;
    if (anim.current) cancelAnimationFrame(anim.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) moved.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pts.current.size === 1) {
      const s = svgPoint(cur.x, cur.y)[2];
      moved.current += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      onView((v) => clamp({ ...v, x: v.x - (cur.x - prev.x) * s, y: v.y - (cur.y - prev.y) * s }));
    } else if (pts.current.size === 2) {
      const other = [...pts.current.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
      const mid = [(cur.x + other.x) / 2, (cur.y + other.y) / 2];
      const pmid = [(prev.x + other.x) / 2, (prev.y + other.y) / 2];
      const [px, py, s] = svgPoint(mid[0], mid[1]);
      moved.current = 99;
      onView((v) => {
        const z = zoomAt(v, px, py, d1 / (d0 || 1));
        return clamp({ ...z, x: z.x - (mid[0] - pmid[0]) * s, y: z.y - (mid[1] - pmid[1]) * s });
      });
    }
    pts.current.set(e.pointerId, cur);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.delete(e.pointerId);
    if (pts.current.size === 0 && moved.current < 6 && active) setActive(null);
  };
  /** Ouvrir la fiche referme l'info-bulle : au retour, la carte est nette. */
  const open = (id: string) => {
    setActive(null);
    onOpen(id);
  };
  const onMarkerClick = (id: string) => {
    if (canHover() || active === id) open(id);
    else setActive(id);
  };
  const center = (f: number) => animateTo(zoomAt(view, view.x + view.w / 2, view.y + view.h / 2, f));
  const cancelLeave = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };

  let overlay: React.ReactNode = null;
  if (activeTrip) {
    const o = originOf(activeTrip, departures);
    const [x1, y1] = project(o.lon, o.lat);
    const [x2, y2] = project(activeTrip.destination.lon, activeTrip.destination.lat);
    const p = arcPath(x1, y1, x2, y2);
    overlay = (
      <>
        <path className={o.ground ? "arc ground" : "arc"} d={p} />
        {!prefersReducedMotion() && (
          <circle r={(5 * k).toFixed(2)} fill="#fff">
            <animateMotion dur="2.4s" repeatCount="indefinite" path={p} />
          </circle>
        )}
        {activeTrip.best.mode === "plane" && activeTrip.best.viaNearby && (
          <g className="origin" transform={`translate(${x1.toFixed(1)},${y1.toFixed(1)}) scale(${k.toFixed(3)})`}>
            <circle r={5} />
            <text y={-10} textAnchor="middle">
              {o.label}
            </text>
          </g>
        )}
      </>
    );
  }

  return (
    <div
      className="map-wrap glass"
      ref={wrapRef}
      onPointerEnter={cancelLeave}
      onPointerLeave={() => {
        // À la souris, l'info-bulle se referme peu après que le curseur a quitté la carte.
        if (!canHover() || !active) return;
        cancelLeave();
        leaveTimer.current = window.setTimeout(() => setActive(null), LEAVE_MS);
      }}
    >
      <svg
        ref={svgRef}
        className={view.w < MAP.W / 1.8 ? "map zoomed" : "map"}
        viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
        role="img"
        aria-label="Carte des destinations"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerOver={(e) => {
          if (!canHover()) return;
          const mk = (e.target as Element).closest<SVGGElement>(".mk");
          if (mk?.dataset.id && mk.dataset.id !== active) setActive(mk.dataset.id);
        }}
      >
        <path className="land" d={getLandPath()} />
        <g>{overlay}</g>
        <g>
          {departures.map((dep) => {
            const [x, y] = project(dep.lon, dep.lat);
            return (
              <g key={dep.id} className="dep" transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(3)})`}>
                <circle className="ring" r={12} />
                <circle r={5} />
                <text y={-18} textAnchor="middle">
                  {dep.label}
                </text>
              </g>
            );
          })}
          {trips.map((t) => {
            const d = t.destination;
            const [x, y] = project(d.lon, d.lat);
            const label = eur(t.perPerson);
            const w = 16 + label.length * 7.5;
            const cls = ["mk", inBudgetIds.has(d.id) ? "" : "dim", d.id === bestId ? "best" : "", favs.includes(d.id) ? "fav" : "", active === d.id ? "active" : ""].filter(Boolean).join(" ");
            return (
              <g
                key={d.id}
                className={cls}
                data-id={d.id}
                transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(3)})`}
                role="button"
                tabIndex={0}
                aria-label={`${d.city}, ${label} par personne`}
                onClick={() => onMarkerClick(d.id)}
                onFocus={() => setActive(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(d.id);
                  }
                }}
              >
                <circle className="dot" r={4.5} />
                <g transform="translate(0,-22)">
                  <rect x={(-w / 2).toFixed(1)} y={-13} width={w.toFixed(1)} height={26} rx={13} />
                  <text className="pr" textAnchor="middle" y={4.5}>
                    {label}
                  </text>
                </g>
                <text className="nm" textAnchor="middle" y={21}>
                  {d.city}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="map-ctl">
        <button className="glass-3" type="button" aria-label="Zoomer" onClick={() => center(1.5)}>
          +
        </button>
        <button className="glass-3" type="button" aria-label="Dézoomer" onClick={() => center(1 / 1.5)}>
          −
        </button>
        <button className="glass-3" type="button" aria-label="Recentrer" onClick={() => animateTo(FULL_VIEW)}>
          <Icon name="reset" />
        </button>
      </div>
      <div className="map-legend glass-3">Bulle = prix / pers. · doré = meilleur prix · grisé = hors budget</div>
      {activeTrip && (
        <div className="tip glass-3" ref={tipRef}>
          <div className="post">
            <Scene dest={activeTrip.destination} width={320} />
            <TempTag temp={activeTrip.temp} />
          </div>
          <div className="body">
            <h4>
              {activeTrip.destination.city} <span className="hint">· {activeTrip.destination.country}</span>
            </h4>
            <div className="price">
              <span className="big num">{eur(activeTrip.perPerson)}</span>
              <span className="per">/ pers. · {activeTrip.window.nights} nuits</span>
            </div>
            <p className="hint">
              {fmtShort(activeTrip.window.out)} → {fmtShort(activeTrip.window.ret)} ·{" "}
              {activeTrip.best.mode === "plane" ? `vol ${activeTrip.best.airline} depuis ${activeTrip.best.origin}` : `${MODE_LABEL[activeTrip.best.mode]} depuis ${activeTrip.best.originLabel}`}
            </p>
            <LandTags dest={activeTrip.destination} />
            <button className="btn sm primary" type="button" onClick={() => open(activeTrip.destination.id)}>
              Voir le séjour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
