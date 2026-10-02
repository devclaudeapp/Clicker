import type { Destination, TripOption } from "@/types";
import { VIBE_BY_ID } from "@/lib/data/vibes";
import { eur, fmtShort, minutesLabel, tempClass } from "@/lib/format";
import { Icon } from "../ui/Icon";

export const MODE_LABEL = { plane: "Avion", train: "Train", bus: "Bus", car: "Covoiturage" } as const;

/** Ligne « Vol A/R Vueling, direct, 1 h 35 · 38 €/pers. » ou son équivalent terrestre. */
export function TransportLine({ trip }: { trip: TripOption }) {
  const b = trip.best;
  return (
    <li>
      <Icon name={b.mode} />
      {b.mode === "plane" ? (
        <span>
          Vol A/R {b.airline}
          {b.direct ? ", direct" : ""}, {b.duration} · <b className="num">{eur(b.price)}</b>/pers.
        </span>
      ) : (
        <span>
          {MODE_LABEL[b.mode]} depuis {b.originLabel}, {b.duration} · dès <b className="num">{eur(b.price)}</b>/pers.
        </span>
      )}
    </li>
  );
}

export function StayLine({ trip, showRooms = true }: { trip: TripOption; showRooms?: boolean }) {
  return (
    <li>
      <Icon name="bed" />
      <span>
        {trip.window.nights} nuits · ~<b className="num">{eur(trip.nightly)}</b>/nuit la chambre
        {showRooms && trip.rooms > 1 ? ` × ${trip.rooms}` : ""}
      </span>
    </li>
  );
}

export function TripTags({ trip, isBest }: { trip: TripOption; isBest: boolean }) {
  const b = trip.best;
  const hasTrain = b.mode === "plane" && trip.candidates.some((c) => c.mode === "train");
  return (
    <div className="tags">
      {isBest && <span className="tag best">Meilleur prix</span>}
      <span className="tag dates">
        <Icon name="cal" />
        {fmtShort(trip.window.out)} → {fmtShort(trip.window.ret)}
      </span>
      {b.mode === "plane" && (
        <span className="tag">{b.viaNearby && b.nearbyMinutes != null ? `via ${b.originCity} · ${minutesLabel(b.nearbyMinutes)}` : `depuis ${b.origin}`}</span>
      )}
      {hasTrain && (
        <span className="tag">
          <Icon name="train" />
          Train possible
        </span>
      )}
    </div>
  );
}

export function TempTag({ temp }: { temp: number }) {
  return (
    <span className={`tag ${tempClass(temp)} num`}>
      <Icon name="sun" />
      {temp} °C
    </span>
  );
}

export function VibeIcons({ dest }: { dest: Destination }) {
  return (
    <span className="vibe-icons" aria-label={dest.vibes.map((v) => VIBE_BY_ID[v].label).join(", ")}>
      {dest.vibes.slice(0, 5).map((v) => (
        <Icon key={v} name={VIBE_BY_ID[v].icon} />
      ))}
    </span>
  );
}

export function LandTags({ dest }: { dest: Destination }) {
  return (
    <div className="land-tags">
      {dest.land.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}
