import type { PointerEvent } from "react";
import type { TripOption } from "@/types";
import { TripCard } from "./TripCard";

interface Props {
  trips: TripOption[];
  bestId: string | null;
  favs: string[];
  emptyMessage: string;
  /** Nombre de cartes fantômes à montrer pendant le tout premier chargement. */
  skeleton?: number;
  onOpen: (id: string) => void;
  onFav: (id: string) => void;
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="card glass skeleton" aria-hidden="true" style={{ animationDelay: `${index * 35}ms` }}>
      <div className="post" />
      <div className="bar" style={{ width: "55%", height: 22 }} />
      <div className="bar" style={{ width: "35%", height: 30 }} />
      <div className="bar" style={{ width: "90%" }} />
      <div className="bar" style={{ width: "70%" }} />
      <div className="bar" style={{ width: "100%", height: 40, borderRadius: 14 }} />
    </div>
  );
}

// Les requêtes média sont créées une fois ; seule leur valeur est relue à chaque mouvement.
let hoverQuery: MediaQueryList | null = null;
let motionQuery: MediaQueryList | null = null;
const canHover = () => {
  if (typeof window === "undefined") return false;
  hoverQuery ??= window.matchMedia("(hover: hover) and (pointer: fine)");
  motionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return hoverQuery.matches && !motionQuery.matches;
};

/** Grille de cartes ; au survol à la souris, la carte s'incline légèrement et un halo suit le curseur. */
export function TripGrid({ trips, bestId, favs, emptyMessage, skeleton = 0, onOpen, onFav }: Props) {
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!canHover()) return;
    const c = (e.target as HTMLElement).closest<HTMLElement>(".card");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    c.style.setProperty("--mx", `${x * 100}%`);
    c.style.setProperty("--my", `${y * 100}%`);
    c.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-3px)`;
  };
  const onOut = (e: PointerEvent<HTMLDivElement>) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>(".card");
    if (c && !c.contains(e.relatedTarget as Node | null)) c.style.transform = "";
  };
  if (!trips.length && skeleton > 0) {
    return (
      <div className="grid" aria-busy="true" aria-label="Chargement des escapades">
        {Array.from({ length: skeleton }, (_, i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </div>
    );
  }
  if (!trips.length) return <div className="empty">{emptyMessage}</div>;
  return (
    <div className="grid" onPointerMove={onMove} onPointerOut={onOut}>
      {trips.map((t, i) => (
        <TripCard key={t.destination.id} trip={t} isBest={t.destination.id === bestId} fav={favs.includes(t.destination.id)} index={i} onOpen={onOpen} onFav={onFav} />
      ))}
    </div>
  );
}
