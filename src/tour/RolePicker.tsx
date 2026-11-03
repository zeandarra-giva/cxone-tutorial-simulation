import { useEffect, useState } from 'react';
import { CircleCheck, Play, Compass, Headset, Briefcase, Eye, ShieldCheck, ArrowLeft, Rocket, UserRound, MonitorSmartphone, Settings2 } from 'lucide-react';
import { useSim } from '../store';
import { ROLES, type RoleId } from '../data/data';
import { Logo } from '../components/icons';
import { getCompleted, useTour } from './TourEngine';
import type { Tour } from './tours';
import { openWorkspace } from '../workspace/open';
import { modulesForRole, rememberModule, type LearningModule, type RoleModule } from './modules';

const ROLE_ICONS: Record<RoleId, JSX.Element> = {
  agent: <Headset size={26} />,
  agent_bo: <Briefcase size={26} />,
  supervisor: <Eye size={26} />,
  supervisor_bo: <ShieldCheck size={26} />,
};

const MODULE_ICONS: Record<LearningModule['icon'], JSX.Element> = {
  start: <Rocket size={22} />,
  zone: <UserRound size={22} />,
  workspace: <MonitorSmartphone size={22} />,
  supervisor: <Eye size={22} />,
  admin: <Settings2 size={22} />,
};

export function RolePicker() {
  const { s, set, reset } = useSim();
  const { start } = useTour();
  const picked: RoleId | null = s.rolePicked ? s.role : null;
  const setPicked = (r: RoleId | null) => {
    if (r) reset({ role: r, rolePicked: true, screen: 'picker' });
    else set({ rolePicked: false });
  };
  // refresh completion ticks when the trainee comes back from the Agent Workspace window
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    window.addEventListener('focus', f);
    window.addEventListener('storage', f);
    return () => { window.removeEventListener('focus', f); window.removeEventListener('storage', f); };
  }, []);
  const done = getCompleted();

  if (!picked) {
    return (
      <div className="picker">
        <div className="picker-head">
          <Logo size={30} />
          <h1>Training Simulator</h1>
          <p>Pick your role to start a guided walkthrough of the CXone screens you'll use every day.</p>
        </div>
        <div className="role-grid">
          {ROLES.map((r) => (
            <button key={r.id} className="role-card" onClick={() => setPicked(r.id)}>
              <span className="role-ic">{ROLE_ICONS[r.id]}</span>
              <span className="role-name">{r.label}</span>
              <span className="role-blurb">{r.blurb}</span>
            </button>
          ))}
        </div>
        <div className="picker-foot">Simulation only. All names, numbers and data are fictional. Nothing you type is sent anywhere.</div>
      </div>
    );
  }

  const role = ROLES.find((r) => r.id === picked)!;
  const modules = modulesForRole(picked);
  const isDone = (t: Tour) => done.includes(t.id);
  const doneCount = (m: RoleModule) => m.lessons.filter(isDone).length;
  const all = modules.flatMap((m) => m.lessons);
  const total = all.length;
  const finished = all.filter(isDone).length;
  const nextLesson = all.find((t) => !isDone(t));
  const nextMod = modules.find((m) => nextLesson && m.lessons.includes(nextLesson));
  const target = nextLesson ?? all[0];
  const targetMod = nextMod ?? modules[0];

  // the one action on this page depends on where the trainee is
  const cta = finished === 0 ? 'Start learning' : finished < total ? 'Continue learning' : 'Review from the start';
  const ctaSub = finished === 0
    ? <>First up: <b>{target.title}</b></>
    : finished < total
      ? <>Up next: <b>{target.title}</b> · Module {modules.indexOf(targetMod) + 1}, {targetMod.mod.title}</>
      : <>You've finished every lesson. Replay any of them from the lessons sidebar.</>;

  const go = () => {
    rememberModule(targetMod.mod.id);
    if (target.opensIn) { openWorkspace(picked, target.id, s.username || undefined); return; }
    reset({ role: picked, rolePicked: true, screen: 'login' });
    start(target);
  };

  return (
    <div className="picker">
      <div className="picker-head small">
        <button className="picker-back" onClick={() => setPicked(null)}><ArrowLeft size={16} /> Change role</button>
        <Logo size={24} />
        <h1>{role.label} training</h1>
        <p>{finished} of {total} lessons completed</p>
        <div className="ov-prog"><span style={{ width: `${(finished / Math.max(1, total)) * 100}%` }} /></div>
      </div>
      <div className="mod-grid">
        {modules.map((m, i) => {
          const n = doneCount(m);
          const tot = m.lessons.length;
          const complete = n === tot;
          const current = m === nextMod;
          const status = complete ? 'Completed' : current ? (n === 0 ? 'Up next' : 'In progress') : 'Not started';
          return (
            <div key={m.mod.id} className={'mod-card static' + (current ? ' current' : '') + (complete ? ' done' : '')}>
              <div className="mod-card-top">
                <span className="mod-ic">{MODULE_ICONS[m.mod.icon]}</span>
                <span className="mod-kicker dark">Module {i + 1}</span>
                <span className={'mod-badge' + (complete ? ' ok' : current ? '' : ' muted')}>{complete && <CircleCheck size={13} />} {status}</span>
              </div>
              <div className="mod-title">{m.mod.title}</div>
              <div className="module-sum">{m.mod.summary}</div>
              <div className="mod-card-foot">
                <div className="mod-progress"><span style={{ width: `${(n / tot) * 100}%` }} /></div>
                <span className="mod-count">{n}/{tot} lesson{tot === 1 ? '' : 's'}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="ov-action">
        <button className="ov-cta" onClick={go}><Play size={20} /> {cta}</button>
        <div className="ov-cta-sub">{ctaSub}</div>
        <button className="ov-free" onClick={() => reset({ role: picked, rolePicked: true, screen: 'login' })}><Compass size={14} /> Or explore freely, no guidance</button>
      </div>
    </div>
  );
}
