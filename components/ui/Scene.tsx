import { useMemo } from "react";
import type { Destination } from "@/types";
import { sceneSVG } from "@/lib/scene";

/** Paysage illustré d'une destination, en couverture de son conteneur (position: absolute). */
export function Scene({ dest }: { dest: Destination }) {
  const html = useMemo(() => sceneSVG(dest), [dest]);
  return <div className="scene-host" dangerouslySetInnerHTML={{ __html: html }} />;
}
