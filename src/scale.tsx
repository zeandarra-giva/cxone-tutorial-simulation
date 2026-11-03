import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/*
 * Responsive scaling for the whole simulator.
 * The CXone screens are a pixel replica, so instead of re-flowing them we scale the entire app to the
 * window: bigger screens get bigger elements, smaller screens get smaller ones (same proportions).
 *
 * The app renders inside a transform: scale() wrapper, so anything that turns screen coordinates
 * (getBoundingClientRect, mouse clientX/Y, window size) into CSS positions must divide by uiScale().
 */
const BASE_W = 1680; // design width at scale 1
const BASE_H = 1000; // design height at scale 1
const MIN = 0.8, MAX = 1.75;

let current = 1;
export const uiScale = () => current;

export function computeScale() {
  const s = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
  return Math.round(Math.min(MAX, Math.max(MIN, s)) * 100) / 100;
}

/** A screen-space rect (getBoundingClientRect) in the app's own CSS pixels. */
export function toLocal(r: { left: number; top: number; width: number; height: number }) {
  const s = current;
  return { left: r.left / s, top: r.top / s, width: r.width / s, height: r.height / s };
}
/** Window size in the app's own CSS pixels. */
export const viewW = () => window.innerWidth / current;
export const viewH = () => window.innerHeight / current;

export function ScaleRoot({ children }: { children: ReactNode }) {
  const [s, setS] = useState(computeScale);
  current = s;
  useEffect(() => {
    const f = () => setS(computeScale());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return <div className="app-scale" style={{ '--s': s } as CSSProperties}>{children}</div>;
}
