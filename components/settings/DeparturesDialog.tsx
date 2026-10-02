import { useEffect, useRef, useState } from "react";
import type { DeparturePoint } from "@/types";
import { minutesLabel } from "@/lib/format";
import { Icon } from "../ui/Icon";

interface Props {
  saved: DeparturePoint[];
  excludedNearby: string[];
  onToggleNearby: (iata: string) => void;
  onRemove: (id: string) => void;
  onAdd: (dep: DeparturePoint) => void;
  onClose: () => void;
}

interface Suggestion {
  label: string;
  country: string;
}

/** Villes de départ : aéroports principaux, voisins à ~2 h (cochables), gares ; ajout d'une ville par recherche. */
export function DeparturesDialog({ saved, excludedNearby, onToggleNearby, onRemove, onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Suggestions au fil de la saisie, avec un léger délai ; sous deux caractères on n'affiche rien.
  const visible = query.trim().length < 2 ? [] : suggestions;
  useEffect(() => {
    if (query.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/places?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: { suggestions: Suggestion[] }) => setSuggestions(data.suggestions))
        .catch(() => {});
    }, 120);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const add = async (name: string) => {
    const q = name.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/places?resolve=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("introuvable");
      const data: { departure: DeparturePoint } = await r.json();
      if (saved.some((d) => d.id === data.departure.id)) setError(`${data.departure.label} est déjà dans la liste.`);
      else onAdd(data.departure);
      setQuery("");
      setSuggestions([]);
    } catch {
      setError(`Je ne connais pas « ${q} ». Essaie une grande ville ou une ville avec aéroport.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box glass-3">
        <div className="drawer-head">
          <div>
            <h2 id="settings-title" style={{ fontSize: 22 }}>
              Villes de départ
            </h2>
            <p className="hint">Tes points de départ habituels et les aéroports accessibles autour. Décoche ceux que tu ne veux pas.</p>
          </div>
          <button className="btn sm close" type="button" aria-label="Fermer" ref={closeRef} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {saved.map((d) => (
            <div key={d.id} className="dep glass">
              <h4>
                {d.label}
                <span className="pill">{d.airports.length ? d.airports.join(" · ") : "aucun aéroport"}</span>
                {saved.length > 1 && (
                  <button className="btn sm rm" type="button" onClick={() => onRemove(d.id)}>
                    Retirer
                  </button>
                )}
              </h4>
              {d.stations.length > 0 && <p className="hint">Gares : {d.stations.join(", ")}</p>}
              {d.nearby.length > 0 ? (
                <div className="near">
                  <span className="label">Alentours (~2 h)</span>
                  {d.nearby.map((n) => (
                    <label key={n.iata} className="check">
                      <input type="checkbox" checked={!excludedNearby.includes(n.iata)} onChange={() => onToggleNearby(n.iata)} /> {n.name} ({n.iata}){" "}
                      <small>
                        · {n.km} km · ~{minutesLabel(n.minutes)}
                      </small>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="hint">Aucun autre aéroport à moins de 2 h.</p>
              )}
            </div>
          ))}
        </div>

        <div className="field">
          <span className="label">Ajouter une ville</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              id="add-city-input"
              placeholder="Ex. Paris, Marseille, Annecy…"
              aria-label="Nom de la ville"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(visible[0]?.label ?? query);
                }
              }}
            />
            <button className="btn primary" type="button" disabled={busy} onClick={() => add(visible[0]?.label ?? query)}>
              <Icon name="plus" />
              Ajouter
            </button>
          </div>
          {visible.length > 0 && (
            <div className="chips">
              {visible.map((s) => (
                <button key={s.label} className="chip" type="button" onClick={() => add(s.label)}>
                  {s.label} <small className="hint">{s.country}</small>
                </button>
              ))}
            </div>
          )}
          {error && <p className="note warn">{error}</p>}
          <p className="hint">Les aéroports et gares à moins de 2 h sont trouvés automatiquement.</p>
        </div>
      </div>
    </div>
  );
}
