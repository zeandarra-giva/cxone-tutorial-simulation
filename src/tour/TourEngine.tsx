import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSim, type SimState } from '../store';
import { X } from 'lucide-react';
import { toLocal, viewH, viewW } from '../scale';
import type { Tour, TourStep } from './tours';

interface TourCtx {
  tour: Tour | null;
  index: number;
  start: (t: Tour) => void;
  stop: () => void;
  /** stop the tour and return to where lessons are picked */
  exit: () => void;
  /** re-apply the current step's setup (puts the screen back if the trainee moved ahead) */
  reapply: () => void;
  next: () => void;
  back: () => void;
  /** jump to a step (used when the trainee already did a later step's task) */
  goTo: (i: number) => void;
}
const Ctx = createContext<TourCtx | null>(null);
export const useTour = () => useContext(Ctx)!;

const PICKER_PATCH: Partial<SimState> = { screen: 'picker', appMenuOpen: false, profileMenuOpen: false, statusMenuOpen: false };

const DONE_KEY = 'cxone-sim-completed';
export function getCompleted(): string[] {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch { return []; }
}
function markCompleted(id: string) {
  try {
    const d = new Set(getCompleted());
    d.add(id);
    localStorage.setItem(DONE_KEY, JSON.stringify([...d]));
  } catch { /* storage unavailable */ }
}

export function TourProvider({ children, finishPatch, docked }: {
  children: ReactNode;
  finishPatch?: Partial<SimState>;
  /** docked = lessons sidebar on the left; the spotlight only covers the simulator stage */
  docked?: boolean | ((s: SimState) => boolean);
}) {
  const { s, set } = useSim();
  const [tour, setTour] = useState<Tour | null>(null);
  const [index, setIndex] = useState(0);
  const sRef = useRef(s);
  sRef.current = s;

  const applySetup = useCallback((step: TourStep | undefined) => {
    if (!step?.setup) return;
    const patch = typeof step.setup === 'function' ? step.setup(sRef.current) : step.setup;
    if (patch && Object.keys(patch).length) set(patch);
  }, [set]);

  const go = useCallback((t: Tour, i: number) => {
    if (i >= t.steps.length) {
      markCompleted(t.id);
      setTour(null);
      setIndex(0);
      set(finishPatch ?? PICKER_PATCH);
      window.dispatchEvent(new CustomEvent('tour-finished', { detail: t.id }));
      return;
    }
    setIndex(i);
    applySetup(t.steps[i]);
  }, [applySetup, set, finishPatch]);

  const start = (raw: Tour) => {
    const t = { ...raw, steps: raw.steps.filter((st) => !st.roles || st.roles.includes(sRef.current.role)) };
    setTour(t);
    if (t.init) set(t.init);
    setTimeout(() => go(t, 0), 0);
  };
  const stop = () => { setTour(null); setIndex(0); };
  const exit = () => { stop(); set(finishPatch ?? PICKER_PATCH); };
  const reapply = () => { if (tour) applySetup(tour.steps[index]); };
  const next = () => tour && go(tour, index + 1);
  const back = () => tour && index > 0 && go(tour, index - 1);
  const goTo = (i: number) => { if (tour && i > index) go(tour, i); };

  return (
    <Ctx.Provider value={{ tour, index, start, stop, exit, reapply, next, back, goTo }}>
      {children}
      {tour && ((typeof docked === 'function' ? docked(s) : docked)
        ? <DockedSpotlight step={tour.steps[index]} index={index} total={tour.steps.length} />
        : <Spotlight step={tour.steps[index]} index={index} total={tour.steps.length} title={tour.title} />)}
    </Ctx.Provider>
  );
}

interface Rect { top: number; left: number; width: number; height: number }

function useTargetRect(selector: string | undefined) {
  const [rect, setRect] = useState<Rect | null>(null);
  const scrolled = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }
    let raf = 0;
    let last = '';
    const tick = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        if (scrolled.current !== selector) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          scrolled.current = selector;
        }
        const r = toLocal(el.getBoundingClientRect());
        const key = `${r.top}|${r.left}|${r.width}|${r.height}`;
        if (key !== last) {
          last = key;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      } else if (last !== 'none') {
        last = 'none';
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return rect;
}

/** How far ahead to look for tasks the trainee has already done. */
const LOOKAHEAD = 4;

/**
 * Advance when the step's task is done: its target is clicked, or its state condition becomes true.
 * Trainees can explore freely, so they sometimes do a later step's task early (e.g. click Accept while
 * the lesson is still explaining the ringing call). Then we jump straight past that later step, and its
 * narration is replaced by the next one.
 */
function useAutoAdvance(step: TourStep) {
  const { tour, index, goTo } = useTour();
  const { s } = useSim();
  const steps = tour?.steps ?? [];
  const ahead = steps.slice(index, index + LOOKAHEAD + 1);

  useEffect(() => {
    const clickSteps = ahead.map((st, k) => ({ st, i: index + k })).filter(({ st }) => st.advance === 'click' && st.target);
    if (!clickSteps.length) return;
    const onClick = (e: MouseEvent) => {
      // capture phase: runs before the app reacts, so the clicked element is still on screen
      for (const { st, i } of clickSteps) {
        const el = document.querySelector(st.target!);
        if (el && el.contains(e.target as Node)) { setTimeout(() => goTo(i + 1), 60); return; }
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [step, index, tour]);

  useEffect(() => {
    // the current step's own condition
    if (step.advance === 'state' && step.until && step.until(s)) {
      const id = setTimeout(() => goTo(index + 1), 250);
      return () => clearTimeout(id);
    }
    // a later step's condition, but only once the trainee has clearly moved past this step
    // (its target is gone), so conditions that happen to be true already don't skip anything
    const gone = !!step.target && !document.querySelector(step.target);
    if (!gone) return;
    for (let k = 1; k < ahead.length; k++) {
      const st = ahead[k];
      if (st.advance === 'state' && st.until && st.until(s)) {
        const id = setTimeout(() => goTo(index + k + 1), 250);
        return () => clearTimeout(id);
      }
    }
  }, [s, step, index]);
}

/**
 * Walkthrough used with the lessons sidebar. It guides without taking over: a quiet outline around the
 * thing the step is about and a small step card next to it. Nothing is dimmed or blocked, so trainees
 * can explore freely; the lesson moves on when they do the task (or click Continue on explanation steps).
 */
function DockedSpotlight({ step, index, total }: { step: TourStep; index: number; total: number }) {
  const { next, reapply } = useTour();
  const rect = useTargetRect(step.target);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipSize, setTipSize] = useState({ w: 340, h: 120 });
  const [away, setAway] = useState(false);   // target not on screen (trainee is exploring elsewhere)
  const [stuck, setStuck] = useState(false); // still missing after "Show me"
  useAutoAdvance(step);
  const pad = step.padding ?? 6;
  const missing = !!step.target && !rect;
  const action = step.advance === 'click' || step.advance === 'state';

  // don't flash the "not on screen" card while the step's screen is still appearing
  useEffect(() => {
    setAway(false);
    setStuck(false);
    if (!missing) return;
    const id = setTimeout(() => setAway(true), 900);
    return () => clearTimeout(id);
  }, [missing, step]);

  useLayoutEffect(() => {
    if (tipRef.current) {
      const r = toLocal(tipRef.current.getBoundingClientRect());
      if (Math.abs(r.width - tipSize.w) > 1 || Math.abs(r.height - tipSize.h) > 1) setTipSize({ w: r.width, h: r.height });
    }
  });

  const stageEl = document.querySelector('.learn-stage');
  const st = stageEl ? toLocal(stageEl.getBoundingClientRect()) : { left: 0, top: 0, width: viewW(), height: viewH() };
  const sx = st.left, sy = st.top, sw = st.width, sh = st.height;
  const hole = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;

  let tipStyle: React.CSSProperties;
  let corner = false;
  if (!hole) {
    if (step.target) {
      // target is elsewhere: park the card in the corner so it doesn't get in the way of exploring
      corner = true;
      tipStyle = { left: sx + sw - tipSize.w - 20, top: sy + sh - tipSize.h - 20 };
    } else {
      tipStyle = { left: sx + sw / 2 - tipSize.w / 2, top: sy + sh / 2 - tipSize.h / 2 };
    }
  } else {
    const gap = 14;
    const spaces = { bottom: sy + sh - (hole.y + hole.h), top: hole.y - sy, right: sx + sw - (hole.x + hole.w), left: hole.x - sx };
    let place = step.placement && step.placement !== 'auto' ? step.placement : undefined;
    const fits = (p: keyof typeof spaces) => spaces[p] >= (p === 'top' || p === 'bottom' ? tipSize.h : tipSize.w) + gap;
    if (!place || !fits(place)) place = (['bottom', 'right', 'top', 'left'] as const).find(fits) ?? 'bottom';
    let left: number, top: number;
    if (place === 'bottom' || place === 'top') {
      left = hole.x + hole.w / 2 - tipSize.w / 2;
      top = place === 'bottom' ? hole.y + hole.h + gap : hole.y - tipSize.h - gap;
    } else {
      top = hole.y + hole.h / 2 - tipSize.h / 2;
      left = place === 'right' ? hole.x + hole.w + gap : hole.x - tipSize.w - gap;
    }
    left = Math.min(Math.max(sx + 10, left), sx + sw - tipSize.w - 10);
    top = Math.min(Math.max(sy + 10, top), sy + sh - tipSize.h - 10);
    tipStyle = { left, top };
  }

  return (
    <div className="tour-root docked">
      {!step.target && <div className="tour-welcome-dim" style={{ left: sx, top: sy, width: sw, height: sh }} />}
      {hole && <div className="tour-ring soft" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
      <div className={'tour-callout' + (!step.target ? ' center' : '') + (corner ? ' corner' : '')} ref={tipRef} style={tipStyle} role="dialog" aria-live="polite">
        <div className="tc-top"><span>Step {index + 1} / {total}</span></div>
        <h4>{step.title}</h4>
        {missing && away ? (
          <>
            <div className="tour-tip-body">This step is about something that isn't on screen right now. Keep exploring, or jump back to it.</div>
            <div className="tc-btns">
              {stuck && <button className="tour-link" onClick={next}>Skip this step</button>}
              <button className="tour-btn" onClick={() => { reapply(); setTimeout(() => setStuck(true), 1500); }}>Show me</button>
            </div>
          </>
        ) : (
          <>
            <div className="tour-tip-body">{step.body}</div>
            {action ? (
              step.actionHint && <div className="tc-do">{step.actionHint}</div>
            ) : (
              <div className="tc-btns"><button className="tour-btn" onClick={next}>{index === total - 1 ? 'Finish' : 'Continue'}</button></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Spotlight({ step, index, total, title }: { step: TourStep; index: number; total: number; title: string }) {
  const { next, back, exit } = useTour();
  const { s } = useSim();
  const rect = useTargetRect(step.target);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipSize, setTipSize] = useState({ w: 340, h: 180 });
  const pad = step.padding ?? 6;
  const waitingForTarget = !!step.target && !rect;
  void s;

  // advance when the highlighted element is clicked
  useEffect(() => {
    if (step.advance !== 'click' || !step.target) return;
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(step.target!);
      if (el && el.contains(e.target as Node)) setTimeout(next, 60);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [step, next]);

  // advance when a state condition becomes true
  useEffect(() => {
    if (step.advance === 'state' && step.until && step.until(s)) {
      const id = setTimeout(next, 250);
      return () => clearTimeout(id);
    }
  }, [s, step, next]);

  useLayoutEffect(() => {
    if (tipRef.current) {
      const r = toLocal(tipRef.current.getBoundingClientRect());
      if (Math.abs(r.width - tipSize.w) > 1 || Math.abs(r.height - tipSize.h) > 1) setTipSize({ w: r.width, h: r.height });
    }
  });

  const vw = viewW(), vh = viewH();
  const hole = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;

  // tooltip placement
  let tipStyle: React.CSSProperties;
  if (!hole) {
    tipStyle = { left: vw / 2 - tipSize.w / 2, top: vh / 2 - tipSize.h / 2 };
  } else {
    const gap = 14;
    const spaces = { bottom: vh - (hole.y + hole.h), top: hole.y, right: vw - (hole.x + hole.w), left: hole.x };
    let place = step.placement && step.placement !== 'auto' ? step.placement : undefined;
    if (!place || spaces[place] < (place === 'top' || place === 'bottom' ? tipSize.h : tipSize.w) + gap) {
      place = (['bottom', 'right', 'top', 'left'] as const).find((p) => spaces[p] >= (p === 'top' || p === 'bottom' ? tipSize.h : tipSize.w) + gap) ?? 'bottom';
    }
    let left = 0, top = 0;
    if (place === 'bottom' || place === 'top') {
      left = hole.x + hole.w / 2 - tipSize.w / 2;
      top = place === 'bottom' ? hole.y + hole.h + gap : hole.y - tipSize.h - gap;
    } else {
      top = hole.y + hole.h / 2 - tipSize.h / 2;
      left = place === 'right' ? hole.x + hole.w + gap : hole.x - tipSize.w - gap;
    }
    left = Math.min(Math.max(12, left), vw - tipSize.w - 12);
    top = Math.min(Math.max(12, top), vh - tipSize.h - 12);
    tipStyle = { left, top };
  }

  const block = (st: React.CSSProperties) => (
    <div className="tour-block" style={st} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} />
  );

  const canNext = step.advance === 'next' || (!step.target && step.advance !== 'state');
  const allowInteract = step.interactive !== false;

  return (
    <div className="tour-root">
      <svg className="tour-mask" width={vw} height={vh}>
        <defs>
          <mask id="tour-hole">
            <rect width={vw} height={vh} fill="white" />
            {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={6} fill="black" />}
          </mask>
        </defs>
        <rect width={vw} height={vh} fill="rgba(10,20,40,0.58)" mask="url(#tour-hole)" />
      </svg>
      {hole ? (
        <>
          {block({ left: 0, top: 0, width: vw, height: Math.max(0, hole.y) })}
          {block({ left: 0, top: hole.y + hole.h, width: vw, height: Math.max(0, vh - hole.y - hole.h) })}
          {block({ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h })}
          {block({ left: hole.x + hole.w, top: hole.y, width: Math.max(0, vw - hole.x - hole.w), height: hole.h })}
          {!allowInteract && block({ left: hole.x, top: hole.y, width: hole.w, height: hole.h })}
          <div className={'tour-ring' + (step.advance === 'click' ? ' pulse' : '')} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        </>
      ) : (
        block({ left: 0, top: 0, width: vw, height: vh })
      )}
      <div className="tour-tip" ref={tipRef} style={tipStyle} role="dialog" aria-live="polite">
        <div className="tour-tip-top">
          <span className="tour-tip-module">{title}</span>
          <span className="tour-tip-count">{index + 1} / {total}</span>
          <button className="tour-tip-x" onClick={exit} title="Exit lesson (Esc)" aria-label="Exit lesson"><X size={14} /></button>
        </div>
        <div className="tour-progress"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        <h4>{step.title}</h4>
        <div className="tour-tip-body">{step.body}</div>
        {waitingForTarget && <div className="tour-wait">Waiting for this element to appear…</div>}
        {(step.advance === 'click' || step.advance === 'state') && !waitingForTarget && (
          <div className="tour-action-hint">👆 {step.actionHint ?? 'Click the pulsing spot to continue'}</div>
        )}
        <div className="tour-tip-btns">
          <button className="tour-link" onClick={exit}>Exit lesson</button>
          <span className="flex1" />
          {index > 0 && <button className="tour-btn ghost" onClick={back}>Back</button>}
          {canNext ? (
            <button className="tour-btn" onClick={next}>{index === total - 1 ? 'Finish' : 'Next'}</button>
          ) : (
            <button className="tour-btn ghost" onClick={next} title="Skip this step">Skip</button>
          )}
        </div>
      </div>
    </div>
  );
}

export type { SimState };
