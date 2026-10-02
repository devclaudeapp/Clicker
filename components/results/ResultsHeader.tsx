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
}

const VIEWS: { id: ViewMode; label: string; icon: string }[] = [
  { id: "grid", label: "Grille", icon: "grid" },
  { id: "swipe", label: "Swipe", icon: "layers" },
  { id: "map", label: "Carte", icon: "map" },
];

export function ResultsHeader({ title, subtitle, view, onView, sort, onSort, loading, onShare }: Props) {
  return (
    <div className="results-head" style={{ opacity: loading ? 0.7 : 1, transition: "opacity .2s" }}>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="tools">
        <div className="view" role="group" aria-label="Affichage">
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
      </div>
    </div>
  );
}
