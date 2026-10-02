"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DeparturePoint, SearchParams, SortKey, TripOption, VibeId, ViewMode } from "@/types";
import { buildWindows, type MonthOption } from "@/lib/dates";
import { eur, fmtLong, fmtShort, listFr, plural } from "@/lib/format";
import { defaultPrefs, getPrefsSnapshot, getServerPrefsSnapshot, subscribePrefs, updatePrefs, type Prefs } from "@/lib/prefs";
import { matchesVibes, originsFor, sortTrips } from "@/lib/pricing";
import { Header } from "./Header";
import { SearchRail, type SearchForm } from "./search/SearchRail";
import { VibeChips } from "./search/VibeChips";
import { MapView } from "./results/MapView";
import { ResultsHeader } from "./results/ResultsHeader";
import { SwipeDeck } from "./results/SwipeDeck";
import { TripDrawer } from "./results/TripDrawer";
import { TripGrid } from "./results/TripGrid";
import { DeparturesDialog } from "./settings/DeparturesDialog";

interface Props {
  initialDepartures: DeparturePoint[];
  months: MonthOption[];
}

/** Champs de recherche non persistés : dates et transports. */
type DateForm = Omit<SearchForm, "travelers" | "budget">;

const DURATION_LABEL = { weekend: "ce week-end", long: "ce long week-end", week: "cette semaine" } as const;
const DURATION_SHORT = { weekend: "week-end", long: "long week-end", week: "semaine" } as const;
const DURATION_LONG = { weekend: "week-end (2 nuits)", long: "long week-end (3 nuits)", week: "semaine (7 nuits)" } as const;

export default function EscapadeApp({ initialDepartures, months }: Props) {
  const defaults = useMemo(() => defaultPrefs(initialDepartures), [initialDepartures]);
  const stored = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, getServerPrefsSnapshot);
  const prefs: Prefs = stored ?? defaults;
  const setPrefs = useCallback((update: (p: Prefs) => Prefs) => updatePrefs(update, defaults), [defaults]);

  const firstFlex = useMemo(() => buildWindows({ dateMode: "flex", month: months[0].value, duration: "weekend", dateOut: "", dateIn: "" })[0], [months]);
  const [form, setForm] = useState<DateForm>({
    dateMode: "flex",
    month: months[0].value,
    duration: "weekend",
    dateOut: firstFlex?.out ?? "",
    dateIn: firstFlex?.ret ?? "",
    modes: { plane: true, train: true, bus: true, car: true },
    directOnly: false,
  });
  const [vibes, setVibes] = useState<VibeId[]>([]);
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("total");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [swiped, setSwiped] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  // La requête serveur ne dépend que de ces champs ; budget et envies se filtrent ici, sans appel.
  const departures = useMemo(() => prefs.saved.filter((d) => prefs.activeIds.includes(d.id)), [prefs.saved, prefs.activeIds]);
  const query = useMemo<SearchParams>(
    () => ({
      departures,
      includeNearby: prefs.includeNearby,
      excludedNearby: prefs.excludedNearby,
      dateMode: form.dateMode,
      month: form.month,
      duration: form.duration,
      dateOut: form.dateOut,
      dateIn: form.dateIn,
      travelers: prefs.travelers,
      modes: form.modes,
      directOnly: form.directOnly,
      budget: 0,
      vibes: [],
    }),
    [departures, prefs.includeNearby, prefs.excludedNearby, prefs.travelers, form.dateMode, form.month, form.duration, form.dateOut, form.dateIn, form.modes, form.directOnly],
  );
  const windows = useMemo(() => buildWindows(query), [query]);
  const noQuery = !departures.length || !windows.length;

  useEffect(() => {
    if (noQuery) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query), signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data: { trips: TripOption[]; provider: string | null } = await res.json();
        setTrips(data.trips);
        setProvider(data.provider);
        setError(null);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Impossible de charger les prix. Réessaie dans un instant.");
      } finally {
        if (!ctrl.signal.aborted) setFetching(false);
      }
    }, 120);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query, noQuery]);

  // Dérivés d'affichage
  const loading = fetching && !noQuery;
  const filtered = useMemo(() => {
    let all = noQuery ? [] : trips;
    if (onlyFavs) all = all.filter((t) => prefs.favs.includes(t.destination.id));
    if (vibes.length) all = all.filter((t) => matchesVibes(t, vibes));
    return all;
  }, [noQuery, trips, onlyFavs, prefs.favs, vibes]);
  const inBudget = useMemo(() => filtered.filter((t) => t.perPerson <= prefs.budget), [filtered, prefs.budget]);
  const outBudget = useMemo(() => sortTrips(filtered.filter((t) => t.perPerson > prefs.budget), "total"), [filtered, prefs.budget]);
  const byTotal = useMemo(() => sortTrips(inBudget, "total"), [inBudget]);
  const bestId = byTotal[0]?.destination.id ?? null;
  const shown = view === "grid" ? sortTrips(inBudget, sort) : byTotal;
  const openTrip = filtered.find((t) => t.destination.id === openId) ?? null;
  const depLabels = departures.map((d) => d.label);
  const nearbyCodes = [...originsFor(query).entries()].filter(([, v]) => v.nearby).map(([c]) => c);

  const whenLabel = form.dateMode === "flex" ? DURATION_LABEL[form.duration] : `du ${fmtShort(form.dateOut)} au ${fmtShort(form.dateIn)}`;
  const monthOption = months.find((m) => m.value === form.month);
  let title: string;
  let subtitle: string;
  let emptyMessage: string;
  if (!departures.length) {
    title = "Choisis une ville de départ";
    subtitle = "Au moins une, dans la recherche.";
    emptyMessage = "Aucune ville de départ sélectionnée.";
  } else if (form.dateMode === "fixed" && !windows.length) {
    title = "Dates à corriger";
    subtitle = "La date de retour doit être après le départ.";
    emptyMessage = "Choisis une date de retour postérieure au départ.";
  } else {
    const n = inBudget.length;
    title = n ? `${n} ${plural(n, "escapade")} dès ${eur(byTotal[0].perPerson)}` : loading ? "Recherche en cours…" : "Aucune escapade";
    subtitle =
      form.dateMode === "flex"
        ? `${monthOption?.label ?? form.month} · ${DURATION_LONG[form.duration]} · ${prefs.travelers} pers. · dates les moins chères par destination`
        : `Du ${fmtLong(form.dateOut)} au ${fmtLong(form.dateIn)} · ${prefs.travelers} pers.`;
    emptyMessage = onlyFavs
      ? "Aucun favori dans ce budget. Garde des destinations avec le cœur ou en swipant à droite."
      : vibes.length
        ? "Rien avec toutes ces envies dans ce budget. Retire une envie ou monte le budget."
        : loading
          ? "Recherche en cours…"
          : "Rien dans ce budget avec ces critères. Monte le budget ou coche d'autres transports.";
  }

  // Actions
  const toggleFav = useCallback((id: string) => setPrefs((p) => ({ ...p, favs: p.favs.includes(id) ? p.favs.filter((x) => x !== id) : [...p.favs, id] })), [setPrefs]);
  const decide = useCallback(
    (id: string, dir: "left" | "right") => {
      setSwiped((s) => [...s, id]);
      if (dir === "right") {
        setPrefs((p) => (p.favs.includes(id) ? p : { ...p, favs: [...p.favs, id] }));
        showToast("Gardé dans tes favoris");
      }
    },
    [setPrefs, showToast],
  );
  const closeAll = useCallback(() => {
    setOpenId(null);
    setSettingsOpen(false);
    setRailOpen(false);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeAll]);
  const onFormChange = (patch: Partial<SearchForm>) => {
    const { travelers, budget, ...rest } = patch;
    if (travelers !== undefined || budget !== undefined) setPrefs((p) => ({ ...p, travelers: travelers ?? p.travelers, budget: budget ?? p.budget }));
    if (Object.keys(rest).length) setForm((f) => ({ ...f, ...rest }));
  };

  const overlayOpen = railOpen || settingsOpen || openId !== null;
  const fabWhen = form.dateMode === "flex" ? `${monthOption?.short ?? form.month} · ${DURATION_SHORT[form.duration]}` : `${fmtShort(form.dateOut)} → ${fmtShort(form.dateIn)}`;

  return (
    <>
      <Header favCount={prefs.favs.length} onlyFavs={onlyFavs} onToggleFavs={() => setOnlyFavs((v) => !v)} departureLabels={depLabels} onOpenSettings={() => setSettingsOpen(true)} provider={provider} />
      <main className="shell">
        <section className="hero">
          <h1>
            On part <span className="grad">où</span> {whenLabel} ?
          </h1>
          <p className="hero-sub">{depLabels.length ? `Depuis ${listFr(depLabels)}${prefs.includeNearby ? " et les alentours" : ""}, au meilleur prix, en dix secondes.` : "Choisis d'abord une ville de départ."}</p>
          <VibeChips selected={vibes} onToggle={(id) => setVibes((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))} />
        </section>

        <div className="cols">
          <SearchRail
            form={{ ...form, travelers: prefs.travelers, budget: prefs.budget }}
            onChange={onFormChange}
            months={months}
            saved={prefs.saved}
            activeIds={prefs.activeIds}
            onToggleDeparture={(id) => setPrefs((p) => ({ ...p, activeIds: p.activeIds.includes(id) ? p.activeIds.filter((x) => x !== id) : [...p.activeIds, id] }))}
            includeNearby={prefs.includeNearby}
            onIncludeNearby={(on) => setPrefs((p) => ({ ...p, includeNearby: on }))}
            nearbyInfo={prefs.includeNearby ? (nearbyCodes.length ? `Aéroports voisins inclus : ${nearbyCodes.join(", ")}.` : "Aucun aéroport voisin pour cette sélection.") : "Seuls les aéroports et gares des villes choisies."}
            open={railOpen}
            onClose={() => setRailOpen(false)}
          />

          <section className="results" aria-live="polite">
            <ResultsHeader title={title} subtitle={subtitle} view={view} onView={setView} sort={sort} onSort={setSort} loading={loading} />
            {error && <p className="note warn">{error}</p>}
            {outBudget.length > 0 && (
              <p className="note warn">
                {outBudget.length} autre{outBudget.length > 1 ? "s" : ""} {plural(outBudget.length, "escapade")} au-dessus de {eur(prefs.budget)} (la plus proche : {outBudget[0].destination.city}, {eur(outBudget[0].perPerson)}).
              </p>
            )}
            {view === "grid" && <TripGrid trips={shown} bestId={bestId} favs={prefs.favs} emptyMessage={emptyMessage} onOpen={setOpenId} onFav={toggleFav} />}
            {view === "swipe" && <SwipeDeck trips={byTotal} swiped={swiped} favCount={prefs.favs.length} emptyMessage={emptyMessage} onDecide={decide} onOpen={setOpenId} onReset={() => setSwiped([])} />}
            {view === "map" && <MapView trips={byTotal.concat(outBudget)} inBudgetIds={new Set(inBudget.map((t) => t.destination.id))} bestId={bestId} favs={prefs.favs} departures={departures} onOpen={setOpenId} />}
            <p className="foot">
              Prix indicatifs. Les boutons de réservation ouvrent de vrais liens pré-remplis (Aviasales, Google Flights, Skyscanner, SNCF Connect, BlaBlaCar, Booking, Airbnb…) : le prix final se confirme sur le site du vendeur.
            </p>
          </section>
        </div>
      </main>

      <button className="fab glass" type="button" onClick={() => setRailOpen(true)}>
        <span className="sum">
          {depLabels.join(" · ") || "Aucun départ"}{" "}
          <small>
            · {fabWhen} · {prefs.travelers} pers. · {eur(prefs.budget)} max
          </small>
        </span>
        <span className="btn sm primary" aria-hidden="true">
          Modifier
        </span>
      </button>

      {overlayOpen && <div className="backdrop" onClick={closeAll} />}
      {openTrip && (
        <TripDrawer
          trip={openTrip}
          departures={departures}
          travelers={prefs.travelers}
          flexible={form.dateMode === "flex"}
          fav={prefs.favs.includes(openTrip.destination.id)}
          onFav={toggleFav}
          onClose={() => setOpenId(null)}
          onToast={showToast}
        />
      )}
      {settingsOpen && (
        <DeparturesDialog
          saved={prefs.saved}
          excludedNearby={prefs.excludedNearby}
          onToggleNearby={(iata) => setPrefs((p) => ({ ...p, excludedNearby: p.excludedNearby.includes(iata) ? p.excludedNearby.filter((x) => x !== iata) : [...p.excludedNearby, iata] }))}
          onRemove={(id) => setPrefs((p) => ({ ...p, saved: p.saved.filter((d) => d.id !== id), activeIds: p.activeIds.filter((x) => x !== id) }))}
          onAdd={(dep) => {
            setPrefs((p) => ({ ...p, saved: [...p.saved, dep], activeIds: [...p.activeIds, dep.id] }));
            showToast(`${dep.label} ajoutée`);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {toast && (
        <div className="toast glass-3" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
