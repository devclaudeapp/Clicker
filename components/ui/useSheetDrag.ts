"use client";

import { useRef, useState, type PointerEvent } from "react";

/** Au-delà de cette distance, ou de cette vitesse (px/ms), relâcher referme la feuille. */
const DISMISS_PX = 120;
const DISMISS_VELOCITY = 0.5;

export interface SheetDrag {
  /** Décalage vertical courant de la feuille, en pixels (0 au repos). */
  dy: number;
  dragging: boolean;
  /** À poser sur la zone de prise (poignée, en-tête) ; elle doit avoir `touch-action: none`. */
  handlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  };
}

/**
 * Geste de fermeture d'une feuille du bas : tirer la zone de prise vers le bas fait suivre la feuille ; relâcher loin
 * ou vite la referme, sinon elle revient en place. Inactif quand `active` est faux (grand écran).
 */
export function useSheetDrag(onDismiss: () => void, active: boolean): SheetDrag {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ id: number; y: number; lastY: number; lastT: number; velocity: number } | null>(null);

  const end = (dismiss: boolean) => {
    start.current = null;
    setDragging(false);
    if (dismiss) onDismiss();
    else setDy(0);
  };

  return {
    dy,
    dragging,
    handlers: {
      onPointerDown: (e) => {
        if (!active || e.button !== 0 || (e.target as HTMLElement).closest("button,a,input,select")) return;
        start.current = { id: e.pointerId, y: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      },
      onPointerMove: (e) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const dt = Math.max(1, e.timeStamp - s.lastT);
        s.velocity = (e.clientY - s.lastY) / dt;
        s.lastY = e.clientY;
        s.lastT = e.timeStamp;
        setDy(Math.max(0, e.clientY - s.y));
      },
      onPointerUp: (e) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const dist = Math.max(0, e.clientY - s.y);
        end(dist > DISMISS_PX || (dist > 24 && s.velocity > DISMISS_VELOCITY));
      },
      onPointerCancel: () => end(false),
    },
  };
}
