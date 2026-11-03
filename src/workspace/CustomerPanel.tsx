import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Phone, Mail, MessageSquare, Check, Cloud, RefreshCw, X, ArrowDownLeft, ArrowUpRight, FileText, UserRound, ClipboardList, ExternalLink } from 'lucide-react';
import { useSim, type SimState } from '../store';
import { USER } from '../data/data';
import { SCENARIOS, scenarioById, type CrmRecord, type Scenario } from '../training/scenarios';

type Call = NonNullable<SimState['call']>;

/** The saved customer behind a call (by scenario, else by phone number). */
export function customerFor(c: Call): Scenario | undefined {
  const sc = scenarioById(c.scenario) ?? SCENARIOS.find((x) => x.number === c.number);
  return sc?.saved ? sc : undefined;
}

/** CRM record id logged for this interaction (stable per call). */
export function crmTaskId(c: Call) {
  const h = [...c.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36).toUpperCase();
  return `00TKe0000${h.padEnd(9, 'Q').slice(0, 9)}`;
}

function Section({ id, title, right, children, open: initial = true }: { id: string; title: string; right?: ReactNode; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={'as-sec' + (open ? ' open' : '')} data-tour={`ws-cust-${id}`}>
      <div className="as-sec-h">
        <button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? <ChevronDown size={15} /> : <ChevronUp size={15} />} {title}</button>
        {right}
      </div>
      {open && <div className="as-sec-b">{children}</div>}
    </section>
  );
}
const Empty = () => <div className="as-empty">No information Available</div>;

const CH_ICON = { Phone: <Phone size={15} />, Email: <Mail size={15} />, Chat: <MessageSquare size={15} /> };
const REC_ICON = { Case: <FileText size={15} />, Task: <ClipboardList size={15} />, Contact: <UserRound size={15} /> };

/**
 * Customer information shown in the main area ("App Space") once a call is accepted:
 * Details, Contact History, Channels, Current Interaction (the CRM record for this call) and
 * Related Interactions (matching CRM records).
 */
export function CustomerPanel({ c }: { c: Call }) {
  const { s, set } = useSim();
  const cust = customerFor(c);
  const history = s.contactHistory.filter((h) => h.number === c.number);
  const [refreshing, setRefreshing] = useState(false);
  const taskId = crmTaskId(c);
  const open = (r: CrmRecord) => set({ crmRecord: r });
  const refresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 900); };
  return (
    <div className="as" data-tour="ws-cust-panel">
      <Section id="details" title="Details">
        <div className="as-fields">
          <div><span>Phone number</span><b>{c.number}</b></div>
          <div><span>Customer</span><b>{cust ? cust.name : 'Unknown'}</b></div>
          <div><span>Skill name</span><b>{c.skill}</b></div>
        </div>
      </Section>
      <Section id="history" title="Contact History">
        {history.length ? (
          <div className="as-list">
            {history.map((h) => (
              <div key={h.id} className="as-row">
                {h.outbound ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                <span className="as-row-main">{h.outbound ? 'Outbound' : 'Inbound'} call · {h.skill}</span>
                <span className="as-row-meta">{h.date} · {h.duration}</span>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </Section>
      <Section id="channels" title="Channels">
        {cust?.channels?.length ? (
          <div className="as-list">
            {cust.channels.map((ch) => <div key={ch.type + ch.value} className="as-row">{CH_ICON[ch.type]}<span className="as-row-main">{ch.type}</span><span className="as-row-meta">{ch.value}</span></div>)}
          </div>
        ) : <Empty />}
      </Section>
      <Section id="current" title="Current Interaction">
        <div className="as-ci">
          <span className="as-ci-id">ID: {taskId}</span>
          <span className="as-ci-ok" title="Linked to a CRM record"><Check size={14} /></span>
          <button className="as-crm-btn" data-tour="ws-crm-task" onClick={() => open({ type: 'Task', id: taskId, subject: `Call from ${cust?.name ?? c.number}`, status: 'Open', date: 'Today' })}>
            <Cloud size={14} /> Task
          </button>
        </div>
      </Section>
      <Section id="related" title="Related Interactions" right={<button className="as-refresh" onClick={refresh} disabled={refreshing}><RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh</button>}>
        {refreshing ? <div className="as-empty">Searching CRM…</div> : cust?.related?.length ? (
          <div className="as-list">
            {cust.related.map((r) => (
              <button key={r.id} className="as-row link" data-tour="ws-crm-related" onClick={() => open(r)}>
                {REC_ICON[r.type]}<span className="as-row-main"><b>{r.type}</b> {r.subject}</span>
                <span className="as-row-meta">{r.status}{r.date ? ` · ${r.date}` : ''}</span><ExternalLink size={13} />
              </button>
            ))}
          </div>
        ) : <Empty />}
      </Section>
    </div>
  );
}

/** Simulated CRM window (in real life the record opens in the company's CRM application). */
export function CrmWindow() {
  const { s, set } = useSim();
  const r = s.crmRecord;
  if (!r) return null;
  const c = s.call;
  const cust = c ? customerFor(c) : undefined;
  return (
    <div className="crm-scrim" onClick={() => set({ crmRecord: null })}>
      <div className="crm" data-tour="ws-crm-window" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`CRM ${r.type}`}>
        <div className="crm-bar">
          <Cloud size={18} /> <span className="crm-app">CRM</span><span className="crm-sim">simulated</span>
          <span className="flex1" />
          <button data-tour="ws-crm-close" onClick={() => set({ crmRecord: null })} aria-label="Close CRM record"><X size={18} /></button>
        </div>
        <div className="crm-head">
          <span className="crm-ic">{REC_ICON[r.type as keyof typeof REC_ICON] ?? <FileText size={15} />}</span>
          <div>
            <div className="crm-type">{r.type}</div>
            <div className="crm-title">{r.subject}</div>
          </div>
          <span className={'crm-status ' + (r.status === 'Closed' ? 'closed' : 'open')}>{r.status}</span>
        </div>
        <div className="crm-grid">
          <span>Record ID</span><b>{r.id}</b>
          <span>Customer</span><b>{cust?.name ?? 'Unknown caller'}</b>
          <span>Phone</span><b>{c?.number ?? '—'}</b>
          <span>Email</span><b>{cust?.channels?.find((x) => x.type === 'Email')?.value ?? '—'}</b>
          <span>Owner</span><b>{USER.first} {USER.last}</b>
          <span>{r.type === 'Task' ? 'Created' : 'Last updated'}</span><b>{r.date ?? 'Today'}</b>
        </div>
        <div className="crm-note">In real life this record opens in your company's CRM application. Agent Workspace found it by matching this interaction (the caller's number and details) against CRM records.</div>
      </div>
    </div>
  );
}
