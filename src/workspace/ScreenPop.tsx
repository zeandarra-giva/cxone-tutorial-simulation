import { useEffect } from 'react';
import { ExternalLink, SquareArrowOutDownLeft, Search, Menu, ChevronLeft, Globe } from 'lucide-react';
import { useSim, type SimState } from '../store';

type Call = NonNullable<SimState['call']>;

/*
 * Screen pops: web pages a system administrator configures to open in the App Space when a contact
 * arrives (for example a knowledge-base article that matches the skill or the caller's issue).
 * The agent can pop a screen pop out into its own window and pop it back in again.
 * All pages here are fictional and simulated.
 */

export interface KbArticle { host: string; path: string; crumbs: string[]; title: string; intro: string; steps: string[]; tip?: string; related: string[] }

const HOST = 'kb.servicedesk.example';
const NAV = ['Accounts & Passwords', 'Access Requests', 'VPN & Remote Access', 'Call Handling', 'Escalation Paths', 'Service Desk Policies'];

const KB: Record<string, KbArticle> = {
  lockout: {
    host: HOST, path: '/iam/account-lockout', crumbs: ['IAM', 'Accounts & Passwords', 'Account lockout'],
    title: 'Account locked after password expiry',
    intro: 'Use this when a caller cannot sign in because their password expired and the account locked after failed attempts.',
    steps: ['Verify the caller: employee ID plus two security questions.', 'In the IAM console, search the user and check the lock reason.', 'Unlock the account and trigger a self-service reset email.', 'Stay on the line until the caller confirms they can sign in.', 'Disposition: Password Reset. Add the IAM reference to the notes.'],
    tip: 'Never ask the caller to read their new password to you. Mask the call if they start to.',
    related: ['Self-service password reset', 'MFA device re-registration', 'Locked service accounts'],
  },
  access: {
    host: HOST, path: '/iam/shared-drive-access', crumbs: ['IAM', 'Access Requests', 'Shared drive access'],
    title: 'Requesting access to a shared drive',
    intro: 'Team moves often need new shared-drive access. Access is granted by the drive owner, not the service desk.',
    steps: ['Confirm the drive path and the caller’s new team.', 'Check the manager’s approval is attached (email or ticket).', 'Raise an Access Request in the ticketing tool with the drive path.', 'Give the caller the request number; the owner approves within 1 business day.', 'Disposition: Access Request Raised.'],
    related: ['Mailbox delegation', 'Application role requests', 'Leaver / mover checklist'],
  },
  vpn: {
    host: HOST, path: '/network/vpn-error-809', crumbs: ['Network', 'VPN & Remote Access', 'Error 809'],
    title: 'VPN error 809 after a token reset',
    intro: 'Error 809 after a soft-token reset usually means the token is not yet synced with the VPN gateway.',
    steps: ['Ask the caller to wait 10 minutes after the reset and try again.', 'Confirm the VPN client version is current.', 'If it still fails, collect the device name and the time of the last attempt.', 'Escalate to L2 Network (skill DWCS_ITHD_L2_Network) with those details.', 'Disposition: Escalated to L2.'],
    related: ['Soft token setup', 'VPN client reinstall', 'Working offline'],
  },
  callback: {
    host: HOST, path: '/desk/callbacks', crumbs: ['Service Desk', 'Call Handling', 'Callbacks'],
    title: 'Promising a callback',
    intro: 'When the caller can’t talk now, book the callback so it can’t be forgotten.',
    steps: ['Agree a time and confirm the best number.', 'Open the call’s ⋮ menu and choose Add Commitment.', 'Add a short note so you remember the context.', 'Disposition: Callback Required.'],
    related: ['Commitments in Schedule', 'Missed callbacks'],
  },
  howto: {
    host: HOST, path: '/desk/how-to', crumbs: ['Service Desk', 'Call Handling', 'How-to questions'],
    title: 'Answering how-to questions',
    intro: 'Walk the caller through it while they share their screen or follow along.',
    steps: ['Find the matching how-to article in the knowledge base.', 'Guide the caller step by step and let them do it.', 'Send the article link by email for next time.', 'Disposition: Resolved - First Contact.'],
    related: ['Outlook rules', 'Teams meeting settings', 'Printer setup'],
  },
  wrong: {
    host: HOST, path: '/desk/wrong-numbers', crumbs: ['Service Desk', 'Call Handling', 'Wrong numbers'],
    title: 'Wrong numbers and misdirected calls',
    intro: 'Be polite and brief. Don’t transfer external callers to internal teams.',
    steps: ['Confirm the caller wanted a different organisation.', 'End the call politely.', 'Disposition: Wrong Number.'],
    related: ['Spam and nuisance calls', 'Call handling standards'],
  },
};
const GENERIC: KbArticle = {
  host: HOST, path: '/desk/call-handling', crumbs: ['Service Desk', 'Call Handling', 'Standards'],
  title: 'Service desk call handling standards',
  intro: 'The basics for every call on the IAM service desk.',
  steps: ['Greet the caller and give your name.', 'Verify who they are before changing anything on their account.', 'Note what you did in the Disposition Notes.', 'Pick the disposition that matches how the call ended.'],
  related: ['Verification checklist', 'Escalation paths'],
};

export const kbFor = (scenario?: string) => (scenario && KB[scenario]) || GENERIC;

/** The (simulated) web page shown inside a screen pop. Used in the App Space and in the popped-out window. */
export function KbPage({ a }: { a: KbArticle }) {
  return (
    <div className="kb" data-tour="ws-sp-page">
      <div className="kb-top">
        <span className="kb-logo">IT Service Desk</span>
        <span className="kb-sub">KNOWLEDGE BASE</span>
        <span className="flex1" />
        <span className="kb-sim">simulated page</span>
      </div>
      <div className="kb-searchbar">
        <span className="kb-scope">All pages ▾</span>
        <span className="kb-search"><span>Search</span><Search size={15} /></span>
        <span className="flex1" />
        <Menu size={18} />
      </div>
      <div className="kb-body">
        <nav className="kb-nav">
          <div className="kb-back"><ChevronLeft size={13} /> GO TO {a.crumbs[0].toUpperCase()}</div>
          {NAV.map((n) => <div key={n} className={'kb-nav-i' + (n === a.crumbs[1] ? ' on' : '')}>{n}</div>)}
        </nav>
        <article className="kb-art">
          <div className="kb-crumbs">{a.crumbs.map((c, i) => <span key={c}>{i > 0 && ' > '}<u>{c}</u></span>)}</div>
          <h1>{a.title}</h1>
          <p>{a.intro}</p>
          <ol>{a.steps.map((st) => <li key={st}>{st}</li>)}</ol>
          {a.tip && <div className="kb-tip"><b>Tip</b> {a.tip}</div>}
        </article>
        <aside className="kb-aside">
          <div className="kb-aside-h">RELATED ARTICLES</div>
          {a.related.map((r) => <div key={r} className="kb-aside-i">{r}</div>)}
        </aside>
      </div>
    </div>
  );
}

/* ---------- popping out / back in ---------- */

let popWin: Window | null = null;
const POP_IN = 'cxone-screenpop-in';
const msgTarget = () => (location.protocol === 'file:' ? '*' : location.origin);

/** Open the call's screen pop in its own browser window. Returns false if the browser blocked the pop-up. */
export function popOut(c: Call) {
  const q = new URLSearchParams({ app: 'pop', sc: c.scenario ?? '', n: c.number });
  popWin = window.open(`${location.pathname}?${q.toString()}`, 'cxscreenpop', 'popup=yes,width=1100,height=760');
  popWin?.focus();
  return !!popWin;
}
export function closePopWindow() {
  try { popWin?.close(); } catch { /* ignore */ }
  popWin = null;
}

/**
 * Keeps the workspace in sync with the popped-out window: Pop In in that window (or closing it)
 * brings the screen pop back into the App Space, and the window closes when the call ends.
 */
export function useScreenPopWindow() {
  const { s, set } = useSim();
  useEffect(() => {
    const f = (e: MessageEvent) => {
      if ((location.protocol !== 'file:' && e.origin !== location.origin) || e.data?.type !== POP_IN) return;
      popWin = null;
      set((x) => ({ screenPopOut: false, appSpaceTab: 'screenpop', callView: !!x.call || x.callView }));
      window.focus();
    };
    window.addEventListener('message', f);
    return () => window.removeEventListener('message', f);
  }, [set]);
  useEffect(() => {
    if (!s.screenPopOut) return;
    const id = setInterval(() => { if (popWin && popWin.closed) { popWin = null; set({ screenPopOut: false }); } }, 700);
    return () => clearInterval(id);
  }, [s.screenPopOut]);
  // the screen pop belongs to the interaction: it closes when the call ends
  useEffect(() => {
    if (!s.call && s.screenPopOut) { closePopWindow(); set({ screenPopOut: false }); }
    if (!s.call && s.appSpaceTab !== 'details') set({ appSpaceTab: 'details' });
  }, [!!s.call]);
}

/** Screen Pops tab of the App Space. */
export function ScreenPopTab({ c }: { c: Call }) {
  const { s, set } = useSim();
  const a = kbFor(c.scenario);
  const out = () => { if (popOut(c)) set({ screenPopOut: true }); };
  const back = () => { closePopWindow(); set({ screenPopOut: false }); };
  return (
    <div className="sp" data-tour="ws-sp-panel">
      <div className="sp-tabs">
        <span className="sp-tab on" title={`https://${a.host}${a.path}`}>{a.host}{a.path}</span>
        <span className="flex1" />
        {s.screenPopOut
          ? <button className="sp-btn" data-tour="ws-sp-popin" onClick={back} title="Pop In" aria-label="Pop In"><SquareArrowOutDownLeft size={20} /></button>
          : <button className="sp-btn" data-tour="ws-sp-popout" onClick={out} title="Pop Out" aria-label="Pop Out"><ExternalLink size={20} /></button>}
      </div>
      {s.screenPopOut ? (
        <div className="sp-out" data-tour="ws-sp-outnote">
          <ExternalLink size={30} />
          <b>This screen pop is open in its own window.</b>
          <span>Work in that window, or click <b>Pop In</b> to bring it back into the App Space.</span>
          <button className="btn-primary sm" onClick={back}>Pop In</button>
        </div>
      ) : <KbPage a={a} />}
    </div>
  );
}

/** The separate window a screen pop opens in after Pop Out (?app=pop). */
export function PopOutRoot() {
  const p = new URLSearchParams(location.search);
  const a = kbFor(p.get('sc') ?? undefined);
  const hasOpener = !!window.opener && !window.opener.closed;
  useEffect(() => { document.title = `${a.host}${a.path}`; }, []);
  const popIn = () => {
    try { window.opener?.postMessage({ type: POP_IN }, msgTarget()); } catch { /* ignore */ }
    window.close();
  };
  return (
    <div className="spw">
      <div className="spw-bar">
        <Globe size={15} />
        <span className="spw-url">https://{a.host}{a.path}</span>
        <span className="spw-for">Screen pop · {p.get('n')}</span>
        <span className="flex1" />
        <button className="spw-in" data-tour="ws-sp-window-popin" onClick={popIn} disabled={!hasOpener} title={hasOpener ? 'Pop In' : 'Agent Workspace is closed'}>
          <SquareArrowOutDownLeft size={17} /> Pop In
        </button>
      </div>
      <KbPage a={a} />
    </div>
  );
}
