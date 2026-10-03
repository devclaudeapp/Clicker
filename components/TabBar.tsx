import type { ViewMode } from "@/types";
import { Icon } from "./ui/Icon";

interface Props {
  view: ViewMode;
  onView: (v: ViewMode) => void;
  onlyFavs: boolean;
  favCount: number;
  onToggleFavs: () => void;
  /** La feuille de recherche est ouverte : l'onglet central est marqué actif. */
  searchOpen: boolean;
  onSearch: () => void;
}

/**
 * Barre d'onglets du téléphone, fixée en bas sous la zone sûre : les trois vues, les favoris, et au centre le bouton
 * de recherche en relief qui ouvre la feuille. Masquée sur grand écran (le sélecteur de vue de l'en-tête des résultats
 * prend le relais).
 */
export function TabBar({ view, onView, onlyFavs, favCount, onToggleFavs, searchOpen, onSearch }: Props) {
  const tab = (id: ViewMode, label: string, icon: string) => (
    <button type="button" aria-pressed={view === id} onClick={() => onView(id)}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="tabbar glass-3" aria-label="Navigation">
      {tab("grid", "Grille", "grid")}
      {tab("swipe", "Swipe", "layers")}
      <button type="button" className="search" aria-pressed={searchOpen} onClick={onSearch}>
        <span className="orb" aria-hidden="true">
          <Icon name="search" />
        </span>
        <span>Recherche</span>
      </button>
      {tab("map", "Carte", "map")}
      <button type="button" aria-pressed={onlyFavs} onClick={onToggleFavs} aria-label={`Favoris (${favCount})`}>
        <span className="ico">
          <Icon name="heart" />
          {favCount > 0 && (
            <span className="badge num" key={favCount}>
              {favCount}
            </span>
          )}
        </span>
        <span>Favoris</span>
      </button>
    </nav>
  );
}
