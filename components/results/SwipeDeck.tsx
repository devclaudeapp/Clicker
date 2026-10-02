import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { TripOption } from "@/types";
import { eur } from "@/lib/format";
import { Icon } from "../ui/Icon";
import { Scene } from "../ui/Scene";
import { LandTags, StayLine, TempTag, TransportLine, TripTags, VibeIcons } from "./TripBits";

interface Props {
  trips: TripOption[];
  swiped: string[];
  favCount: number;
  emptyMessage: string;
  onDecide: (id: string, dir: "left" | "right") => void;
  onOpen: (id: string) => void;
  onReset: () => void;
}

const THRESHOLD = 110;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Pile de cartes à glisser : à droite on garde (favori), à gauche on passe. Flèches du clavier aussi. */
export function SwipeDeck({ trips, swiped, favCount, emptyMessage, onDecide, onOpen, onReset }: Props) {
  const remaining = trips.filter((t) => !swiped.includes(t.destination.id));
  const top = remaining.slice(0, 3);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const topId = top[0]?.destination.id ?? null;

  // Une fois la carte sortie de l'écran, on acte la décision.
  const decide = (dir: "left" | "right") => {
    if (!topId || leaving) return;
    setLeaving(dir);
    setDrag(null);
    window.setTimeout(() => {
      setLeaving(null);
      onDecide(topId, dir);
    }, reduced() ? 0 : 340);
  };

  // Flèches du clavier : l'écouteur est posé une fois, mais lit toujours la carte du dessus courante.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.closest("input,select,textarea")) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      decide("right");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      decide("left");
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!trips.length) return <div className="empty">{emptyMessage}</div>;
  if (!remaining.length) {
    return (
      <div className="stack empty-stack glass">
        <h3>Tu as tout vu</h3>
        <p className="hint">
          {favCount} favori{favCount > 1 ? "s" : ""} gardé{favCount > 1 ? "s" : ""}. Retrouve-les avec le cœur en haut.
        </p>
        <button className="btn primary" type="button" onClick={onReset}>
          <Icon name="reset" />
          Recommencer
        </button>
      </div>
    );
  }

  const topStyle = (): React.CSSProperties => {
    if (leaving) {
      const w = typeof window !== "undefined" ? window.innerWidth : 600;
      return { transform: `translate(${leaving === "right" ? w : -w}px,-40px) rotate(${leaving === "right" ? 25 : -25}deg)`, opacity: 0, zIndex: 10 };
    }
    if (drag) return { transform: `translate(${drag.dx}px,${drag.dy * 0.6}px) rotate(${drag.dx * 0.06}deg)`, zIndex: 10 };
    return { zIndex: 10 };
  };
  const k = drag ? Math.min(1, Math.abs(drag.dx) / THRESHOLD) : 0;

  return (
    <>
      <div className="stack">
        {top
          .map((t, i) => {
            const d = t.destination;
            const isTop = i === 0;
            const style: React.CSSProperties = isTop ? topStyle() : { transform: `translateY(${i * 16}px) scale(${1 - i * 0.05})`, opacity: i === 2 ? 0.7 : 1, zIndex: 10 - i };
            return (
              <article
                key={d.id}
                className={isTop && drag ? "sc glass dragging" : "sc glass"}
                data-i={i}
                style={style}
                onPointerDown={
                  isTop
                    ? (e) => {
                        if (e.button !== 0 || (e.target as HTMLElement).closest("button,a")) return;
                        start.current = { x: e.clientX, y: e.clientY };
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setDrag({ dx: 0, dy: 0 });
                      }
                    : undefined
                }
                onPointerMove={
                  isTop
                    ? (e) => {
                        if (!start.current) return;
                        setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
                      }
                    : undefined
                }
                onPointerUp={
                  isTop
                    ? () => {
                        const dx = drag?.dx ?? 0;
                        start.current = null;
                        if (Math.abs(dx) > THRESHOLD) decide(dx > 0 ? "right" : "left");
                        else setDrag(null);
                      }
                    : undefined
                }
                onPointerCancel={
                  isTop
                    ? () => {
                        start.current = null;
                        setDrag(null);
                      }
                    : undefined
                }
              >
                {isTop && (
                  <>
                    <div className="stamp like" style={{ opacity: drag && drag.dx > 0 ? k : 0 }}>
                      J&apos;ADORE
                    </div>
                    <div className="stamp nope" style={{ opacity: drag && drag.dx < 0 ? k : 0 }}>
                      PASSE
                    </div>
                  </>
                )}
                <div className="post">
                  <Scene dest={d} />
                  <TempTag temp={t.temp} />
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
                  <span className="big num">{eur(t.perPerson)}</span>
                  <span className="per">
                    / pers.
                    <br />
                    transport + {t.window.nights} nuits
                  </span>
                </div>
                <ul className="breakdown">
                  <TransportLine trip={t} />
                  <StayLine trip={t} showRooms={false} />
                </ul>
                <LandTags dest={d} />
                <TripTags trip={t} isBest={false} />
              </article>
            );
          })
          .reverse()}
      </div>
      <div className="swipe-actions">
        <button className="round nope" type="button" aria-label="Passer" onClick={() => decide("left")}>
          <Icon name="x" />
        </button>
        <button className="btn" type="button" onClick={() => topId && onOpen(topId)}>
          Voir le séjour
        </button>
        <button className="round like" type="button" aria-label="Garder en favori" onClick={() => decide("right")}>
          <Icon name="heart" />
        </button>
      </div>
      <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
        {remaining.length} restante{remaining.length > 1 ? "s" : ""} · glisse à droite pour garder, à gauche pour passer
      </p>
    </>
  );
}
