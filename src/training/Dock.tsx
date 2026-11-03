import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Map, Compass, Clapperboard, Target, Zap, Flag, Award, Play, Star, Volume2, VolumeX, Captions, X, CircleCheck, Lock, Printer } from 'lucide-react';
import { useSim } from '../store';
import { ROLES, USER } from '../data/data';
import { useTour, getCompleted } from '../tour/TourEngine';
import { READY, WS_TOURS } from '../workspace/wsTours';
import { BADGES, award, certificateStatus, getProgress, levelOf, updateProgress, type Progress } from './progress';
import { ExploreOverlay, HOTSPOTS } from './Explore';
import { MissionRunner, missionsForRole } from './Missions';
import { QuizRunner } from './Quiz';
import { CHAPTERS, StoryPlayer } from './Story';
import { ShiftSim } from './ShiftSim';
import { stopSpeech } from './speech';
import { LearnLayout, LessonPlayer, LessonRow, SidebarShell, useCompletionTick } from '../learn/LearnUi';
import { modulesForRole } from '../tour/modules';
import { goTrainingHome } from '../workspace/open';
import { Home } from 'lucide-react';
import type { Tour } from '../tour/tours';

type Mode = 'tour' | 'explore' | 'story' | 'missions' | 'quiz' | 'sim' | 'cert';
type Activity = { mode: 'explore' } | { mode: 'story'; chapters: string[] } | { mode: 'mission'; id: string } | { mode: 'quiz'; n: number } | { mode: 'sim'; n: number };

const TABS: { id: Mode; label: string; icon: JSX.Element }[] = [
  { id: 'tour', label: 'Tour', icon: <Map size={16} /> },
  { id: 'explore', label: 'Explore', icon: <Compass size={16} /> },
  { id: 'story', label: 'Story', icon: <Clapperboard size={16} /> },
  { id: 'missions', label: 'Missions', icon: <Target size={16} /> },
  { id: 'quiz', label: 'Quiz', icon: <Zap size={16} /> },
  { id: 'sim', label: 'Shift Sim', icon: <Flag size={16} /> },
  { id: 'cert', label: 'Certificate', icon: <Award size={16} /> },
];

function useProgress(): Progress {
  const [p, setP] = useState(getProgress());
  useEffect(() => {
    const f = () => setP(getProgress());
    window.addEventListener('progress-changed', f);
    window.addEventListener('storage', f);
    window.addEventListener('tour-finished', f);
    return () => { window.removeEventListener('progress-changed', f); window.removeEventListener('storage', f); window.removeEventListener('tour-finished', f); };
  }, []);
  return p;
}

const ACT_LABEL: Record<Activity['mode'], string> = { explore: 'Hotspots', story: 'Story', mission: 'Mission', quiz: 'Quiz', sim: 'Shift Sim' };

interface TrainingCtx { tab: Mode; setTab: (m: Mode) => void; act: Activity | null; begin: (a: Activity) => void; end: () => void; certOpen: boolean; setCertOpen: (o: boolean) => void }
const TCtx = createContext<TrainingCtx | null>(null);
const useTraining = () => useContext(TCtx)!;

/**
 * Training for the Agent Workspace window: lessons sidebar on the left (lessons + learning modes),
 * the live workspace on the right, and the practice overlays inside the workspace stage.
 */
export function WorkspaceTraining({ autoTour, initialTab, children }: { autoTour: string | null; initialTab?: string | null; children: ReactNode }) {
  const { s, set } = useSim();
  const { tour, start, stop } = useTour();
  const [tab, setTab] = useState<Mode>(TABS.some((t) => t.id === initialTab) ? (initialTab as Mode) : 'tour');
  const [act, setAct] = useState<Activity | null>(null);
  const [certOpen, setCertOpen] = useState(false);

  // auto-start a tour passed in the URL (from the main CXone window)
  useEffect(() => {
    if (!autoTour) return;
    const t = WS_TOURS.find((x) => x.id === autoTour);
    if (t) setTimeout(() => start(t), 300);
  }, []);

  // keep trainingMode in sync (free practice rings calls only when nothing else runs)
  useEffect(() => {
    const m = tour ? 'tour' : act ? (act.mode === 'mission' ? 'mission' : act.mode) : 'free';
    if (s.trainingMode !== m) set({ trainingMode: m });
  }, [tour, act]);

  // award tour completion XP + first-call badge
  useEffect(() => {
    const f = (e: Event) => award(50, `Lesson: ${WS_TOURS.find((t) => t.id === (e as CustomEvent).detail)?.title ?? 'complete'}`);
    window.addEventListener('tour-finished', f);
    return () => window.removeEventListener('tour-finished', f);
  }, []);
  useEffect(() => { if (s.stats.handled >= 1 && !getProgress().badges.includes('first-call')) award(25, 'First call handled', 'first-call'); }, [s.stats.handled]);

  // practice modes need a launched, tidy workspace and no lesson running
  const begin = (a: Activity) => { stop(); stopSpeech(); set({ ...READY, call: null, wrap: null, callView: false }); setAct(a); };
  // a lesson started while a practice mode runs ends the practice mode
  useEffect(() => { if (tour && act) setAct(null); }, [tour]);
  const end = () => { stopSpeech(); setAct(null); };

  return (
    <TCtx.Provider value={{ tab, setTab, act, begin, end, certOpen, setCertOpen }}>
      <LearnLayout sidebar={<WsSidebar />}>
        {children}
        <TrainingOverlays />
      </LearnLayout>
    </TCtx.Provider>
  );
}

function TrainingOverlays() {
  const { act, end, certOpen, setCertOpen, begin } = useTraining();
  return (
    <>
      {act?.mode === 'explore' && <ExploreOverlay onExit={end} />}
      {act?.mode === 'story' && <StoryPlayer key={act.chapters.join()} chapterIds={act.chapters} onExit={end} />}
      {act?.mode === 'mission' && <MissionRunner key={act.id} id={act.id} onExit={end} onNext={(id) => begin({ mode: 'mission', id })} />}
      {act?.mode === 'quiz' && <QuizRunner key={act.n} onExit={end} />}
      {act?.mode === 'sim' && <ShiftSim key={act.n} onExit={end} />}
      <Toasts />
      {certOpen && <CertificateModal onClose={() => setCertOpen(false)} />}
    </>
  );
}

function WsSidebar() {
  const { s, set } = useSim();
  const { tour, start, exit } = useTour();
  const { tab, setTab, act, begin, end, setCertOpen } = useTraining();
  const p = useProgress();
  useCompletionTick();
  const role = ROLES.find((r) => r.id === s.role)!;
  const lv = levelOf(p.xp);
  const done = getCompleted();
  const missions = missionsForRole(s.role);
  const wsModule = modulesForRole(s.role).find((m) => m.mod.id === 'm-workspace');
  const sections = (wsModule?.sections ?? []).map((sec) => ({ ...sec, lessons: sec.lessons.filter((t) => t.opensIn === 'cxa') })).filter((sec) => sec.lessons.length);
  const allLessons = sections.flatMap((sec) => sec.lessons);
  const nextLesson = allLessons.find((t) => !done.includes(t.id));
  const startLesson = (t: Tour) => { end(); set({ statusMenuOpen: false, customizeOpen: false }); start(WS_TOURS.find((x) => x.id === t.id) ?? t); };
  const onMode = (id: string) => { if (tour && id !== 'tour') exit(); setTab(id as Mode); };
  let n = 0;

  const top = (
    <div className="ls-xp">
      <div className="dock-lv">{lv.level}</div>
      <div className="flex1">
        <div className="ls-xp-name">{lv.name}</div>
        <div className="dock-xp"><span style={{ width: `${lv.pct}%` }} /></div>
        <div className="ls-xp-l">{p.xp} XP{lv.to > lv.from ? ` · ${lv.to - p.xp} to level ${lv.level + 1}` : ' · max level'}</div>
      </div>
    </div>
  );

  return (
    <SidebarShell title="Agent Workspace training" sub={`${role.label} · ${done.filter((id) => allLessons.some((t) => t.id === id)).length}/${allLessons.length} lessons`} top={top}
      modes={TABS.map((t) => ({ id: t.id, label: t.id === 'tour' ? 'Lessons' : t.label, icon: t.icon }))} mode={tab} onMode={onMode}
      onHome={() => { if (tour) exit(); end(); goTrainingHome(s.role); }}
      foot={<>
        <div className="ls-links"><button onClick={() => { if (tour) exit(); end(); goTrainingHome(s.role); }}><Home size={13} /> Training home</button></div>
        <div className="ls-badges">{Object.entries(BADGES).map(([id, b]) => <span key={id} className={'dock-badge' + (p.badges.includes(id) ? ' got' : '')} title={`${b.label}: ${b.how}`}>{b.icon}</span>)}</div>
      </>}>
      {act && (
        <div className="ls-running">
          <span className="fc-live" /> <b>{ACT_LABEL[act.mode]}</b> in progress
          <button className="fc-exit" onClick={end}>Exit</button>
        </div>
      )}
      {tab === 'tour' && (tour ? <LessonPlayer /> : (
        <>
          <p className="dock-intro">Pick a lesson. The steps appear here, the narrator reads them out, and you do each task in the workspace on the right.</p>
          {sections.map((sec) => (
            <div key={sec.title} className="ls-sec">
              <div className="ls-sec-t">{sec.title}</div>
              {sec.lessons.map((t) => { n += 1; return <LessonRow key={t.id} t={{ ...t, opensIn: undefined }} n={String(n)} done={done.includes(t.id)} next={t === nextLesson} onClick={() => startLesson(t)} />; })}
            </div>
          ))}
          <div className="ls-tip">Free practice: go Available in the workspace. A practice call rings in about 10 seconds.</div>
        </>
      ))}
            {tab === 'explore' && (
              <div className="dock-hero">
                <Compass size={34} />
                <h3>Explore at your own pace</h3>
                <p>Pulsing dots appear on the real screen. Click any of them, in any order, to learn what it does. You can keep using the workspace while you explore.</p>
                <div className="dock-meter"><span style={{ width: `${(p.explored.length / HOTSPOTS.length) * 100}%` }} /></div>
                <div className="muted small">{p.explored.length} / {HOTSPOTS.length} discovered · +10 XP each</div>
                <button className="tour-btn big" onClick={() => begin({ mode: 'explore' })}><Play size={14} /> Start exploring</button>
              </div>
            )}
            {tab === 'story' && (
              <>
                <p className="dock-intro">🎙️ A narrated first shift. You hear the narrator, callers and your team lead, and you do the real actions yourself. Captions are available. {p.voice ? '' : <b>Voice is muted (top-right).</b>}</p>
                <button className="tour-btn big wide" onClick={() => begin({ mode: 'story', chapters: CHAPTERS.map((c) => c.id) })}><Play size={14} /> Play the full story</button>
                {CHAPTERS.map((c, i) => (
                  <Row key={c.id} n={p.storyDone.includes(c.id) ? '✓' : String(i + 1)} title={`${c.time} · ${c.title}`} sub={`${c.beats.length} scenes`}
                    action={<button className="tour-btn ghost" onClick={() => begin({ mode: 'story', chapters: [c.id] })}><Play size={13} /> Play</button>} />
                ))}
              </>
            )}
            {tab === 'missions' && (
              <>
                <p className="dock-intro">🎯 Real tasks with no hand-holding. Hints are there if you need them, but each one costs a star.</p>
                <div className="mission-grid">
                  {missions.map((m, i) => {
                    const stars = p.missions[m.id] ?? 0;
                    return (
                      <button key={m.id} className={'mission-tile' + (stars ? ' done' : '')} onClick={() => begin({ mode: 'mission', id: m.id })}>
                        <span className="mt-n">{i + 1}</span>
                        <span className="mt-title">{m.title}</span>
                        <span className="mt-stars">{[0, 1, 2].map((k) => <Star key={k} size={12} className={k < stars ? 'on' : ''} />)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {tab === 'quiz' && (
              <div className="dock-hero">
                <Zap size={34} />
                <h3>Quick-fire quiz</h3>
                <p>10 questions, 20 seconds each. <b>Find it</b> questions: click the right spot on the real screen. <b>Scenario</b> questions: pick the right move. Keep a streak for bonus points.</p>
                <div className="muted small">Personal best: {p.quizBest}%</div>
                <button className="tour-btn big" onClick={() => begin({ mode: 'quiz', n: Date.now() })}><Play size={14} /> Start a round</button>
              </div>
            )}
            {tab === 'sim' && (
              <div className="dock-hero">
                <Flag size={34} />
                <h3>Shift Simulator</h3>
                <p>A whole shift squeezed into about 5 minutes: callers with real problems, a scheduled break, a commitment coming due and the end-of-day log out. You're scored on answer speed, correct dispositions, notes and adherence.</p>
                <div className="muted small">Personal best: {p.simBest}% · Tip: turn voice on to hear callers</div>
                <button className="tour-btn big" onClick={() => begin({ mode: 'sim', n: Date.now() })}><Play size={14} /> Start shift</button>
              </div>
            )}
            {tab === 'cert' && <CertTab onClaim={() => setCertOpen(true)} total={missions.length} />}
          
    </SidebarShell>
  );
}

function Row({ n, title, sub, action, hl }: { n: string; title: string; sub: string; action: React.ReactNode; hl?: boolean }) {
  return (
    <div className={'ws-mod' + (hl ? ' next' : '')}>
      <span className="module-num">{n === '✓' ? <CircleCheck size={20} className="ok" /> : n}</span>
      <div className="module-text"><div className="module-title">{title}</div><div className="module-sum">{sub}</div></div>
      {action}
    </div>
  );
}

function CertTab({ onClaim, total }: { onClaim: () => void; total: number }) {
  const p = getProgress();
  const st = certificateStatus(p, total);
  return (
    <div className="dock-hero">
      <Award size={34} />
      <h3>Agent Workspace certificate</h3>
      <div className="cert-reqs">
        {st.reqs.map((r) => <div key={r.label} className={r.ok ? 'ok' : ''}>{r.ok ? <CircleCheck size={16} /> : <Lock size={15} />} {r.label} <span className="muted small">({r.detail})</span></div>)}
      </div>
      <button className="tour-btn big" disabled={!st.ok} onClick={onClaim}><Award size={14} /> {st.ok ? 'Claim certificate' : 'Locked'}</button>
    </div>
  );
}

function CertificateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(getProgress().traineeName || `${USER.first} ${USER.last}`);
  const p = getProgress();
  useEffect(() => { if (!p.badges.includes('certified')) award(300, 'Certified!', 'certified'); }, []);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="quiz-scrim cert-scrim">
      <div className="cert-wrap">
        <div className="cert" id="certificate">
          <div className="cert-top">CXone Training Simulator</div>
          <div className="cert-title">Certificate of Completion</div>
          <div className="cert-sub">This certifies that</div>
          <input className="cert-name" value={name} onChange={(e) => { setName(e.target.value); updateProgress((x) => ({ ...x, traineeName: e.target.value })); }} />
          <div className="cert-sub">has completed the <b>Agent Workspace</b> training simulation</div>
          <div className="cert-stats">
            <span>Missions <b>{Object.keys(p.missions).length}</b></span>
            <span>Quiz best <b>{p.quizBest}%</b></span>
            <span>Shift Sim best <b>{p.simBest}%</b></span>
            <span>Level <b>{levelOf(p.xp).name}</b></span>
          </div>
          <div className="cert-date">{date}</div>
          <div className="cert-note">Simulation-based training record. Not an official vendor certification.</div>
        </div>
        <div className="mc-btns center no-print">
          <button className="tour-btn ghost" onClick={onClose}>Close</button>
          <button className="tour-btn" onClick={() => window.print()}><Printer size={14} /> Print / Save as PDF</button>
        </div>
      </div>
    </div>
  );
}

export function Toasts() {
  const [list, setList] = useState<{ id: number; text: string; kind: string }[]>([]);
  useEffect(() => {
    const f = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setList((l) => [...l.slice(-3), d]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== d.id)), 3200);
    };
    window.addEventListener('sim-toast', f);
    return () => window.removeEventListener('sim-toast', f);
  }, []);
  return <div className="toasts">{list.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}</div>;
}
