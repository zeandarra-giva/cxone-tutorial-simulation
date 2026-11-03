import { useEffect, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { award, getProgress, updateProgress } from './progress';
import { stageBox, tsel, useRect } from './common';

export interface Hotspot { id: string; sel: string; title: string; body: string; where: string }

export const HOTSPOTS: Hotspot[] = [
  { id: 'help', sel: tsel('ws-help'), where: 'Top bar', title: 'Help', body: 'Opens the online help for whatever you are looking at.' },
  { id: 'notif', sel: tsel('ws-notifications'), where: 'Top bar', title: 'Notifications', body: 'Messages from your team lead, WEM schedule changes and system alerts. The red number is how many are unread.' },
  { id: 'leg', sel: tsel('ws-agent-leg'), where: 'Top bar', title: 'Agent leg', body: 'Your audio connection to CXone. Crossed out = disconnected. It reconnects automatically when a call starts.' },
  { id: 'presence', sel: tsel('ws-presence'), where: 'Top bar', title: 'Status bar', body: 'Your state and time in it. Click to go Available, pick a break or busy code, or Log Out at the end of your shift.' },
  { id: 'outbound', sel: tsel('ws-outbound'), where: 'Interactions panel', title: 'New Outbound', body: 'Start a call. It opens the Directory where you type a number or pick a person or skill.' },
  { id: 'assign', sel: tsel('ws-assign'), where: 'Interactions panel', title: 'Interactions panel', body: 'Your live work queue: ringing calls, active calls, calls in wrap-up and commitments that are due.' },
  { id: 'r-history', sel: tsel('ws-rail-history'), where: 'Left menu', title: 'Contact History', body: 'Your contacts from about the last 3 days. Click one to call back.' },
  { id: 'r-search', sel: tsel('ws-rail-search'), where: 'Left menu', title: 'Search', body: 'Find a past interaction by phone number or skill.' },
  { id: 'r-queue', sel: tsel('ws-rail-queue'), where: 'Left menu', title: 'Queue', body: 'How many contacts are waiting in your skills, by channel, and the longest wait.' },
  { id: 'r-dir', sel: tsel('ws-rail-directory'), where: 'Left menu', title: 'Directory', body: 'Agents, skills and teams with live availability. Star up to 25 favorites.' },
  { id: 'r-sched', sel: tsel('ws-rail-schedule'), where: 'Left menu', title: 'Schedule', body: 'Your shift (open time, breaks, lunch, meetings) and your commitments.' },
  { id: 'r-wem', sel: tsel('ws-rail-wem'), where: 'Left menu', title: 'WEM', body: 'Workforce Engagement: your recorded interactions and evaluations.' },
  { id: 'r-set', sel: tsel('ws-rail-settings'), where: 'Left menu', title: 'Settings', body: 'Softphone volume, Auto Accept, ringtones, notifications, shortcuts, connection info, your skills and Report Issue.' },
  { id: 'r-rep', sel: tsel('ws-rail-reporting'), where: 'Left menu', title: 'Reporting', body: 'Your productivity: time Available, Working and Unavailable vs your team.' },
  { id: 'r-more', sel: tsel('ws-rail-more'), where: 'Left menu', title: 'More / Customize', body: 'Every app available to you. Greyed items are not enabled for your account.' },
  { id: 'p-history', sel: tsel('ws-history-list'), where: 'Contact History', title: 'History list', body: '↑ is outbound, ↓ inbound. Each row shows the number, skill and when it happened.' },
  { id: 'p-dir', sel: tsel('ws-dir-search'), where: 'Directory', title: 'Directory search', body: 'Type a name, skill or team, or dial a number directly. Enter shows all results.' },
  { id: 'p-queue', sel: tsel('ws-queue-table'), where: 'Queue', title: 'Queue Counter', body: 'Digital, Inbound Voice, Voicemail and Work Item queues. Counts update live.' },
  { id: 'p-sched', sel: tsel('ws-sch-add'), where: 'Schedule', title: 'Add Commitment', body: 'Promise a customer a call back at a set time. It pops into your Interactions panel when due.' },
  { id: 'p-set', sel: tsel('ws-set-tabs'), where: 'Settings', title: 'Settings tabs', body: 'Six tabs. Information shows your connection lag, which support may ask about.' },
  { id: 'p-rep', sel: tsel('ws-rep-range'), where: 'Reporting', title: 'Date range', body: 'Compare today with yesterday, the last 7 days or a custom range.' },
  { id: 'p-wem', sel: tsel('ws-wem'), where: 'WEM', title: 'Recent Interactions', body: 'Recorded segments for the period. The ↗ icon opens the full WEM app.' },
];

export function ExploreOverlay({ onExit }: { onExit: () => void }) {
  const [found, setFound] = useState<string[]>(() => getProgress().explored);
  const [open, setOpen] = useState<string | null>(null);
  const total = HOTSPOTS.length;

  const discover = (id: string) => {
    setOpen(open === id ? null : id);
    if (found.includes(id)) return;
    const next = [...found, id];
    setFound(next);
    updateProgress((p) => ({ ...p, explored: next }));
    award(10, 'Hotspot discovered');
    if (next.length === total) award(100, 'Explored everything', 'explorer');
  };
  const left = HOTSPOTS.filter((h) => !found.includes(h.id));
  const nextWhere = [...new Set(left.map((h) => h.where))].filter((w) => !['Top bar', 'Left menu', 'Interactions panel'].includes(w));

  return (
    <div className="explore-layer">
      <div className="explore-bar">
        <Compass size={16} />
        <b>Explore</b>
        <span>{found.length} / {total} discovered</span>
        <div className="explore-meter"><span style={{ width: `${(found.length / total) * 100}%` }} /></div>
        {left.length > 0 && nextWhere.length > 0 && <span className="muted-w">More hotspots in: {nextWhere.join(', ')}</span>}
        <button onClick={onExit} aria-label="Exit explore"><X size={15} /></button>
      </div>
      {HOTSPOTS.map((h) => <Dot key={h.id} h={h} found={found.includes(h.id)} open={open === h.id} onClick={() => discover(h.id)} onClose={() => setOpen(null)} />)}
    </div>
  );
}

function Dot({ h, found, open, onClick, onClose }: { h: Hotspot; found: boolean; open: boolean; onClick: () => void; onClose: () => void }) {
  const r = useRect(h.sel);
  useEffect(() => { if (!r && open) onClose(); }, [r, open]);
  if (!r) return null;
  const box = stageBox();
  const x = Math.min(box.w - 22, r.left + r.width - 8);
  const y = Math.max(4, r.top + 2);
  const popLeft = Math.min(Math.max(10, x - 140), box.w - 300);
  const popTop = y + 22 + 160 > box.h ? y - 150 : y + 22;
  return (
    <>
      <button className={'hs-dot' + (found ? ' found' : '')} style={{ left: x - 9, top: y - 9 }} onClick={onClick} aria-label={h.title}>{found ? '✓' : ''}</button>
      {open && (
        <div className="hs-pop" style={{ left: popLeft, top: popTop }}>
          <div className="hs-where">{h.where}</div>
          <div className="hs-title">{h.title}</div>
          <div className="hs-body">{h.body}</div>
          <button className="tour-btn" onClick={onClose}>Got it</button>
        </div>
      )}
    </>
  );
}
