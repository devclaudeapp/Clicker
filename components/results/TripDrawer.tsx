import { useEffect, useRef } from "react";
import type { DeparturePoint, TransportCandidate, TravelProfile, TripOption } from "@/types";
import { eur, fmtLong, fmtShort, minutesLabel, plural } from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import { LINKS } from "@/lib/links";
import { photoCredit, photoFor } from "@/lib/photos";
import { originOf } from "@/lib/pricing";
import { Icon } from "../ui/Icon";
import { Scene } from "../ui/Scene";
import { useFocusTrap } from "../ui/useFocusTrap";
import type { PresencePhase } from "../ui/usePresence";
import { useSheetDrag } from "../ui/useSheetDrag";
import { Itinerary, useItinerary } from "./Itinerary";
import { MiniMap } from "./MiniMap";
import { LandTags, MODE_LABEL, TempTag } from "./TripBits";

interface Props {
  trip: TripOption;
  departures: DeparturePoint[];
  travelers: number;
  profile: TravelProfile;
  flexible: boolean;
  fav: boolean;
  /** « exit » pendant l'animation de fermeture, le temps que le parent démonte la fiche. */
  phase: PresencePhase;
  /** Feuille du bas (téléphone) : on peut la tirer vers le bas pour la refermer. */
  mobile: boolean;
  onFav: (id: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
  onShareLink: () => void;
}

function Ext({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <a className={primary ? "btn sm primary" : "btn sm"} href={href} target="_blank" rel="noopener">
      {label} <Icon name="ext" />
    </a>
  );
}

/** Fiche complète d'une escapade : paysage, trajet, budget, vols, alternatives terrestres, hébergement. */
export function TripDrawer({ trip, departures, travelers, profile, flexible, fav, phase, mobile, onFav, onClose, onToast, onShareLink }: Props) {
  const d = trip.destination;
  const w = trip.window;
  const a = travelers;
  const o = originOf(trip, departures);
  const km = Math.round(haversineKm(o, d));
  const flights = trip.candidates.filter((c) => c.mode === "plane");
  const ground = trip.candidates.filter((c) => c.mode !== "plane");
  // Les objets viennent du JSON de l'API : on reconnaît le transport retenu par ses clés, pas par identité.
  const isBest = (c: TransportCandidate) => c.mode === trip.best.mode && c.depId === trip.best.depId && c.origin === trip.best.origin;
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const firstDep = departures[0];
  const plan = useItinerary(trip, profile);
  const activities = plan.itinerary ? plan.itinerary.costPerPerson * a : null;
  const photo = photoFor(d.id);
  useFocusTrap(asideRef, phase === "open");
  const drag = useSheetDrag(onClose, mobile && phase === "open");

  useEffect(() => {
    closeRef.current?.focus();
  }, [trip]);

  const share = () => {
    const text = `${d.city} ${fmtShort(w.out)} → ${fmtShort(w.ret)} · ${eur(trip.perPerson)}/pers. (${MODE_LABEL[trip.best.mode].toLowerCase()} + ${w.nights} nuits) · ${eur(trip.total)} pour ${a}`;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => onToast("Résumé copié")).catch(() => onToast("Copie impossible ici"));
    else onToast("Copie impossible ici");
  };

  // Le marker partenaire n'est pas un secret (il figure dans les liens publics) : exposé au navigateur pour les liens de repli.
  const flightLink = (origin: string) => ({ origin, destination: d.iata, out: w.out, ret: w.ret, adults: a, marker: process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER || undefined });

  return (
    <aside
      className={`drawer glass-3${drag.dragging ? " dragging" : ""}${phase === "exit" ? " is-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Séjour à ${d.city}`}
      ref={asideRef}
      // Pendant le geste, la feuille suit le doigt ; à la fermeture, l'animation de sortie repart de là (--dy).
      style={{ transform: drag.dy ? `translateY(${drag.dy}px)` : undefined, "--dy": `${drag.dy}px` } as React.CSSProperties}
    >
      <div className="drawer-inner">
        <div className="grip" {...drag.handlers}>
          <span className="handle" aria-hidden="true" />
        </div>
        <div className="hero-post">
          <Scene dest={d} width={1280} />
          <TempTag temp={trip.temp} />
          <button className="btn sm close" type="button" aria-label="Fermer" ref={closeRef} onClick={onClose}>
            ✕
          </button>
          <div className="over">
            <h2>{d.city}</h2>
            <p className="hint" style={{ color: "#E6ECF3" }}>
              {d.country} · {fmtLong(w.out)} → {fmtLong(w.ret)}
            </p>
            <LandTags dest={d} />
          </div>
          {photo && (
            <a className="credit" href={photo.page} target="_blank" rel="noopener" title="Voir la photo sur Wikimedia Commons">
              {photoCredit(photo)}
            </a>
          )}
        </div>

        <div className="route glass">
          <MiniMap trip={trip} departures={departures} />
          <div className="meta">
            <span>
              <Icon name="route" /> <b className="num">{km.toLocaleString("fr-FR")} km</b> à vol d&apos;oiseau
            </span>
            <span>
              <Icon name={trip.best.mode} /> <b>{trip.best.duration}</b> depuis {o.label}
            </span>
            <span>
              <Icon name="sun" /> <b className="num">{trip.temp} °C</b> en moyenne
            </span>
          </div>
        </div>

        <div className="budget glass">
          <table>
            <tbody>
              <tr>
                <td>
                  {MODE_LABEL[trip.best.mode]} A/R{trip.best.mode === "plane" ? ` · ${trip.best.airline}` : ""} × {a}
                </td>
                <td className="num">{eur(trip.transportTotal)}</td>
              </tr>
              <tr>
                <td>
                  {w.nights} nuits × {trip.rooms} chambre{trip.rooms > 1 ? "s" : ""} à ~{eur(trip.nightly)}
                </td>
                <td className="num">{eur(trip.stayTotal)}</td>
              </tr>
              <tr className="total">
                <td>
                  Total pour {a} personne{a > 1 ? "s" : ""}
                  <small>soit {eur(trip.perPerson)} par personne</small>
                </td>
                <td className="num">{eur(trip.total)}</td>
              </tr>
              {activities !== null && (
                <tr className="extra">
                  <td>
                    Séjour complet, programme d&apos;activités compris
                    <small>
                      + ~{eur(activities)} d&apos;activités · {eur(Math.round((trip.total + activities) / a))} par personne
                    </small>
                  </td>
                  <td className="num">~{eur(trip.total + activities)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Itinerary trip={trip} profile={profile} state={plan} onToast={onToast} />

        {flexible && trip.alternatives.length > 1 && (
          <div className="section">
            <h3>
              <Icon name="cal" />
              Autres dates du mois
            </h3>
            <div className="alt-dates">
              {trip.alternatives.map((x) => (
                <div key={x.window.key} className={x.window.key === w.key ? "d glass pick" : "d glass"}>
                  <span>
                    {fmtShort(x.window.out)} → {fmtShort(x.window.ret)}
                    {x.window.key === w.key ? " · retenu" : ""}
                  </span>
                  <b className="num">{eur(x.perPerson)}/pers.</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <h3>
            <Icon name="plane" />
            Vols
          </h3>
          {flights.length ? (
            flights.map((f, i) => (
              <div key={f.origin} className={isBest(f) ? "opt glass pick" : "opt glass"}>
                <div className="opt-row">
                  <span className="who">{f.airline}</span>
                  <span className="meta">
                    {f.originLabel} ({f.origin}) → {d.iata} · {f.duration} · {f.direct ? "direct" : `${f.stops || 1} ${plural(f.stops || 1, "escale")}`}
                    {f.viaNearby && f.nearbyMinutes != null ? ` · ${minutesLabel(f.nearbyMinutes)} pour rejoindre ${f.originCity}` : ""}
                  </span>
                  <span className="p num">
                    {eur(f.price)} <small>/pers. A/R</small>
                  </span>
                </div>
                <div className="links">
                  <Ext href={f.link ?? LINKS.aviasales(flightLink(f.origin!))} label="Réserver sur Aviasales" primary={i === 0} />
                  <Ext href={LINKS.googleFlights(flightLink(f.origin!))} label="Google Flights" />
                  <Ext href={LINKS.skyscanner(flightLink(f.origin!))} label="Skyscanner" />
                  <Ext href={LINKS.kayak(flightLink(f.origin!))} label="Kayak" />
                </div>
              </div>
            ))
          ) : (
            <p className="note">Aucun vol depuis tes aéroports avec ces critères.</p>
          )}
        </div>

        <div className="section">
          <h3>
            <Icon name="train" />
            Train, bus, covoiturage
          </h3>
          {ground.length ? (
            ground.map((g) => {
              const dep = departures.find((x) => x.id === g.depId) ?? firstDep;
              return (
                <div key={`${g.mode}-${g.depId}`} className={isBest(g) ? "opt glass pick" : "opt glass"}>
                  <div className="opt-row">
                    <span className="who">
                      <Icon name={g.mode} /> {MODE_LABEL[g.mode]}
                    </span>
                    <span className="meta">
                      depuis {g.originLabel} · {g.duration}
                      {g.enabled ? "" : " · non coché dans les filtres"}
                    </span>
                    <span className="p num">
                      {g.max ? `${eur(g.price)} à ${eur(g.max)}` : `~${eur(g.price)}`} <small>/pers. A/R</small>
                    </span>
                  </div>
                  <div className="opt-row">
                    <span className="est">Estimation, prix à confirmer sur le site</span>
                  </div>
                  <div className="links">
                    {g.mode === "train" && (
                      <>
                        <Ext href={LINKS.sncfConnect(dep.label, d.city, w.out)} label="SNCF Connect" primary />
                        <Ext href={LINKS.trainline(dep.label, d.city, w.out, w.ret)} label="Trainline" />
                      </>
                    )}
                    {g.mode === "bus" && <Ext href={LINKS.flixbus(dep.en, d.en, w.out, w.ret, a)} label="FlixBus" primary />}
                    {g.mode === "car" && (
                      <>
                        <Ext href={LINKS.blablacar(dep.label, d.city, w.out, a)} label="BlaBlaCar (aller)" primary />
                        <Ext href={LINKS.blablacar(d.city, dep.label, w.ret, a)} label="BlaBlaCar (retour)" />
                      </>
                    )}
                  </div>
                  {g.mode === "train" && a > 1 && (
                    <div className="opt-row">
                      <span className="est">Nombre de voyageurs à régler sur le site : les liens ouvrent pour 1 personne.</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="opt glass">
              <p className="note">Pas d&apos;estimation terrestre pour ce trajet. Les sites, eux, savent répondre :</p>
              <div className="links">
                <Ext href={LINKS.sncfConnect(firstDep.label, d.city, w.out)} label="SNCF Connect" />
                <Ext href={LINKS.trainline(firstDep.label, d.city, w.out, w.ret)} label="Trainline" />
                <Ext href={LINKS.flixbus(firstDep.en, d.en, w.out, w.ret, a)} label="FlixBus" />
                <Ext href={LINKS.blablacar(firstDep.label, d.city, w.out, a)} label="BlaBlaCar" />
              </div>
              {a > 1 && (
                <div className="opt-row">
                  <span className="est">Train : nombre de voyageurs à régler sur le site, les liens ouvrent pour 1 personne.</span>
                </div>
              )}
            </div>
          )}
          <div className="links" style={{ marginTop: 10 }}>
            <Ext href={LINKS.rome2rio(firstDep.en, d.en)} label="Comparer tous les trajets sur Rome2Rio" />
          </div>
        </div>

        <div className="section">
          <h3>
            <Icon name="bed" />
            Hébergement
          </h3>
          <div className="opt glass">
            <div className="opt-row">
              <span className="who">Chambre double, centre-ville</span>
              <span className="meta">
                {w.nights} nuits · {fmtShort(w.out)} → {fmtShort(w.ret)}
              </span>
              <span className="p num">
                ~{eur(trip.nightly)} <small>/nuit</small>
              </span>
            </div>
            <div className="opt-row">
              <span className="est">Estimation moyenne, à comparer</span>
            </div>
            <div className="links">
              <Ext href={LINKS.booking(d.city, w.out, w.ret, a)} label="Booking.com" primary />
              <Ext href={LINKS.airbnb(d.city, w.out, w.ret, a)} label="Airbnb" />
            </div>
          </div>
        </div>

        <div className="links">
          <button className={fav ? "btn on" : "btn"} type="button" onClick={() => onFav(d.id)}>
            <Icon name="heart" /> {fav ? "Dans tes favoris" : "Ajouter aux favoris"}
          </button>
          <button className="btn" type="button" onClick={onShareLink}>
            <Icon name="share" />
            Copier le lien
          </button>
          <button className="btn" type="button" onClick={share}>
            Copier le résumé
          </button>
        </div>
      </div>
    </aside>
  );
}
