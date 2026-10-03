import { useLayoutEffect, useRef } from "react";
import type { SortKey, ViewMode } from "@/types";
import { Icon } from "../ui/Icon";

interface Props {
  title: string;
  subtitle: string;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  loading: boolean;
  onShare: () => void;
  /** Tire une escapade au sort parmi celles qui restent après budget et envies ; absent quand il n'y a rien à tirer. */
  onSurprise?: () => void;
}

const VIEWS: { id: ViewMode; label: string; icon: string }[] = [
  { id: "grid", label: "Grille", icon: "grid" },
  { id: "swipe", label: "Swipe", icon: "layers" },
  { id: "map", label: "Carte", icon: "map" },
];

export function ResultsHeader({ title, subtitle, view, onView, sort, onSort, loading, onShare, onSurprise }: Props) {
  const groupRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);

  // L'indicateur glisse sous le bouton actif : sa position est lue dans le DOM (les libellés n'ont pas la même largeur).
  useLayoutEffect(() => {
    const place = () => {
      const active = groupRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
      const ind = indRef.current;
      if (!active || !ind) return;
      ind.style.transform = `translateX(${active.offsetLeft}px)`;
      ind.style.width = `${active.offsetWidth}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [view]);

  return (
    <div className="results-head">
      <div>
        <h2 aria-live="polite">{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="tools">
        <div className="view" role="group" aria-label="Affichage" ref={groupRef}>
          <span className="view-ind" aria-hidden="true" ref={indRef} />
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => onView(v.id)}>
              <Icon name={v.icon} />
              {v.label}
            </button>
          ))}
        </div>
        {view === "grid" && (
          <label className="sort">
            Trier
            <select className="input" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
              <option value="total">prix total</option>
              <option value="transport">prix du transport</option>
              <option value="temp">chaleur</option>
              <option value="name">nom</option>
            </select>
          </label>
        )}
        <button className="btn sm" type="button" onClick={onShare} title="Copier le lien de cette recherche">
          <Icon name="share" />
          Partager
        </button>
        {onSurprise && (
          <button className="btn sm primary" type="button" onClick={onSurprise} title="Ouvrir une escapade au hasard">
            <Icon name="sparkles" />
            Surprends-moi
          </button>
        )}
      </div>
      {/* Recherche en cours : barre fine qui défile, les cartes restent en place. */}
      {loading && <div className="progress" role="presentation" />}
    </div>
  );
}
