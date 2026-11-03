import { useEffect, useState } from 'react';
import { toLocal, viewH, viewW } from '../scale';

export interface Rect { top: number; left: number; width: number; height: number }

/**
 * The simulator stage (right of the lessons sidebar). Training overlays render inside it, and it has a
 * transform, so their position:fixed coordinates are relative to the stage, not the window.
 */
export function stageBox() {
  const b = document.querySelector('.learn-stage')?.getBoundingClientRect();
  const r = b && toLocal(b);
  return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: viewW(), h: viewH() };
}

/** Tracks an element's on-screen rect every frame (null if not rendered). */
export function useRect(selector: string | null | undefined) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!selector) { setRect(null); return; }
    let raf = 0, last = '';
    const tick = () => {
      const el = document.querySelector(selector);
      const b = el?.getBoundingClientRect();
      const r = b && toLocal(b);
      const o = stageBox();
      const key = r ? `${r.top}|${r.left}|${r.width}|${r.height}|${o.x}|${o.y}` : 'none';
      if (key !== last) { last = key; setRect(r && r.width ? { top: r.top - o.y, left: r.left - o.x, width: r.width, height: r.height } : null); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return rect;
}

/** Pulsing outline around an element that does NOT block clicks. */
export function HintRing({ selector, label }: { selector: string | null | undefined; label?: string }) {
  const r = useRect(selector);
  if (!r) return null;
  return (
    <div className="hint-ring" style={{ top: r.top - 5, left: r.left - 5, width: r.width + 10, height: r.height + 10 }}>
      {label && <span className="hint-ring-label">{label}</span>}
    </div>
  );
}

export const tsel = (id: string) => `[data-tour="${id}"]`;

export function useTicker(ms = 1000) {
  const [n, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN((x) => x + 1), ms); return () => clearInterval(id); }, [ms]);
  return n;
}
