import { useScreenPopWindow } from './ScreenPop';
import { useEffect, useState } from 'react';
import { startRinging } from './ringtone';
import {
  Bell, CircleQuestionMark, Link2, Search, List, BookUser, CalendarDays, CircleUserRound, Settings, ChartColumn, Ellipsis, UserPlus,
  CircleCheck, CircleMinus, LogOut, X, Info, ListCollapse, PhoneIncoming, PhoneOutgoing, Phone, GripVertical, Inbox, CalendarClock, PhoneCall, ArrowDownLeft,
  Upload,
} from 'lucide-react';
import { useSim, statusPatch, type SimState } from '../store';
import { UNAVAILABLE_CODES, USER } from '../data/data';
import { AgentWorkspaceIcon, HistoryIcon, Logo } from '../components/icons';
import { useTour } from '../tour/TourEngine';
import { accept, fmtTimer, reject, requestOutbound, ringInbound, startOutbound } from './callActions';
import { CUSTOMIZE_ITEMS, OUTBOUND_SKILL } from './wsData';
import { ContactHistoryPanel, DirectoryPanel, HelpPanel, QueuePanel, ReportingPanel, SchedulePanel, SearchPanel, SettingsPanel, WemPanel, parseCommitTime } from './panels';
import { CallCard, CallView, OutcomeDrawer } from './CallView';
import { DigitalCanvas, EmailCard } from './DigitalCanvas';
import { customerChatReply, deliverEmail, resolveApproval } from './digitalActions';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const RAIL = [
  { id: 'history', label: 'Contact History', icon: <HistoryIcon size={21} /> },
  { id: 'search', label: 'Search', icon: <Search size={21} /> },
  { id: 'queue', label: 'Queue', icon: <List size={21} /> },
  { id: 'directory', label: 'Directory', icon: <BookUser size={21} /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarDays size={21} /> },
  { id: 'wem', label: 'WEM', icon: <CircleUserRound size={21} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={21} /> },
  { id: 'reporting', label: 'Reporting', icon: <ChartColumn size={21} /> },
];

const statusKind = (st: string) => (st === 'Available' ? 'ok' : st === 'Working' ? 'busy' : st === 'Wrap Up' ? 'wrap' : 'bad');

/* ================= ROOT ================= */
export function WorkspaceApp() {
  const { s, set } = useSim();
  const { tour } = useTour();
  const now = useNow();
  useScreenPopWindow();

  // Outbound: "dialing" becomes connected after a short ring.
  useEffect(() => {
    if (s.call?.phase !== 'dialing') return;
    const id = setTimeout(() => set((x) => (x.call?.phase === 'dialing' ? { call: { ...x.call, phase: 'active', start: Date.now(), connectedAt: Date.now() } } : {})), 2500);
    return () => clearTimeout(id);
  }, [s.call?.phase, s.call?.id]);

  // Consult: the other party answers after a short ring.
  useEffect(() => {
    if (s.call?.consult?.phase !== 'dialing') return;
    const id = setTimeout(() => set((x) => (x.call?.consult?.phase === 'dialing' ? { call: { ...x.call, consult: { ...x.call.consult, phase: 'active', start: Date.now() } } } : {})), 2200);
    return () => clearTimeout(id);
  }, [s.call?.consult?.phase, s.call?.consult?.name]);

  // Free practice: one practice email arrives ~20s after you first go Available (digital work doesn't change your voice state).
  const [firstAvail, setFirstAvail] = useState<number | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  useEffect(() => { if (firstAvail === null && s.agentStatus === 'Available') setFirstAvail(Date.now()); }, [s.agentStatus]);
  useEffect(() => {
    if (tour || s.trainingMode !== 'free' || emailSent || s.digital || firstAvail === null || now - firstAvail < 20000) return;
    setEmailSent(true);
    set((x) => (x.trainingMode === 'free' && !x.digital ? deliverEmail(x, 'mailbox') : {}));
  }, [now, tour, s.trainingMode, emailSent, !!s.digital, firstAvail]);

  // Webchat: the (simulated) customer types their first message after you accept, and answers each of your replies.
  const dg = s.digital;
  const lastFromAgent = dg?.messages[dg.messages.length - 1]?.from === 'agent';
  const chatTurn = !!dg && dg.channel === 'chat' && dg.phase === 'active' && (dg.script === 0 || lastFromAgent);
  useEffect(() => {
    if (!chatTurn) return;
    const id = setTimeout(() => set((x) => customerChatReply(x)), dg!.script === 0 ? 1500 : 2600);
    return () => clearTimeout(id);
  }, [chatTurn, dg?.messages.length, dg?.script]);

  // Review approval: the (simulated) reviewer answers a few seconds after you request approval.
  const waiting = !!s.approval && !s.digital;
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => set((x) => resolveApproval(x)), 5000);
    return () => clearTimeout(id);
  }, [waiting, s.approval?.at]);
  // CXone notifications disappear after a few seconds
  useEffect(() => {
    if (!s.wsToast) return;
    const id = setTimeout(() => set({ wsToast: null }), 4500);
    return () => clearTimeout(id);
  }, [s.wsToast?.at]);

  // Free-explore realism: an inbound call arrives ~10s after going Available. Unanswered calls are refused after 30s.
  useEffect(() => {
    if (tour || s.trainingMode !== 'free') return;
    if (s.agentStatus === 'Available' && !s.call && !s.wrap) {
      const id = setTimeout(() => set((x) => (x.agentStatus === 'Available' && !x.call && !x.wrap && x.trainingMode === 'free' ? ringInbound(x, x.stats.inboundAccepted + x.stats.refused) : {})), 10000);
      return () => clearTimeout(id);
    }
    if (s.call?.phase === 'ringing') {
      const id = setTimeout(() => set((x) => (x.call?.phase === 'ringing' ? reject(x) : {})), 30000);
      return () => clearTimeout(id);
    }
  }, [tour, s.trainingMode, s.agentStatus, s.call?.phase, s.wrap, s.statusSince]);

  // Play the ringtone (from Settings, at the Settings volume) while a call is ringing.
  const ringingNow = s.call?.phase === 'ringing';
  useEffect(() => {
    if (!ringingNow) return;
    return startRinging(s.prefs.ringtone as string, s.prefs.volume as number);
  }, [ringingNow, s.prefs.ringtone, s.prefs.volume]);

  // Commitments become due at their scheduled time.
  useEffect(() => {
    const due = s.commitments.some((c) => c.target === 'me' && !c.due && parseCommitTime(c.time) <= now);
    if (due) set((x) => ({ commitments: x.commitments.map((c) => (c.target === 'me' && !c.due && parseCommitTime(c.time) <= Date.now() ? { ...c, due: true } : c)) }));
  }, [now, s.commitments]);

  useEffect(() => { document.title = 'NiCE CXone'; }, []);

  if (s.wsLaunch) return <VoiceConnectionPage />;

  return (
    <div className="aw">
      <AwHeader now={now} />
      <div className="aw-body">
        <AwRail />
        <AssignPanel now={now} />
        <main className="aw-main" data-tour="ws-main">
          <div className={'aw-card' + (s.digitalView && s.digital?.phase === 'active' ? ' canvas' : '')}>{s.digitalView && s.digital?.phase === 'active' ? <DigitalCanvas /> : s.callView && (s.call || s.wrap) ? <CallView now={now} /> : <Panel />}</div>
        </main>
      </div>
      {s.wsToast && (
        <div className={'ws-toast ' + (s.wsToast.kind ?? 'ok')} role="status" data-tour="ws-toast">
          {s.wsToast.kind === 'bad' ? <CircleMinus size={18} /> : <CircleCheck size={18} />}<span>{s.wsToast.text}</span>
          <button aria-label="Dismiss" onClick={() => set({ wsToast: null })}><X size={14} /></button>
        </div>
      )}
      {s.approval && !s.digital && <div className="ws-await" data-tour="ws-awaiting">Waiting for approval from {s.approval.queue}…</div>}
      {s.extPromptOpen && <ExtensionPrompt />}
      {s.customizeOpen && <CustomizeMenu />}
      {s.skillPrompt && !(s.wsPanel === 'directory' && !s.callView && s.dirQuery.replace(/[\s()-]/g, '') === s.skillPrompt.number) && <SkillPrompt />}
      {s.callbackContact && <CallbackModal />}
    </div>
  );
}

function Panel() {
  const { s } = useSim();
  switch (s.wsPanel) {
    case 'history': return <ContactHistoryPanel />;
    case 'search': return <SearchPanel />;
    case 'queue': return <QueuePanel />;
    case 'directory': return <DirectoryPanel />;
    case 'schedule': return <SchedulePanel />;
    case 'wem': return <WemPanel />;
    case 'settings': return <SettingsPanel />;
    case 'reporting': return <ReportingPanel />;
    case 'help': return <HelpPanel />;
    default: return <ContactHistoryPanel />;
  }
}

/* ================= HEADER ================= */
function AwHeader({ now }: { now: number }) {
  const { s, set } = useSim();
  const kind = statusKind(s.agentStatus);
  const [hoverLeg, setHoverLeg] = useState(false);
  return (
    <header className="aw-top">
      <div className="aw-top-left">
        <AgentWorkspaceIcon size={34} />
        <span className="aw-title">Agent Workspace</span>
      </div>
      <div className="aw-top-center"><Logo size={23} /></div>
      <div className="aw-top-right" data-tour="ws-topbar-right">
        <button className="aw-ic" data-tour="ws-help" aria-label="Help" onClick={() => set({ wsPanel: 'help', callView: false, digitalView: false })} title="Help"><CircleQuestionMark size={23} /></button>
        <span className="aw-sep" />
        <div className="rel">
          <button className="aw-ic" data-tour="ws-notifications" aria-label="Notifications" onClick={() => set((x) => ({ notifOpen: !x.notifOpen, statusMenuOpen: false, notifications: x.notifOpen ? x.notifications.map((n) => ({ ...n, read: true })) : x.notifications }))}>
            <Bell size={22} />
            {s.notifications.some((n) => !n.read) && <span className="aw-dot">{s.notifications.filter((n) => !n.read).length}</span>}
          </button>
          {s.notifOpen && (
            <>
              <div className="backdrop-clear" onClick={() => set((x) => ({ notifOpen: false, notifications: x.notifications.map((n) => ({ ...n, read: true })) }))} />
              <div className="aw-pop notif" data-tour="ws-notif-pop">
                <div className="aw-pop-title">Notifications</div>
                {s.notifications.length ? s.notifications.map((n) => (
                  <div key={n.id} className={'notif-item' + (n.read ? '' : ' unread')}>
                    <div className="notif-from"><span className={'notif-kind ' + n.kind}>{n.kind === 'message' ? 'Agent message' : n.kind === 'wem' ? 'WEM' : 'System'}</span> {n.from}</div>
                    <div className="notif-text">{n.text}</div>
                    <div className="notif-at">{Math.max(1, Math.round((now - n.at) / 60000)) < 60 ? `${Math.max(1, Math.round((now - n.at) / 60000))} min ago` : `${Math.round((now - n.at) / 3600000)} hr ago`}</div>
                  </div>
                )) : <div className="aw-pop-empty">No new notifications.</div>}
              </div>
            </>
          )}
        </div>
        <div className="rel">
          <button
            className={'aw-ic leg' + (s.agentLeg ? ' on' : '') + (hoverLeg ? ' hover' : '')}
            data-tour="ws-agent-leg"
            aria-label="Agent leg"
            onMouseEnter={() => setHoverLeg(true)}
            onMouseLeave={() => setHoverLeg(false)}
            onClick={() => set((x) => (x.call ? {} : { agentLeg: !x.agentLeg }))}
          >
            <Link2 size={22} style={{ transform: 'rotate(-35deg)' }} />
            {!s.agentLeg && <span className="leg-slash" />}
          </button>
          {hoverLeg && <div className="aw-tip">{s.agentLeg ? 'Agent leg connected. Click to disconnect.' : 'Agent leg disconnected. Click to connect.'}</div>}
        </div>
        <button className="aw-presence" data-tour="ws-presence" onClick={() => set({ statusMenuOpen: !s.statusMenuOpen, notifOpen: false })}>
          <span className="aw-avatar">
            {USER.initials}
            <span className={'aw-badge ' + kind}>{kind === 'ok' ? '✓' : kind === 'bad' ? '–' : ''}</span>
          </span>
          <span className="aw-status">
            <span className="aw-status-label">{s.agentStatus}</span>
            <span>({fmtTimer(now - s.statusSince)})</span>
          </span>
        </button>
      </div>
      {s.statusMenuOpen && <StatusMenu />}
    </header>
  );
}

function StatusMenu() {
  const { s, set } = useSim();
  const [q, setQ] = useState('');
  const choose = (st: string) => set((x) => ({ ...statusPatch(x, st), statusMenuOpen: false }));
  const codes = UNAVAILABLE_CODES.filter((c) => c.toLowerCase().includes(q.toLowerCase()));
  const busy = !!s.call || !!s.wrap;
  return (
    <>
      <div className="backdrop-clear" onClick={() => set({ statusMenuOpen: false })} />
      <div className="status-menu aw-status-menu" data-tour="ws-status-menu">
        {s.agentStatus !== 'Available' && !busy && (
          <button className="go-available-row" data-tour="ws-go-available" onClick={() => choose('Available')}><CircleCheck size={15} /> Go Available</button>
        )}
        <div className="search-box">
          <Search size={14} />
          <input placeholder="Search agent status" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="sm-count">All Codes ({UNAVAILABLE_CODES.length + 1})</div>
        <div className="sm-list">
          {'available'.includes(q.toLowerCase()) && (
            <button disabled={busy} className={s.agentStatus === 'Available' ? 'current' : ''} data-tour="ws-code-available" onClick={() => choose('Available')}>
              <CircleCheck size={16} className="st-ic ok" /> Available
            </button>
          )}
          {codes.map((c) => (
            <button key={c} className={s.agentStatus === c ? 'current' : ''} data-tour={`ws-code-${c.replace(/\W+/g, '-').toLowerCase()}`} onClick={() => choose(c)}>
              <CircleMinus size={16} className="st-ic bad" /> {c}
            </button>
          ))}
        </div>
        {busy && <div className="sm-note">Your new state applies after you finish the current contact.</div>}
        <button className="sm-logout" data-tour="ws-logout" disabled={busy} onClick={() => set({ statusMenuOpen: false, ...statusPatch(s, 'Logged Out') })}>
          <LogOut size={15} /> Log Out
        </button>
      </div>
    </>
  );
}

/* ================= LEFT RAIL ================= */
function AwRail() {
  const { s, set } = useSim();
  return (
    <nav className="aw-rail" data-tour="ws-rail">
      {RAIL.map((r) => (
        <RailBtn key={r.id} id={r.id} label={r.label} active={s.wsPanel === r.id && !s.callView} onClick={() => set({ wsPanel: r.id, callView: false, digitalView: false, scheduleMode: r.id === 'schedule' ? 'calendar' : s.scheduleMode })}>
          {r.icon}
        </RailBtn>
      ))}
      <RailBtn id="more" label="More" active={s.customizeOpen} onClick={() => set({ customizeOpen: !s.customizeOpen })}><Ellipsis size={21} /></RailBtn>
    </nav>
  );
}

function RailBtn({ id, label, active, onClick, children }: { id: string; label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="rel">
      <button className={active ? 'active' : ''} data-tour={`ws-rail-${id}`} aria-label={label} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {children}
      </button>
      {hover && <div className="aw-tip below">{label}</div>}
    </div>
  );
}

function CustomizeMenu() {
  const { set } = useSim();
  return (
    <>
      <div className="backdrop-clear" onClick={() => set({ customizeOpen: false })} />
      <div className="aw-customize" data-tour="ws-customize">
        <div className="aw-customize-head">
          <span>Customize</span>
          <button className="aw-x-box" aria-label="Close" onClick={() => set({ customizeOpen: false })}><X size={16} /></button>
        </div>
        {[0, 1, 2].map((g) => (
          <div key={g} className="aw-customize-group">
            {CUSTOMIZE_ITEMS.filter((i) => i.group === g).map((i) => (
              <button
                key={i.label}
                className={'aw-customize-item' + (i.enabled ? '' : ' off')}
                disabled={!i.enabled}
                title={i.enabled ? `Open ${i.label}` : 'Not enabled for your account'}
                onClick={() => i.panel && set({ wsPanel: i.panel, callView: false, digitalView: false, customizeOpen: false })}
              >
                <GripVertical size={14} className="grip" /> {i.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ================= INTERACTIONS (assignment) PANEL ================= */
function AssignPanel({ now }: { now: number }) {
  const { s, set } = useSim();
  const [tipOut, setTipOut] = useState(false);
  const due = s.commitments.filter((c) => c.due);
  const call = s.call, wrap = s.wrap;
  const done = !call && !wrap && !s.digital && !!s.completedAt && now - s.completedAt < 4000;
  const empty = !call && !wrap && !due.length && !done && !s.digital;
  return (
    <aside className={'aw-assign' + (s.assignCollapsed ? ' collapsed' : '')} data-tour="ws-assign">
      <div className="aw-assign-top">
        <div className="rel">
          <button className="aw-ic dark" data-tour="ws-outbound" aria-label="New Outbound" onMouseEnter={() => setTipOut(true)} onMouseLeave={() => setTipOut(false)}
            onClick={() => set({ wsPanel: 'directory', callView: false, digitalView: false, dirQuery: '' })}>
            <Upload size={21} />
          </button>
          {tipOut && <div className="aw-tip below dark">New Outbound</div>}
        </div>
        <button className="aw-ic dark" aria-label="Collapse" onClick={() => set({ assignCollapsed: !s.assignCollapsed })}><ListCollapse size={20} /></button>
      </div>
      {!s.assignCollapsed && (
        <div className="aw-assign-list">
          {call && call.phase === 'ringing' && (
            <div className="int-card ringing ri" data-tour="ws-incoming">
              <div className="ri-top">
                <div className="ri-l">
                  <div className="ri-title">{call.name ?? call.number}</div>
                  <div className="ri-skill" title={call.skill}><ArrowDownLeft size={12} /> {call.skill}</div>
                  <div className={'ri-label' + (call.name ? '' : ' unknown')} data-tour="ws-caller-name">{call.name ?? 'Unknown'}</div>
                </div>
                <div className="ri-r">
                  <PhoneCall size={22} className="ri-ring" />
                  <span className="ri-time">{fmtTimer(now - call.start)}</span>
                </div>
              </div>
              <div className="ri-actions">
                <button className="ri-reject" data-tour="ws-reject" onClick={() => set((x) => reject(x))}>Reject</button>
                <button className="ri-accept" data-tour="ws-accept" onClick={() => set((x) => accept(x))}>Accept</button>
              </div>
            </div>
          )}
          {call && call.phase !== 'ringing' && <CallCard now={now} />}
          {s.digital && <EmailCard now={now} />}
          {done && (
            <div className="int-card completed" data-tour="ws-completed">
              <span>Interaction completed</span><CircleCheck size={26} />
            </div>
          )}
          {wrap && (
            <button className={'int-card wrap' + (s.callView ? ' selected' : '')} data-tour="ws-wrap-card" onClick={() => set({ callView: true, digitalView: false })}>
              <div className="int-card-row"><Phone size={16} /> <b>{wrap.call.name ?? wrap.call.number}</b><span className="int-timer">{fmtTimer(now - wrap.endedAt)}</span></div>
              <div className="int-skill">{wrap.call.skill}</div>
              <div className="int-state wrap">Outcome required</div>
            </button>
          )}
          {due.map((c) => (
            <div key={c.id} className="int-card commit" data-tour="ws-commit-card">
              <div className="int-card-row"><CalendarClock size={16} /> <b>Commitment</b></div>
              <div className="int-num">{c.first} {c.last}</div>
              <div className="int-skill">{c.phone} · {c.skill}</div>
              <div className="int-actions three">
                <button onClick={() => set((x) => ({ commitments: x.commitments.map((k) => (k.id === c.id ? { ...k, due: false, time: rescheduleTime() } : k)) }))}>Reschedule</button>
                <button className="btn-accept" data-tour="ws-commit-proceed" disabled={!!s.call || !!s.wrap}
                  onClick={() => set((x) => ({ ...startOutbound(x, c.phone, `${c.first} ${c.last}`, c.skill || OUTBOUND_SKILL), commitments: x.commitments.filter((k) => k.id !== c.id) }))}>Proceed</button>
                <button onClick={() => set((x) => ({ commitments: x.commitments.filter((k) => k.id !== c.id) }))}>Remove</button>
              </div>
            </div>
          ))}
          {empty && (
            <div className="no-assign">
              <Inbox size={24} />
              <span>No Assignments</span>
            </div>
          )}
        </div>
      )}
      {!s.assignCollapsed && <OutcomeDrawer />}
    </aside>
  );
}

function rescheduleTime() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ap}`;
}

/* ================= VOICE CONNECTION (first page of the new window) ================= */
export const REMEMBER_KEY = 'cxa-voice-remembered';
function VoiceConnectionPage() {
  const { s, set } = useSim();
  const opt = (id: 'phone' | 'station' | 'softphone', label: string) => (
    <label className="radio-row" data-tour={`voice-${id}`}>
      <input type="radio" name="voice" checked={s.voiceOption === id} onChange={() => set({ voiceOption: id })} />
      <span>{label}</span>
    </label>
  );
  const launch = () => {
    try { if (s.rememberSetting) localStorage.setItem(REMEMBER_KEY, s.voiceOption ?? 'softphone'); else localStorage.removeItem(REMEMBER_KEY); } catch { /* storage unavailable */ }
    set((x) => ({ wsLaunch: false, extPromptOpen: true, ...statusPatch(x, 'Unavailable') }));
  };
  return (
    <div className="vc-page">
      <div className="launch-card flat" data-tour="launch-dialog">
        <div className="launch-head">
          <AgentWorkspaceIcon size={36} />
          <span>Agent Workspace</span>
        </div>
        <div className="launch-body">
          <div className="launch-label">Voice Connection</div>
          {opt('phone', 'Set Phone Number')}
          {opt('station', 'Set Station ID')}
          {opt('softphone', 'Integrated Softphone')}
          <label className="check-row" data-tour="voice-remember">
            <input type="checkbox" checked={s.rememberSetting} onChange={(e) => set({ rememberSetting: e.target.checked })} />
            <span>Remember Setting</span>
          </label>
          <button className="btn-primary block" data-tour="voice-launch" disabled={!s.voiceOption} onClick={launch}>Launch</button>
        </div>
      </div>
    </div>
  );
}

/* ================= OVERLAYS ================= */
function ExtensionPrompt() {
  const { set } = useSim();
  return (
    <div className="ext-prompt" data-tour="ws-ext-prompt">
      <div className="ext-head">
        <Info size={20} className="ext-ic" />
        <span>Install Softphone Extension</span>
        <button className="ext-x" aria-label="Close" onClick={() => set({ extPromptOpen: false })}><X size={15} /></button>
      </div>
      <p>For enhanced call experience, it is recommended to install the CXone Softphone Extension from the Chrome Web Store. <a href="#" onClick={(e) => e.preventDefault()}>Click here for details</a></p>
      <div className="ext-btns">
        <button className="btn-outline-blue" data-tour="ws-ext-never" onClick={() => set({ extPromptOpen: false })}>Do Not Remind Me</button>
        <button className="btn-primary" data-tour="ws-ext-later" onClick={() => set({ extPromptOpen: false })}>Remind Me Later</button>
      </div>
    </div>
  );
}

/** Outbound skill choice outside the Directory (Callback, Save & Redial) when the agent has several outbound skills. */
function SkillPrompt() {
  const { s, set } = useSim();
  const p = s.skillPrompt!;
  return (
    <div className="modal-scrim dim aw-scrim">
      <div className="cb-card" data-tour="ws-skill-prompt">
        <div className="cb-head"><span>Select a skill</span><button className="x-circle" onClick={() => set({ skillPrompt: null })} aria-label="Close">×</button></div>
        <div className="cb-row">Outbound call to <b>{p.name ?? p.number}</b></div>
        <div className="skill-dd inline"><SkillDropdownList /></div>
      </div>
    </div>
  );
}
function SkillDropdownList() {
  const { s, set } = useSim();
  const p = s.skillPrompt!;
  return <>{s.outboundSkills.map((k, i) => (
    <button key={k} data-tour={i === 0 ? 'ws-skill-dd-first' : undefined} onClick={() => set((x) => ({ ...startOutbound({ ...x, skillPrompt: null }, p.number, p.name, k), skillPrompt: null }))}><Phone size={14} /> {k}</button>
  ))}</>;
}

function CallbackModal() {
  const { s, set } = useSim();
  const c = s.callbackContact!;
  return (
    <div className="modal-scrim dim aw-scrim">
      <div className="cb-card" data-tour="ws-callback-modal">
        <div className="cb-head"><span>{c.number}</span><button className="x-circle" onClick={() => set({ callbackContact: null })} aria-label="Close">×</button></div>
        <div className="cb-row"><span><span className="dir">{c.outbound ? '↑' : '↓'}</span><Phone size={12} /> {c.skill}</span><span>{c.date}</span></div>
        <div className="cb-row">Duration: {c.duration}</div>
        <div className="cb-actions">
          <button className="btn-outline sm" onClick={() => set({ callbackContact: null })}>Cancel</button>
          <button className="btn-primary sm" data-tour="ws-callback-btn" disabled={!!s.call || !!s.wrap}
            onClick={() => set((x) => ({ callbackContact: null, ...requestOutbound({ ...x, callbackContact: null }, c.number) }))}>Callback</button>
        </div>
      </div>
    </div>
  );
}

export type { SimState };
