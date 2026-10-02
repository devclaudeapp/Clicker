import type { VibeId } from "@/types";
import { VIBES } from "@/lib/data/vibes";
import { Icon } from "../ui/Icon";

interface Props {
  selected: VibeId[];
  onToggle: (id: VibeId) => void;
}

/** Rangée d'envies sous le titre : défile horizontalement sur téléphone, s'enroule sur grand écran. */
export function VibeChips({ selected, onToggle }: Props) {
  return (
    <div className="vibes" aria-label="Envies">
      {VIBES.map((v) => {
        const on = selected.includes(v.id);
        return (
          <button key={v.id} className={on ? "chip vibe on" : "chip vibe"} type="button" aria-pressed={on} onClick={() => onToggle(v.id)}>
            <Icon name={v.icon} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
