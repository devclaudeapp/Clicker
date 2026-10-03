"use client";

import { useEffect, useRef, useState } from "react";
import type { Destination, Photo as PhotoData } from "@/types";
import { photoCredit, photoFor, photoUrl } from "@/lib/photos";
import { sceneFor } from "@/lib/scene";

/**
 * Paysage illustré d'une destination, en couverture de son conteneur (position: absolute), avec sa photo par-dessus
 * quand elle existe. `width` est la largeur d'affichage prévue (doublée pour les écrans denses).
 */
export function Scene({ dest, width = 500 }: { dest: Destination; width?: number }) {
  const photo = photoFor(dest.id);
  return (
    <>
      <div className="scene-host" dangerouslySetInnerHTML={{ __html: sceneFor(dest) }} />
      {photo && <Photo key={dest.id} photo={photo} width={width} />}
    </>
  );
}

/** Marge autour de l'écran à partir de laquelle une photo commence à se charger. */
const NEAR = "300px";

/**
 * La photo ne se charge qu'à l'approche de l'écran (observateur maison : le `loading="lazy"` natif reste inerte dans les
 * conteneurs animés), apparaît en fondu une fois chargée, et s'efface si elle ne charge pas : le paysage SVG reste seul.
 */
function Photo({ photo, width }: { photo: PhotoData; width: number }) {
  const ref = useRef<HTMLImageElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: NEAR },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  if (state === "error") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- miniature Wikimedia servie telle quelle, sans optimiseur d'images
    <img
      ref={ref}
      className={state === "ok" ? "photo on" : "photo"}
      src={near ? photoUrl(photo, width) : undefined}
      srcSet={near ? `${photoUrl(photo, width)} 1x, ${photoUrl(photo, width * 2)} 2x` : undefined}
      alt=""
      title={photoCredit(photo)}
      decoding="async"
      draggable={false}
      onLoad={() => setState("ok")}
      onError={() => setState("error")}
    />
  );
}
