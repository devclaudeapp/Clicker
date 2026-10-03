import { useEffect, useState } from "react";
import { Icon } from "./ui/Icon";

interface Props {
  favCount: number;
  onlyFavs: boolean;
  onToggleFavs: () => void;
  departureLabels: string[];
  onOpenSettings: () => void;
  /** Nom du fournisseur de prix actif, renvoyé par l'API (« mock », « travelpayouts »). */
  provider: string | null;
}

const PROVIDER_LABEL: Record<string, string> = { mock: "Prix fictifs", travelpayouts: "Prix Aviasales · cache 48 h" };
/** Au-delà de ce défilement, la barre se compacte et s'opacifie. */
const SCROLLED_PX = 24;

/**
 * Barre de navigation : une pilule de verre flottante, sous la barre d'état du téléphone (zone sûre), qui se resserre
 * quand la page défile. Marque à gauche, fournisseur de prix au centre, favoris et villes de départ à droite.
 */
export function Header({ favCount, onlyFavs, onToggleFavs, departureLabels, onOpenSettings, provider }: Props) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > SCROLLED_PX);
    const raf = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <header className={scrolled ? "top scrolled" : "top"}>
      <div className="top-inner glass-3">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <Icon name="plane" />
          </span>
          Escapade
        </div>
        {provider && <span className="pill">{PROVIDER_LABEL[provider] ?? provider}</span>}
        <nav aria-label="Navigation principale">
          <button className={onlyFavs ? "btn sm on" : "btn sm"} type="button" aria-pressed={onlyFavs} onClick={onToggleFavs} aria-label={`Afficher seulement les favoris (${favCount})`}>
            <Icon name="heart" />
            {/* La clé remonte le compteur à chaque changement : il rebondit. */}
            <span className={favCount ? "num count on" : "num count"} key={favCount}>
              {favCount}
            </span>
          </button>
          <button className="btn sm" type="button" onClick={onOpenSettings} title="Villes de départ" aria-label={`Villes de départ : ${departureLabels.join(", ") || "aucune"}`}>
            <Icon name="pin" />
            <span className="lbl">{departureLabels.length ? departureLabels.join(" · ") : "Villes"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
