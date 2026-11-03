import { useState } from 'react';
import { BookOpen, Compass, MousePointerClick, Clapperboard, Target, Zap, Flag, Home, ChevronDown, ChevronRight, Repeat } from 'lucide-react';
import { useSim } from '../store';
import { ROLES } from '../data/data';
import { getCompleted, useTour } from '../tour/TourEngine';
import { lastModule, modulesForRole, rememberModule } from '../tour/modules';
import type { Tour } from '../tour/tours';
import { openWorkspace } from '../workspace/open';
import { LessonPlayer, LessonRow, SidebarShell, useCompletionTick, type ModeDef } from './LearnUi';

const MODES: ModeDef[] = [
  { id: 'lessons', label: 'Lessons', icon: <BookOpen size={17} /> },
  { id: 'free', label: 'Free explore', icon: <Compass size={17} /> },
  { id: 'explore', label: 'Hotspots', icon: <MousePointerClick size={17} />, external: true },
  { id: 'story', label: 'Story', icon: <Clapperboard size={17} />, external: true },
  { id: 'missions', label: 'Missions', icon: <Target size={17} />, external: true },
  { id: 'quiz', label: 'Quiz', icon: <Zap size={17} />, external: true },
  { id: 'sim', label: 'Shift Sim', icon: <Flag size={17} />, external: true },
];

/** Lessons sidebar for the main CXone window. */
export function MainSidebar() {
  const { s, set, reset } = useSim();
  const { tour, start, exit } = useTour();
  const [mode, setMode] = useState<'lessons' | 'free'>('lessons');
  useCompletionTick();
  const done = getCompleted();
  const role = ROLES.find((r) => r.id === s.role)!;
  const modules = modulesForRole(s.role);
  const all = modules.flatMap((m) => m.lessons);
  const nextLesson = all.find((t) => !done.includes(t.id));
  const nextMod = modules.find((m) => m.lessons.includes(nextLesson!))?.mod.id;
  const [openMod, setOpenMod] = useState<string | null>(() => lastModule() ?? nextMod ?? null);

  const run = (t: Tour, modId: string) => {
    rememberModule(modId);
    setMode('lessons');
    if (t.opensIn) { openWorkspace(s.role, t.id, s.username || undefined); return; }
    reset({ role: s.role, rolePicked: true, screen: 'login' });
    start(t);
  };
  const onMode = (id: string) => {
    if (id === 'lessons') { setMode('lessons'); return; }
    if (id === 'free') { if (tour) exit(); setMode('free'); return; }
    openWorkspace(s.role, undefined, s.username || undefined, id);
  };

  const home = () => { if (tour) exit(); set({ screen: 'picker', ...CLOSE }); };
  return (
    <SidebarShell onHome={home} title={`${role.label} training`} sub={`${done.filter((id) => all.some((t) => t.id === id)).length} of ${all.length} lessons completed`}
      modes={MODES} mode={mode} onMode={onMode}
      foot={
        <div className="ls-links">
          <button onClick={home}><Home size={13} /> Training home</button>
          <button onClick={() => { if (tour) exit(); set({ rolePicked: false, screen: 'picker', ...CLOSE }); }}><Repeat size={13} /> Change role</button>
        </div>
      }>
      {mode === 'free' && !tour ? (
        <div className="dock-hero">
          <Compass size={34} />
          <h3>Free explore</h3>
          <p>No guidance. Sign in and click around CXone as a {role.label.toLowerCase()}. Pick <b>Lessons</b> below whenever you want a guided walkthrough.</p>
          <button className="tour-btn big" onClick={() => reset({ role: s.role, rolePicked: true, screen: 'login' })}>Start over at sign-in</button>
        </div>
      ) : tour ? (
        <LessonPlayer />
      ) : (
        <>
          <p className="dock-intro">Pick a lesson. The steps appear here, the narrator reads them out, and you do each task in the simulator on the right.</p>
          {modules.map((m, mi) => {
            const n = m.lessons.filter((t) => done.includes(t.id)).length;
            const isOpen = openMod === m.mod.id;
            let k = 0;
            return (
              <div key={m.mod.id} className={'ls-mod' + (isOpen ? ' open' : '')}>
                <button className="ls-mod-h" onClick={() => setOpenMod(isOpen ? null : m.mod.id)}>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="ls-mod-t"><span className="ls-mod-k">Module {mi + 1}</span>{m.mod.title}</span>
                  <span className={'ls-mod-n' + (n === m.lessons.length ? ' ok' : '')}>{n}/{m.lessons.length}</span>
                </button>
                {isOpen && m.sections.map((sec) => (
                  <div key={sec.title} className="ls-sec">
                    {m.sections.length > 1 && <div className="ls-sec-t">{sec.title}</div>}
                    {sec.lessons.map((t) => { k += 1; return <LessonRow key={t.id} t={t} n={`${mi + 1}.${k}`} done={done.includes(t.id)} next={t === nextLesson} onClick={() => run(t, m.mod.id)} />; })}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </SidebarShell>
  );
}

const CLOSE = { appMenuOpen: false, profileMenuOpen: false, launchOpen: false };
