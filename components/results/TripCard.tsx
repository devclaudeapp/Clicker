import { useEffect, useRef } from "react";
import type { TripOption } from "@/types";
import { eur } from "@/lib/format";
import { Icon } from "../ui/Icon";
import { Scene } from "../ui/Scene";
import { StayLine, TempTag, TransportLine, TripTags, VibeIcons } from "./TripBits";

interface Props {
  trip: TripOption;
  isBest: boolean;
  fav: boolean;
  index: number;
  onOpen: (id: string) => void;
  onFav: (id: string) => void;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fait défiler le prix de l'ancienne valeur à la nouvelle quand les critères changent. */
function usePriceCountUp(value: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    const from = prev.current;
    prev.current = value;
    if (!el || from == null || from === value || reduced()) return;
    const t0 = performance.now();
    const dur = 520;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = eur(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return ref;
}

export function TripCard({ trip, isBest, fav, index, onOpen, onFav }: Props) {
  const d = trip.destination;
  const priceRef = usePriceCountUp(trip.perPerson);
  return (
    <article className={isBest ? "card glass best" : "card glass"} data-id={d.id} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
      <div className="post">
        <Scene dest={d} />
        <TempTag temp={trip.temp} />
        <button className={fav ? "fav on" : "fav"} type="button" aria-pressed={fav} aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => onFav(d.id)}>
          <Icon name="heart" />
        </button>
      </div>
      <div className="card-head">
        <div>
          <h3>{d.city}</h3>
          <p className="sub">
            {d.country} <VibeIcons dest={d} />
          </p>
        </div>
      </div>
      <div className="price">
        <span className="big num" ref={priceRef}>
          {eur(trip.perPerson)}
        </span>
        <span className="per">/ pers. · transport + {trip.window.nights} nuits</span>
      </div>
      <ul className="breakdown">
        <TransportLine trip={trip} />
        <StayLine trip={trip} />
      </ul>
      <TripTags trip={trip} isBest={isBest} />
      <button className="btn" type="button" onClick={() => onOpen(d.id)}>
        Voir le séjour
      </button>
    </article>
  );
}
