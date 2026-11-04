import { useEffect, useRef } from 'react';
import { scenarioById } from '../training/scenarios';
import { speak } from '../training/speech';
import { Pause, Play, Mic, MicOff, AudioLines, CircleDot, Grid3x3, PhoneIncoming, PhoneOutgoing, Search, Wrench, User, Phone, PhoneCall, UserPlus, ContactRound, EllipsisVertical, CalendarPlus, ArrowDownLeft, ArrowUpRight, ClipboardCheck, ListOrdered, BookUser, CalendarDays, CalendarCheck, MonitorDot, Users, ChevronLeft, CircleCheck, ChevronsUp, ChevronsDown } from 'lucide-react';
import { emptyDraft, useSim, type AppSpaceTab, type Call } from '../store';
import { HistoryIcon } from '../components/icons';
import { ConsultDirectory, ConsultPanel } from './ConsultPanel';
import { ContactHistoryPanel, QueuePanel, SchedulePanel, SearchPanel, WemPanel } from './panels';
import { fmtTimer, hangUp, saveOutcome, setCallOutcome, startRecording } from './callActions';
import { CrmWindow, CustomerPanel } from './CustomerPanel';
import { ScreenPopTab } from './ScreenPop';
import { DISPOSITIONS, OUTBOUND_SKILL, TAGS } from './wsData';

export function CallView({ now }: { now: number }) {
  const { s } = useSim();
  if (s.wrap && !s.call) return <OutcomePanel now={now} />;
  const c = s.call!;
  return (
    <div className="cv">
      <div className="cv-head">
        <div className="cv-avatar"><User size={28} /></div>
        <div>
          <div className="cv-name">{c.name ?? c.number}</div>
          <div className="cv-sub">{c.direction === 'in' ? <PhoneIncoming size={13} /> : <PhoneOutgoing size={13} />} {c.direction === 'in' ? 'Inbound' : 'Outbound'} · {c.skill}</div>
          {c.name ? <div className="cv-sub">{c.number}</div> : c.direction === 'in' && <div className="cv-sub">Unknown (not a saved contact)</div>}
        </div>
        <div className="cv-timer" data-tour="ws-call-timer">
          <span className={'cv-state ' + (c.phase === 'dialing' ? 'dialing' : c.onHold ? 'hold' : 'active')}>{c.phase === 'dialing' ? 'Dialing' : c.onHold ? 'On Hold' : 'Connected'}</span>
          {fmtTimer(now - c.start)}
        </div>
      </div>
      <CrmWindow />
      <div className="cv-body as-layout">
        <AppSpace c={c} now={now} />
        <Transcript now={now} />
      </div>
    </div>
  );
}

const AS_TABS: { id: AppSpaceTab; label: string; icon: React.ReactNode; sep?: boolean }[] = [
  { id: 'details', label: 'Customer details', icon: <ContactRound size={19} /> },
  { id: 'consult', label: 'Consult', icon: <Users size={19} /> },
  { id: 'screenpop', label: 'Screen Pops', icon: <Wrench size={19} />, sep: true },
  { id: 'history', label: 'Contact History', icon: <HistoryIcon size={19} /> },
  { id: 'search', label: 'Search', icon: <Search size={19} /> },
  { id: 'queue', label: 'Queue', icon: <ListOrdered size={19} /> },
  { id: 'directory', label: 'Directory', icon: <BookUser size={19} /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarDays size={19} /> },
  { id: 'wem', label: 'WEM', icon: <CalendarCheck size={19} /> },
];

/** App Space: the tabbed area for the current interaction (customer details, screen pops and your apps). */
function AppSpace({ c, now }: { c: Call; now: number }) {
  const { s, set } = useSim();
  const tab = s.appSpaceTab;
  let body: React.ReactNode;
  switch (tab) {
    case 'screenpop': body = <ScreenPopTab c={c} />; break;
    case 'history': body = <ContactHistoryPanel />; break;
    case 'search': body = <SearchPanel />; break;
    case 'queue': body = <QueuePanel />; break;
    case 'directory': body = <ConsultDirectory />; break;
    case 'consult': body = c.consult || c.conference?.length ? <ConsultPanel now={now} /> : <CustomerPanel c={c} />; break;
    case 'schedule': body = <SchedulePanel />; break;
    case 'wem': body = <WemPanel />; break;
    default: body = <CustomerPanel c={c} />;
  }
  return (
    <div className="aps" data-tour="ws-appspace">
      <div className="aps-title">App Space</div>
      <div className="aps-tabs" role="tablist">
        {AS_TABS.filter((t) => (t.id !== 'screenpop' || c.direction === 'in') && (t.id !== 'consult' || !!c.consult || !!c.conference?.length)).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={(tab === t.id ? 'on' : '') + (t.sep ? ' sep' : '')} data-tour={`ws-aps-${t.id}`} title={t.label} aria-label={t.label}
            onClick={() => set({ appSpaceTab: t.id, ...(t.id === 'directory' ? { dirQuery: '' } : {}) })}>
            {t.icon}{t.id === 'screenpop' && s.screenPopOut && <span className="aps-dot" title="Popped out" />}
          </button>
        ))}
      </div>
      <div className={'aps-body' + (tab === 'details' || tab === 'screenpop' || tab === 'consult' ? '' : ' app')}>{body}</div>
    </div>
  );
}

/** Small "tooltip" button used on the call card, styled like the real one (dark tooltip on hover). */
function CB({ id, label, icon, on, onClick, disabled, className = 'cc-btn' }: { id: string; label: string; icon: React.ReactNode; on?: boolean; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button className={className + (on ? ' on' : '')} data-tour={`ws-vc-${id}`} disabled={disabled} onClick={onClick} aria-label={label} aria-pressed={on} data-tip={label}>
      {icon}
    </button>
  );
}

/**
 * Active call card in the Interactions panel, laid out like the real Agent Workspace:
 * header (name/number, skill, timer), the call line with a ⋮ menu (Add Commitment), the skill,
 * two rows of phone controls, then Hang Up and Outcome. Only the controls assigned to you appear.
 * The keypad opens inside the card; Consult/Transfer opens the Directory in the App Space.
 */
export function CallCard({ now }: { now: number }) {
  const { s, set } = useSim();
  const c = s.call!;
  const live = c.phase === 'active';
  const upd = (p: Partial<Call>) => set((x) => (x.call ? { call: { ...x.call, ...p, everHeld: x.call.everHeld || !!p.onHold, everMasked: x.call.everMasked || !!p.masked } } : {}));
  const addCommitment = () => set((x) => ({
    callMenuOpen: false, callView: false, wsPanel: 'schedule', scheduleMode: 'add', skillDdOpen: false,
    draft: { ...emptyDraft(), phone: x.call?.number ?? '', skill: x.call?.skill ?? OUTBOUND_SKILL },
  }));
  const recLabel = !c.recording ? 'Record' : c.masked ? 'Recording paused (masked)' : `Recording voice${c.screenRec ? ' + screen' : ''}`;
  const dirOpen = s.callView && s.appSpaceTab === 'directory';
  return (
    <div className={'int-card call-card' + (s.callView ? ' selected' : '')} data-tour="ws-int-card">
      <button className="cc-head" onClick={() => set({ callView: true, digitalView: false, callMenuOpen: false })}>
        <span className="cc-head-l">
          <span className="cc-num">{c.name ?? c.number}</span>
          <span className="cc-dir">{c.direction === 'in' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />} {c.skill}</span>
        </span>
        <span className="cc-head-r">
          {c.phase === 'dialing' ? <PhoneCall size={20} className="cc-ph ringing" aria-label="Dialing" /> : <Phone size={20} className="cc-ph" />}
          <span className="cc-time">{fmtTimer(now - c.start)}</span>
        </span>
      </button>
      {c.phase === 'dialing' ? (
        <div className="cc-dialing" data-tour="ws-dialing">
          <CB id="hangup" className="cc-hangup" label="Hang Up" icon={<Phone size={22} />} onClick={() => set((x) => ({ ...hangUp(x), callMenuOpen: false }))} />
        </div>
      ) : (
      <div className="cc-body">
        {s.keypadOpen ? <CardKeypad /> : c.consult || c.conference?.length ? (
          <>
            <div className="cc-line">
              <Phone size={15} className="cc-ph" />
              <span className="cc-line-num">{c.name ?? c.number}</span>
              <button className="cc-kebab" aria-label="More actions" disabled><EllipsisVertical size={17} /></button>
            </div>
            {c.onHold ? <div className="cc-holdline">hold ( {fmtTimer(now - (c.consult?.start ?? now))} )</div> : <div className="cc-skill">{c.skill}</div>}
            <div className="cc-ctrls two">
              <CB id="consultview" label={c.consult ? 'Consult' : 'Conference'} icon={<Users size={22} />} on={s.callView && s.appSpaceTab === 'consult'} onClick={() => set({ callView: true, appSpaceTab: 'consult', keypadOpen: false })} />
              <CB id="keypad" label="Keypad" icon={<Grid3x3 size={22} />} onClick={() => set({ keypadOpen: true, callView: true })} />
            </div>
          </>
        ) : (
          <>
            <div className="cc-line">
              <Phone size={15} className="cc-ph" />
              <span className="cc-line-num">{c.name ?? c.number}</span>
              <div className="rel">
                <button className="cc-kebab" data-tour="ws-call-kebab" aria-label="More actions" onClick={() => set({ callMenuOpen: !s.callMenuOpen })}><EllipsisVertical size={17} /></button>
                {s.callMenuOpen && (
                  <div className="cc-menu">
                    <button data-tour="ws-call-add-commit" onClick={addCommitment}><CalendarPlus size={17} /> Add Commitment</button>
                  </div>
                )}
              </div>
            </div>
            <div className="cc-skill">{c.skill}</div>
            {c.onHold && !c.consult && <div className="cc-state hold">On Hold</div>}
            {c.recording && (
              <div className={'cc-rec' + (c.masked ? ' paused' : '')} data-tour="ws-rec-indicator">
                {c.masked ? <Pause size={11} /> : <span className="cc-rec-dot" />} {c.masked ? 'Rec paused' : 'Recording'}
                <span className="cc-rec-what" title={`Recording your voice${c.screenRec ? ' and screen' : ''}`}><Mic size={12} />{c.screenRec && <MonitorDot size={12} />}</span>
              </div>
            )}
            <div className="cc-ctrls" data-tour="ws-voice-controls">
              <CB id="hold" label={c.onHold ? 'Resume' : 'Hold'} icon={c.onHold ? <Play size={22} /> : <Pause size={22} />} on={c.onHold} disabled={!live || !!c.consult} onClick={() => upd({ onHold: !c.onHold })} />
              <CB id="mute" label={c.muted ? 'Unmute' : 'Mute'} icon={c.muted ? <MicOff size={22} /> : <Mic size={22} />} on={c.muted} disabled={!live} onClick={() => upd({ muted: !c.muted })} />
              <CB id="mask" label={c.masked ? 'Unmask' : 'Mask'} icon={c.masked ? <AudioLines size={22} /> : <span className="cc-slash"><AudioLines size={22} /></span>} on={c.masked} disabled={!live} onClick={() => upd({ masked: !c.masked })} />
              <CB id="record" label={recLabel} icon={<CircleDot size={22} />} disabled={!live || c.recording} className={'cc-btn rec' + (c.recording ? ' started' : '')} onClick={() => set((x) => startRecording(x))} />
              <CB id="consult" label="Consult / Transfer" icon={<UserPlus size={22} />} on={dirOpen} disabled={!live} onClick={() => set({ callView: true, appSpaceTab: 'directory', dirQuery: '', keypadOpen: false, consultOpen: true })} />
              <CB id="keypad" label="Keypad" icon={<Grid3x3 size={22} />} disabled={!live} onClick={() => set({ keypadOpen: true, callView: true })} />
            </div>
          </>
        )}
        {!(c.consult || c.conference?.length) && <div className="cc-hang">
          <CB id="hangup" className="cc-hangup" label={c.masked ? 'Unmask to hang up' : c.conference?.length ? 'Hang Up (leave the conference)' : 'Hang Up'} icon={<Phone size={22} />} disabled={c.masked}
            onClick={() => set((x) => ({ ...hangUp(x), callMenuOpen: false }))} />
          <span className="cc-hang-sep" />
          <CB id="outcome" className="cc-outcome" label="Outcome" icon={<CircleCheck size={24} />} on={s.outcomeOpen} onClick={() => set({ outcomeOpen: !s.outcomeOpen })} />
        </div>}
        {c.masked && <div className="cc-note">Unmask to hang up.</div>}
      </div>
      )}
    </div>
  );
}

/** Keypad inside the call card (back arrow, entry field, digits with letters, mute). Sends tones to IVRs. */
const KEYS: [string, string][] = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
function CardKeypad() {
  const { s, set } = useSim();
  const c = s.call!;
  return (
    <div className="ckp" data-tour="ws-keypad">
      <div className="ckp-top">
        <button className="ckp-back" data-tour="ws-keypad-back" aria-label="Close keypad" data-tip="Back" onClick={() => set({ keypadOpen: false })}><ChevronLeft size={22} /></button>
        <input className="ckp-in" data-tour="ws-keypad-input" value={s.dtmf} aria-label="Tones sent" placeholder=""
          onChange={(e) => set({ dtmf: e.target.value.replace(/[^\d*#+]/g, '').slice(-24) })} />
      </div>
      <div className="ckp-keys">
        {KEYS.map(([d, l]) => (
          <button key={d} onClick={() => set((x) => ({ dtmf: (x.dtmf + d).slice(-24) }))}><span>{d}</span><small>{l || ' '}</small></button>
        ))}
      </div>
      <div className="ckp-mic">
        <button className={c.muted ? 'on' : ''} aria-label={c.muted ? 'Unmute' : 'Mute'} data-tip={c.muted ? 'Unmute' : 'Mute'} onClick={() => set((x) => (x.call ? { call: { ...x.call, muted: !x.call.muted } } : {}))}>{c.muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
      </div>
    </div>
  );
}

/** Outcomes panel at the bottom of the Interactions panel: fill in the disposition during the call. */
export function OutcomeDrawer() {
  const { s, set } = useSim();
  const c = s.call;
  if (!c || c.phase === 'ringing') return null;
  const o = c.outcome ?? { disposition: '', notes: '', tags: [] };
  const upd = (p: Partial<typeof o>) => set((x) => setCallOutcome(x, p));
  return (
    <div className={'ocd' + (s.outcomeOpen ? ' open' : '')} data-tour="ws-outcome-drawer">
      <button className="ocd-bar" onClick={() => set({ outcomeOpen: !s.outcomeOpen })} aria-expanded={s.outcomeOpen}>
        <ClipboardCheck size={16} /> <span className="flex1">Outcomes</span>{o.disposition && <span className="ocd-set">{o.disposition}</span>}
        {s.outcomeOpen ? <ChevronsDown size={17} /> : <ChevronsUp size={17} />}
      </button>
      {s.outcomeOpen && (
        <div className="ocd-body">
          <label className="aw-field" data-tour="ws-ocd-disposition">
            <span>Disposition *</span>
            <select value={o.disposition} onChange={(e) => upd({ disposition: e.target.value })}>
              <option value="">Select</option>
              {DISPOSITIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="aw-field">
            <span>Disposition Notes</span>
            <textarea rows={3} placeholder="Add notes about this contact" value={o.notes} onChange={(e) => upd({ notes: e.target.value })} />
          </label>
          <div className="aw-field">
            <span>Tags</span>
            <div className="tag-row">
              {TAGS.map((t) => <button key={t} className={'tag' + (o.tags.includes(t) ? ' on' : '')} onClick={() => upd({ tags: o.tags.includes(t) ? o.tags.filter((x) => x !== t) : [...o.tags, t] })}>{t}</button>)}
            </div>
          </div>
          <div className="muted small">Saved with the contact when you hang up. You can still change it in wrap-up.</div>
        </div>
      )}
    </div>
  );
}

/** Simulated live transcript of the caller (fictional). Lines appear every few seconds; spoken if voice is on. */
function Transcript({ now }: { now: number }) {
  const { s } = useSim();
  const c = s.call!;
  const sc = scenarioById(c.scenario);
  const spoken = useRef<string>('');
  const shown = sc && c.connectedAt && !c.onHold ? Math.min(sc.lines.length, 1 + Math.floor((now - c.connectedAt) / 6000)) : 0;
  useEffect(() => {
    if (!sc || !shown || s.trainingMode === 'story') return;
    const key = c.id + ':' + shown;
    if (spoken.current === key) return;
    spoken.current = key;
    const line = sc.lines[shown - 1];
    if (line.who === 'customer') speak(line.text, 'customer');
  }, [shown, c.id]);
  if (!sc) return null;
  return (
    <div className="cv-transcript" data-tour="ws-transcript">
      <div className="cv-info-title">Caller · {sc.name} <span className="muted small">(simulated transcript)</span></div>
      {sc.lines.slice(0, shown).map((l, i) => <div key={i} className={'tr-line ' + l.who}>{l.text}</div>)}
      {c.onHold && <div className="tr-line hold">Caller is on hold…</div>}
      {!shown && !c.onHold && <div className="muted small">Connecting…</div>}
    </div>
  );
}

function OutcomePanel({ now }: { now: number }) {
  const { s, set } = useSim();
  const w = s.wrap!;
  const upd = (p: Partial<typeof w>) => set((x) => (x.wrap ? { wrap: { ...x.wrap, ...p } } : {}));
  return (
    <div className="cv outcome" data-tour="ws-outcome">
      <div className="cv-head">
        <div className="cv-avatar"><ClipboardCheck size={26} /></div>
        <div>
          <div className="cv-name">Outcome</div>
          <div className="cv-sub">{w.call.name ?? w.call.number} · {w.call.skill}</div>
        </div>
        <div className="cv-timer"><span className="cv-state wrap">Wrap Up</span>{fmtTimer(now - w.endedAt)}</div>
      </div>
      <div className="oc-body">
        <label className="aw-field" data-tour="ws-disposition">
          <span>Disposition *</span>
          <select value={w.disposition} onChange={(e) => upd({ disposition: e.target.value })}>
            <option value="">Select</option>
            {DISPOSITIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="aw-field" data-tour="ws-disp-notes">
          <span>Disposition Notes</span>
          <textarea rows={3} placeholder="Add notes about this contact" value={w.notes} onChange={(e) => upd({ notes: e.target.value })} />
        </label>
        <div className="aw-field" data-tour="ws-tags">
          <span>Tags</span>
          <div className="tag-row">
            {TAGS.map((t) => (
              <button key={t} className={'tag' + (w.tags.includes(t) ? ' on' : '')} onClick={() => upd({ tags: w.tags.includes(t) ? w.tags.filter((x) => x !== t) : [...w.tags, t] })}>{t}</button>
            ))}
          </div>
        </div>
        <div className="oc-actions">
          <button className="btn-outline" data-tour="ws-save-redial" disabled={!w.disposition} onClick={() => set((x) => saveOutcome(x, true))}>Save &amp; Redial</button>
          <button className="btn-primary" data-tour="ws-save-close" disabled={!w.disposition} onClick={() => set((x) => saveOutcome(x))}>Save &amp; Close</button>
        </div>
        {!w.disposition && <div className="muted small">Select a disposition to finish the contact.</div>}
      </div>
    </div>
  );
}
