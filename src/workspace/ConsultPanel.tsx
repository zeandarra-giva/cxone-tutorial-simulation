import { useState } from 'react';
import { Search, ChevronDown, Headset, Wrench, Users, BookUser, Phone, ArrowLeftRight, ChevronsRight, PhoneIncoming, Pause, Play, AudioLines, Mic, MicOff, CircleDot, UserPlus, Star } from 'lucide-react';
import { useSim, type Call } from '../store';
import { DIR_ADDRESS_BOOK, DIR_AGENTS, DIR_FILTERS, DIR_SKILLS, DIR_TEAMS } from './wsData';
import { blindTransfer, endConference, endConsult, hangUpParty, leaveConference, mergeConsult, startConsult, startRecording, swapTo, warmTransfer } from './callActions';
import { StateIcon } from './panels';

type Kind = NonNullable<Call['consult']>['kind'];

/**
 * Directory tab of the App Space during a call (opened by Consult / Transfer).
 * Search, or filter by Agents / Skills / Teams / Address Book, or type a number. Each result has:
 *   Call (consult first: warm / consultative transfer) and Transfer (blind / direct transfer).
 * A manually entered external number asks which outbound skill to use.
 */
export function ConsultDirectory() {
  const { s, set } = useSim();
  const [filterOpen, setFilterOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const c = s.call;
  const q = s.dirQuery.trim();
  const ql = q.toLowerCase();
  const digits = q.replace(/[\s()-]/g, '');
  const isNumber = /^\+?\d{5,}$/.test(digits);
  const f = s.dirFilter;
  // can act when the call is connected and you're not already consulting someone
  const can = !!c && c.phase === 'active' && !c.consult;
  const want = (k: string) => f === 'All' || f === k || (f === 'Favorites');
  const fav = (k: string) => s.favorites.includes(k);
  const match = (n: string) => !!ql && n.toLowerCase().includes(ql) && (f !== 'Favorites' || fav(n));
  const agents = want('Agents') && !isNumber ? DIR_AGENTS.filter((a) => match(a.name)) : [];
  const skills = want('Skills') && !isNumber ? DIR_SKILLS.filter((k) => match(k.name)) : [];
  const teams = want('Teams') && !isNumber ? DIR_TEAMS.filter((t) => match(t.name)) : [];
  const book = want('Address Book') && !isNumber ? DIR_ADDRESS_BOOK.filter((b) => match(b.name) || b.number.includes(digits)) : [];
  const nothing = q && !isNumber && !agents.length && !skills.length && !teams.length && !book.length;

  const consult = (name: string, kind: Kind) => set((x) => startConsult(x, name, kind));
  const transfer = (name: string) => set((x) => blindTransfer(x, name));
  const Actions = ({ name, kind, tour }: { name: string; kind: Kind; tour?: string }) => (
    <span className="cd-acts">
      <button className="cd-act" data-tip="Call" aria-label={`Call ${name} (consult)`} disabled={!can} data-tour={tour ? `ws-dir-consult-${tour}` : undefined} onClick={() => consult(name, kind)}><Phone size={15} /></button>
      <button className="cd-act" data-tip="Transfer" aria-label={`Transfer to ${name}`} disabled={!can} data-tour={tour ? `ws-dir-transfer-${tour}` : undefined} onClick={() => transfer(name)}><ArrowLeftRight size={16} /></button>
    </span>
  );
  const pick = s.consultPick;
  return (
    <div className="aw-panel cd" data-tour="ws-consult-dir">
      {c?.consult && <div className="aw-tip-inline">You're consulting {c.consult.name}. Use the Consult tab to swap, transfer or conference.</div>}
      <div className="rel">
        <div className={'dir-search' + (focus ? ' focus' : '')} data-tour="ws-dir-search">
          <Search size={18} />
          <input autoFocus placeholder="Search for people, skills, teams, etc." value={s.dirQuery}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            onChange={(e) => set({ dirQuery: e.target.value, consultPick: null })} />
        </div>
        {focus && !q && <div className="aw-tip center">Search Directory or press Enter for all results</div>}
      </div>
      <div className="rel">
        <button className="dir-filter" data-tour="ws-dir-filter" onClick={() => setFilterOpen(!filterOpen)}>{f}<ChevronDown size={16} /></button>
        {filterOpen && (
          <div className="dir-filter-menu">
            {DIR_FILTERS.map((x) => <button key={x} className={x === f ? 'on' : ''} onClick={() => { set({ dirFilter: x }); setFilterOpen(false); }}>{x}</button>)}
          </div>
        )}
      </div>
      <div className="dir-results">
        {isNumber && (
          <div className="cd-sec">
            <div className="dir-sec">Number</div>
            <div className="cd-row" data-tour="ws-dir-number">
              <span className="cd-main"><Phone size={16} className="dir-ic" /> {digits}<span className="cd-sub">External number</span></span>
              <span className="cd-acts">
                <button className="cd-act" data-tip="Call" aria-label={`Call ${digits} (consult)`} disabled={!can} data-tour="ws-dir-consult-number" onClick={() => set({ consultPick: { target: digits, action: 'consult' } })}><Phone size={15} /></button>
                <button className="cd-act" data-tip="Transfer" aria-label={`Transfer to ${digits}`} disabled={!can} data-tour="ws-dir-transfer-number" onClick={() => set({ consultPick: { target: digits, action: 'transfer' } })}><ArrowLeftRight size={16} /></button>
              </span>
            </div>
            {pick?.target === digits && (
              <div className="skill-dd inline cd-skill" data-tour="ws-consult-skill">
                <div className="skill-dd-h">Select the outbound skill for this {pick.action === 'consult' ? 'consult' : 'transfer'}</div>
                {s.outboundSkills.map((k, i) => (
                  <button key={k} data-tour={i === 0 ? 'ws-consult-skill-first' : undefined}
                    onClick={() => set((x) => (pick.action === 'consult' ? startConsult(x, digits, 'number', k) : blindTransfer(x, digits)))}>
                    <Phone size={14} /> {k}
                  </button>
                ))}
                <button className="skill-dd-cancel" onClick={() => set({ consultPick: null })}>Cancel</button>
              </div>
            )}
          </div>
        )}
        {!!agents.length && (
          <div className="cd-sec" data-tour="ws-dir-agents">
            <div className="dir-sec">Agents</div>
            {agents.map((a, i) => (
              <div key={a.name} className="cd-row">
                <span className="cd-main"><Headset size={16} className="dir-ic" /> {a.name}<span className="cd-sub"><StateIcon state={a.state} /> {a.state}</span></span>
                {a.state === 'Available' && <Actions name={a.name} kind="agent" tour={i === 0 ? 'agent' : undefined} />}
                <Star size={17} className={'cd-star' + (fav(a.name) ? ' on' : '')} />
              </div>
            ))}
          </div>
        )}
        {!!skills.length && (
          <div className="cd-sec">
            <div className="dir-sec">Skills</div>
            {skills.map((k) => (
              <div key={k.name} className="cd-row">
                <span className="cd-main"><Wrench size={16} className="dir-ic" /> {k.name}<span className="cd-sub"><StateIcon state={k.available ? 'Available' : 'Unavailable'} /> {k.available ? 'Available' : 'Unavailable'} · Queue: {k.queue} · Wait: {k.wait}</span></span>
                <Actions name={k.name} kind="skill" tour={/L2_Network/.test(k.name) ? 'network' : undefined} />
              </div>
            ))}
          </div>
        )}
        {!!teams.length && (
          <div className="cd-sec">
            <div className="dir-sec">Teams</div>
            {teams.map((t) => (
              <div key={t.name} className="cd-row">
                <span className="cd-main"><Users size={16} className="dir-ic" /> {t.name}<span className="cd-sub">{t.available} of {t.members} available</span></span>
                {t.available > 0 && <Actions name={t.name} kind="team" />}
              </div>
            ))}
          </div>
        )}
        {!!book.length && (
          <div className="cd-sec">
            <div className="dir-sec">Address Book</div>
            {book.map((b, i) => (
              <div key={b.name} className="cd-row">
                <span className="cd-main"><BookUser size={16} className="dir-ic" /> {b.name}<span className="cd-sub">{b.number}</span></span>
                <Actions name={b.name} kind="number" tour={i === 0 ? 'book' : undefined} />
              </div>
            ))}
          </div>
        )}
        {nothing && <div className="aw-empty small">No Matches Found</div>}
      </div>
    </div>
  );
}

const hold = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Consult tab of the App Space (consult in progress or a conference).
 * Consult: the consulted party and the caller, swap between them, Transfer (warm) or Conference.
 * Conference: hang up either party, add another party (Consult / Transfer), Leave or End Call.
 */
export function ConsultPanel({ now }: { now: number }) {
  const { s, set } = useSim();
  const c = s.call!;
  const k = c.consult;
  const conf = c.conference ?? [];
  const caller = c.name ?? c.number;
  const up = k?.phase === 'active';
  const upd = (p: Partial<Call>) => set((x) => (x.call ? { call: { ...x.call, ...p, everMasked: x.call.everMasked || !!p.masked } } : {}));
  const isConf = !k && conf.length > 0;
  return (
    <div className="cp" data-tour="ws-consult-panel">
      <div className="cp-head">
        <span className="cp-title">{isConf ? 'Conference' : 'Consult'}</span>
        <span className="flex1" />
        {k && (
          <>
            <button className="cp-box" data-tip="Transfer" aria-label="Transfer" data-tour="ws-cons-transfer" disabled={!up} onClick={() => set((x) => warmTransfer(x))}><ArrowLeftRight size={18} /></button>
            {up && <button className="cp-box" data-tip="Conference" aria-label="Conference" data-tour="ws-cons-conference" onClick={() => set((x) => mergeConsult(x))}><ChevronsRight size={19} /></button>}
          </>
        )}
        {isConf && (
          <>
            <button className="cp-box" data-tip="Consult / Transfer" aria-label="Add a party (Consult / Transfer)" data-tour="ws-conf-add" onClick={() => set({ appSpaceTab: 'directory', dirQuery: '', confMenuOpen: false })}><UserPlus size={18} /></button>
            <div className="rel cp-leave">
              <button className="cp-leave-main" data-tour="ws-conf-leave" onClick={() => set((x) => leaveConference(x))}>Leave</button>
              <button className="cp-leave-dd" data-tip="Conference Menu" aria-label="Conference Menu" data-tour="ws-conf-menu" onClick={() => set({ confMenuOpen: !s.confMenuOpen })}><ChevronDown size={16} /></button>
              {s.confMenuOpen && (
                <div className="cp-menu" data-tour="ws-conf-menu-list">
                  <button data-tour="ws-conf-menu-leave" onClick={() => set((x) => leaveConference(x))}>Leave</button>
                  <button data-tour="ws-conf-end" onClick={() => set((x) => endConference(x))}>End Call</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="cp-ctrls">
        <button data-tip={c.masked ? 'Unmask' : 'Mask'} aria-label="Mask" className={c.masked ? 'on' : ''} onClick={() => upd({ masked: !c.masked })}>{c.masked ? <AudioLines size={19} /> : <span className="cc-slash"><AudioLines size={19} /></span>}</button>
        <button data-tip={c.muted ? 'Unmute' : 'Mute'} aria-label="Mute" className={c.muted ? 'on' : ''} onClick={() => upd({ muted: !c.muted })}>{c.muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
        <button data-tip={c.recording ? 'Recording' : 'Record'} aria-label="Record" disabled={c.recording} className={c.recording ? 'rec-on' : ''} onClick={() => set((x) => startRecording(x))}><CircleDot size={19} /></button>
      </div>
      <div className="cp-list">
        {k && (
          <div className={'cp-row' + (k.held ? ' held' : '')} data-tour="ws-cons-party">
            <Headset size={17} className="cp-ic" />
            <span className="cp-name">{up ? k.name : ''}{k.skill && up ? <span className="cd-sub"> via {k.skill}</span> : null}</span>
            {!up && <span className="cp-ringing">Ringing...</span>}
            {up && (k.held
              ? <button className="cp-ib" data-tip="Resume" aria-label={`Resume ${k.name}`} data-tour="ws-cons-resume-party" onClick={() => set((x) => swapTo(x, 'party'))}><Play size={17} /></button>
              : <button className="cp-ib" data-tip="Hold" aria-label={`Hold ${k.name}`} data-tour="ws-cons-hold-party" onClick={() => set((x) => swapTo(x, 'caller'))}><Pause size={17} /></button>)}
            {up && k.held && <span className="cp-held">hold ({hold(now - k.start)})</span>}
            <button className="cp-ib end" data-tip="Hang Up" aria-label={`Hang up ${k.name || 'consult'}`} data-tour="ws-cons-end" onClick={() => set((x) => endConsult(x))}><Phone size={18} /></button>
          </div>
        )}
        {k ? (
          <div className={'cp-row' + (c.onHold ? ' held' : '')} data-tour="ws-cons-caller">
            <PhoneIncoming size={16} className="cp-ic" />
            <span className="cp-name">{caller}{conf.length ? <span className="cd-sub"> + {conf.join(', ')}</span> : null}</span>
            {c.onHold
              ? <button className="cp-ib" data-tip="Resume" aria-label={`Resume ${caller}`} data-tour="ws-cons-resume-caller" disabled={!up} onClick={() => set((x) => swapTo(x, 'caller'))}><Play size={17} /></button>
              : <button className="cp-ib" data-tip="Hold" aria-label={`Hold ${caller}`} data-tour="ws-cons-hold-caller" onClick={() => set((x) => swapTo(x, 'party'))}><Pause size={17} /></button>}
            <button className="cp-ib end off" aria-label="Hang up caller (unavailable while consulting)" disabled><Phone size={18} /></button>
          </div>
        ) : (
          [caller, ...conf].map((p, i) => (
            <div key={p} className="cp-row" data-tour={i === 0 ? 'ws-conf-caller' : i === 1 ? 'ws-conf-party' : undefined}>
              {i === 0 ? <PhoneIncoming size={16} className="cp-ic" /> : <Headset size={17} className="cp-ic" />}
              <span className="cp-name">{p}</span>
              <button className="cp-ib end" data-tip="Hang Up" aria-label={`Hang up ${p}`} data-tour={i === 1 ? 'ws-conf-hangup-party' : undefined} onClick={() => set((x) => hangUpParty(x, p))}><Phone size={18} /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
