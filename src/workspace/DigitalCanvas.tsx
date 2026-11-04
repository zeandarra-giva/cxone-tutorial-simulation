import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Mail, ArrowDownLeft, UserPlus, CircleCheck, ChevronDown, ChevronsDown, ChevronsUp, EllipsisVertical, Plus, Reply, X,
  Smile, Paperclip, Image as ImageIcon, Unlink, Link, Bold, Underline, Italic, List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Baseline, Highlighter, Type, ALargeSmall, Pilcrow, Table, ClipboardList, Trash2, ContactRound, Zap, Search, ListOrdered as QueueIc,
  BookUser, CalendarDays, CalendarCheck, PersonStanding, SquarePen, ClipboardCheck, ArrowLeftRight, Headset, Wrench, MessageSquare, Star, ChevronLeft, Users, ChevronUp, CircleAlert,
} from 'lucide-react';
import { useSim, type Digital, type DigitalTab } from '../store';
import { HistoryIcon } from '../components/icons';
import { fmtTimer } from './callActions';
import { acceptDigital, chatScenario, closeDigital, discardReply, emailScenario, fillTemplate, openReply, plain, rejectDigital, requestApproval, sendChat, sendReply, transferDigital } from './digitalActions';
import { USER } from '../data/data';
import { DIR_AGENTS, DIR_SKILLS, DIR_TEAMS, EMAIL_DISPOSITIONS, EMAIL_FIELDS, EMAIL_FROM, QUICK_REPLIES, REVIEW_QUEUES } from './wsData';
import { ContactHistoryPanel, QueuePanel, SchedulePanel, SearchPanel, WemPanel } from './panels';

/** digital card timer: mm:ss for the first minutes, then "05 min" */
const digTimer = (ms: number) => (ms >= 5 * 60000 ? `${String(Math.floor(ms / 60000)).padStart(2, '0')} min` : fmtTimer(ms));
const shortName = (n: string) => { const [f, l] = n.split(' '); return l ? `${f} ${l[0]}` : f; };
const when = (t: number) => {
  const d = new Date(t);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const tm = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const ago = Math.floor((Date.now() - t) / 86400000);
  return `${day}, ${md} at ${tm} (${ago} days ago)`;
};

/* ======================= Interactions panel card ======================= */
/**
 * A digital interaction in the Interactions panel: name, skill, channel icon and timer. While it's offered
 * (manual accept) it has Reject / Accept; once accepted, Consult/Transfer and Outcome.
 */
export function EmailCard({ now }: { now: number }) {
  const { s, set } = useSim();
  const d = s.digital!;
  const ch = d.channel;
  const open = (extra = {}) => set({ digitalView: true, callView: false, ...extra });
  const Icon = ch === 'chat' ? <MessageSquare size={22} className="cc-ph chat" /> : <Mail size={22} className="cc-ph mail" />;
  if (d.phase === 'offered') {
    return (
      <div className="int-card ringing ri dig-offer" data-tour={`ws-${ch}-offer`}>
        <div className="ri-top">
          <div className="ri-l">
            <div className="ri-title">{d.name.split(' ')[0]}</div>
            <div className="ri-skill" title={d.skill}><ArrowDownLeft size={12} /> {d.skill}</div>
          </div>
          <div className="ri-r">{Icon}<span className="ri-time">{fmtTimer(now - d.start)}</span></div>
        </div>
        <div className="ri-actions">
          <button className="ri-reject" data-tour="ws-digital-reject" onClick={() => set((x) => rejectDigital(x))}>Reject</button>
          <button className="ri-accept" data-tour="ws-digital-accept" onClick={() => set((x) => acceptDigital(x))}>Accept</button>
        </div>
      </div>
    );
  }
  return (
    <div className={'int-card call-card email-card' + (s.digitalView ? ' selected' : '')} data-tour={`ws-${ch}-card`}>
      <button className="cc-head" data-tour={`ws-${ch}-card-head`} onClick={() => open()}>
        <span className="cc-head-l">
          <span className="cc-num">{ch === 'chat' ? d.name.split(' ')[0] : shortName(d.name)}</span>
          <span className="cc-dir"><ArrowDownLeft size={13} /> {d.skill}</span>
        </span>
        <span className="cc-head-r">{Icon}<span className="cc-time">{digTimer(now - d.start)}</span></span>
      </button>
      <div className="em-acts">
        <button data-tip="Consult / Transfer" aria-label="Consult / Transfer" data-tour={`ws-${ch}-transfer`} onClick={() => open({ digitalTab: 'directory' })}><UserPlus size={21} /></button>
        <span className="cc-hang-sep" />
        <button className="cc-outcome" data-tip="Outcome" aria-label="Outcome" data-tour={`ws-${ch}-outcome`} onClick={() => open({ digitalOutcomeOpen: !s.digitalOutcomeOpen })}><CircleCheck size={24} /></button>
      </div>
    </div>
  );
}

/* ======================= the agent canvas ======================= */
/**
 * Agent canvas for a digital interaction: the Interaction space (the email) on the left and the
 * App Space on the right. Drag the divider between them (or focus it and use the arrow keys).
 */
export function DigitalCanvas() {
  const { s, set } = useSim();
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      set({ digitalSplit: Math.round(Math.min(75, Math.max(30, ((e.clientX - r.left) / r.width) * 100))) });
    };
    const up = () => setDrag(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag]);
  const d = s.digital!;
  return (
    <div className={'dc' + (drag ? ' dragging' : '')} ref={wrap} data-tour="ws-canvas">
      <div className="dc-left" style={{ flexBasis: `${s.digitalSplit}%` }}>
        <InteractionSpace d={d} />
      </div>
      <div className="dc-div" role="separator" aria-orientation="vertical" aria-label="Resize panels" tabIndex={0} data-tour="ws-canvas-divider"
        aria-valuenow={s.digitalSplit} aria-valuemin={30} aria-valuemax={75}
        onPointerDown={(e) => { e.preventDefault(); setDrag(true); }}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') set({ digitalSplit: Math.max(30, s.digitalSplit - 5) }); if (e.key === 'ArrowRight') set({ digitalSplit: Math.min(75, s.digitalSplit + 5) }); }}>
        <span className="dc-grip" />
      </div>
      <div className="dc-right">
        <DigitalAppSpace d={d} />
      </div>
    </div>
  );
}

/* ---------- Interaction space ---------- */
function InteractionSpace({ d }: { d: Digital }) {
  if (d.channel === 'chat') return <ChatSpace d={d} />;
  const [details, setDetails] = useState(false);
  return (
    <div className="is" data-tour="ws-int-space">
      <div className="is-head">
        <div className="is-title"><Mail size={16} /> Email</div>
        <div className="is-sub">
          <span className="is-subj" title={d.subject}>Subject: {d.subject}</span>
          <span className="is-case">|#{d.caseId} | {d.status}</span>
          <span className="flex1" />
          <button className="is-vd" onClick={() => setDetails(!details)}>View Details <ChevronDown size={12} /></button>
          <EllipsisVertical size={16} className="is-kebab" />
        </div>
        {details && (
          <div className="is-details">
            <span>From</span><b>{d.address}</b><span>Skill</span><b>{d.skill}</b><span>Case</span><b>#{d.caseId}</b><span>Status</span><b>{d.status}</b>
          </div>
        )}
      </div>
      <div className="is-body">
        <div className="is-party">{shortName(d.name)} <span className="is-plus">+</span></div>
        <div className="em-thread" data-tour="ws-email-thread">
          {d.messages.map((m, i) => <EmailMessage key={m.id} m={m} first={i === 0} showReply={i === d.messages.length - 1 && !d.replyOpen} />)}
        </div>
      </div>
      {d.replyOpen && <Compose d={d} />}
      <DigitalOutcome d={d} />
    </div>
  );
}

function EmailMessage({ m, first, showReply }: { m: Digital['messages'][number]; first: boolean; showReply: boolean }) {
  const { set } = useSim();
  const [open, setOpen] = useState(true);
  const mine = m.from === 'agent';
  return (
    <div className={'em-msg' + (mine ? ' mine' : '')} data-tour={first ? 'ws-email-msg' : undefined}>
      <div className="em-msg-h">
        <span className="em-from"><b>{mine ? 'To:' : 'From:'}</b> {mine ? m.to : m.address}</span>
        <span className="em-at">{when(m.at)}</span>
        <button onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>{open ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}</button>
      </div>
      {open && (
        <div className="em-msg-b">
          <EllipsisVertical size={16} className="em-kebab" />
          <div className="em-html" dangerouslySetInnerHTML={{ __html: m.html }} />
          {!!m.attachments?.length && <div className="em-atts">{m.attachments.map((a) => <span key={a} className="em-att"><Paperclip size={12} /> {a}</span>)}</div>}
          {showReply && (
            <div className="em-reply-row">
              <button className="em-reply" data-tour="ws-email-reply" onClick={() => set((x) => openReply(x))}><Reply size={16} /> Reply</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Send Message split button (send directly / request approval) ---------- */
/**
 * Depending on your permissions: send directly (dropdown off), send for approval only (Request Approval),
 * or both (the dropdown lists the review queues; picking one turns the button into Request Approval).
 */
function SendSplit({ empty, onSend, extra }: { empty: boolean; onSend: () => void; extra?: ReactNode }) {
  const { s, set } = useSim();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const perm = s.replyPermission;
  const queue = s.reviewQueue ?? (perm === 'approval' ? REVIEW_QUEUES[0] : null);
  const approving = !!queue;
  const go = () => { setOpen(false); if (approving) set((x) => requestApproval(x)); else onSend(); };
  return (
    <div className="rel cmp-send" data-tour="ws-send-split">
      <button className={'cmp-send-main' + (approving ? ' approve' : '')} data-tour={approving ? 'ws-request-approval' : 'ws-send-main'} data-tip={approving ? queue! : undefined} disabled={empty} onClick={go}>{approving ? 'Request Approval' : 'Send Message'}</button>
      <button className="cmp-send-dd" data-tour="ws-send-dd" disabled={empty || perm === 'send'} aria-label="Send options" onClick={() => setOpen(!open)}><ChevronDown size={15} /></button>
      {open && (
        <div className="rte-pop up right send-pop" data-tour="ws-review-queues">
          <div className="send-pop-h">Request approval from</div>
          {REVIEW_QUEUES.filter((r) => !q || r.toLowerCase().includes(q.toLowerCase())).map((r, i) => (
            <button key={r} className={queue === r ? 'on' : ''} data-tour={i === 0 ? 'ws-review-first' : undefined} onClick={() => { set({ reviewQueue: r }); setOpen(false); }}>{r}</button>
          ))}
          {/* as in CXone: Send Message sits under the review queues, above the search box */}
          {perm !== 'approval' && <button className={!s.reviewQueue ? 'on' : ''} data-tour="ws-send-direct" onClick={() => { set({ reviewQueue: null }); setOpen(false); }}>Send Message</button>}
          {extra}
          <div className="send-pop-search"><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search review queues" /><Search size={13} /></div>
        </div>
      )}
    </div>
  );
}

/** Banner on a draft a reviewer returned. */
function DeniedNote({ d }: { d: Digital }) {
  if (!d.denied) return null;
  return <div className="denied" data-tour="ws-denied"><CircleAlert size={15} /><span><b>Returned by the reviewer:</b> {d.denied} Adjust your response and try again.</span></div>;
}

/* ---------- response section with the rich text editor ---------- */
const EMOJI = ['🙂', '😀', '👍', '🙏', '✅', '📎', '⚠️', '📞'];
const COLORS = ['#222222', '#c62828', '#1b74c5', '#2e7d32', '#ef6c00', '#6a1b9a'];
const HILITE = ['#fff59d', '#c8e6c9', '#bbdefb', '#ffcdd2', '#ffffff'];
const FONTS = ['Open Sans', 'Arial', 'Georgia', 'Courier New'];
const SIZES: [string, string][] = [['Small', '2'], ['Normal', '3'], ['Large', '5'], ['Huge', '6']];

function Compose({ d }: { d: Digital }) {
  const { set } = useSim();
  const ed = useRef<HTMLDivElement>(null);
  const last = useRef('');
  const file = useRef<HTMLInputElement>(null);
  const img = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<'' | 'emoji' | 'color' | 'hilite' | 'font' | 'size' | 'link' | 'from' | 'send'>('');
  const [url, setUrl] = useState('https://');
  const dr = d.draft;
  const upd = (p: Partial<typeof dr>) => set((x) => (x.digital ? { digital: { ...x.digital, draft: { ...x.digital.draft, ...p } } } : {}));
  // keep the editor in sync when the draft changes from outside (quick responses, discard)
  useEffect(() => {
    if (ed.current && dr.html !== last.current) { ed.current.innerHTML = dr.html; last.current = dr.html; }
  }, [dr.html]);
  const save = () => { const h = ed.current?.innerHTML ?? ''; last.current = h; upd({ html: h }); };
  const cmd = (c: string, v?: string) => { ed.current?.focus(); document.execCommand(c, false, v); save(); setMenu(''); };
  const T = ({ title, onClick, children, on, tour }: { title: string; onClick: () => void; children: ReactNode; on?: boolean; tour?: string }) => (
    <button type="button" className={'rte-b' + (on ? ' on' : '')} data-tip={title} aria-label={title} data-tour={tour}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>
  );
  const empty = !plain(dr.html);
  return (
    <div className="cmp" data-tour="ws-email-compose">
      <DeniedNote d={d} />
      <div className="cmp-row">
        <span className="cmp-l">To:</span>
        {dr.to.map((t) => <span key={t} className="cmp-chip">{t} <button aria-label={`Remove ${t}`} onClick={() => upd({ to: dr.to.filter((x) => x !== t) })}><X size={11} /></button></span>)}
        <span className="flex1" />
        <button className="cmp-ccbcc" onClick={() => upd({ showCc: !dr.showCc })}>CC</button>
        <button className="cmp-ccbcc" onClick={() => upd({ showCc: !dr.showCc })}>BCC</button>
      </div>
      {dr.showCc && (
        <>
          <div className="cmp-row"><span className="cmp-l">CC:</span><input value={dr.cc} onChange={(e) => upd({ cc: e.target.value })} aria-label="CC" /></div>
          <div className="cmp-row"><span className="cmp-l">BCC:</span><input value={dr.bcc} onChange={(e) => upd({ bcc: e.target.value })} aria-label="BCC" /></div>
        </>
      )}
      <div className="cmp-row rel">
        <span className="cmp-l">From:</span>
        <button className="cmp-from" onClick={() => setMenu(menu === 'from' ? '' : 'from')}>{dr.from} <ChevronDown size={13} /></button>
        {menu === 'from' && <div className="rte-pop left">{EMAIL_FROM.map((f) => <button key={f} onClick={() => { upd({ from: f }); setMenu(''); }}>{f}</button>)}</div>}
      </div>
      <div className="cmp-row"><span className="cmp-l">Subject:</span><input value={dr.subject} onChange={(e) => upd({ subject: e.target.value })} aria-label="Subject" /></div>
      <div className="cmp-ed" ref={ed} contentEditable suppressContentEditableWarning data-tour="ws-rte-body" role="textbox" aria-multiline="true" aria-label="Message"
        onInput={save} onBlur={save} />
      {!!dr.attachments.length && <div className="em-atts cmp-atts">{dr.attachments.map((a) => <span key={a} className="em-att"><Paperclip size={12} /> {a} <button aria-label={`Remove ${a}`} onClick={() => upd({ attachments: dr.attachments.filter((x) => x !== a) })}><X size={11} /></button></span>)}</div>}
      <div className="rte-bar" data-tour="ws-rte-toolbar">
        <div className="rel"><T title="Emoji" onClick={() => setMenu(menu === 'emoji' ? '' : 'emoji')}><Smile size={17} /></T>
          {menu === 'emoji' && <div className="rte-pop emoji">{EMOJI.map((e) => <button key={e} onMouseDown={(ev) => ev.preventDefault()} onClick={() => cmd('insertText', e)}>{e}</button>)}</div>}</div>
        <T title="Attach file" onClick={() => file.current?.click()}><Paperclip size={17} /></T>
        <T title="Insert image" onClick={() => img.current?.click()}><ImageIcon size={17} /></T>
        <T title="Remove link" onClick={() => cmd('unlink')}><Unlink size={17} /></T>
        <div className="rel"><T title="Insert link" onClick={() => setMenu(menu === 'link' ? '' : 'link')}><Link size={17} /></T>
          {menu === 'link' && <div className="rte-pop link"><input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link address" /><button onMouseDown={(ev) => ev.preventDefault()} onClick={() => cmd('createLink', url)}>Add</button></div>}</div>
        <T title="Bold" tour="ws-rte-bold" onClick={() => cmd('bold')}><Bold size={17} /></T>
        <T title="Underline" onClick={() => cmd('underline')}><Underline size={17} /></T>
        <T title="Italic" onClick={() => cmd('italic')}><Italic size={17} /></T>
        <T title="Bulleted list" onClick={() => cmd('insertUnorderedList')}><List size={17} /></T>
        <T title="Numbered list" onClick={() => cmd('insertOrderedList')}><ListOrdered size={17} /></T>
        <T title="Align left" on onClick={() => cmd('justifyLeft')}><AlignLeft size={17} /></T>
        <T title="Align center" onClick={() => cmd('justifyCenter')}><AlignCenter size={17} /></T>
        <T title="Align right" onClick={() => cmd('justifyRight')}><AlignRight size={17} /></T>
        <div className="rel"><T title="Font color" onClick={() => setMenu(menu === 'color' ? '' : 'color')}><Baseline size={17} /><ChevronDown size={10} /></T>
          {menu === 'color' && <div className="rte-pop sw">{COLORS.map((c) => <button key={c} style={{ background: c }} aria-label={c} onMouseDown={(ev) => ev.preventDefault()} onClick={() => cmd('foreColor', c)} />)}</div>}</div>
        <div className="rel"><T title="Highlight" onClick={() => setMenu(menu === 'hilite' ? '' : 'hilite')}><Highlighter size={17} /><ChevronDown size={10} /></T>
          {menu === 'hilite' && <div className="rte-pop sw">{HILITE.map((c) => <button key={c} style={{ background: c }} aria-label={c} onMouseDown={(ev) => ev.preventDefault()} onClick={() => cmd('hiliteColor', c)} />)}</div>}</div>
        <div className="rel"><T title="Font" onClick={() => setMenu(menu === 'font' ? '' : 'font')}><Type size={16} /><ChevronDown size={10} /></T>
          {menu === 'font' && <div className="rte-pop">{FONTS.map((f) => <button key={f} style={{ fontFamily: f }} onMouseDown={(ev) => ev.preventDefault()} onClick={() => cmd('fontName', f)}>{f}</button>)}</div>}</div>
        <div className="rel"><T title="Font size" onClick={() => setMenu(menu === 'size' ? '' : 'size')}><ALargeSmall size={17} /><ChevronDown size={10} /></T>
          {menu === 'size' && <div className="rte-pop">{SIZES.map(([l, v]) => <button key={l} onMouseDown={(ev) => ev.preventDefault()} onClick={() => cmd('fontSize', v)}>{l}</button>)}</div>}</div>
        <T title="Left to right" on onClick={() => { if (ed.current) ed.current.dir = 'ltr'; save(); }}><Pilcrow size={17} /></T>
        <T title="Right to left" onClick={() => { if (ed.current) ed.current.dir = 'rtl'; save(); }}><span className="rtl-ic"><Pilcrow size={17} /></span></T>
        <T title="Insert table" onClick={() => cmd('insertHTML', '<table class="em-table"><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p></p>')}><Table size={17} /></T>
      </div>
      <input ref={file} type="file" hidden multiple onChange={(e) => { const n = [...(e.target.files ?? [])].map((f) => f.name); upd({ attachments: [...dr.attachments, ...n] }); e.target.value = ''; }} />
      <input ref={img} type="file" accept="image/*" hidden onChange={(e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        const r = new FileReader(); r.onload = () => cmd('insertImage', String(r.result)); r.readAsDataURL(f);
      }} />
      <div className="cmp-foot">
        <button className="cmp-ic" data-tip="Quick Responses" aria-label="Quick Responses" data-tour="ws-email-templates" onClick={() => set({ digitalTab: 'quick' })}><ClipboardList size={18} /></button>
        <button className="cmp-ic del" data-tip="Discard" aria-label="Discard reply" onClick={() => set((x) => discardReply(x))}><Trash2 size={18} /></button>
        <div data-tour="ws-email-send"><SendSplit empty={empty} onSend={() => set((x) => sendReply(x))} extra={<button onClick={() => set((x) => sendReply(x, true))}>Send &amp; set to Resolved</button>} /></div>
      </div>
    </div>
  );
}

/* ---------- Outcomes (bottom of the Interaction space) ---------- */
function DigitalOutcome({ d }: { d: Digital }) {
  const { s, set } = useSim();
  const o = d.outcome;
  const upd = (p: Partial<typeof o>) => set((x) => (x.digital ? { digital: { ...x.digital, outcome: { ...x.digital.outcome, ...p } } } : {}));
  return (
    <div className={'ocd is-ocd' + (s.digitalOutcomeOpen ? ' open' : '')} data-tour={`ws-${d.channel}-outcomes`}>
      <button className="ocd-bar" onClick={() => set({ digitalOutcomeOpen: !s.digitalOutcomeOpen })} aria-expanded={s.digitalOutcomeOpen}>
        <ClipboardCheck size={16} /> <span className="flex1">Outcomes</span>{o.disposition && <span className="ocd-set">{o.disposition}</span>}
        {s.digitalOutcomeOpen ? <ChevronsDown size={17} /> : <ChevronsUp size={17} />}
      </button>
      {s.digitalOutcomeOpen && (
        <div className="ocd-body">
          <label className="aw-field" data-tour={`ws-${d.channel}-disposition`}>
            <span>Disposition *</span>
            <select value={o.disposition} onChange={(e) => upd({ disposition: e.target.value })}>
              <option value="">Select</option>
              {EMAIL_DISPOSITIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="aw-field">
            <span>Disposition Notes</span>
            <textarea rows={2} placeholder="Add notes about this email" value={o.notes} onChange={(e) => upd({ notes: e.target.value })} />
          </label>
          {!d.sent && <div className="muted small">You haven't replied yet. You can still close it if no reply is needed.</div>}
          <div className="oc-actions">
            <button className="btn-primary sm" data-tour={`ws-${d.channel}-save`} disabled={!o.disposition} onClick={() => set((x) => closeDigital(x))}>Save &amp; Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- App Space for a digital interaction ---------- */
const DTABS: { id: DigitalTab; label: string; icon: ReactNode; sep?: boolean }[] = [
  { id: 'details', label: 'Customer details', icon: <ContactRound size={19} /> },
  { id: 'quick', label: 'Quick Responses', icon: <Zap size={19} />, sep: true },
  { id: 'history', label: 'Contact History', icon: <HistoryIcon size={19} /> },
  { id: 'search', label: 'Search', icon: <Search size={19} /> },
  { id: 'queue', label: 'Queue', icon: <QueueIc size={19} /> },
  { id: 'directory', label: 'Directory', icon: <BookUser size={19} /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarDays size={19} /> },
  { id: 'wem', label: 'WEM', icon: <CalendarCheck size={19} /> },
];

function DigitalAppSpace({ d }: { d: Digital }) {
  const { s, set } = useSim();
  const quickOn = d.replyOpen || d.channel === 'chat';
  const tab = s.digitalTab === 'quick' && !quickOn ? 'details' : s.digitalTab;
  let body: ReactNode;
  switch (tab) {
    case 'quick': body = <QuickResponses d={d} />; break;
    case 'history': body = <ContactHistoryPanel />; break;
    case 'search': body = <SearchPanel />; break;
    case 'queue': body = <QueuePanel />; break;
    case 'directory': body = <DigitalTransfer />; break;
    case 'schedule': body = <SchedulePanel />; break;
    case 'wem': body = <WemPanel />; break;
    default: body = <DigitalCustomer d={d} />;
  }
  return (
    <div className="aps dig-aps" data-tour="ws-dig-appspace">
      <div className="aps-title">App Space</div>
      <div className="aps-tabs" role="tablist">
        {DTABS.filter((t) => t.id !== 'quick' || quickOn).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={(tab === t.id ? 'on' : '') + (t.sep || (t.id === 'details' && !quickOn) ? ' sep' : '')}
            data-tour={`ws-dig-tab-${t.id}`} title={t.label} aria-label={t.label} onClick={() => set({ digitalTab: t.id })}>{t.icon}</button>
        ))}
      </div>
      <div className={'aps-body' + (tab === 'details' ? '' : ' app')}>{body}</div>
    </div>
  );
}

function Sec({ title, right, children, open: o = true, tour }: { title: string; right?: ReactNode; children: ReactNode; open?: boolean; tour?: string }) {
  const [open, setOpen] = useState(o);
  return (
    <section className={'as-sec' + (open ? ' open' : '')} data-tour={tour}>
      <div className="as-sec-h"><button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />} {title}</button>{right}</div>
      {open && <div className="as-sec-b">{children}</div>}
    </section>
  );
}

function DigitalCustomer({ d }: { d: Digital }) {
  const { s, set } = useSim();
  const [note, setNote] = useState<string | null>(null);
  const [card, setCard] = useState(false);
  const fields = d.channel === 'chat' ? chatScenario(d.scenario).fields : emailScenario(d.scenario).fields;
  const history = s.contactHistory.filter((h) => h.channel && h.channel !== 'voice' && h.number === d.name);
  return (
    <div className="as dig-cust" data-tour="ws-dig-customer">
      <div className="dig-name"><span>{shortName(d.name)}</span><button className="dig-pin" data-tip="Customer Card" aria-label="Customer Card" data-tour="ws-cust-card-btn" onClick={() => setCard(!card)}><PersonStanding size={18} /></button></div>
      {card && <CustomerCard d={d} onClose={() => setCard(false)} />}
      <Sec title="Details" right={<SquarePen size={15} className="muted" />} tour="ws-dig-details">
        <div className="dig-fields">{EMAIL_FIELDS.map((f, i) => <div key={f}><span>{f}</span><b>{fields[i] ?? ''}</b></div>)}</div>
      </Sec>
      <Sec title="Contact History" open={false}>
        {history.length ? history.map((h) => <div key={h.id} className="as-row">{h.channel === 'chat' ? <MessageSquare size={14} /> : <Mail size={14} />}<span className="as-row-main">{h.channel === 'chat' ? 'Chat' : 'Email'} · {h.skill}</span><span className="as-row-meta">{h.date}</span></div>) : <div className="as-empty">No information Available</div>}
      </Sec>
      <Sec title="Notes" open={!!d.notes.length || note !== null} right={<button className="as-plus" aria-label="Add note" onClick={() => setNote('')}><Plus size={17} /></button>}>
        {d.notes.map((n, i) => <div key={i} className="dig-note">{n}</div>)}
        {note !== null && (
          <div className="dig-note-add">
            <textarea rows={2} autoFocus value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Add a note about this customer" />
            <div className="oc-actions"><button className="btn-outline sm" onClick={() => setNote(null)}>Cancel</button><button className="btn-primary sm" disabled={!note.trim()} onClick={() => { set((x) => (x.digital ? { digital: { ...x.digital, notes: [...x.digital.notes, note.trim()] } } : {})); setNote(null); }}>Save</button></div>
          </div>
        )}
        {!d.notes.length && note === null && <div className="as-empty">No notes yet</div>}
      </Sec>
      <Sec title="Channels" open={false}><div className="as-row">{d.channel === 'chat' ? <MessageSquare size={14} /> : <Mail size={14} />}<span className="as-row-main">{d.channel === 'chat' ? 'Webchat' : 'Email'}</span><span className="as-row-meta">{d.address}</span></div></Sec>
      <Sec title="Interaction History" open={false}>
        {d.messages.map((m) => <div key={m.id} className="as-row"><Mail size={14} /><span className="as-row-main">{m.from === 'agent' ? 'Reply sent' : 'Email received'}</span><span className="as-row-meta">{new Date(m.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div>)}
      </Sec>
    </div>
  );
}

/** Quick replies app: templated responses (configured by administrators). Search, favorites, placeholders. */
function QuickResponses({ d }: { d: Digital }) {
  const { s, set } = useSim();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'all' | 'fav'>('all');
  const favs = s.quickFavs;
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => { const id = setTimeout(() => setLoading(false), 500); return () => clearTimeout(id); }, []);
  const list = QUICK_REPLIES.filter((r) => (view === 'all' || favs.includes(r.title)) && (!q || (r.title + r.text).toLowerCase().includes(q.toLowerCase())));
  const use = (t: string) => set((x) => {
    const dd = x.digital;
    if (!dd) return {};
    const text = fillTemplate(t, dd);
    const html = dd.channel === 'chat' ? (dd.draft.html ? dd.draft.html + ' ' : '') + text : dd.draft.html + `<p>${text}</p>`;
    return { digital: { ...dd, replyOpen: true, draft: { ...dd.draft, html } } };
  });
  const picked = QUICK_REPLIES.find((r) => r.title === pick);
  const star = (t: string) => set((x) => ({ quickFavs: x.quickFavs.includes(t) ? x.quickFavs.filter((f) => f !== t) : [...x.quickFavs, t] }));
  if (picked) {
    return (
      <div className="qr" data-tour="ws-quick-detail">
        <button className="qr-back" data-tour="ws-quick-back" onClick={() => setPick(null)}><ChevronLeft size={14} /> All Quick Replies</button>
        <div className="qr-dtitle"><b>{picked.title}</b>
          <button className={'qr-star' + (favs.includes(picked.title) ? ' on' : '')} aria-label="Favorite" onClick={() => star(picked.title)}><Star size={15} /></button></div>
        <div className="qr-dbody">{fillTemplate(picked.text, d)}</div>
        <div className="qr-insert"><button className="btn-primary" data-tour="ws-quick-insert" onClick={() => { use(picked.text); setPick(null); }}>Insert</button></div>
      </div>
    );
  }
  return (
    <div className="qr" data-tour="ws-quick-responses">
      <div className="dir-search qr-search"><Search size={17} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search quick replies" /></div>
      <div className="qr-tabs">
        <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>View All</button>
        <button className={view === 'fav' ? 'on' : ''} data-tour="ws-quick-favtab" onClick={() => setView('fav')}>Favorites</button>
      </div>
      {loading ? <div className="qr-load"><span className="qr-spin" /></div> : (
        <>
          {list.map((r, i) => (
            <div key={r.title} className="qr-item" role="button" tabIndex={0} data-tour={i === 0 ? 'ws-quick-first' : undefined}
              onClick={() => setPick(r.title)} onKeyDown={(e) => { if (e.key === 'Enter') setPick(r.title); }}>
              <div className="qr-top"><b>{r.title}</b>
                <button className={'qr-star' + (favs.includes(r.title) ? ' on' : '')} data-tour={i === 1 ? 'ws-quick-star' : undefined} aria-label={favs.includes(r.title) ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={(e) => { e.stopPropagation(); star(r.title); }}><Star size={15} /></button>
              </div>
              <span>{r.text}</span>
            </div>
          ))}
          {!list.length && <div className="as-empty">No quick replies</div>}
          <div className="qr-page">1 - {list.length} of {list.length}</div>
        </>
      )}
    </div>
  );
}

/** Customer card app: a summary card for the customer (opened from the icon next to their name). */
function CustomerCard({ d, onClose }: { d: Digital; onClose: () => void }) {
  const f = d.channel === 'chat' ? chatScenario(d.scenario).fields : emailScenario(d.scenario).fields;
  return (
    <div className="ccard" data-tour="ws-cust-card">
      <div className="ccard-h"><span className="ccard-av">{d.name.split(' ').map((x) => x[0]).join('')}</span>
        <div><b>{d.name}</b><div className="muted small">{f[2]} · {f[4]}</div></div>
        <span className="flex1" /><button onClick={onClose} aria-label="Close customer card"><X size={15} /></button></div>
      <div className="ccard-g"><span>Email</span><b>{d.address}</b><span>Employee ID</span><b>{f[1]}</b><span>Manager</span><b>{f[5]}</b><span>Open cases</span><b>#{d.caseId}</b></div>
    </div>
  );
}

/**
 * Transfer a digital interaction (Consult / Transfer on the inbox tile opens this Directory app).
 * Search for the destination and click Transfer next to an agent, skill or team.
 */
function DigitalTransfer() {
  const { s, set } = useSim();
  const [kind, setKind] = useState<'All' | 'Agents' | 'Skills' | 'Teams'>('All');
  const [more, setMore] = useState(false);
  const q = s.dirQuery;
  const setQ = (v: string) => { set({ dirQuery: v }); setMore(false); };
  const ql = q.toLowerCase();
  const m = (n: string) => !ql || n.toLowerCase().includes(ql);
  const show = (k: typeof kind) => kind === 'All' || kind === k;
  const agents = show('Agents') ? DIR_AGENTS.filter((a) => a.state === 'Available' && m(a.name)) : [];
  const skills = show('Skills') ? DIR_SKILLS.filter((k) => m(k.name)) : [];
  const teams = show('Teams') ? DIR_TEAMS.filter((t) => m(t.name)) : [];
  // like CXone, only the first few skills show until you click "load more..." (or press Enter, or filter to Skills)
  const SKILL_PAGE = 3;
  const skillsShown = more || kind === 'Skills' ? skills : skills.slice(0, SKILL_PAGE);
  const Row = ({ icon, name, sub, tour }: { icon: ReactNode; name: string; sub?: string; tour?: string }) => (
    <div className="cd-row hov"><span className="cd-main">{icon} {name}{sub && <span className="cd-sub">{sub}</span>}</span>
      <span className="cd-acts"><button className="cd-act" data-tip="Transfer" aria-label={`Transfer to ${name}`} data-tour={tour} onClick={() => set((x) => transferDigital(x, name))}><ArrowLeftRight size={16} /></button></span></div>
  );
  return (
    <div className="aw-panel cd" data-tour="ws-dig-transfer">
      <div className="dir-search" data-tour="ws-dig-transfer-search" data-tip="Search Directory or press Enter for all results">
        <Search size={18} /><input autoFocus placeholder="Search for people, skills, teams, etc." value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setMore(true); }} aria-label="Search Directory" /></div>
      <select className="cd-filter" data-tour="ws-dig-transfer-filter" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Filter the Directory">
        {(['All', 'Agents', 'Skills', 'Teams'] as const).map((k) => <option key={k}>{k}</option>)}
      </select>
      <div className="dir-results">
        {!!skills.length && <><div className="dir-sec">Skills</div>{skillsShown.map((k) => <Row key={k.name} icon={<Wrench size={16} className="dir-ic" />} name={k.name} tour={/L2_Network/.test(k.name) ? 'ws-dig-transfer-network' : undefined} />)}
          {skillsShown.length < skills.length && <button className="cd-more" onClick={() => setMore(true)}>load more...</button>}</>}
        {!!teams.length && <><div className="dir-sec">Teams</div>{teams.map((t) => <Row key={t.name} icon={<Users size={16} className="dir-ic" />} name={t.name} sub={`${t.members} members`} />)}</>}
        {!!agents.length && <><div className="dir-sec">Agents</div>{agents.slice(0, 4).map((a) => <Row key={a.name} icon={<Headset size={16} className="dir-ic" />} name={a.name} />)}</>}
        {!skills.length && !teams.length && !agents.length && <div className="aw-empty small">No Matches Found</div>}
      </div>
    </div>
  );
}

/* ---------- Webchat interaction space ---------- */
const ago = (t: number) => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'a few seconds ago' : m === 1 ? 'a minute ago' : `${m} minutes ago`; };

/** Webchat: the conversation, "Replying to …" and a plain-text reply box (emoji, attachments, text direction only). */
function ChatSpace({ d }: { d: Digital }) {
  const { s, set } = useSim();
  const [details, setDetails] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  const file = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [d.messages.length]);
  const upd = (p: Partial<Digital['draft']>) => set((x) => (x.digital ? { digital: { ...x.digital, draft: { ...x.digital.draft, ...p } } } : {}));
  const text = d.draft.html;
  const send = () => set((x) => sendChat(x));
  return (
    <div className="is chat" data-tour="ws-int-space">
      <div className="is-head">
        <div className="is-title chat"><MessageSquare size={16} /> Webchat</div>
        <div className="is-sub">
          <span><b>{d.messages.length}</b> Messages</span><span className="is-case">Private |#{d.caseId} | {d.status}</span>
          <span className="flex1" />
          <button className="is-vd" onClick={() => setDetails(!details)}>View Details <ChevronDown size={12} /></button>
          <EllipsisVertical size={16} className="is-kebab" />
        </div>
        {details && <div className="is-details"><span>Customer</span><b>{d.name}</b><span>Skill</span><b>{d.skill}</b><span>Case</span><b>#{d.caseId}</b><span>Status</span><b>{d.status}</b></div>}
      </div>
      <div className="is-body">
        <div className="is-party">{d.name.split(' ')[0]} <span className="is-plus">+</span></div>
        {!!d.previous?.length && !d.showPrevious && (
          <div className="ch-prev"><button data-tour="ws-load-previous" onClick={() => set((x) => (x.digital ? { digital: { ...x.digital, showPrevious: true } } : {}))}><ChevronUp size={13} /> Load Previous Messages</button></div>
        )}
        <div className="ch-thread" data-tour="ws-chat-thread">
          {d.showPrevious && d.previous?.map((m) => (
            <div key={m.id} className={'ch-msg old ' + (m.from === 'agent' ? 'me' : 'them')}>
              {m.from === 'agent' && <div className="ch-who">{m.address}</div>}
              <div className="ch-bubble">{m.html}</div><div className="ch-time">2 days ago</div>
            </div>
          ))}
          {d.showPrevious && <div className="ch-sep">Current conversation</div>}
          {d.messages.map((m) => (
            <div key={m.id} className={'ch-msg ' + (m.from === 'agent' ? 'me' : 'them')}>
              {m.from === 'agent' && <div className="ch-who">{USER.first} {USER.last} <span className="is-plus">+</span></div>}
              <div className="ch-bubble" dir="auto">{m.html}</div>
              {!!m.attachments?.length && <div className="em-atts">{m.attachments.map((a) => <span key={a} className="em-att"><Paperclip size={12} /> {a}</span>)}</div>}
              <div className="ch-time">{ago(m.at)}</div>
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
      <div className="ch-cmp" data-tour="ws-chat-compose">
        <DeniedNote d={d} />
        <div className="ch-replying">Replying to {d.name.split(' ')[0]}</div>
        <textarea className="ch-in" data-tour="ws-chat-input" dir={dir} rows={3} value={text} placeholder="" aria-label={`Reply to ${d.name}`}
          onChange={(e) => upd({ html: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!s.reviewQueue && s.replyPermission !== 'approval') send(); } }} />
        {!!d.draft.attachments.length && <div className="em-atts cmp-atts">{d.draft.attachments.map((a) => <span key={a} className="em-att"><Paperclip size={12} /> {a}</span>)}</div>}
        <div className="ch-bar">
          <div className="rte-plain" data-tour="ws-chat-toolbar">
            <div className="rel"><button className="rte-b" data-tip="Emoji" aria-label="Emoji" onClick={() => setEmoji(!emoji)}><Smile size={17} /></button>
              {emoji && <div className="rte-pop emoji">{EMOJI.map((e) => <button key={e} onClick={() => { upd({ html: text + e }); setEmoji(false); }}>{e}</button>)}</div>}</div>
            <button className="rte-b" data-tip="Attach file" aria-label="Attach file" onClick={() => file.current?.click()}><Paperclip size={17} /></button>
            <button className={'rte-b' + (dir === 'ltr' ? ' on' : '')} data-tip="Left to right" aria-label="Left to right" onClick={() => setDir('ltr')}><Pilcrow size={17} /></button>
            <button className={'rte-b' + (dir === 'rtl' ? ' on' : '')} data-tip="Right to left" aria-label="Right to left" onClick={() => setDir('rtl')}><span className="rtl-ic"><Pilcrow size={17} /></span></button>
          </div>
          <span className="flex1" />
          <button className="cmp-ic" data-tip="Quick Replies" aria-label="Quick Replies" data-tour="ws-chat-templates" onClick={() => set({ digitalTab: 'quick' })}><ClipboardList size={18} /></button>
          {!!text.trim() && <button className="cmp-ic clear" data-tip="Clear" aria-label="Clear reply" data-tour="ws-chat-clear" onClick={() => upd({ html: '' })}><X size={18} /></button>}
          <div data-tour="ws-chat-send"><SendSplit empty={!text.trim()} onSend={send} /></div>
        </div>
        <input ref={file} type="file" hidden multiple onChange={(e) => { const n = [...(e.target.files ?? [])].map((f) => f.name); upd({ attachments: [...d.draft.attachments, ...n] }); e.target.value = ''; }} />
      </div>
      <DigitalOutcome d={d} />
    </div>
  );
}
