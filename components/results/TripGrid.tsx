import type { PointerEvent } from "react";
import type { TripOption } from "@/types";
import { TripCard } from "./TripCard";

interface Props {
  trips: TripOption[];
  bestId: string | null;
  favs: string[];
  emptyMessage: string;
  onOpen: (id: string) => void;
  onFav: (id: string) => void;
}

const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Grille de cartes ; au survol à la souris, la carte s'incline légèrement et un halo suit le curseur. */
export function TripGrid({ trips, bestId, favs, emptyMessage, onOpen, onFav }: Props) {
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
  if (!trips.length) return <div className="empty">{emptyMessage}</div>;
  return (
    <div className="grid" onPointerMove={onMove} onPointerOut={onOut}>
      {trips.map((t, i) => (
        <TripCard key={t.destination.id} trip={t} isBest={t.destination.id === bestId} fav={favs.includes(t.destination.id)} index={i} onOpen={onOpen} onFav={onFav} />
      ))}
    </div>
  );
}
