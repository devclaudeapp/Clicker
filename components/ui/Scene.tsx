import type { Destination } from "@/types";
import { sceneFor } from "@/lib/scene";

/** Paysage illustré d'une destination, en couverture de son conteneur (position: absolute). */
export function Scene({ dest }: { dest: Destination }) {
  return <div className="scene-host" dangerouslySetInnerHTML={{ __html: sceneFor(dest) }} />;
}
