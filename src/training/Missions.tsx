import { useEffect, useRef, useState } from 'react';
import { Target, Lightbulb, RotateCcw, X, Star } from 'lucide-react';
import { useSim, statusPatch, type SimState, type Stats } from '../store';
import { ringInbound } from '../workspace/callActions';
import { seedHistory } from '../workspace/wsData';
import { award, getProgress, updateProgress } from './progress';
import { HintRing, tsel } from './common';
import type { RoleId } from '../data/data';

type P = Partial<SimState>;
interface Ctx { base: Stats; start: SimState }
export interface Mission {
  id: string; title: string; brief: string; objective: string;
  hints: { text: string; sel?: string }[];
  setup: (s: SimState) => P;
  ring?: { scenario: string; delay: number };
  check: (s: SimState, c: Ctx) => boolean;
  roles?: RoleId[];
}

const CLOSE: P = { extPromptOpen: false, statusMenuOpen: false, customizeOpen: false, notifOpen: false, callbackContact: null, skillPrompt: null, addMenuOpen: false, keypadOpen: false, consultOpen: false, callView: false, call: null, wrap: null, scheduleMode: 'calendar' };
const ready = (s: SimState): P => ({ ...CLOSE, agentLeg: true, ...(s.agentStatus === 'Available' ? {} : statusPatch(s, 'Available')), wsPanel: 'history' });
const newHandled = (s: SimState, c: Ctx) => s.stats.handledLog.slice(c.base.handledLog.length);
const handledWith = (s: SimState, c: Ctx, scenario: string, disposition?: string, extra?: (h: Stats['handledLog'][number]) => boolean) =>
  newHandled(s, c).some((h) => h.scenario === scenario && (!disposition || h.disposition === disposition) && (!extra || extra(h)));

export const MISSIONS: Mission[] = [
  {
    id: 'ready', title: 'Get call-ready', brief: 'Your shift just started. Nothing can reach you yet.', objective: 'Connect your agent leg and go Available.',
    hints: [{ text: 'The crossed-out link icon in the top bar is your audio connection.', sel: tsel('ws-agent-leg') }, { text: 'Then click your status (top right) and pick Available.', sel: tsel('ws-presence') }],
    setup: (s) => ({ ...CLOSE, agentLeg: false, ...statusPatch(s, 'Unavailable') }),
    check: (s) => s.agentLeg && s.agentStatus === 'Available',
  },
  {
    id: 'lockout', title: 'The locked-out trader', brief: 'A call is about to ring in. Listen to the caller and resolve it.', objective: 'Answer, finish the call with the right disposition and a note.',
    hints: [{ text: 'Accept the ringing card in the Interactions panel.', sel: tsel('ws-accept') }, { text: 'After Hang Up, the caller needed a new password → "Password Reset". Type a short note before saving.', sel: tsel('ws-disposition') }],
    setup: ready, ring: { scenario: 'lockout', delay: 2500 },
    check: (s, c) => handledWith(s, c, 'lockout', 'Password Reset', (h) => h.notes.trim().length > 0),
  },
  {
    id: 'hold', title: 'Hold while you check', brief: 'Marcus needs drive access. Put him on hold while you look up the approval.', objective: 'Use Hold during the call, resume, and log it as an access request.',
    hints: [{ text: 'Hold is the first button on the call card.', sel: tsel('ws-vc-hold') }, { text: 'The disposition is "Access Request Raised".', sel: tsel('ws-disposition') }],
    setup: ready, ring: { scenario: 'access', delay: 2500 },
    check: (s, c) => handledWith(s, c, 'access', 'Access Request Raised', (h) => h.everHeld),
  },
  {
    id: 'mask', title: 'Protect sensitive details', brief: 'Hana is about to read out her token serial and PIN. That must not end up on the recording.', objective: 'Mask the recording during the call, then escalate it to L2.',
    hints: [{ text: 'Mask covers the recording with white noise. Unmask before you hang up.', sel: tsel('ws-vc-mask') }, { text: 'Disposition: "Escalated to L2".', sel: tsel('ws-disposition') }],
    setup: ready, ring: { scenario: 'vpn', delay: 2500 },
    check: (s, c) => handledWith(s, c, 'vpn', 'Escalated to L2', (h) => h.everMasked),
  },
  {
    id: 'wrong', title: 'Not a pizza place', brief: 'Some calls are simply wrong numbers. Handle it quickly and accurately.', objective: 'Answer and close the call with the correct disposition.',
    hints: [{ text: 'There is a disposition made exactly for this: "Wrong Number".', sel: tsel('ws-disposition') }],
    setup: ready, ring: { scenario: 'wrong', delay: 2500 },
    check: (s, c) => handledWith(s, c, 'wrong', 'Wrong Number'),
  },
  {
    id: 'outbound', title: 'Dial out', brief: 'A user left a voicemail asking you to call +1 555 555 0134.', objective: 'Call +15555550134. Nobody picks up, so log it as "No Answer / Voicemail".',
    hints: [{ text: 'New Outbound (the start another action icon above the Interactions panel) opens the Directory. Type the number.', sel: tsel('ws-outbound') }, { text: 'Click Voice Call. With one outbound skill it dials straight away.', sel: tsel('ws-dir-voicecall') }],
    setup: ready,
    check: (s, c) => newHandled(s, c).some((h) => h.direction === 'out' && h.number.replace(/\D/g, '').endsWith('5555550134') && h.disposition === 'No Answer / Voicemail'),
  },
  {
    id: 'callback', title: 'Call them back', brief: 'Your most recent caller got cut off. Call them back from your history.', objective: 'Call back the top contact in Contact History and save an outcome.',
    hints: [{ text: 'Open Contact History and click the first row.', sel: tsel('ws-rail-history') }, { text: 'Click Callback, then Call.', sel: tsel('ws-callback-btn') }],
    setup: (s) => ({ ...ready(s), contactHistory: s.contactHistory.length ? s.contactHistory : seedHistory() }),
    check: (s, c) => newHandled(s, c).some((h) => h.direction === 'out' && h.number === c.start.contactHistory[0]?.number),
  },
  {
    id: 'promise', title: 'Keep the promise', brief: 'Daniel is walking into a meeting and wants a call back at 3 PM.', objective: 'Close his call as "Callback Required" and book a commitment for Daniel Okafor.',
    hints: [{ text: 'Disposition: "Callback Required".', sel: tsel('ws-disposition') }, { text: 'Schedule → Add → Commitment. Use his number from the call: +15555550161.', sel: tsel('ws-rail-schedule') }],
    setup: ready, ring: { scenario: 'callback', delay: 2500 },
    check: (s, c) => handledWith(s, c, 'callback', 'Callback Required') && s.commitments.some((k) => /daniel/i.test(k.first) && /okafor/i.test(k.last)),
  },
  {
    id: 'transfer', title: 'Hand it to the experts', brief: 'Another VPN failure. This one belongs with the network team.', objective: 'Transfer the caller to the DWCS_ITHD_L2_Network skill, then save the outcome.',
    hints: [{ text: 'Consult / Transfer is the person + icon on the call card.', sel: tsel('ws-vc-consult') }, { text: 'The Directory tab opens in the App Space. Search "Network" and click the Transfer icon (⇄) next to the skill.', sel: tsel('ws-appspace') }],
    setup: ready, ring: { scenario: 'vpn', delay: 2500 },
    check: (s, c) => s.stats.transfers > c.base.transfers && s.stats.handled > c.base.handled,
  },
  {
    id: 'favorite', title: 'Know your lead', brief: 'You will call your team lead a lot. Make them easy to find.', objective: 'Add Tamas Farkas (Team Lead) to your Directory favorites.',
    hints: [{ text: 'Open the Directory and search "Tamas".', sel: tsel('ws-rail-directory') }, { text: 'Click the ☆ on his row.' }],
    setup: (s) => ({ ...CLOSE, wsPanel: 'history', favorites: s.favorites.filter((f) => !f.startsWith('Tamas')) }),
    check: (s) => s.favorites.some((f) => f.startsWith('Tamas')),
  },
  {
    id: 'break', title: 'Scheduled break', brief: "It's 3:15 PM, time for your break. Supervisors watch adherence live.", objective: 'Set the correct break status (Break - 15 min Break).',
    roles: ['agent', 'supervisor', 'supervisor_bo'],
    hints: [{ text: 'Click your status in the top bar.', sel: tsel('ws-presence') }, { text: 'Pick "Break - 15 min Break", not Away.' }],
    setup: ready, check: (s) => s.agentStatus === 'Break - 15 min Break',
  },
  {
    id: 'break-bo', title: 'Backoffice block', brief: 'Your schedule has a backoffice block now for ticket follow-ups.', objective: 'Set the backoffice status (Break - Backoffice).',
    roles: ['agent_bo'],
    hints: [{ text: 'Click your status in the top bar.', sel: tsel('ws-presence') }, { text: 'Type "back" in the search box.' }],
    setup: ready, check: (s) => s.agentStatus === 'Break - Backoffice',
  },
  {
    id: 'issue', title: 'Choppy audio', brief: 'Callers say your audio keeps cutting out.', objective: 'Report an issue with the category "Audio Quality".',
    hints: [{ text: 'Settings → Information shows your connection lag. Report Issue is the last tab.', sel: tsel('ws-rail-settings') }, { text: 'Fill Category, Priority and Comment, then Submit.' }],
    setup: (s) => ({ ...CLOSE, wsPanel: 'history', issue: { ...s.issue, sent: false } }),
    check: (s, c) => s.stats.issuesSent > c.base.issuesSent && s.stats.lastIssueCategory === 'Audio Quality',
  },
  {
    id: 'sound', title: "Don't miss a call", brief: 'You keep missing calls when you look at another screen.', objective: 'Turn on the audio notification for New Contact.',
    hints: [{ text: 'Settings → A/V Notifications.', sel: tsel('ws-rail-settings') }, { text: 'Toggle "New Contact" under Audio Notifications.' }],
    setup: (s) => ({ ...CLOSE, wsPanel: 'history', prefs: { ...s.prefs, aContact: false } }),
    check: (s) => !!s.prefs.aContact,
  },
  {
    id: 'logout', title: 'End of shift', brief: "It's 5 PM. Time to go home properly.", objective: 'Log out of Agent Workspace the right way.',
    hints: [{ text: 'Closing the window is not logging out. Open your status.', sel: tsel('ws-presence') }, { text: 'Log Out is at the bottom of the status list.' }],
    setup: ready, check: (s) => s.agentStatus === 'Logged Out',
  },
];

export const missionsForRole = (r: RoleId) => MISSIONS.filter((m) => !m.roles || m.roles.includes(r));

export function MissionRunner({ id, onExit, onNext }: { id: string; onExit: () => void; onNext: (id: string) => void }) {
  const { s, set } = useSim();
  const m = MISSIONS.find((x) => x.id === id)!;
  const ctx = useRef<Ctx | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintSel, setHintSel] = useState<string | undefined>();
  const [startedAt, setStartedAt] = useState(Date.now());
  const [won, setWon] = useState<{ stars: number; secs: number } | null>(null);
  const [, tick] = useState(0);

  const begin = () => {
    setWon(null); setHintsUsed(0); setHintSel(undefined); setStartedAt(Date.now());
    set((x) => {
      const p = m.setup(x);
      ctx.current = { base: x.stats, start: { ...x, ...p } as SimState };
      return p;
    });
    if (m.ring) setTimeout(() => set((x) => ringInbound({ ...x, prefs: { ...x.prefs, autoAccept: false } }, m.ring!.scenario)), m.ring.delay);
  };
  useEffect(begin, [id]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (won || !ctx.current) return;
    if (m.check(s, ctx.current)) {
      const stars = Math.max(1, 3 - hintsUsed);
      const secs = Math.round((Date.now() - startedAt) / 1000);
      setWon({ stars, secs });
      setHintSel(undefined);
      const prev = getProgress().missions[m.id] ?? 0;
      updateProgress((p) => ({ ...p, missions: { ...p.missions, [m.id]: Math.max(prev, stars) } }));
      const done = Object.keys(getProgress().missions).length;
      award(prev ? 15 : 40 + stars * 20, `Mission: ${m.title}`, stars === 3 ? 'three-star' : undefined);
      if (done >= 5) award(0, '', 'mission-5');
      if (done >= missionsForRole(s.role).length) award(0, '', 'mission-all');
    }
  }, [s]);

  const list = missionsForRole(s.role);
  const nextM = list[list.findIndex((x) => x.id === m.id) + 1];
  const hint = m.hints[hintsUsed - 1];
  const secs = Math.round((Date.now() - startedAt) / 1000);

  return (
    <>
      {hintSel && !won && <HintRing selector={hintSel} />}
      <div className={'mission-card' + (won ? ' won' : '')}>
        <div className="mc-top"><Target size={15} /> Mission <span className="mc-time">{won ? `${won.secs}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</span>
          <button className="mc-x" onClick={onExit} aria-label="Exit mission"><X size={15} /></button></div>
        <div className="mc-title">{m.title}</div>
        {!won ? (
          <>
            <div className="mc-brief">{m.brief}</div>
            <div className="mc-obj"><b>Objective:</b> {m.objective}</div>
            {hint && <div className="mc-hint"><Lightbulb size={14} /> {hint.text}</div>}
            <div className="mc-btns">
              <span className="mc-stars">{[0, 1, 2].map((i) => <Star key={i} size={16} className={i < Math.max(1, 3 - hintsUsed) ? 'on' : ''} />)}</span>
              <button className="tour-btn ghost" disabled={hintsUsed >= m.hints.length} onClick={() => { const n = hintsUsed + 1; setHintsUsed(n); setHintSel(m.hints[n - 1].sel); }}>
                <Lightbulb size={13} /> Hint {hintsUsed < m.hints.length ? `(${m.hints.length - hintsUsed})` : ''}
              </button>
              <button className="tour-btn ghost" onClick={begin} title="Restart"><RotateCcw size={13} /></button>
            </div>
          </>
        ) : (
          <div className="mc-win">
            <div className="mc-win-stars">{[0, 1, 2].map((i) => <Star key={i} size={30} className={i < won.stars ? 'on' : ''} />)}</div>
            <div>Mission complete in {won.secs}s{won.stars === 3 ? ' with no hints!' : ''}</div>
            <div className="mc-btns">
              <button className="tour-btn ghost" onClick={begin}><RotateCcw size={13} /> Retry</button>
              {nextM ? <button className="tour-btn" onClick={() => onNext(nextM.id)}>Next mission →</button> : <button className="tour-btn" onClick={onExit}>Done</button>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
