import { createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Captions, GraduationCap, Home, PanelLeftClose, PanelLeftOpen, Volume2, VolumeX, ArrowLeft, RotateCcw, LogOut, CircleCheck, MousePointerClick, ExternalLink } from 'lucide-react';
import { useTour } from '../tour/TourEngine';
import type { Tour } from '../tour/tours';
import { getProgress, updateProgress } from '../training/progress';
import { englishVoices, speak, speechSupported, stopSpeech, SPEECH_RATES } from '../training/speech';

/* ------------------------------------------------------------------ */
/* Sidebar collapsed state (shared with the tour spotlight)            */
/* ------------------------------------------------------------------ */
const KEY = 'cxone-sim-sidebar-collapsed';
interface LearnUi { collapsed: boolean; setCollapsed: (c: boolean) => void }
const Ctx = createContext<LearnUi | null>(null);
export const useLearnUi = () => useContext(Ctx);

export function LearnUiProvider({ children }: { children: ReactNode }) {
  const [collapsed, setC] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const setCollapsed = (c: boolean) => { setC(c); try { localStorage.setItem(KEY, c ? '1' : '0'); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ collapsed, setCollapsed }}>{children}</Ctx.Provider>;
}

/** Lessons sidebar on the left, live simulator ("stage") on the right. */
export function LearnLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const ui = useLearnUi();
  return (
    <div className={'learn' + (ui?.collapsed ? ' collapsed' : '')}>
      <aside className="learn-side">{sidebar}</aside>
      {/* transform makes position:fixed children (menus, modals, overlays) stay inside the stage */}
      <div className="learn-stage">{children}</div>
      <CaptionBar />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar shell: header, body, modes bar                              */
/* ------------------------------------------------------------------ */
export interface ModeDef { id: string; label: string; icon: ReactNode; external?: boolean }

export function useVoice() {
  const [voice, setVoice] = useState(getProgress().voice);
  useEffect(() => {
    const f = () => setVoice(getProgress().voice);
    window.addEventListener('progress-changed', f);
    window.addEventListener('storage', f);
    return () => { window.removeEventListener('progress-changed', f); window.removeEventListener('storage', f); };
  }, []);
  const [captions, setCaptions] = useState(getProgress().captions);
  useEffect(() => {
    const f = () => setCaptions(getProgress().captions);
    window.addEventListener('progress-changed', f);
    return () => window.removeEventListener('progress-changed', f);
  }, []);
  const toggle = () => { if (voice) stopSpeech(); updateProgress((x) => ({ ...x, voice: !x.voice })); setVoice(!voice); };
  const toggleCaptions = () => { if (captions) window.dispatchEvent(new CustomEvent('speech-caption', { detail: null })); updateProgress((x) => ({ ...x, captions: !x.captions })); setCaptions(!captions); };
  return { voice, toggle, captions, toggleCaptions };
}

export function SidebarShell({ title, sub, top, modes, mode, onMode, children, foot, onHome }: {
  title: string; sub: ReactNode; top?: ReactNode; modes: ModeDef[]; mode: string; onMode: (id: string) => void; children: ReactNode; foot?: ReactNode;
  /** back to the training home (overview) */
  onHome?: () => void;
}) {
  const ui = useLearnUi()!;
  const { voice, toggle, captions, toggleCaptions } = useVoice();
  const [soundOpen, setSoundOpen] = useState(false);
  const { tour, index } = useTour();
  if (ui.collapsed) {
    return (
      <div className="ls-rail">
        <button className="ls-rail-btn" onClick={() => ui.setCollapsed(false)} title="Show lessons" aria-label="Show lessons"><PanelLeftOpen size={20} /></button>
        {onHome && <button className="ls-rail-btn" onClick={() => { stopSpeech(); onHome(); }} title="Training home" aria-label="Training home"><Home size={19} /></button>}
        {tour && <div className="ls-rail-step" title={tour.title}><span>{index + 1}</span><small>/{tour.steps.length}</small></div>}
        <span className="flex1" />
        {modes.map((m) => (
          <button key={m.id} className={'ls-rail-btn' + (mode === m.id ? ' on' : '')} onClick={() => { onMode(m.id); if (!m.external) ui.setCollapsed(false); }} title={m.label} aria-label={m.label}>{m.icon}</button>
        ))}
        <button className={'ls-rail-btn' + (captions ? ' on' : '')} onClick={toggleCaptions} title={captions ? 'Captions on' : 'Captions off'} aria-pressed={captions}><Captions size={18} /></button>
        <button className="ls-rail-btn" onClick={toggle} title={voice ? 'Narration on' : 'Narration off'} aria-pressed={voice}>{voice ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </div>
    );
  }
  return (
    <div className="ls">
      <div className="ls-head">
        {onHome
          ? <button className="ls-logo ls-home" onClick={() => { stopSpeech(); onHome(); }} title="Training home" aria-label="Training home"><Home size={19} /></button>
          : <span className="ls-logo"><GraduationCap size={20} /></span>}
        <div className="ls-head-t">
          <div className="ls-title">{title}</div>
          <div className="ls-sub">{sub}</div>
        </div>
        <button className={'ls-ic' + (soundOpen ? ' on' : '')} onClick={() => setSoundOpen(!soundOpen)} title="Sound & captions" aria-label="Sound and captions" aria-expanded={soundOpen}>
          {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
          {captions && <span className="ls-ic-dot" />}
        </button>
        <button className="ls-ic" onClick={() => ui.setCollapsed(true)} title="Hide lessons" aria-label="Hide lessons"><PanelLeftClose size={18} /></button>
      </div>
      {soundOpen && (
        <div className="ls-sound">
          <button className="ls-switch" onClick={toggle} role="switch" aria-checked={voice}>
            {voice ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>Narration</span><i className={voice ? 'on' : ''} />
          </button>
          <button className="ls-switch" onClick={toggleCaptions} role="switch" aria-checked={captions}>
            <Captions size={16} /><span>Captions</span><i className={captions ? 'on' : ''} />
          </button>
          <NarratorVoice />
          <VoiceSpeed />
        </div>
      )}
      {top}
      <div className="ls-body">{children}</div>
      <div className="ls-modes">
        <div className="ls-modes-label">Learning modes</div>
        <div className="ls-modes-grid">
          {modes.map((m) => (
            <button key={m.id} className={'ls-mode' + (mode === m.id ? ' on' : '')} onClick={() => onMode(m.id)} title={m.external ? `${m.label} (opens Agent Workspace)` : m.label}>
              {m.icon}<span>{m.label}</span>{m.external && <ExternalLink size={9} className="ls-mode-ext" />}
            </button>
          ))}
        </div>
        {foot}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lesson player: the running lesson in the sidebar, with narration     */
/* ------------------------------------------------------------------ */

/** Plain text of a JSX step body, for narration. */
export function nodeText(n: ReactNode): string {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join('');
  if (isValidElement(n)) {
    if (n.type === 'br') return ' ';
    return nodeText((n.props as { children?: ReactNode }).children);
  }
  return '';
}

function narrate(title: string, body: ReactNode, step?: { target?: string; advance: string }) {
  stopSpeech();
  const p = getProgress();
  if (!p.voice && !p.captions) return;
  void step;
  const text = `${title}. ${nodeText(body)}`.replace(/[⋮→↗👆]/g, ' ').replace(/\s+/g, ' ');
  void speak(text, 'narrator', { caption: true });
}

export function LessonPlayer({ onExit }: { onExit?: () => void }) {
  const { tour, index, next, back, exit } = useTour();
  const step = tour?.steps[index];
  // narrate each step as it starts
  useEffect(() => {
    if (step) narrate(step.title, step.body, step);
  }, [tour?.id, index]);
  useEffect(() => () => stopSpeech(), []);
  // keep the current step visible in the sidebar's step list. Only the sidebar's own scroll area moves
  // (scrollIntoView would also shift the page's overflow-hidden wrappers).
  const curRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const li = curRef.current;
    const box = li?.closest('.ls-body') as HTMLElement | null;
    if (!li || !box) return;
    const lr = li.getBoundingClientRect(), br = box.getBoundingClientRect();
    const k = box.clientHeight / (br.height || 1); // the app is scaled: screen px -> CSS px
    if (lr.bottom > br.bottom - 8) box.scrollTop += (lr.bottom - br.bottom) * k + 24;
    else if (lr.top < br.top + 8) box.scrollTop -= (br.top - lr.top) * k + 24;
  }, [tour?.id, index]);
  if (!tour || !step) return null;
  const total = tour.steps.length;
  const action = step.advance === 'click' || step.advance === 'state';
  const doExit = () => { stopSpeech(); exit(); onExit?.(); };
  return (
    <div className="lp">
      <div className="lp-top">
        <div className="lp-kicker">Now learning</div>
        <div className="lp-title">{tour.title}</div>
        <div className="lp-prog"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        <div className="lp-count">Step {index + 1} of {total}</div>
      </div>
      <div className={'lp-step' + (action ? ' action' : '')} aria-live="polite">
        <h3>{step.title}</h3>
        <div className="lp-body">{step.body}</div>
        {action ? (
          <div className="lp-do"><MousePointerClick size={16} /> {step.actionHint ?? 'Do this in the simulator to continue'}</div>
        ) : (
          <button className="tour-btn lp-next" onClick={next}>{index === total - 1 ? 'Finish lesson' : 'Continue'}</button>
        )}
        <div className="lp-ctrls">
          <button disabled={index === 0} onClick={back}><ArrowLeft size={14} /> Back</button>
          <button onClick={() => narrate(step.title, step.body, step)} title="Hear this step again"><RotateCcw size={14} /> Replay</button>
          <span className="flex1" />
          <button className="lp-exit" onClick={doExit}><LogOut size={14} /> Exit lesson</button>
        </div>
      </div>
      <ol className="lp-steps">
        {tour.steps.map((st, i) => (
          <li key={i} ref={i === index ? curRef : undefined} className={i < index ? 'done' : i === index ? 'cur' : ''}>
            <span className="lp-dot">{i < index ? <CircleCheck size={14} /> : i + 1}</span>{st.title}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lesson list rows                                                    */
/* ------------------------------------------------------------------ */
export function LessonRow({ t, n, done, next, onClick }: { t: Tour; n: string; done: boolean; next?: boolean; onClick: () => void }) {
  return (
    <button className={'lr' + (done ? ' done' : '') + (next ? ' next' : '')} onClick={onClick}>
      <span className="lr-n">{done ? <CircleCheck size={16} /> : n}</span>
      <span className="lr-t">
        <span className="lr-title">{t.title}{t.opensIn && <ExternalLink size={11} className="lr-ext" />}</span>
        {next && <span className="lr-next">Up next</span>}
      </span>
    </button>
  );
}

/** Re-render when lesson completion changes (this window or the other one). */
export function useCompletionTick() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    window.addEventListener('tour-finished', f);
    window.addEventListener('storage', f);
    window.addEventListener('focus', f);
    return () => { window.removeEventListener('tour-finished', f); window.removeEventListener('storage', f); window.removeEventListener('focus', f); };
  }, []);
}

/** How fast the narrator and the simulated callers speak. Applies from the next sentence. */
export function VoiceSpeed() {
  const [rate, setRate] = useState(() => getProgress().speechRate || 1);
  if (!speechSupported()) return null;
  const idx = Math.max(0, SPEECH_RATES.indexOf(rate));
  const label = (r: number) => (r === 1 ? 'Normal' : `${r}×`);
  const pick = (r: number) => { setRate(r); updateProgress((x) => ({ ...x, speechRate: r })); };
  const preview = () => { stopSpeech(); void speak('This is how fast I will speak.', 'narrator'); };
  return (
    <label className="lp-voice lp-speed">
      <span>Voice speed</span>
      <input type="range" min={0} max={SPEECH_RATES.length - 1} step={1} value={idx} aria-valuetext={label(rate)}
        onChange={(e) => pick(SPEECH_RATES[Number(e.target.value)])} onPointerUp={preview} onKeyUp={(e) => { if (e.key.startsWith('Arrow')) preview(); }} />
      <b>{label(rate)}</b>
    </label>
  );
}

/** Pick the narrator voice. "Auto" picks the most natural voice installed. */
export function NarratorVoice() {
  const [, force] = useState(0);
  const [chosen, setChosen] = useState(getProgress().narratorVoice);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    window.addEventListener('voices-changed', f);
    return () => window.removeEventListener('voices-changed', f);
  }, []);
  if (!speechSupported()) return null;
  const voices = englishVoices().slice(0, 14);
  if (!voices.length) return null;
  const pick = (name: string) => {
    setChosen(name);
    updateProgress((x) => ({ ...x, narratorVoice: name, voice: true }));
    stopSpeech();
    void speak("Hi! I'll guide you through each step. Let's get started.", 'narrator');
  };
  return (
    <label className="lp-voice">
      <span>Narrator voice</span>
      <select value={chosen} onChange={(e) => pick(e.target.value)}>
        <option value="">Auto (natural, no delay)</option>
        {voices.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/^Microsoft |^Google /, '').replace(/ Online \(Natural\)/, ' (Natural)')}{v.localService ? '' : ' · online, may lag'}</option>)}
      </select>
    </label>
  );
}

/** Subtitles for the lesson narrator, shown at the bottom of the simulator. */
function CaptionBar() {
  const [text, setText] = useState<string | null>(null);
  const [on, setOn] = useState(getProgress().captions);
  useEffect(() => {
    const f = (e: Event) => setText((e as CustomEvent<string | null>).detail);
    const g = () => setOn(getProgress().captions);
    window.addEventListener('speech-caption', f);
    window.addEventListener('progress-changed', g);
    return () => { window.removeEventListener('speech-caption', f); window.removeEventListener('progress-changed', g); };
  }, []);
  if (!on || !text) return null;
  return <div className="learn-caption" aria-live="polite"><span>{text}</span></div>;
}
