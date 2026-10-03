import { useEffect, useState } from "react";
import type { Activity, DaySlot, Itinerary as ItineraryData, TravelProfile, TripOption } from "@/types";
import { KIND_LABEL } from "@/lib/data/activities/kinds";
import { AGE_LABEL, GROUP_LABEL } from "@/lib/data/profile";
import { VIBE_BY_ID } from "@/lib/data/vibes";
import { eur, listFr, plural } from "@/lib/format";
import { LINKS } from "@/lib/links";
import { PRICE_LABEL, SLOT_ORDER, itineraryToText } from "@/lib/planner";
import { Icon } from "../ui/Icon";

const SLOT_LABEL: Record<DaySlot, string> = { morning: "Matin", afternoon: "Après-midi", evening: "Soir" };
const FREE_LABEL: Record<DaySlot, string> = {
  morning: "Matinée libre : grasse mat\u2019 et café en terrasse.",
  afternoon: "Après-midi libre : flâner, ou piocher une idée ci-dessous.",
  evening: "Soirée libre : dîner dans le quartier, puis balade.",
};

interface Loaded {
  key: string;
  itinerary: ItineraryData | null;
  error: boolean;
}

export interface ItineraryState {
  itinerary: ItineraryData | null;
  loading: boolean;
  error: boolean;
  reshuffle: () => void;
}

/**
 * Demande au serveur le programme de l'escapade ouverte pour le profil courant, et le redemande quand l'un ou l'autre change.
 * La graine permet de « remélanger » ; elle repart de zéro quand on change d'escapade.
 */
export function useItinerary(trip: TripOption, profile: TravelProfile): ItineraryState {
  const tripKey = `${trip.destination.id}|${trip.window.out}|${trip.window.nights}`;
  const [seedState, setSeedState] = useState({ key: tripKey, seed: 0 });
  const seed = seedState.key === tripKey ? seedState.seed : 0;
  const params = new URLSearchParams({
    dest: trip.destination.id,
    out: trip.window.out,
    nights: String(trip.window.nights),
    g: profile.group,
    a: profile.ages.join(","),
    v: profile.vibes.join(","),
    t: String(profile.travelers),
    seed: String(seed),
  });
  const key = params.toString();
  const [loaded, setLoaded] = useState<Loaded>({ key: "", itinerary: null, error: false });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/plan?${key}`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ itinerary: ItineraryData }>;
      })
      .then((data) => setLoaded({ key, itinerary: data.itinerary, error: false }))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setLoaded({ key, itinerary: null, error: true });
      });
    return () => ctrl.abort();
  }, [key]);

  const fresh = loaded.key === key;
  return {
    itinerary: fresh ? loaded.itinerary : null,
    loading: !fresh,
    error: fresh && loaded.error,
    reshuffle: () => setSeedState({ key: tripKey, seed: seed + 1 }),
  };
}

const hoursLabel = (h: number): string => (h >= 6 ? "la journée" : h % 1 ? `${Math.floor(h)} h 30` : `${h} h`);

function ActivityRow({ a, city, slot }: { a: Activity; city: string; slot?: DaySlot }) {
  return (
    <li className="act">
      {slot && <span className="when">{SLOT_LABEL[slot]}</span>}
      <div className="what">
        <a href={LINKS.maps(a.query ?? a.name, city)} target="_blank" rel="noopener" className="name">
          {a.name} <Icon name="pin" />
        </a>
        <p className="blurb">{a.blurb}</p>
        <div className="meta">
          <span className="tag">{KIND_LABEL[a.kind]}</span>
          <span className="tag">
            <Icon name="clock" /> {hoursLabel(a.hours)}
          </span>
          <span className={a.price ? "tag" : "tag free"}>{PRICE_LABEL[a.price]}</span>
          {a.bookable && (
            <a className="tag book" href={LINKS.getYourGuide(a.name, city)} target="_blank" rel="noopener">
              <Icon name="ticket" /> Réserver
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

interface Props {
  trip: TripOption;
  profile: TravelProfile;
  state: ItineraryState;
  onToast: (msg: string) => void;
}

/** « Ton programme » : jour par jour, adapté au groupe, aux âges, aux envies et à la météo. */
export function Itinerary({ trip, profile, state, onToast }: Props) {
  const city = trip.destination.city;
  const it = state.itinerary;
  const vibeLabels = profile.vibes.map((v) => VIBE_BY_ID[v].label);
  const recap = [GROUP_LABEL[profile.group], listFr(profile.ages.map((a) => AGE_LABEL[a])), `${profile.travelers} pers.`, vibeLabels.length ? `envies : ${listFr(vibeLabels).toLowerCase()}` : "toutes envies"].join(" · ");

  const copy = () => {
    if (!it) return;
    const text = itineraryToText(city, it);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => onToast("Programme copié")).catch(() => onToast("Copie impossible ici"));
    else onToast("Copie impossible ici");
  };

  return (
    <div className="section plan">
      <h3>
        <Icon name="sparkles" />
        Ton programme
      </h3>
      <p className="hint">{recap}. Change « Qui part ? » et les envies dans la recherche : le programme suit.</p>
      {state.loading && (
        <div className="opt glass plan-wait" aria-busy="true">
          <span className="sk" />
          <span className="sk" />
          <span className="sk short" />
        </div>
      )}
      {state.error && <p className="note warn">Impossible de composer le programme pour l&apos;instant.</p>}
      {it && (
        <>
          <ol className="days">
            {it.days.map((d) => (
              <li key={d.index} className="day glass">
                <h4>{d.label}</h4>
                <ul className="acts">
                  {SLOT_ORDER.map((slot) => {
                    const s = d.slots.find((x) => x.slot === slot);
                    if (s) return <ActivityRow key={s.activity.id} a={s.activity} city={city} slot={slot} />;
                    if (!d.free.includes(slot)) return null;
                    return (
                      <li key={slot} className="act free">
                        <span className="when">{SLOT_LABEL[slot]}</span>
                        <p className="blurb">{FREE_LABEL[slot]}</p>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
          {it.freeDays > 0 && (
            <p className="note">
              + {it.freeDays} {plural(it.freeDays, "journée libre", "journées libres")} au milieu du séjour : plage, farniente, ou une idée ci-dessous.
            </p>
          )}
          {it.leftovers.length > 0 && (
            <details className="more">
              <summary>Autres idées pour vous ({it.leftovers.length})</summary>
              <ul className="acts">
                {it.leftovers.map((a) => (
                  <ActivityRow key={a.id} a={a} city={city} />
                ))}
              </ul>
            </details>
          )}
          <div className="plan-foot">
            <span className="est">
              Activités : ~{eur(it.costPerPerson)} par personne, {eur(it.costPerPerson * profile.travelers)} pour {profile.travelers}
            </span>
            <div className="links">
              <button className="btn sm" type="button" onClick={state.reshuffle}>
                <Icon name="reset" /> Remélanger
              </button>
              <button className="btn sm" type="button" onClick={copy}>
                <Icon name="copy" /> Copier le programme
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
