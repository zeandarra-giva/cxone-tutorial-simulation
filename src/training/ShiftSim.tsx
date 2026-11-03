import { useEffect, useRef, useState } from 'react';
import { Flag, X, Clock } from 'lucide-react';
import { useSim, statusPatch, type SimState, type Stats } from '../store';
import { reject, ringInbound } from '../workspace/callActions';
import { SCENARIOS, scenarioById } from './scenarios';
import { award, getProgress, toast, updateProgress } from './progress';
import { speak } from './speech';

const DURATION = 300; // seconds of real time = one compressed shift
const BREAK_AT = 140, BREAK_LEN = 25, COMMIT_AT = 205, END_AT = 285, RING_TIMEOUT = 15;

interface Line { label: string; pts: number; max: number }
interface Engine {
  start: number; base: Stats; nextCallAt: number; order: string[]; ringStartedAt: number | null; offered: number;
  readyAt: number | null; breakStartedAt: number | null; breakOkAt: number | null; backAt: number | null;
  commitDueAt: number | null; commitDone: boolean; logoutAt: number | null; feed: string[]; ended: boolean;
  missed: number; prompted: Record<string, boolean>;
}

const clockLabel = (t: number) => {
  // map 0..DURATION to 8:00 AM .. 5:00 PM
  const mins = 8 * 60 + Math.round((t / DURATION) * 9 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export function ShiftSim({ onExit }: { onExit: () => void }) {
  const { s, set } = useSim();
  const sRef = useRef(s); sRef.current = s;
  const eng = useRef<Engine | null>(null);
  const [t, setT] = useState(0);
  const [result, setResult] = useState<{ lines: Line[]; pct: number; grade: string } | null>(null);

  const feed = (msg: string, kind: 'info' | 'bad' | 'xp' = 'info') => { eng.current?.feed.unshift(msg); toast(msg, kind); };

  useEffect(() => {
    const now = Date.now();
    const order = [...SCENARIOS].sort(() => Math.random() - 0.5).map((x) => x.id);
    eng.current = { start: now, base: sRef.current.stats, nextCallAt: 12, order, ringStartedAt: null, offered: 0, readyAt: null, breakStartedAt: null, breakOkAt: null, backAt: null, commitDueAt: null, commitDone: false, logoutAt: null, feed: [], ended: false, missed: 0, prompted: {} };
    set((x) => ({
      extPromptOpen: false, statusMenuOpen: false, customizeOpen: false, notifOpen: false, callbackContact: null, skillPrompt: null, call: null, wrap: null, callView: false,
      agentLeg: false, ...statusPatch(x, 'Unavailable'), wsPanel: 'history', scheduleMode: 'calendar',
      commitments: [{ id: 'sim-commit', target: 'me', skill: 'DWCS_ITHD_IAM_Outbound', first: 'Jordan', last: 'Lee', phone: '+15555550155', time: '01/01/2099 12:00 PM', tz: '(GMT+08:00) Manila', notes: 'Follow up on badge access', due: false }],
    }));
    speak("Your shift starts now. Get call-ready: connect your agent leg and go Available.", 'supervisor');
    feed('Shift started: get call-ready');
    const id = setInterval(step, 500);
    return () => clearInterval(id);
  }, []);

  function step() {
    const e = eng.current; const x = sRef.current;
    if (!e || e.ended) return;
    const sec = (Date.now() - e.start) / 1000;
    setT(sec);
    const ready = x.agentLeg && x.agentStatus === 'Available';
    if (ready && e.readyAt === null) { e.readyAt = sec; feed(`Call-ready at ${clockLabel(sec)}`, 'xp'); }

    // ringing timeout => missed
    if (x.call?.phase === 'ringing') {
      if (e.ringStartedAt === null) e.ringStartedAt = sec;
      if (sec - e.ringStartedAt > RING_TIMEOUT) { e.missed++; e.ringStartedAt = null; set((y) => reject(y)); feed('Missed call: you are now Refused', 'bad'); e.nextCallAt = sec + 6; }
    } else e.ringStartedAt = null;

    // route the next call
    const breakWindow = sec >= BREAK_AT && e.backAt === null;
    if (ready && !x.call && !x.wrap && sec >= e.nextCallAt && sec < END_AT - 20 && !breakWindow) {
      const sc = e.order[e.offered % e.order.length];
      e.offered++;
      e.nextCallAt = Infinity;
      set((y) => ringInbound({ ...y, prefs: { ...y.prefs, autoAccept: false } }, sc));
    }
    if (!x.call && !x.wrap && e.nextCallAt === Infinity) e.nextCallAt = sec + 8 + Math.random() * 7;

    // scheduled break
    if (sec >= BREAK_AT && !e.prompted.break) { e.prompted.break = true; speak('Heads up: your fifteen minute break is scheduled now.', 'supervisor'); feed(`${clockLabel(sec)}: scheduled break, set Break - 15 min Break`); }
    if (sec >= BREAK_AT && e.breakStartedAt === null && x.agentStatus.startsWith('Break')) { e.breakStartedAt = sec; e.breakOkAt = sec; feed('On break ✓', 'xp'); }
    if (e.breakStartedAt !== null && !e.prompted.back && sec - e.breakStartedAt >= BREAK_LEN) { e.prompted.back = true; speak("Break's over. Set yourself Available.", 'supervisor'); feed('Break over: go Available'); }
    if (e.prompted.back && e.backAt === null && x.agentStatus === 'Available') { e.backAt = sec; feed('Back from break ✓', 'xp'); }
    if (sec >= BREAK_AT + 60 && e.breakStartedAt === null && !e.prompted.breakMissed) { e.prompted.breakMissed = true; e.backAt = sec; feed('Break skipped: adherence missed', 'bad'); }

    // commitment comes due
    if (sec >= COMMIT_AT && e.commitDueAt === null) {
      e.commitDueAt = sec;
      set((y) => ({ commitments: y.commitments.map((k) => (k.id === 'sim-commit' ? { ...k, due: true } : k)) }));
      feed(`${clockLabel(sec)}: commitment due, call Jordan Lee`);
    }
    if (e.commitDueAt !== null && !e.commitDone && x.call?.number === '+15555550155') { e.commitDone = true; feed('Commitment kept ✓', 'xp'); }

    // end of shift
    if (sec >= END_AT && !e.prompted.end) { e.prompted.end = true; speak("That's the end of your shift. Finish any contact, then log out.", 'supervisor'); feed('End of shift: log out'); }
    if (e.prompted.end && x.agentStatus === 'Logged Out' && e.logoutAt === null) { e.logoutAt = sec; finish(); }
    if (sec >= DURATION + 30) finish();
  }

  function finish() {
    const e = eng.current!; const x = sRef.current;
    if (e.ended) return;
    e.ended = true;
    const handled = x.stats.handledLog.slice(e.base.handledLog.length);
    const inbound = handled.filter((h) => h.direction === 'in');
    const answer = x.stats.answerTimes.slice(e.base.answerTimes.length);
    const refused = x.stats.refused - e.base.refused;
    const offered = Math.max(e.offered, inbound.length, 1);
    const lines: Line[] = [];
    lines.push({ label: `Call-ready ${e.readyAt === null ? 'never' : `after ${Math.round(e.readyAt)}s`}`, pts: e.readyAt === null ? 0 : e.readyAt <= 20 ? 10 : 5, max: 10 });
    const speedPts = answer.reduce((a, ms) => a + (ms <= 6000 ? 10 : ms <= 12000 ? 6 : 2), 0);
    lines.push({ label: `Answer speed (${answer.length} calls, avg ${answer.length ? (answer.reduce((a, b) => a + b, 0) / answer.length / 1000).toFixed(1) : '–'}s)`, pts: speedPts, max: offered * 10 });
    const right = inbound.filter((h) => h.disposition === scenarioById(h.scenario)?.expected).length;
    lines.push({ label: `Correct dispositions (${right}/${inbound.length})`, pts: right * 15, max: offered * 15 });
    const notes = inbound.filter((h) => h.notes.trim()).length;
    lines.push({ label: `Notes added (${notes}/${inbound.length})`, pts: notes * 5, max: offered * 5 });
    lines.push({ label: `Refused / missed calls (${refused})`, pts: -15 * refused, max: 0 });
    lines.push({ label: e.breakStartedAt !== null ? `Break taken on time` : 'Scheduled break missed', pts: e.breakStartedAt !== null ? (e.breakStartedAt - BREAK_AT <= 25 ? 15 : 8) : 0, max: 15 });
    lines.push({ label: e.backAt !== null && e.breakStartedAt !== null ? 'Back from break on time' : 'Back from break', pts: e.backAt !== null && e.breakStartedAt !== null && e.prompted.back ? 10 : 0, max: 10 });
    lines.push({ label: e.commitDone ? 'Commitment kept' : 'Commitment not handled', pts: e.commitDone ? 20 : 0, max: 20 });
    lines.push({ label: e.logoutAt !== null ? 'Logged out properly' : 'Did not log out', pts: e.logoutAt !== null ? 10 : 0, max: 10 });
    const max = lines.reduce((a, l) => a + l.max, 0);
    const got = Math.max(0, lines.reduce((a, l) => a + l.pts, 0));
    const pct = Math.min(100, Math.round((got / max) * 100));
    const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 55 ? 'D' : 'E';
    setResult({ lines, pct, grade });
    updateProgress((p) => ({ ...p, simBest: Math.max(p.simBest, pct) }));
    award(Math.round(pct * 3), `Shift Simulator (${pct}%)`, pct >= 85 ? 'shift-pro' : undefined);
    if (refused === 0 && inbound.length >= 3) award(0, '', 'zero-refused');
    set({ call: null, wrap: null, callView: false, commitments: [] });
  }

  const e = eng.current;
  if (result) {
    return (
      <div className="quiz-scrim">
        <div className="quiz-card result sim">
          <Flag size={34} className="quiz-trophy" />
          <div className="quiz-big">{result.grade} · {result.pct}%</div>
          <div className="muted small">Best: {Math.max(getProgress().simBest, result.pct)}%</div>
          <table className="sim-table">
            <tbody>{result.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td className={l.pts < 0 ? 'neg' : ''}>{l.pts > 0 ? '+' : ''}{l.pts}{l.max ? ` / ${l.max}` : ''}</td></tr>)}</tbody>
          </table>
          <div className="mc-btns center"><button className="tour-btn" onClick={onExit}>Close</button></div>
        </div>
      </div>
    );
  }
  const objective = !e ? '' : e.readyAt === null ? 'Connect agent leg & go Available'
    : e.prompted.end ? 'Finish up and Log Out'
    : e.commitDueAt !== null && !e.commitDone ? 'Commitment due: Proceed in Interactions'
    : e.prompted.back && e.backAt === null ? 'Break over: go Available'
    : e.prompted.break && e.breakStartedAt === null ? 'Scheduled break: set Break - 15 min Break'
    : s.call?.phase === 'ringing' ? 'Answer the call!'
    : s.wrap ? 'Pick the disposition that matches the call'
    : s.call ? 'Listen to the caller' : 'Wait for calls';
  return (
    <div className="sim-hud">
      <span className="sim-clock"><Clock size={14} /> {clockLabel(t)}</span>
      <div className="sim-bar"><span style={{ width: `${Math.min(100, (t / DURATION) * 100)}%` }} /></div>
      <span className="sim-obj">🎯 {objective}</span>
      <span className="sim-feed">{e?.feed[0]}</span>
      <button onClick={() => { if (confirmEnd()) finish(); }} title="End shift now"><Flag size={14} /></button>
      <button onClick={onExit} title="Abandon shift"><X size={14} /></button>
    </div>
  );
}
// End immediately (used by the flag button) without a browser dialog.
const confirmEnd = () => true;
