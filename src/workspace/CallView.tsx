import { useEffect, useRef, useState } from 'react';
import { scenarioById } from '../training/scenarios';
import { speak } from '../training/speech';
import { Pause, Play, Mic, MicOff, AudioLines, CircleDot, Grid3x3, PhoneIncoming, PhoneOutgoing, Search, Headset, Wrench, User, Phone, UserPlus, ContactRound, EllipsisVertical, CalendarPlus, ArrowDownLeft, ArrowUpRight, ClipboardCheck } from 'lucide-react';
import { emptyDraft, useSim } from '../store';
import { fmtTimer, hangUp, saveOutcome, transferCall } from './callActions';
import { CrmWindow, CustomerPanel } from './CustomerPanel';
import { ScreenPopTab } from './ScreenPop';
import { DIR_AGENTS, DIR_SKILLS, DISPOSITIONS, OUTBOUND_SKILL, TAGS } from './wsData';

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
      {s.keypadOpen && <Keypad />}
      {s.consultOpen && <Consult />}
      {!s.keypadOpen && !s.consultOpen && (
        <div className="cv-body as-layout">
          <AppSpace c={c} />
          <Transcript now={now} />
        </div>
      )}
    </div>
  );
}

/** App Space: the tabbed area for the current interaction (customer details and screen pops). */
function AppSpace({ c }: { c: NonNullable<ReturnType<typeof useSim>['s']['call']> }) {
  const { s, set } = useSim();
  const tab = s.appSpaceTab;
  return (
    <div className="aps" data-tour="ws-appspace">
      <div className="aps-title">App Space</div>
      <div className="aps-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'on' : ''} data-tour="ws-aps-details" title="Customer details" onClick={() => set({ appSpaceTab: 'details' })}><ContactRound size={19} /></button>
        <button role="tab" aria-selected={tab === 'screenpop'} className={tab === 'screenpop' ? 'on' : ''} data-tour="ws-aps-screenpop" title="Screen Pops" onClick={() => set({ appSpaceTab: 'screenpop' })}>
          <Wrench size={19} />{s.screenPopOut && <span className="aps-dot" title="Popped out" />}
        </button>
      </div>
      {tab === 'screenpop' ? <ScreenPopTab c={c} /> : <CustomerPanel c={c} />}
    </div>
  );
}

/**
 * Active call card in the Interactions panel, laid out like the real Agent Workspace:
 * header (number, skill, timer), the call line with a ⋮ menu (Add Commitment), the skill,
 * two rows of voice controls and the red hang-up button.
 */
export function CallCard({ now }: { now: number }) {
  const { s, set } = useSim();
  const c = s.call!;
  const live = c.phase === 'active';
  const upd = (p: Partial<typeof c>) => set((x) => (x.call ? { call: { ...x.call, ...p, everHeld: x.call.everHeld || !!p.onHold, everMasked: x.call.everMasked || !!p.masked } } : {}));
  const B = ({ id, label, icon, on, onClick, disabled }: { id: string; label: string; icon: React.ReactNode; on?: boolean; onClick: () => void; disabled?: boolean }) => (
    <button className={'cc-btn' + (on ? ' on' : '')} data-tour={`ws-vc-${id}`} disabled={disabled} onClick={onClick} title={label} aria-label={label} aria-pressed={on}>
      {icon}
    </button>
  );
  const addCommitment = () => set((x) => ({
    callMenuOpen: false, callView: false, wsPanel: 'schedule', scheduleMode: 'add', skillDdOpen: false,
    draft: { ...emptyDraft(), phone: x.call?.number ?? '', skill: x.call?.skill ?? OUTBOUND_SKILL },
  }));
  return (
    <div className={'int-card call-card' + (s.callView ? ' selected' : '')} data-tour="ws-int-card">
      <button className="cc-head" onClick={() => set({ callView: true, callMenuOpen: false })}>
        <span className="cc-head-l">
          <span className="cc-num">{c.name ?? c.number}</span>
          <span className="cc-dir">{c.direction === 'in' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />} {c.skill}</span>
        </span>
        <span className="cc-head-r">
          <Phone size={20} className="cc-ph" />
          <span className="cc-time">{fmtTimer(now - c.start)}</span>
        </span>
      </button>
      <div className="cc-body">
        <div className="cc-line">
          <Phone size={15} className="cc-ph" />
          <span className="cc-line-num">{c.number}</span>
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
        {(c.phase === 'dialing' || c.onHold) && <div className={'cc-state ' + (c.phase === 'dialing' ? 'dialing' : 'hold')}>{c.phase === 'dialing' ? 'Dialing…' : 'On Hold'}</div>}
        <div className="cc-ctrls" data-tour="ws-voice-controls">
          <B id="hold" label={c.onHold ? 'Resume' : 'Hold'} icon={c.onHold ? <Play size={22} /> : <Pause size={22} />} on={c.onHold} disabled={!live} onClick={() => upd({ onHold: !c.onHold })} />
          <B id="mute" label={c.muted ? 'Unmute' : 'Mute'} icon={c.muted ? <MicOff size={22} /> : <Mic size={22} />} on={c.muted} disabled={!live} onClick={() => upd({ muted: !c.muted })} />
          <B id="mask" label={c.masked ? 'Unmask' : 'Mask'} icon={c.masked ? <AudioLines size={22} /> : <span className="cc-slash"><AudioLines size={22} /></span>} on={c.masked} disabled={!live} onClick={() => upd({ masked: !c.masked })} />
          <B id="record" label={c.recording ? 'Stop recording' : 'Record'} icon={<CircleDot size={22} />} on={c.recording} disabled={!live} onClick={() => upd({ recording: !c.recording })} />
          <B id="consult" label="Consult / Transfer" icon={<UserPlus size={22} />} on={s.consultOpen} disabled={!live} onClick={() => set({ consultOpen: !s.consultOpen, keypadOpen: false, callView: true })} />
          <B id="keypad" label="Keypad" icon={<Grid3x3 size={22} />} on={s.keypadOpen} disabled={!live} onClick={() => set({ keypadOpen: !s.keypadOpen, consultOpen: false, callView: true })} />
        </div>
        <div className="cc-hang">
          <button className="cc-hangup" data-tour="ws-vc-hangup" disabled={c.masked} title={c.masked ? 'Unmask to hang up' : 'Hang Up'} aria-label="Hang Up" onClick={() => set((x) => ({ ...hangUp(x), callMenuOpen: false }))}>
            <Phone size={22} />
          </button>
          {c.masked && <div className="cc-note">Unmask to hang up.</div>}
        </div>
      </div>
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

function Keypad() {
  const { s, set } = useSim();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  return (
    <div className="cv-keypad" data-tour="ws-keypad">
      <div className="cv-dtmf">{s.dtmf || <span className="muted">Send tones (e.g. IVR menu choices)</span>}</div>
      <div className="dialpad">{keys.map((k) => <button key={k} onClick={() => set({ dtmf: s.dtmf + k })}>{k}</button>)}</div>
    </div>
  );
}

function Consult() {
  const { set } = useSim();
  const [q, setQ] = useState('');
  const [done, setDone] = useState('');
  const agents = DIR_AGENTS.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  const skills = DIR_SKILLS.filter((k) => k.name.toLowerCase().includes(q.toLowerCase()));
  const transfer = (who: string) => { setDone(who); setTimeout(() => set((x) => transferCall(x)), 900); };
  return (
    <div className="cv-consult" data-tour="ws-consult">
      <div className="search-box wide2"><Search size={14} /><input placeholder="Search agents, skills or enter a number" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
      {done && <div className="cv-done">Transferring to {done}…</div>}
      <div className="cv-consult-list">
        {agents.map((a) => (
          <div key={a.name} className="cv-row">
            <Headset size={16} className="dir-ic" /> <span className="flex1">{a.name} <span className={'mini-state ' + a.state.toLowerCase()}>{a.state}</span></span>
            <button className="btn-outline sm" disabled={a.state !== 'Available'} onClick={() => transfer(a.name)} data-tour={a.name === 'Ana Bautista' ? 'ws-transfer-agent' : undefined}>Transfer</button>
          </div>
        ))}
        {skills.map((k) => (
          <div key={k.name} className="cv-row">
            <Wrench size={16} className="dir-ic" /> <span className="flex1">{k.name} <span className="muted">· Available ({k.available})</span></span>
            <button className="btn-outline sm" onClick={() => transfer(k.name)}>Transfer</button>
          </div>
        ))}
        {/^\+?\d{5,}$/.test(q.replace(/\s/g, '')) && (
          <div className="cv-row"><PhoneOutgoing size={16} className="dir-ic" /> <span className="flex1">{q}</span><button className="btn-outline sm" onClick={() => transfer(q)}>Transfer</button></div>
        )}
      </div>
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
