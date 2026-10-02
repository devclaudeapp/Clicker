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

export function Header({ favCount, onlyFavs, onToggleFavs, departureLabels, onOpenSettings, provider }: Props) {
  return (
    <header className="top glass">
      <div className="top-inner">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <Icon name="plane" />
          </span>
          Escapade
        </div>
        {provider && <span className="pill">{PROVIDER_LABEL[provider] ?? provider}</span>}
        <nav>
          <button className={onlyFavs ? "btn sm on" : "btn sm"} type="button" aria-pressed={onlyFavs} onClick={onToggleFavs} aria-label="Afficher seulement les favoris">
            <Icon name="heart" />
            <span className="num">{favCount}</span>
          </button>
          <button className="btn sm" type="button" onClick={onOpenSettings}>
            <Icon name="pin" />
            {departureLabels.length ? departureLabels.join(" · ") : "Villes"}
          </button>
        </nav>
      </div>
    </header>
  );
}
