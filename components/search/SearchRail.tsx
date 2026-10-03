import type { AgeBand, DateMode, DeparturePoint, DurationPreset, GroupType, TransportMode } from "@/types";
import type { MonthOption } from "@/lib/dates";
import { AGES, GROUPS } from "@/lib/data/profile";
import { eur } from "@/lib/format";
import { Icon } from "../ui/Icon";

/** Champs du formulaire de recherche (hors villes de départ et envies, gérés à part). */
export interface SearchForm {
  dateMode: DateMode;
  month: string;
  duration: DurationPreset;
  dateOut: string;
  dateIn: string;
  travelers: number;
  budget: number;
  group: GroupType;
  ages: AgeBand[];
  modes: Record<TransportMode, boolean>;
  directOnly: boolean;
}

interface Props {
  form: SearchForm;
  onChange: (patch: Partial<SearchForm>) => void;
  months: MonthOption[];
  /** Premier jour de départ acceptable (demain), pour les champs de dates fixes. */
  minDate: string;
  saved: DeparturePoint[];
  activeIds: string[];
  onToggleDeparture: (id: string) => void;
  includeNearby: boolean;
  onIncludeNearby: (on: boolean) => void;
  nearbyInfo: string;
  open: boolean;
  onClose: () => void;
}

const TRANSPORTS: { mode: TransportMode; label: string }[] = [
  { mode: "plane", label: "Avion" },
  { mode: "train", label: "Train" },
  { mode: "bus", label: "Bus" },
  { mode: "car", label: "Covoit'" },
];

export function SearchRail({ form, onChange, months, minDate, saved, activeIds, onToggleDeparture, includeNearby, onIncludeNearby, nearbyInfo, open, onClose }: Props) {
  const pct = ((form.budget - 100) / 900) * 100;
  // Solo et couple fixent le nombre de voyageurs ; une tranche d'âge au moins reste cochée.
  const pickGroup = (g: (typeof GROUPS)[number]) => onChange(g.travelers ? { group: g.id, travelers: g.travelers } : { group: g.id });
  const toggleAge = (id: AgeBand) => {
    const next = form.ages.includes(id) ? form.ages.filter((a) => a !== id) : AGES.map((a) => a.id).filter((a) => a === id || form.ages.includes(a));
    if (next.length) onChange({ ages: next });
  };
  return (
    <aside className={open ? "rail glass open" : "rail glass"} aria-label="Recherche">
      <div className="sheet-head">
        <span className="handle" aria-hidden="true" />
      </div>
      <div className="sheet-head">
        <strong>Ma recherche</strong>
        <button className="btn sm close" type="button" aria-label="Fermer" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="field">
        <span className="label">Départ</span>
        <div className="chips">
          {saved.map((d) => {
            const on = activeIds.includes(d.id);
            return (
              <label key={d.id} className={on ? "chip on" : "chip"}>
                <input type="checkbox" checked={on} onChange={() => onToggleDeparture(d.id)} />
                <Icon name="pin" />
                {d.label}
              </label>
            );
          })}
        </div>
        <label className="check">
          <input type="checkbox" checked={includeNearby} onChange={(e) => onIncludeNearby(e.target.checked)} /> Inclure les alentours (~2 h)
        </label>
        <p className="hint">{nearbyInfo}</p>
      </div>

      <div className="field">
        <span className="label">Dates</span>
        <div className={form.dateMode === "fixed" ? "seg right" : "seg"} role="radiogroup">
          <label className={form.dateMode === "flex" ? "on" : undefined}>
            <input type="radio" name="dateMode" checked={form.dateMode === "flex"} onChange={() => onChange({ dateMode: "flex" })} />
            Flexibles
          </label>
          <label className={form.dateMode === "fixed" ? "on" : undefined}>
            <input type="radio" name="dateMode" checked={form.dateMode === "fixed"} onChange={() => onChange({ dateMode: "fixed" })} />
            Fixes
          </label>
        </div>
        {form.dateMode === "flex" ? (
          <div className="row">
            <select className="input" id="month" aria-label="Mois" value={form.month} onChange={(e) => onChange({ month: e.target.value })}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select className="input" id="duration" aria-label="Durée" value={form.duration} onChange={(e) => onChange({ duration: e.target.value as DurationPreset })}>
              <option value="weekend">Week-end · 2 nuits</option>
              <option value="long">Long week-end · 3 nuits</option>
              <option value="week">Semaine · 7 nuits</option>
            </select>
          </div>
        ) : (
          <div className="row">
            <input className="input" type="date" id="date-out" aria-label="Date de départ" min={minDate} value={form.dateOut} onChange={(e) => onChange({ dateOut: e.target.value })} />
            <input className="input" type="date" id="date-in" aria-label="Date de retour" min={form.dateOut || minDate} value={form.dateIn} onChange={(e) => onChange({ dateIn: e.target.value })} />
          </div>
        )}
        <p className="hint">{form.dateMode === "flex" ? "On retient les dates les moins chères du mois, pour chaque destination." : "Prix pour ces dates précises."}</p>
      </div>

      <div className="row">
        <div className="field">
          <span className="label">Voyageurs</span>
          <div className="stepper">
            <button type="button" aria-label="Un voyageur de moins" onClick={() => onChange({ travelers: Math.max(1, form.travelers - 1) })}>
              −
            </button>
            <output className="num">{form.travelers}</output>
            <button type="button" aria-label="Un voyageur de plus" onClick={() => onChange({ travelers: Math.min(8, form.travelers + 1) })}>
              +
            </button>
          </div>
        </div>
        <div className="field">
          <span className="label">Budget / pers.</span>
          <output className="num" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 17 }}>
            {eur(form.budget)}
          </output>
          <input
            type="range"
            className="range"
            id="budget"
            min={100}
            max={1000}
            step={10}
            value={form.budget}
            style={{ "--pct": `${pct}%` } as React.CSSProperties}
            aria-label="Budget maximum par personne"
            onChange={(e) => onChange({ budget: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="field">
        <span className="label">Qui part ?</span>
        <div className="chips" role="radiogroup" aria-label="Composition du groupe">
          {GROUPS.map((g) => {
            const on = form.group === g.id;
            return (
              <label key={g.id} className={on ? "chip on" : "chip"}>
                <input type="radio" name="group" checked={on} onChange={() => pickGroup(g)} />
                <Icon name={g.icon} />
                {g.label}
              </label>
            );
          })}
        </div>
        <div className="chips" aria-label="Tranches d'âge">
          {AGES.map((a) => {
            const on = form.ages.includes(a.id);
            return (
              <label key={a.id} className={on ? "chip sm on" : "chip sm"}>
                <input type="checkbox" checked={on} onChange={() => toggleAge(a.id)} />
                {a.label}
              </label>
            );
          })}
        </div>
        <p className="hint">Le programme d&apos;activités de chaque fiche s&apos;adapte au groupe, aux âges et aux envies.</p>
      </div>

      <div className="field">
        <span className="label">Transport</span>
        <div className="chips">
          {TRANSPORTS.map((t) => {
            const on = form.modes[t.mode];
            return (
              <label key={t.mode} className={on ? "chip on" : "chip"}>
                <input type="checkbox" checked={on} onChange={(e) => onChange({ modes: { ...form.modes, [t.mode]: e.target.checked } })} />
                <Icon name={t.mode} />
                {t.label}
              </label>
            );
          })}
        </div>
        <label className="check">
          <input type="checkbox" checked={form.directOnly} onChange={(e) => onChange({ directOnly: e.target.checked })} /> Vols directs seulement
        </label>
        <p className="hint">Le prix affiché retient le moyen de transport le moins cher parmi ceux cochés.</p>
      </div>
    </aside>
  );
}
