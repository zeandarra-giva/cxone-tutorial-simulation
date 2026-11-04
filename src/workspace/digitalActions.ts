import { statusPatch, type Digital, type SimState } from '../store';
import type { Contact } from '../data/data';
import { CHATS, CHAT_SKILL, DENY_REASONS, EMAILS, EMAIL_FROM, EMAIL_SKILL, REVIEW_QUEUES } from './wsData';
import { USER } from '../data/data';
import { fmtDur, historyDate } from './callActions';

const uid = () => Math.random().toString(36).slice(2, 9);
export const emailScenario = (id?: string) => EMAILS.find((e) => e.id === id) ?? EMAILS[0];

/** A new email is routed to you. It lands in the Interactions panel; your voice state doesn't change. */
export function deliverEmail(s: SimState, which?: string, minutesAgo = 3): Partial<SimState> {
  if (s.digital) return {};
  const e = emailScenario(which);
  const now = Date.now();
  const d: Digital = {
    id: uid(), channel: 'email', phase: 'active', script: 0, scenario: e.id, name: e.name, address: e.address, skill: EMAIL_SKILL, subject: e.subject, caseId: e.caseId,
    status: 'New', start: now, sent: 0, notes: [], replyOpen: false,
    messages: [{ id: uid(), from: 'customer', address: e.address, to: 'servicedesk@example.com', at: now - minutesAgo * 60000, html: e.html }],
    draft: { to: [e.address], cc: '', bcc: '', showCc: false, from: EMAIL_FROM[0], subject: `Re: ${e.subject}`, html: '', attachments: [] },
    outcome: { disposition: '', notes: '' },
  };
  return { digital: d, digitalTab: 'details', digitalOutcomeOpen: false };
}

/** Open the response section (Reply). */
export const openReply = (s: SimState): Partial<SimState> => (s.digital ? { digital: { ...s.digital, replyOpen: true, status: s.digital.status === 'New' ? 'Open' : s.digital.status }, digitalView: true } : {});

/** Send the drafted reply: it's added to the thread. `resolve` also sets the case status to Resolved. */
export function sendReply(s: SimState, resolve = false): Partial<SimState> {
  const d = s.digital;
  if (!d || !plain(d.draft.html).trim()) return {};
  const msg = { id: uid(), from: 'agent' as const, address: d.draft.from, to: d.draft.to.join(', '), at: Date.now(), html: d.draft.html, attachments: d.draft.attachments };
  return {
    digital: {
      ...d, messages: [...d.messages, msg], replyOpen: false, sent: d.sent + 1, status: resolve ? 'Resolved' : 'Pending', denied: undefined,
      draft: { ...d.draft, html: '', attachments: [], cc: '', bcc: '', showCc: false },
    },
    digitalTab: s.digitalTab === 'quick' ? 'details' : s.digitalTab,
  };
}
export const discardReply = (s: SimState): Partial<SimState> => (s.digital ? { digital: { ...s.digital, replyOpen: false, draft: { ...s.digital.draft, html: '', attachments: [] } }, digitalTab: s.digitalTab === 'quick' ? 'details' : s.digitalTab } : {});

/** Finish the email: save the outcome and close it. It goes into Contact History. */
export function closeDigital(s: SimState, how?: string, transferred = false): Partial<SimState> {
  const d = s.digital;
  if (!d) return {};
  const now = Date.now();
  const entry: Contact = { id: d.id, number: d.name, skill: d.skill, outbound: false, date: historyDate(), duration: fmtDur(now - d.start), channel: d.channel };
  const disposition = how ?? d.outcome.disposition;
  return {
    digital: null, digitalView: false, digitalOutcomeOpen: false, digitalTab: 'details', completedAt: now,
    contactHistory: [entry, ...s.contactHistory],
    stats: {
      ...s.stats, handled: s.stats.handled + 1, transfers: s.stats.transfers + (transferred ? 1 : 0),
      handledLog: [...s.stats.handledLog, { number: d.address, direction: 'in', scenario: `${d.channel}:${d.scenario}`, disposition, notes: d.outcome.notes, everHeld: false, everMasked: false, at: now }],
    },
    // a voice state that was only set by this email doesn't exist; keep whatever the agent is in
    ...(s.agentStatus === 'Working' && !s.call && !s.wrap ? statusPatch(s, 'Available') : {}),
  };
}
/** Transfer a digital interaction to another agent, skill or team: it leaves your inbox. */
export const transferDigital = (s: SimState, to: string): Partial<SimState> => ({
  ...closeDigital(s, `Transferred to ${to}`, true), wsPanel: 'history', callView: false,
  wsToast: { text: 'Digital skill transferred successfully', at: Date.now(), kind: 'ok' },
});

/* ---------------- review approval ---------------- */
/**
 * Request Approval: the drafted response is removed from your inbox and delivered to the review queue.
 * The (simulated) reviewer denies the first request and approves the next ones, so trainees see both.
 */
export function requestApproval(s: SimState): Partial<SimState> {
  const d = s.digital;
  const q = s.reviewQueue ?? (s.replyPermission === 'approval' ? REVIEW_QUEUES[0] : null);
  if (!d || !q || !plain(d.draft.html)) return {};
  return {
    approval: { digital: { ...d, denied: undefined }, queue: q, at: Date.now(), result: s.approvalsAnswered === 0 ? 'deny' : 'approve' },
    digital: null, digitalView: false, digitalOutcomeOpen: false, reviewQueue: null, wsPanel: 'history', callView: false,
    wsToast: { text: `Sent to ${q} for approval`, at: Date.now(), kind: 'ok' },
  };
}
/** The reviewer answers. Approved: the draft is sent immediately. Denied: the draft comes back to you to revise. */
export function resolveApproval(s: SimState): Partial<SimState> {
  const a = s.approval;
  if (!a || s.digital) return {};
  const d = a.digital;
  if (a.result === 'approve') {
    const out = d.channel === 'chat' ? sendChat({ ...s, digital: d }) : sendReply({ ...s, digital: { ...d, replyOpen: true } });
    return { ...out, approval: null, approvalsAnswered: s.approvalsAnswered + 1, wsToast: { text: 'Your response was approved and sent', at: Date.now(), kind: 'ok' } };
  }
  const reason = DENY_REASONS[s.approvalsAnswered % DENY_REASONS.length];
  return {
    digital: { ...d, replyOpen: true, denied: reason }, approval: null, approvalsAnswered: s.approvalsAnswered + 1,
    wsToast: { text: 'Your response was denied and returned to you', at: Date.now(), kind: 'bad' },
  };
}

/** text content of an HTML string */
export function plain(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ---------------- webchat ---------------- */
export const chatScenario = (id?: string) => CHATS.find((c) => c.id === id) ?? CHATS[0];

/**
 * A webchat is offered to you. Depending on configuration it's auto-accepted (Auto Accept on)
 * or waits for you to Accept or Reject it.
 */
export function offerChat(s: SimState, which?: string): Partial<SimState> {
  if (s.digital) return {};
  const c = chatScenario(which);
  const now = Date.now();
  const d: Digital = {
    id: uid(), channel: 'chat', phase: 'offered', script: 0, scenario: c.id, name: c.name, address: c.address, skill: CHAT_SKILL, subject: 'Webchat', caseId: c.caseId,
    status: 'New', start: now, sent: 0, notes: [], replyOpen: true,
    messages: [{ id: uid(), from: 'customer', address: c.name, to: '', at: now, html: 'Begin Conversation' }],
    previous: (c.previous ?? []).map((t, i) => ({ id: uid(), from: i % 2 ? 'agent' as const : 'customer' as const, address: i % 2 ? 'Ana Bautista' : c.name, to: '', at: now - 2 * 86400000 + i * 120000, html: t })),
    draft: { to: [c.name], cc: '', bcc: '', showCc: false, from: '', subject: '', html: '', attachments: [] },
    outcome: { disposition: '', notes: '' },
  };
  return s.prefs.autoAccept ? { ...acceptDigital({ ...s, digital: d }), digital: { ...d, phase: 'active', start: now } } : { digital: d, digitalTab: 'details', digitalOutcomeOpen: false };
}
/** Accept: the interaction moves into your inbox and opens in the canvas. */
export function acceptDigital(s: SimState): Partial<SimState> {
  const d = s.digital;
  if (!d || d.phase !== 'offered') return {};
  return { digital: { ...d, phase: 'active', start: Date.now() }, digitalView: true, callView: false, digitalTab: 'details' };
}
/** Reject: it goes back to the queue for someone else, and you go to Refused (like a rejected call). */
export function rejectDigital(s: SimState): Partial<SimState> {
  if (!s.digital || s.digital.phase !== 'offered') return {};
  return { digital: null, digitalView: false, ...(s.call || s.wrap ? {} : statusPatch(s, 'Refused')) };
}
/** Send a plain-text chat message. */
export function sendChat(s: SimState): Partial<SimState> {
  const d = s.digital;
  const text = d?.draft.html.trim();
  if (!d || d.channel !== 'chat' || !text) return {};
  const msg = { id: uid(), from: 'agent' as const, address: USER.first, to: d.name, at: Date.now(), html: text, attachments: d.draft.attachments };
  return { digital: { ...d, messages: [...d.messages, msg], sent: d.sent + 1, status: 'Pending', denied: undefined, draft: { ...d.draft, html: '', attachments: [] } }, reviewQueue: null };
}
/** The (simulated) customer's next chat line, if any is left in the script. */
export function customerChatReply(s: SimState): Partial<SimState> {
  const d = s.digital;
  if (!d || d.channel !== 'chat') return {};
  const lines = chatScenario(d.scenario).lines;
  if (d.script >= lines.length) return {};
  return { digital: { ...d, script: d.script + 1, status: d.sent ? 'Open' : d.status, messages: [...d.messages, { id: uid(), from: 'customer', address: d.name, to: '', at: Date.now(), html: lines[d.script] }] } };
}
/** Fill a quick reply's {{placeholders}}. */
export function fillTemplate(t: string, d: Digital) {
  return t.replace(/\{\{customer\.firstName\}\}/g, d.name.split(' ')[0]).replace(/\{\{agent\.firstName\}\}/g, USER.first).replace(/\{\{case\.number\}\}/g, `#${d.caseId}`);
}
