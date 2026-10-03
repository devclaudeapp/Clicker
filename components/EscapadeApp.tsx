"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DeparturePoint, SearchParams, SortKey, TravelProfile, TripOption, VibeId, ViewMode } from "@/types";
import { buildWindows, earliestDeparture, type MonthOption } from "@/lib/dates";
import { eur, fmtLong, fmtShort, listFr, plural } from "@/lib/format";
import { MOTION, withViewTransition } from "@/lib/motion";
import { defaultPrefs, getPrefsSnapshot, getServerPrefsSnapshot, normalizePrefs, subscribePrefs, updatePrefs, type Prefs } from "@/lib/prefs";
import { matchesVibes, originsFor, sortTrips } from "@/lib/pricing";
import { encodeShare, type SharedInput } from "@/lib/share";
import { Header } from "./Header";
import { SearchRail, type SearchForm } from "./search/SearchRail";
import { VibeChips } from "./search/VibeChips";
import { FULL_VIEW, MapView, type ViewBox } from "./results/MapView";
import { ResultsHeader } from "./results/ResultsHeader";
import { SwipeDeck } from "./results/SwipeDeck";
import { TripDrawer } from "./results/TripDrawer";
import { TripGrid } from "./results/TripGrid";
import { DeparturesDialog } from "./settings/DeparturesDialog";
import { TabBar } from "./TabBar";
import { Icon } from "./ui/Icon";
import { useIsMobile } from "./ui/useMediaQuery";
import { usePresence } from "./ui/usePresence";

interface Props {
  initialDepartures: DeparturePoint[];
  months: MonthOption[];
  /** Recherche portée par l'URL (lien partagé), déjà validée côté serveur. */
  shared?: SharedInput;
  sharedDepartures?: DeparturePoint[];
}

/** Champs de recherche non persistés : dates et transports. */
type DateForm = Omit<SearchForm, "travelers" | "budget" | "group" | "ages">;

const DURATION_LABEL = { weekend: "ce week-end", long: "ce long week-end", week: "cette semaine" } as const;
const DURATION_LONG = { weekend: "week-end (2 nuits)", long: "long week-end (3 nuits)", week: "semaine (7 nuits)" } as const;
const TOAST_MS = 2000;

/** Élément qui a le focus, s'il peut le reprendre à la fermeture d'une surcouche. */
const focusedElement = (): HTMLElement | null => (typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);

export default function EscapadeApp({ initialDepartures, months, shared = {}, sharedDepartures = [] }: Props) {
  const defaults = useMemo(() => defaultPrefs(initialDepartures), [initialDepartures]);
  const stored = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, getServerPrefsSnapshot);
  const prefs: Prefs = useMemo(() => normalizePrefs(stored, defaults) ?? defaults, [stored, defaults]);
  const minDate = useMemo(() => earliestDeparture(), []);
  const setPrefs = useCallback((update: (p: Prefs) => Prefs) => updatePrefs(update, defaults), [defaults]);
  const mobile = useIsMobile();

  const firstFlex = useMemo(() => buildWindows({ dateMode: "flex", month: months[0].value, duration: "weekend", dateOut: "", dateIn: "" })[0], [months]);
  const [form, setForm] = useState<DateForm>(() => ({
    dateMode: shared.dateMode ?? "flex",
    month: shared.month && months.some((m) => m.value === shared.month) ? shared.month : months[0].value,
    duration: shared.duration ?? "weekend",
    dateOut: shared.dateOut ?? firstFlex?.out ?? "",
    dateIn: shared.dateIn ?? firstFlex?.ret ?? "",
    modes: shared.modes ?? { plane: true, train: true, bus: true, car: true },
    directOnly: shared.directOnly ?? false,
  }));
  const [vibes, setVibes] = useState<VibeId[]>(shared.vibes ?? []);
  const [view, setView] = useState<ViewMode>(shared.view ?? "grid");
  const [mapView, setMapView] = useState<ViewBox>(FULL_VIEW);
  const [sort, setSort] = useState<SortKey>("total");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(shared.open ?? null);
  const [swiped, setSwiped] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; shown: boolean }>({ msg: "", shown: false });
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Un seul minuteur de toast : un nouveau message relance le compte à rebours au lieu de se faire couper.
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast({ msg, shown: true });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast((t) => ({ ...t, shown: false })), TOAST_MS);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  // Lien partagé : on ajoute les villes de l'expéditeur aux réglages et on active exactement celles-là, une seule fois.
  const sharedApplied = useRef(false);
  useEffect(() => {
    if (sharedApplied.current) return;
    sharedApplied.current = true;
    const hasPrefs = sharedDepartures.length > 0 || shared.includeNearby !== undefined || shared.excludedNearby || shared.travelers || shared.budget || shared.group || shared.ages;
    if (!hasPrefs) return;
    setPrefs((p) => {
      const saved = p.saved.slice();
      for (const d of sharedDepartures) if (!saved.some((s) => s.id === d.id)) saved.push(d);
      return {
        ...p,
        saved,
        activeIds: sharedDepartures.length ? sharedDepartures.map((d) => d.id) : p.activeIds,
        includeNearby: shared.includeNearby ?? p.includeNearby,
        excludedNearby: shared.excludedNearby ?? p.excludedNearby,
        travelers: shared.travelers ?? p.travelers,
        budget: shared.budget ?? p.budget,
        group: shared.group ?? p.group,
        ages: shared.ages ?? p.ages,
      };
    });
    const t = window.setTimeout(() => showToast("Recherche partagée chargée"), 0);
    return () => window.clearTimeout(t);
  }, [sharedDepartures, shared, setPrefs, showToast]);

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
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setTrips([]);
          setError("Impossible de charger les prix. Réessaie dans un instant.");
        }
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

  const fixedOk = form.dateMode === "fixed" && windows.length > 0;
  const whenLabel = form.dateMode === "flex" ? DURATION_LABEL[form.duration] : fixedOk ? `du ${fmtShort(form.dateOut)} au ${fmtShort(form.dateIn)}` : "à ces dates";
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
    subtitle = "Départ à partir de demain, retour après le départ, trente nuits au plus.";
    emptyMessage = "Choisis un départ à partir de demain et un retour après le départ.";
  } else {
    const n = inBudget.length;
    title = n ? `${n} ${plural(n, "escapade")} dès ${eur(byTotal[0].perPerson)}` : loading ? "Recherche en cours…" : "Aucune escapade";
    subtitle =
      form.dateMode === "flex"
        ? `${monthOption?.label ?? form.month} · ${DURATION_LONG[form.duration]} · ${prefs.travelers} pers. · ${eur(prefs.budget)} max par personne · dates les moins chères`
        : `Du ${fmtLong(form.dateOut)} au ${fmtLong(form.dateIn)} · ${prefs.travelers} pers. · ${eur(prefs.budget)} max par personne`;
    emptyMessage = onlyFavs
      ? "Aucun favori dans ce budget. Garde des destinations avec le cœur ou en swipant à droite."
      : vibes.length
        ? "Rien avec toutes ces envies dans ce budget. Retire une envie ou monte le budget."
        : loading
          ? "Recherche en cours…"
          : "Rien dans ce budget avec ces critères. Monte le budget ou coche d'autres transports.";
  }

  // Surcouches : chacune mémorise l'élément à qui rendre le focus, et seule celle du dessus se ferme à Échap ou au clic sur le fond.
  const trigger = useRef<HTMLElement | null>(null);
  const restoreFocus = () => {
    trigger.current?.focus();
    trigger.current = null;
  };
  const openDrawer = useCallback((id: string) => {
    trigger.current = focusedElement();
    setOpenId(id);
  }, []);
  const closeDrawer = useCallback(() => {
    setOpenId(null);
    restoreFocus();
  }, []);
  const openSettings = () => {
    trigger.current = focusedElement();
    setRailOpen(false);
    setSettingsOpen(true);
  };
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    restoreFocus();
  }, []);
  const openRail = () => {
    trigger.current = focusedElement();
    setRailOpen(true);
  };
  const closeRail = useCallback(() => {
    setRailOpen(false);
    restoreFocus();
  }, []);
  const sheetOpen = railOpen && mobile;
  const overlayOpen = sheetOpen || settingsOpen || openTrip !== null;
  const closeTop = useCallback(() => {
    if (settingsOpen) closeSettings();
    else if (openId) closeDrawer();
    else if (railOpen) closeRail();
  }, [settingsOpen, openId, railOpen, closeSettings, closeDrawer, closeRail]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTop]);
  // La page ne défile plus derrière une surcouche ; la largeur de la barre de défilement est compensée pour éviter un saut.
  useEffect(() => {
    if (!overlayOpen) return;
    const body = document.body;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prev = { overflow: body.style.overflow, padding: body.style.paddingRight };
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.padding;
    };
  }, [overlayOpen]);

  // Présence : les surcouches restent montées le temps de leur animation de sortie.
  const backdrop = usePresence(overlayOpen, MOTION.overlay);
  const drawer = usePresence(openTrip !== null, MOTION.overlay);
  const settings = usePresence(settingsOpen, MOTION.component);
  const toastPresence = usePresence(toast.shown, MOTION.component);
  // La fiche garde sa destination pendant qu'elle se ferme.
  const [shownId, setShownId] = useState(openId);
  if (openId && openId !== shownId) setShownId(openId);
  const shownTrip = openTrip ?? filtered.find((t) => t.destination.id === shownId) ?? null;

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
  // « Surprends-moi » : une escapade au hasard parmi celles dans le budget et les envies, jamais celle déjà ouverte.
  const surprise = useCallback(() => {
    const pool = inBudget.filter((t) => t.destination.id !== openId);
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    showToast("On tire au sort…");
    window.setTimeout(() => openDrawer(pick.destination.id), 450);
  }, [inBudget, openId, showToast, openDrawer]);
  const firstLoad = loading && trips.length === 0;
  const onFormChange = (patch: Partial<SearchForm>) => {
    const { travelers, budget, group, ages, ...rest } = patch;
    if (travelers !== undefined || budget !== undefined || group !== undefined || ages !== undefined)
      setPrefs((p) => ({ ...p, travelers: travelers ?? p.travelers, budget: budget ?? p.budget, group: group ?? p.group, ages: ages ?? p.ages }));
    if (Object.keys(rest).length) setForm((f) => ({ ...f, ...rest }));
  };
  // Les cartes glissent vers leur nouvelle place quand les envies, le tri, les favoris ou la vue changent.
  const toggleVibe = (id: VibeId) => withViewTransition(() => setVibes((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id])));
  const changeSort = (s: SortKey) => withViewTransition(() => setSort(s));
  const changeView = (v: ViewMode) => withViewTransition(() => setView(v));
  const toggleOnlyFavs = () => withViewTransition(() => setOnlyFavs((v) => !v));

  // Lien de partage : l'adresse reflète toujours la recherche courante, et un bouton la copie.
  const shareQuery = useCallback(
    (open: string | null) =>
      encodeShare({
        departures: departures.map((d) => d.label),
        includeNearby: prefs.includeNearby,
        excludedNearby: prefs.excludedNearby,
        dateMode: form.dateMode,
        month: form.month,
        duration: form.duration,
        dateOut: form.dateOut,
        dateIn: form.dateIn,
        travelers: prefs.travelers,
        budget: prefs.budget,
        group: prefs.group,
        ages: prefs.ages,
        modes: form.modes,
        directOnly: form.directOnly,
        vibes,
        view,
        open,
      }),
    [departures, prefs.includeNearby, prefs.excludedNearby, prefs.travelers, prefs.budget, prefs.group, prefs.ages, form, vibes, view],
  );
  const currentQuery = shareQuery(openId);
  useEffect(() => {
    const t = window.setTimeout(() => window.history.replaceState(null, "", `${window.location.pathname}?${currentQuery}`), 300);
    return () => window.clearTimeout(t);
  }, [currentQuery]);
  const copyLink = useCallback(
    (open: string | null) => {
      const url = `${window.location.origin}${window.location.pathname}?${shareQuery(open)}`;
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => showToast("Lien copié")).catch(() => showToast("Copie impossible ici"));
      else showToast("Copie impossible ici");
    },
    [shareQuery, showToast],
  );

  const profile = useMemo<TravelProfile>(() => ({ group: prefs.group, ages: prefs.ages, vibes, travelers: prefs.travelers }), [prefs.group, prefs.ages, vibes, prefs.travelers]);
  const exiting = (phase: "open" | "exit") => (phase === "exit" ? " is-exiting" : "");

  return (
    <>
      <Header favCount={prefs.favs.length} onlyFavs={onlyFavs} onToggleFavs={toggleOnlyFavs} departureLabels={depLabels} onOpenSettings={openSettings} provider={provider} />
      <main className="shell">
        <section className="hero">
          <h1>
            On part <span className="grad">où</span> {whenLabel} ?
          </h1>
          <p className="hero-sub">{depLabels.length ? `Depuis ${listFr(depLabels)}${prefs.includeNearby ? " et les alentours" : ""}, au meilleur prix, en dix secondes.` : "Choisis d'abord une ville de départ."}</p>
          <VibeChips selected={vibes} onToggle={toggleVibe} />
        </section>

        <div className="cols">
          <SearchRail
            form={{ ...form, travelers: prefs.travelers, budget: prefs.budget, group: prefs.group, ages: prefs.ages }}
            onChange={onFormChange}
            months={months}
            minDate={minDate}
            saved={prefs.saved}
            activeIds={prefs.activeIds}
            onToggleDeparture={(id) => setPrefs((p) => ({ ...p, activeIds: p.activeIds.includes(id) ? p.activeIds.filter((x) => x !== id) : [...p.activeIds, id] }))}
            includeNearby={prefs.includeNearby}
            onIncludeNearby={(on) => setPrefs((p) => ({ ...p, includeNearby: on }))}
            nearbyInfo={prefs.includeNearby ? (nearbyCodes.length ? `Aéroports voisins inclus : ${nearbyCodes.join(", ")}.` : "Aucun aéroport voisin pour cette sélection.") : "Seuls les aéroports et gares des villes choisies."}
            open={railOpen}
            mobile={mobile}
            onClose={closeRail}
          />

          <section className="results">
            <ResultsHeader title={title} subtitle={subtitle} view={view} onView={changeView} sort={sort} onSort={changeSort} loading={loading} onShare={() => copyLink(null)} onSurprise={inBudget.length > 1 ? surprise : undefined} />
            {error && <p className="note warn">{error}</p>}
            {outBudget.length > 0 && (
              <p className="note warn">
                {outBudget.length} autre{outBudget.length > 1 ? "s" : ""} {plural(outBudget.length, "escapade")} au-dessus de {eur(prefs.budget)} (la plus proche : {outBudget[0].destination.city}, {eur(outBudget[0].perPerson)}).
              </p>
            )}
            {/* La vue change en fondu ; la clé remonte le contenu pour rejouer l'entrée. */}
            <div key={view} className="view-pane">
              {view === "grid" && <TripGrid trips={shown} bestId={bestId} favs={prefs.favs} emptyMessage={emptyMessage} skeleton={firstLoad ? 6 : 0} onOpen={openDrawer} onFav={toggleFav} />}
              {view === "swipe" && <SwipeDeck trips={byTotal} swiped={swiped} favCount={prefs.favs.length} emptyMessage={emptyMessage} enabled={!overlayOpen} onDecide={decide} onOpen={openDrawer} onReset={() => setSwiped([])} />}
              {view === "map" && <MapView trips={byTotal.concat(outBudget)} inBudgetIds={new Set(inBudget.map((t) => t.destination.id))} bestId={bestId} favs={prefs.favs} departures={departures} view={mapView} onView={setMapView} onOpen={openDrawer} />}
            </div>
            <p className="foot">
              Prix indicatifs. Les boutons de réservation ouvrent de vrais liens pré-remplis (Aviasales, Google Flights, Skyscanner, SNCF Connect, BlaBlaCar, Booking, Airbnb…) : le prix final se confirme sur le site du vendeur.
            </p>
          </section>
        </div>
      </main>

      {/* Téléphone : barre d'onglets fixe en bas (vues, favoris, recherche) ; masquée sur grand écran par le CSS. */}
      <TabBar view={view} onView={changeView} onlyFavs={onlyFavs} favCount={prefs.favs.length} onToggleFavs={toggleOnlyFavs} searchOpen={sheetOpen} onSearch={openRail} />

      {backdrop.mounted && <div className={`backdrop${exiting(backdrop.phase)}`} onClick={closeTop} />}
      {drawer.mounted && shownTrip && (
        <TripDrawer
          trip={shownTrip}
          departures={departures}
          travelers={prefs.travelers}
          profile={profile}
          flexible={form.dateMode === "flex"}
          fav={prefs.favs.includes(shownTrip.destination.id)}
          phase={drawer.phase}
          mobile={mobile}
          onFav={toggleFav}
          onClose={closeDrawer}
          onToast={showToast}
          onShareLink={() => copyLink(shownTrip.destination.id)}
        />
      )}
      {settings.mounted && (
        <DeparturesDialog
          saved={prefs.saved}
          excludedNearby={prefs.excludedNearby}
          phase={settings.phase}
          onToggleNearby={(iata) => setPrefs((p) => ({ ...p, excludedNearby: p.excludedNearby.includes(iata) ? p.excludedNearby.filter((x) => x !== iata) : [...p.excludedNearby, iata] }))}
          onRemove={(id) => setPrefs((p) => ({ ...p, saved: p.saved.filter((d) => d.id !== id), activeIds: p.activeIds.filter((x) => x !== id) }))}
          onAdd={(dep) => {
            setPrefs((p) =>
              p.saved.some((d) => d.id === dep.id) ? { ...p, activeIds: p.activeIds.includes(dep.id) ? p.activeIds : [...p.activeIds, dep.id] } : { ...p, saved: [...p.saved, dep], activeIds: [...p.activeIds, dep.id] },
            );
            showToast(`${dep.label} ajoutée`);
          }}
          onClose={closeSettings}
        />
      )}
      {toastPresence.mounted && (
        <div className={`toast glass-3${exiting(toastPresence.phase)}`} role="status">
          {toast.msg.includes("copié") && <Icon name="check" />}
          {toast.msg}
        </div>
      )}
    </>
  );
}
