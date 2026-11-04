import { emptyDraft, statusPatch, type Commitment, type SimState } from '../store';
import type { RoleId } from '../data/data';
import type { Tour } from '../tour/tours';
import { acceptDigital, deliverEmail, offerChat, plain, sendReply } from './digitalActions';
import { accept, blindTransfer, hangUp, historyDate, ringInbound, startConsult, startOutbound } from './callActions';
import { DISPOSITIONS, OUTBOUND_SKILL, REVIEW_QUEUES, SEED_HISTORY } from './wsData';
import { crmTaskId } from './CustomerPanel';

const t = (id: string) => `[data-tour="${id}"]`;
const ALL: RoleId[] = ['agent', 'agent_bo', 'supervisor', 'supervisor_bo'];

type P = Partial<SimState>;
type Fn = (s: SimState) => P;
/** Apply patch functions in sequence and return the combined patch. */
const chain = (...fns: Fn[]) => (s: SimState): P => {
  let cur = s;
  let out: P = {};
  for (const f of fns) {
    const p = f(cur);
    cur = { ...cur, ...p };
    out = { ...out, ...p };
  }
  return out;
};

const CLOSED: P = { extPromptOpen: false, statusMenuOpen: false, customizeOpen: false, notifOpen: false, callbackContact: null, skillPrompt: null, addMenuOpen: false };
const panel = (id: string, extra: P = {}): Fn => () => ({ ...CLOSED, wsPanel: id, callView: false, ...extra });
const idle: Fn = () => ({ call: null, wrap: null, callView: false, keypadOpen: false, consultOpen: false });
const available: Fn = (s) => ({ ...(s.agentStatus === 'Available' ? {} : statusPatch(s, 'Available')), agentLeg: true });
const ringing: Fn = (s) => (s.call?.phase === 'ringing' ? {} : chain(idle, available, (x) => ({ ...CLOSED, ...ringInbound({ ...x, prefs: { ...x.prefs, autoAccept: false } }) }))(s));
const activeIn: Fn = (s) => (s.call && s.call.phase !== 'ringing' ? { callView: true } : chain(ringing, accept)(s));
const activeOut = (num = '+15555550100'): Fn => (s) =>
  s.call ? { callView: true, ...(s.call.phase === 'dialing' ? { call: { ...s.call, phase: 'active', start: Date.now(), connectedAt: Date.now() } } : {}) }
    : chain(idle, (x) => ({ ...CLOSED, ...startOutbound(x, num) }), (x) => ({ call: { ...x.call!, phase: 'active', start: Date.now(), connectedAt: Date.now() } }))(s);
const wrapFrom = (make: Fn): Fn => (s) => (s.wrap ? { callView: true, ...CLOSED } : chain(make, (x) => ({ ...hangUp({ ...x, call: x.call ? { ...x.call, masked: false } : null }) }))(s));
const withDisposition: Fn = (s) => (s.wrap && !s.wrap.disposition ? { wrap: { ...s.wrap, disposition: DISPOSITIONS[0] } } : {});
const seedHistory: Fn = (s) => (s.contactHistory.length ? {} : { contactHistory: SEED_HISTORY.map((c, i) => ({ ...c, date: historyDate(new Date(Date.now() - (i + 1) * 3600000)) })) });
void seedHistory;

/* --- Schedule & Commitments lesson helpers --- */
const LESSON_TAG = 'Callback - updates';
const draftPatch = (p: Partial<Commitment>): Fn => (s) => ({ draft: { ...s.draft, ...p } });
/** call is active and the Add Commitment editor is open with the call's number + skill */
const commitFromCall: Fn = chain(activeIn, (s) => (s.scheduleMode === 'add'
  ? { ...CLOSED, callMenuOpen: false, wsPanel: 'schedule', callView: false }
  : { ...CLOSED, callMenuOpen: false, wsPanel: 'schedule', callView: false, scheduleMode: 'add', skillDdOpen: false, draft: { ...emptyDraft(), phone: s.call!.number, skill: s.call!.skill } }));
/** the commitment booked in this lesson (or the newest one for me) */
const lessonCommit = (s: SimState) => [...s.commitments].reverse().find((c) => c.target === 'me' && c.id !== 'k-lesson-due');
const ensureLessonCommit: Fn = (s) => (lessonCommit(s) ? {} : { commitments: [...s.commitments, { ...emptyDraft(), id: 'k-lesson', first: 'Hanzo', last: 'Test', phone: s.call?.number ?? '+15555550177', skill: s.call?.skill ?? emptyDraft().skill, notes: LESSON_TAG }] });
const onSchedule = (popFor: string | null): Fn => chain(activeIn, ensureLessonCommit, (s) => ({ ...CLOSED, callMenuOpen: false, wsPanel: 'schedule', callView: false, scheduleMode: 'calendar', scheduleView: 'day', commitRemoveFor: null, commitPopFor: popFor ?? null }));
const editLesson: Fn = chain(activeIn, ensureLessonCommit, (s) => (s.scheduleMode === 'edit'
  ? { ...CLOSED, wsPanel: 'schedule', callView: false, commitPopFor: null }
  : { ...CLOSED, wsPanel: 'schedule', callView: false, commitPopFor: null, scheduleMode: 'edit', skillDdOpen: false, draft: { ...lessonCommit(s)! } }));

/** call details visible, nothing covering them */
const custView: Fn = () => ({ keypadOpen: false, consultOpen: false, crmRecord: null, callView: true, appSpaceTab: 'details' });
/** active call, details showing, nothing covering the card */
/** this lesson's agent has a single outbound skill (the normal case) */
const oneSkill: Fn = (s) => (s.outboundSkills.length === 1 ? {} : { outboundSkills: [OUTBOUND_SKILL] });
/** extra skills to demonstrate the outbound skill dropdown */
const MULTI_SKILLS = [OUTBOUND_SKILL, 'DWCS_ITHD_IAM_Outbound_APAC', 'DWCS_ITHD_L1_Callbacks'];
const ctl: Fn = chain(activeIn, () => ({ crmRecord: null, callView: true, consultOpen: false, callMenuOpen: false }));
/** patch the active call */
const call = (p: (c: NonNullable<SimState['call']>) => Partial<NonNullable<SimState['call']>>): Fn => (s) => (s.call ? { call: { ...s.call, ...p(s.call) } } : {});
/** an active call with no consult or conference going on */
const freshCall: Fn = chain((s) => (s.call && s.call.phase !== 'ringing' ? {} : activeIn(s)), call(() => ({ consult: undefined, conference: undefined, onHold: false, masked: false })), () => ({ confMenuOpen: false, consultPick: null }));
const consultDir = (q: string): Fn => () => ({ appSpaceTab: 'directory', dirQuery: q, consultPick: null, dirFilter: 'All' });
/** consulting Ana, connected. callerActive = you swapped to the caller (Ana on hold) */
const consultUp = (callerActive: boolean): Fn => chain(call((c) => ({ conference: undefined, onHold: !callerActive, consult: { name: 'Ana Bautista', kind: 'agent', phase: 'active', start: c.consult?.start ?? Date.now(), held: callerActive } })), () => ({ appSpaceTab: 'consult', confMenuOpen: false }));
const inConference: Fn = chain(call((c) => (c.conference?.length ? { consult: undefined } : { consult: undefined, onHold: false, conference: ['Ana Bautista'] })), () => ({ appSpaceTab: 'consult' }));
/* --- email lesson helpers --- */
const freshEmail: Fn = (s) => (s.digital ? {} : deliverEmail({ ...s, digital: null } as SimState, 'mfa'));
const canvas: Fn = () => ({ ...CLOSED, digitalView: true, callView: false });
const replying: Fn = (s) => (s.digital && !s.digital.replyOpen ? { digital: { ...s.digital, replyOpen: true, status: 'Open' } } : {});
const withDraft: Fn = (s) => (s.digital && !plain(s.digital.draft.html) ? { digital: { ...s.digital, replyOpen: true, draft: { ...s.digital.draft, html: '<p>Hi Kenji,</p><p>Thanks for your email. Here is how to move MFA to your new phone.</p>' } } } : {});
/* --- chat lesson helpers --- */
const offeredChat: Fn = (s) => (s.digital?.channel === 'chat' && s.digital.phase === 'offered' ? { digitalView: false } : { ...offerChat({ ...s, digital: null, prefs: { ...s.prefs, autoAccept: false } } as SimState), digitalView: false });
const activeChat: Fn = (s) => {
  if (s.digital?.channel === 'chat' && s.digital.phase === 'active') return {};
  const offered = offeredChat(s);
  return { ...offered, ...acceptDigital({ ...s, ...offered } as SimState) };
};
const chatDraft: Fn = (s) => (s.digital && !s.digital.draft.html.trim() ? { digital: { ...s.digital, draft: { ...s.digital.draft, html: 'Hi Ravi. My name is Alex and I will be helping you today.' } } } : {});
/** approval lesson: an accepted chat, permission to send directly or for approval, reviewer denies the first request */
const approvalStart: Fn = chain(available, (s) => (s.approval ? {} : activeChat(s)), () => ({ replyPermission: 'both', approvalsAnswered: 0, digitalTab: 'details' }));
/** the approval lesson's authored response (from the "Access request submitted" quick reply) */
const approvalDraft: Fn = (s) => (s.digital && !s.digital.draft.html.trim() ? { digital: { ...s.digital, draft: { ...s.digital.draft, html: 'I have submitted an access request for you. Your manager gets an approval email, and access usually works within 1 business day.' } } } : {});
const perm = (p: SimState['replyPermission']): Fn => () => ({ replyPermission: p, reviewQueue: null });
const dirTab: Fn = (s) => (s.appSpaceTab === 'directory' ? {} : { appSpaceTab: 'directory', dirQuery: '' });
/** call active with the Screen Pops tab of the App Space showing (popped in or out) */
const spView = (out: boolean): Fn => chain(activeIn, () => ({ keypadOpen: false, consultOpen: false, crmRecord: null, callView: true, appSpaceTab: 'screenpop', screenPopOut: out }));

const hangupStep = (setup: Fn) => ({ title: 'Hang Up', body: <>Click <b>Hang Up</b> to end the call.</>, target: t('ws-vc-hangup'), advance: 'click' as const, placement: 'right' as const, setup });
const dispositionSteps = (wrapSetup: Fn) => [
  { title: 'Choose a disposition', body: <>The <b>Outcome</b> panel opens after the call. Pick a <b>Disposition</b> that describes how the call ended.</>, target: t('ws-disposition'), advance: 'state' as const, until: (s: SimState) => !!s.wrap?.disposition, placement: 'right' as const, setup: wrapSetup, actionHint: 'Select a disposition to continue' },
  { title: 'Save & Close', body: <>Click <b>Save &amp; Close</b> to finish the contact and leave wrap-up.</>, target: t('ws-save-close'), advance: 'click' as const, placement: 'top' as const, setup: chain(wrapSetup, withDisposition) },
];

const RAW_WS_TOURS: Tour[] = [
  /* ------------------------------------------------------------------ */
  {
    id: 'ws-quick', title: 'Quick Tour (6 steps)', roles: ALL,
    summary: 'The 60-second version: the four zones of Agent Workspace and how to get ready for calls.',
    steps: [
      { title: 'Four zones', body: <>Agent Workspace has four zones: the <b>top bar</b>, the <b>left menu</b>, the <b>Interactions panel</b> and the <b>main area</b>. That's all there is to it.</>, advance: 'next', setup: chain(idle, panel('history')) },
      { title: '1 · Top bar', body: <><b>Help</b>, <b>Notifications</b>, the <b>agent leg</b> (your audio connection) and your <b>status</b> with a timer. You'll use the status bar most.</>, target: t('ws-topbar-right'), advance: 'next', placement: 'bottom' },
      { title: '2 · Left menu', body: <>Your apps: Contact History, Search, Queue, Directory, Schedule, WEM, Settings, Reporting and ⋯ More. Rest your mouse pointer on an icon to see its name.</>, target: t('ws-rail'), advance: 'next', placement: 'right' },
      { title: '3 · Interactions panel', body: <>Your <b>live work queue</b>. Ringing calls, active calls, wrap-ups and due commitments land here. The <b>start another action</b> icon at the top starts an <b>outbound call</b>.</>, target: t('ws-assign'), advance: 'next', placement: 'right' },
      { title: '4 · Main area', body: <>Shows whatever you opened from the left menu, or the call you're on, with its voice controls.</>, target: t('ws-main'), advance: 'next', placement: 'left', padding: -6 },
      { title: "You're ready", body: <>To take calls: <b>connect the agent leg</b> and <b>go Available</b>. Then try a <b>Mission</b>, the <b>Story</b> or the <b>Quiz</b> from the Training dock. That's where the real learning happens.</>, target: t('ws-presence'), advance: 'next', placement: 'left' },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'ws-tour', title: 'Agent Workspace Tour', roles: ALL,
    summary: 'A guided look at every part of Agent Workspace: top bar, left menu, Interactions panel and main area.',
    steps: [
      { title: 'Welcome to Agent Workspace', body: <>Agent Workspace (also called <b>CXone Agent</b>) is where you'll spend most of your day. It runs in <b>its own browser window</b>. Keep this window open for your whole shift.</>, advance: 'next', setup: { wsLaunch: true, voiceOption: null, rememberSetting: false } },
      { title: 'Voice connection', body: <>When the window opens, CXone may ask how your voice connects. Most agents use the <b>Integrated Softphone</b>, which puts calls through your headset in the browser.</>, target: t('launch-dialog'), advance: 'next', placement: 'right', setup: { wsLaunch: true } },
      { title: 'Integrated Softphone', body: <>Select <b>Integrated Softphone</b>.</>, target: t('voice-softphone'), advance: 'click', placement: 'right', setup: { wsLaunch: true } },
      { title: 'Remember Setting', body: <>Check <b>Remember Setting</b> so CXone doesn't ask every time.</>, target: t('voice-remember'), advance: 'state', until: (s) => s.rememberSetting, placement: 'right', setup: { wsLaunch: true, voiceOption: 'softphone', rememberSetting: false }, actionHint: 'Tick the checkbox to continue' },
      { title: 'Launch', body: <>Click <b>Launch</b>.</>, target: t('voice-launch'), advance: 'click', placement: 'right', setup: { wsLaunch: true, voiceOption: 'softphone', rememberSetting: true } },
      { title: 'Softphone extension prompt', body: <>You may see this when the workspace opens. It recommends installing the CXone Softphone Extension for better call quality. Click <b>Remind Me Later</b> for now. Follow your team's guidance on installing it.</>, target: t('ws-ext-later'), advance: 'click', placement: 'bottom', setup: { wsLaunch: false, extPromptOpen: true } },
      { title: 'Help', body: <>The question-mark icon opens the <b>online help</b> for Agent Workspace in a new tab. Use it when you're unsure what a screen or button does.</>, target: t('ws-help'), advance: 'next', setup: panel('history') },
      { title: 'Notifications', body: <>The bell shows a red badge with how many <b>notifications</b> you have: WEM alerts, messages from your team lead and conversations. Click it to read them.</>, target: t('ws-notifications'), advance: 'next' },
      { title: 'Agent leg', body: <>The <b>agent leg</b> is the audio connection between your softphone and CXone. A crossed-out icon means it's disconnected. You'll connect it in the next module.</>, target: t('ws-agent-leg'), advance: 'next' },
      { title: 'Status bar', body: <>Your current <b>state</b> and how long you've been in it. After launch you start as <b>Unavailable</b> (red badge). Click here to change your state.</>, target: t('ws-presence'), advance: 'next', placement: 'left' },
      { title: 'Left menu', body: <>Each icon opens an app in the main area. Rest your mouse pointer on an icon to see its name. We'll go through them one at a time.</>, target: t('ws-rail'), advance: 'next', placement: 'right' },
      { title: 'Contact History', body: <>Your recent calls, voicemails and other contacts (about the last 3 days). Click one to call back.</>, target: t('ws-rail-history'), advance: 'next', placement: 'right' },
      { title: 'Search', body: <>The magnifying glass opens <b>Search</b>. Type a phone number, name or skill to find a past interaction, for example to check what happened on a customer's last call.</>, target: t('ws-rail-search'), advance: 'next', placement: 'right' },
      { title: 'Queue', body: <>The list icon opens the <b>Queue Counter</b>. It shows how many contacts are waiting in your skills right now, split by channel (voice, voicemail, digital, work items), and how long the oldest one has waited.</>, target: t('ws-rail-queue'), advance: 'next', placement: 'right' },
      { title: 'Directory', body: <>Find agents, skills and teams, check their availability, and start outbound calls.</>, target: t('ws-rail-directory'), advance: 'next', placement: 'right' },
      { title: 'Schedule', body: <>The calendar icon opens your <b>Schedule</b>: today's shift with its breaks, lunch and meetings, plus any <b>commitments</b> (callbacks you've promised a customer).</>, target: t('ws-rail-schedule'), advance: 'next', placement: 'right' },
      { title: 'WEM', body: <>The person-in-a-circle icon opens <b>WEM</b> (Workforce Engagement). Here you see your recent interactions and the <b>evaluations</b> your quality team has scored.</>, target: t('ws-rail-wem'), advance: 'next', placement: 'right' },
      { title: 'Settings', body: <>Voice preferences, notifications, display, connection information, your skills, and Report Issue.</>, target: t('ws-rail-settings'), advance: 'next', placement: 'right' },
      { title: 'Reporting', body: <>The bar-chart icon opens <b>Reporting</b>: how long you've spent Available, Working and Unavailable today, and how you're performing next to your team.</>, target: t('ws-rail-reporting'), advance: 'next', placement: 'right' },
      { title: 'More', body: <>The three dots open <b>Customize</b>, a list of every app you can use. Greyed-out ones aren't turned on for your account. You can pin favorites to the left menu.</>, target: t('ws-rail-more'), advance: 'next', placement: 'right' },
      { title: 'New Outbound', body: <>Starts an outbound call. It opens the Directory so you can dial a number or pick a contact.</>, target: t('ws-outbound'), advance: 'next', placement: 'right' },
      { title: 'Interactions panel', body: <>This grey column is your <b>queue for live work</b>. Incoming calls, active calls, contacts in wrap-up and due commitments appear here. "No Assignments" means nothing is waiting for you.</>, target: t('ws-assign'), advance: 'next', placement: 'right' },
      { title: 'Main area', body: <>The big area on the right is the <b>main area</b>. It shows whatever you picked in the left menu, and switches to the call details while you're on a call.</>, target: t('ws-main'), advance: 'next', placement: 'left', padding: -6 },
      { title: 'Tour complete', body: <>Next: <b>Connect &amp; Go Available</b>. Pick any lesson from the sidebar on the left at any time.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-ready', title: 'Connect & Go Available', roles: ALL,
    summary: 'Connect your agent leg (audio) and set yourself Available to start receiving calls.',
    steps: [
      { title: 'Connect your agent leg', body: <>This icon shows your <b>agent leg</b>, the audio line between you and CXone. Crossed out means it's disconnected. Click it to connect your audio.</>, target: t('ws-agent-leg'), advance: 'click', setup: chain(idle, panel('history'), (s) => ({ agentLeg: false, ...(s.agentStatus === 'Unavailable' ? {} : statusPatch(s, 'Unavailable')) })) },
      { title: 'Connected', body: <>The slash is gone, so your audio is connected. The agent leg also connects automatically when a call comes in or you dial out.</>, target: t('ws-agent-leg'), advance: 'next', setup: { agentLeg: true } },
      { title: 'Open the status bar', body: <>Click your status.</>, target: t('ws-presence'), advance: 'click', placement: 'left', setup: { statusMenuOpen: false } },
      { title: 'States', body: <><span className="dot-g" /> <b>Available</b> means CXone can route contacts to you.<br /><span className="dot-r" /> Red codes are <b>unavailable reasons</b>: Away, Break, Busy, Call Wrap Up. Type in the search box to find one quickly.</>, target: t('ws-status-menu'), advance: 'next', placement: 'left', setup: { statusMenuOpen: true } },
      { title: 'Go Available', body: <>Click <b>Available</b>.</>, target: t('ws-code-available'), advance: 'click', placement: 'left', setup: { statusMenuOpen: true } },
      { title: "You're Available", body: <>The badge turns green and the timer restarts. Contacts can now be routed to you.<br /><br />⚠️ If the window reloads while you're Available, CXone sets you back to <b>Unavailable</b>.</>, target: t('ws-presence'), advance: 'next', placement: 'left', setup: chain(available, () => ({ statusMenuOpen: false })) },
      { title: 'Done', body: <>Next: <b>Answering an Inbound Call</b>.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-inbound', title: 'Answering an Inbound Call', roles: ALL,
    summary: 'Accept a ringing call, use Hold, Mute, Mask, Record, Keypad and Transfer, then hang up and set an Outcome.',
    steps: [
      { title: 'Be Available', body: <>You can only receive an inbound interaction when your state is <b>Available</b>. Your state is shown here. While you're Unavailable, calls go to other agents.</>, target: t('ws-presence'), advance: 'next', placement: 'bottom', setup: chain(idle, panel('history'), available) },
      { title: 'Auto or manual accept', body: <>With the <b>Integrated Softphone</b>, inbound calls are set up one of two ways:<br /><b>Auto accept</b>: the call connects by itself.<br /><b>Manual accept</b>: the call rings and you click <b>Accept</b>.<br /><br />In this lesson you'll accept manually.</>, advance: 'next', setup: chain(idle, panel('history'), available) },
      { title: 'Using a hard phone?', body: <>If you connected with a <b>hard phone</b> (Set Phone Number or Station ID) and your voice isn't connected yet, an offered call first <b>rings that phone</b>. Pick it up to establish the voice connection, then the call is delivered to you.</>, advance: 'next', setup: chain(idle, panel('history'), available) },
      { title: 'Waiting for a call', body: <>You're Available with your agent leg connected. Watch the Interactions panel. A call is about to come in…</>, advance: 'next', setup: chain(idle, panel('history'), available) },
      { title: 'Incoming call', body: <>A ringing call shows the caller's number, the <b>skill</b> it came through, and how long it has been ringing.<br /><br />Tip: <b>Auto Accept</b> (Settings) answers calls for you. Shortcut: <kbd>SHIFT + ALT + A</kbd>.</>, target: t('ws-incoming'), advance: 'next', placement: 'right', setup: ringing },
      { title: 'Who is calling', body: <>If the caller's number is saved as a contact, their <b>name</b> shows here. If it isn't saved, it says <b>Unknown</b> and the number shows instead.</>, target: t('ws-caller-name'), advance: 'next', placement: 'right', setup: ringing },
      { title: 'Accept', body: <>Click <b>Accept</b>. If you reject or miss a call, you go to an unavailable state (<b>Refused</b>).</>, target: t('ws-accept'), advance: 'click', placement: 'right', setup: ringing },
      { title: "You're on a call", body: <>The call card shows the number, the skill and the call timer. Your state changes to <b>Working</b> automatically. The main area shows the call details.</>, target: t('ws-int-card'), advance: 'next', placement: 'right', setup: activeIn },
      { title: 'Customer information', body: <>As soon as you accept, the <b>customer's information</b> opens in the main area. <b>Details</b> shows the phone number, the customer's name if they're saved (otherwise <b>Unknown</b>), and the <b>skill</b> the call came through.</>, target: t('ws-cust-details'), advance: 'next', placement: 'bottom', setup: chain(activeIn, custView) },
      { title: 'Contact History', body: <><b>Contact History</b> lists every earlier interaction with this customer that's saved in the system: inbound or outbound, the skill, the date and how long it lasted. Use it to see why they called before. A first-time caller shows <b>No information Available</b>.</>, target: t('ws-cust-history'), advance: 'next', placement: 'bottom', setup: chain(activeIn, custView) },
      { title: 'Channels', body: <><b>Channels</b> shows every way this customer can be reached that's saved for them, such as their phone number, email and chat. Unsaved callers have none.</>, target: t('ws-cust-channels'), advance: 'next', placement: 'bottom', setup: chain(activeIn, custView) },
      { title: 'Current Interaction', body: <>Agent Workspace connects to your company's <b>CRM</b>. When that's set up, this call is logged in the CRM automatically, here as a <b>Task</b> with its own <b>ID</b>. The green tick means it's linked.</>, target: t('ws-cust-current'), advance: 'next', placement: 'top', setup: chain(activeIn, custView) },
      { title: 'Open the CRM record', body: <>Click <b>Task</b> to open this interaction's record in the CRM.</>, target: t('ws-crm-task'), advance: 'click', placement: 'left', setup: chain(activeIn, custView) },
      { title: 'The CRM record', body: <>This is the record in the CRM (simulated here). In real life it opens in your CRM application, where you can add notes or update it while you talk.</>, target: t('ws-crm-window'), advance: 'next', placement: 'right', setup: chain(activeIn, (s) => (s.crmRecord ? {} : { crmRecord: { type: 'Task', id: crmTaskId(s.call!), subject: `Call from ${s.call!.name ?? s.call!.number}`, status: 'Open', date: 'Today' } })) },
      { title: 'Close it', body: <>Click the <b>X</b> to close the CRM record and go back to the call.</>, target: t('ws-crm-close'), advance: 'click', placement: 'left' },
      { title: 'Related Interactions', body: <>Agent Workspace also <b>searches the CRM</b> for records that match this interaction, like the customer's contact record and past cases. Click one to open it in the CRM. <b>Refresh</b> searches again.</>, target: t('ws-cust-related'), advance: 'next', placement: 'top', setup: chain(activeIn, custView) },
      { title: 'Voice controls', body: <>Everything you need during the call is on the card: <b>Hold, Mute, Mask</b> on the top row, <b>Record, Consult/Transfer, Keypad</b> below, and the red <b>Hang Up</b> at the bottom. Rest your mouse pointer on an icon to see its name.</>, target: t('ws-voice-controls'), advance: 'next', placement: 'right', setup: activeIn },
      { title: 'Hold', body: <>Click <b>Hold</b> to put the caller on hold.</>, target: t('ws-vc-hold'), advance: 'click', placement: 'right', setup: chain(activeIn, (s) => ({ call: { ...s.call!, onHold: false } })) },
      { title: 'Resume', body: <>Click <b>Resume</b> to bring the caller back.</>, target: t('ws-vc-hold'), advance: 'click', placement: 'right', setup: chain(activeIn, (s) => ({ call: { ...s.call!, onHold: true } })) },
      { title: 'More controls', body: <><b>Mute</b>, <b>Mask</b>, <b>Record</b>, <b>Consult/Transfer</b>, <b>Keypad</b> and <b>Outcome</b> each have their own lesson next: <b>Phone Controls</b>. For now, let's finish this call.</>, target: t('ws-voice-controls'), advance: 'next', placement: 'right', setup: chain(activeIn, (s) => ({ call: { ...s.call!, onHold: false } })) },
      hangupStep(chain(activeIn, (s) => ({ keypadOpen: false, consultOpen: false, call: { ...s.call!, masked: false } }))),
      { title: 'Wrap up', body: <>The call has ended and you're in <b>Wrap Up</b>. Finish the Outcome before taking the next contact.</>, target: t('ws-outcome'), advance: 'next', placement: 'left', padding: -6, setup: wrapFrom(activeIn) },
      ...dispositionSteps(wrapFrom(activeIn)).slice(0, 1),
      { title: 'Notes & Tags', body: <>Add <b>Disposition Notes</b> (for example the ticket number or what you did) and any <b>Tags</b>.</>, target: t('ws-disp-notes'), advance: 'next', placement: 'right' },
      ...dispositionSteps(wrapFrom(activeIn)).slice(1),
      { title: 'Back to Available', body: <>The call is finished: your state is back to <b>Available</b>, so you can take the next call. The call you just handled now sits at the top of <b>Contact History</b>, with its number, skill and time.</>, target: t('ws-history-list'), advance: 'next', placement: 'bottom', setup: chain(panel('history'), (s) => (s.wrap ? {} : {})) },
      { title: 'Done', body: <>You've handled a full inbound call. Next: <b>Phone Controls</b>.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-controls', title: 'Phone Controls', roles: ALL,
    summary: 'Record a call, pause it with Mask, consult and conference from the Directory, send IVR tones with the keypad, fill in the Outcome and hang up.',
    steps: [
      { title: 'Your phone controls', body: <>During a call, your controls are on the call card: <b>Hold, Mute, Mask</b>, then <b>Record, Consult/Transfer, Keypad</b>, then <b>Hang Up</b> and <b>Outcome</b>.<br /><br /><b>Only the controls assigned to you appear.</b> Your administrator decides which ones you get, so your card may show fewer buttons than a colleague's.</>, target: t('ws-voice-controls'), advance: 'next', placement: 'right', setup: chain(ctl, call(() => ({ recording: false, masked: false }))) },
      { title: 'Record', body: <>Click <b>Record</b> to start recording this call.</>, target: t('ws-vc-record'), advance: 'click', placement: 'right', setup: chain(ctl, call(() => ({ recording: false, masked: false }))) },
      { title: 'Recording', body: <>The call is now recording your <b>voice</b> and, where it's configured for you, your <b>screen</b> as well. The red label shows it's on.<br /><br />The Record button is now <b>greyed out</b>: once recording has started, you can't start it again.</>, target: t('ws-rec-indicator'), advance: 'next', placement: 'right', setup: chain(ctl, call(() => ({ recording: true, everRecorded: true, masked: false }))) },
      { title: 'Mask to pause recording', body: <>The caller is about to read out a PIN. Click <b>Mask</b>. It pauses the recording, covering it with white noise, so sensitive details aren't saved.</>, target: t('ws-vc-mask'), advance: 'click', placement: 'right', setup: chain(ctl, call(() => ({ recording: true, masked: false }))) },
      { title: 'Recording paused', body: <>While masked, the label says <b>Rec paused</b>. You also <b>can't hang up</b> until you unmask.</>, target: t('ws-rec-indicator'), advance: 'next', placement: 'right', setup: chain(ctl, call(() => ({ recording: true, masked: true, everMasked: true }))) },
      { title: 'Unmask to continue', body: <>The sensitive part is done. Click <b>Unmask</b> to continue recording.</>, target: t('ws-vc-mask'), advance: 'click', placement: 'right', setup: chain(ctl, call(() => ({ recording: true, masked: true }))) },
      { title: 'Consult / Transfer', body: <><b>Consult / Transfer</b> opens the Directory so you can send the call to someone else, talk to them first, or set up a conference. The next lesson, <b>Transfers &amp; Conferences</b>, covers it step by step.</>, target: t('ws-vc-consult'), advance: 'next', placement: 'right', setup: chain(ctl, call(() => ({ recording: true, masked: false, consult: undefined, conference: undefined, onHold: false }))) },
      { title: 'Keypad', body: <>Sometimes you need to enter information for an <b>IVR</b> (an automated phone menu), for example when you call another company. Click <b>Keypad</b>.</>, target: t('ws-vc-keypad'), advance: 'click', placement: 'right', setup: chain(ctl, () => ({ keypadOpen: false })) },
      { title: 'Enter information', body: <>The keypad opens <b>inside the call card</b>. Click a few digits, for example <b>1</b> to choose option one. They're sent to the call as tones and show in the box at the top.</>, target: t('ws-keypad'), advance: 'state', until: (s) => s.dtmf.length >= 1, placement: 'right', setup: chain(ctl, () => ({ keypadOpen: true, dtmf: '' })), actionHint: 'Click a digit to continue' },
      { title: 'Back to the controls', body: <>Click the <b>back arrow</b> to close the keypad.</>, target: t('ws-keypad-back'), advance: 'click', placement: 'right', setup: chain(ctl, () => ({ keypadOpen: true })) },
      { title: 'Outcome', body: <>Click <b>Outcome</b> (the blue tick).</>, target: t('ws-vc-outcome'), advance: 'click', placement: 'right', setup: chain(ctl, () => ({ keypadOpen: false, outcomeOpen: false })) },
      { title: 'The Outcomes panel', body: <>The <b>Outcomes</b> panel opens. Fill in the fields needed to <b>disposition</b> the interaction. You can do it while you're still talking. Pick a <b>Disposition</b>.</>, target: t('ws-outcome-drawer'), advance: 'state', until: (s) => !!s.call?.outcome?.disposition, placement: 'right', setup: chain(ctl, () => ({ keypadOpen: false, outcomeOpen: true })), actionHint: 'Select a disposition to continue' },
      { title: 'Hang Up', body: <>Click <b>Hang Up</b> to disconnect the call.</>, target: t('ws-vc-hangup'), advance: 'click', placement: 'right', setup: chain(ctl, call((c) => ({ masked: false, outcome: c.outcome?.disposition ? c.outcome : { disposition: DISPOSITIONS[0], notes: '', tags: [] } }))) },
      { title: 'Conclude the interaction', body: <>The disposition you picked is already filled in. Check it, add any notes, and click <b>Save &amp; Close</b> to conclude the interaction.</>, target: t('ws-save-close'), advance: 'click', placement: 'top', setup: chain(wrapFrom(chain(activeIn, call(() => ({ outcome: { disposition: DISPOSITIONS[0], notes: '', tags: [] } })))), withDisposition) },
      { title: 'Done', body: <>You've used every phone control. Next: <b>Transfers &amp; Conferences</b>.</>, advance: 'next', setup: panel('history') },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-transfer', title: 'Transfers & Conferences', roles: ALL,
    summary: 'Blind (direct) transfers, consultative (warm) transfers, swapping between parties, conferences, and transferring to external numbers.',
    steps: [
      { title: 'Two kinds of transfer', body: <><b>Blind (direct) transfer</b>: the call goes straight to the other party. You don't speak to them first.<br /><br /><b>Consultative (warm) transfer</b>: you speak to the receiving party first, then transfer the call or bring everyone into a conference.</>, advance: 'next', setup: chain(ctl, freshCall, () => ({ appSpaceTab: 'details' })) },
      { title: 'Consult / Transfer', body: <>Click the <b>Consult / Transfer</b> icon on the call card.</>, target: t('ws-vc-consult'), advance: 'click', placement: 'right', setup: chain(ctl, freshCall, () => ({ appSpaceTab: 'details' })) },
      { title: 'The Directory tab', body: <>The <b>Directory</b> tab opens in the App Space. You can:<br />• <b>type a phone number</b> in the field, or<br />• search, and use the dropdown to pick from <b>Teams, Agents, Skills</b> or the <b>Address Book</b>.</>, target: t('ws-consult-dir'), advance: 'next', placement: 'left', setup: chain(ctl, freshCall, consultDir('')) },
      { title: 'Find the person', body: <>Type <b>Ana</b> in the search field.</>, target: t('ws-dir-search'), advance: 'state', until: (s) => /ana/i.test(s.dirQuery), placement: 'bottom', setup: chain(ctl, freshCall, (s) => (s.appSpaceTab === 'directory' ? {} : { appSpaceTab: 'directory', dirQuery: '' })), actionHint: 'Type "Ana" to continue' },
      { title: 'Blind transfer', body: <>Each result has two icons: <b>Call</b> (phone) and <b>Transfer</b> (⇄). Click <b>Transfer</b> next to Ana Bautista. The call is sent directly to her, without you interacting with her.</>, target: t('ws-dir-transfer-agent'), advance: 'click', placement: 'bottom', setup: chain(ctl, freshCall, consultDir('Ana')) },
      { title: 'Interaction completed', body: <>The call went straight to Ana. Your card showed <b>Interaction completed</b>, and you're <b>Available</b> again. A transfer doesn't need wrap-up from you.</>, target: t('ws-assign'), advance: 'next', placement: 'right', setup: (s) => (s.call ? blindTransfer(s, 'Ana Bautista') : {}) },
      { title: 'Warm transfer', body: <>Another call has come in. This time you'll <b>speak to Ana first</b>, a consultative (warm) transfer. The Directory is open with Ana found.</>, target: t('ws-consult-dir'), advance: 'next', placement: 'left', setup: chain(ctl, freshCall, consultDir('Ana')) },
      { title: 'Call to consult', body: <>Click the <b>Call</b> icon (phone) next to Ana.</>, target: t('ws-dir-consult-agent'), advance: 'click', placement: 'bottom', setup: chain(ctl, freshCall, consultDir('Ana')) },
      { title: 'Ringing', body: <>The <b>Consult</b> tab opens. The caller went <b>on hold</b> automatically, and Ana's line is <b>ringing</b>.</>, target: t('ws-consult-panel'), advance: 'state', until: (s) => s.call?.consult?.phase === 'active', placement: 'left', setup: chain(ctl, (s) => (s.call!.consult ? { appSpaceTab: 'consult' } : startConsult(s, 'Ana Bautista', 'agent'))), actionHint: 'Ana answers in a moment' },
      { title: 'Talk to Ana', body: <>Ana answered. You can talk to her privately. The caller is on hold and can't hear you.</>, target: t('ws-cons-party'), advance: 'next', placement: 'bottom', setup: chain(ctl, consultUp(false)) },
      { title: 'Swap to the caller', body: <>Need to check something with the caller? Click <b>Resume</b> (▶) on the caller's line. You swap to them, and Ana goes on hold.</>, target: t('ws-cons-resume-caller'), advance: 'click', placement: 'left', setup: chain(ctl, consultUp(false)) },
      { title: 'Swap back', body: <>Now click <b>Resume</b> on Ana's line to swap back to her. You can swap between the two as often as you need.</>, target: t('ws-cons-resume-party'), advance: 'click', placement: 'left', setup: chain(ctl, consultUp(true)) },
      { title: 'Transfer', body: <>The <b>Transfer</b> icon (⇄) sends the caller to Ana and <b>ends your interaction</b>. That completes a warm transfer.<br /><br />Instead, let's bring everyone together.</>, target: t('ws-cons-transfer'), advance: 'next', placement: 'left', setup: chain(ctl, consultUp(false)) },
      { title: 'Conference', body: <>Once the consulted party is connected, the <b>Conference</b> icon (≫) appears. Click it to <b>merge</b> the two calls.</>, target: t('ws-cons-conference'), advance: 'click', placement: 'left', setup: chain(ctl, consultUp(false)) },
      { title: "You're in a conference", body: <>You, the caller and Ana are all on one call. Each party has a red <b>hang up</b> icon, so you can hang up on <b>either</b> of them.</>, target: t('ws-consult-panel'), advance: 'next', placement: 'left', setup: chain(ctl, inConference) },
      { title: 'Add another party', body: <>To bring in someone else, click <b>Consult / Transfer</b> here. It opens the <b>Directory</b> so you can add more people.</>, target: t('ws-conf-add'), advance: 'click', placement: 'left', setup: chain(ctl, inConference) },
      { title: 'Directory', body: <>Find the person and <b>Call</b> them. When they answer, <b>Conference</b> adds them too. We'll skip that for now and go back to the conference.</>, target: t('ws-consult-dir'), advance: 'next', placement: 'left', setup: chain(ctl, inConference, () => ({ appSpaceTab: 'directory' })) },
      { title: 'Conference menu', body: <>Click the <b>arrow</b> next to <b>Leave</b> to open the conference menu.</>, target: t('ws-conf-menu'), advance: 'click', placement: 'left', setup: chain(ctl, inConference, () => ({ confMenuOpen: false })) },
      { title: 'Leave or End Call', body: <><b>Leave</b>: you drop off the call, and the caller and Ana stay connected.<br /><b>End Call</b>: ends the call for everyone.</>, target: t('ws-conf-menu-list'), advance: 'next', placement: 'left', setup: chain(ctl, inConference, () => ({ confMenuOpen: true })) },
      { title: 'Leave the conference', body: <>Click <b>Leave</b>. The caller and Ana carry on without you.</>, target: t('ws-conf-menu-leave'), advance: 'click', placement: 'left', setup: chain(ctl, inConference, () => ({ confMenuOpen: true })) },
      { title: 'External numbers', body: <>You can also transfer to a number that isn't in the Directory. Another call has come in, and a number is typed in. Click <b>Call</b> next to it.</>, target: t('ws-dir-consult-number'), advance: 'click', placement: 'bottom', setup: chain(ctl, freshCall, consultDir('+15555550170')) },
      { title: 'Select the outbound skill', body: <>For an external number you <b>select the outbound skill</b> to use for the consult and transfer. Choose one.</>, target: t('ws-consult-skill'), advance: 'state', until: (s) => !!s.call?.consult, placement: 'left', setup: chain(ctl, (s) => (s.call?.consult ? {} : { ...consultDir('+15555550170')(s), consultPick: { target: '+15555550170', action: 'consult' } })), actionHint: 'Choose a skill to continue' },
      { title: 'The call rings', body: <>The call <b>rings the receiving party</b>. Once it's connected you can swap, transfer or conference, just like with Ana.</>, target: t('ws-consult-panel'), advance: 'next', placement: 'left', setup: chain(ctl, (s) => (s.call!.consult ? { appSpaceTab: 'consult' } : startConsult(s, '+15555550170', 'number', OUTBOUND_SKILL))) },
      { title: 'Done', body: <>You've done a blind transfer, a warm transfer with swapping, a conference, and a consult to an external number. Next: <b>Screen Pops</b>.</>, advance: 'next', setup: chain(idle, (s) => (s.agentStatus === 'Available' ? {} : statusPatch(s, 'Available')), () => ({ appSpaceTab: 'details', completedAt: null, consultPick: null }), panel('history')) },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-screenpop', title: 'Screen Pops', roles: ALL,
    summary: 'Use the web pages your administrator pops into the App Space during a call, and pop them out into their own window and back in.',
    steps: [
      { title: 'What is a screen pop?', body: <>A <b>screen pop</b> is a web page that opens automatically when you get a contact, for example a knowledge-base article, a customer record or an internal tool. <b>System administrators</b> decide which pages pop and when. You don't set them up yourself.</>, advance: 'next', setup: chain(activeIn, custView) },
      { title: 'App Space', body: <>Screen pops show in the <b>App Space</b>, the main area next to your call. Its tabs switch between the <b>customer details</b> and the <b>screen pops</b>.</>, target: t('ws-appspace'), advance: 'next', placement: 'left', setup: chain(activeIn, custView) },
      { title: 'Open Screen Pops', body: <>Click the <b>Screen Pops</b> tab (the tools icon).</>, target: t('ws-aps-screenpop'), advance: 'click', placement: 'bottom', setup: chain(activeIn, custView) },
      { title: 'The popped page', body: <>This page was popped for this call. Here it's the knowledge-base article for the caller's issue. Its web address shows on the tab above it. You can read, scroll and click in it without leaving Agent Workspace.</>, target: t('ws-sp-panel'), advance: 'next', placement: 'left', setup: spView(false) },
      { title: 'Pop Out', body: <>Want more room, or the page on a second monitor? Click <b>Pop Out</b>. The screen pop opens in <b>its own window</b>.<br /><br />If nothing opens, allow pop-ups for this page and click again.</>, target: t('ws-sp-popout'), advance: 'click', placement: 'left', setup: spView(false) },
      { title: 'Popped out', body: <>The screen pop is now in its own window. Move it wherever it's most useful. That window has a <b>Pop In</b> button at the top that puts it back here. The App Space keeps a placeholder meanwhile.</>, target: t('ws-sp-outnote'), advance: 'next', placement: 'left', setup: spView(true) },
      { title: 'Pop In', body: <>You can also bring it back from here. Click <b>Pop In</b>.</>, target: t('ws-sp-popin'), advance: 'click', placement: 'left', setup: spView(true) },
      { title: 'Back in the App Space', body: <>The page is back inside Agent Workspace. Pop it out and back in as often as you like, whichever view is more useful at the time. When the call ends, its screen pop closes too.</>, target: t('ws-sp-panel'), advance: 'next', placement: 'left', setup: spView(false) },
      { title: 'Customer details', body: <>Click the <b>customer details</b> tab to go back to Details, Contact History and the CRM records.</>, target: t('ws-aps-details'), advance: 'click', placement: 'bottom', setup: spView(false) },
      { title: 'Done', body: <>Tip: the shortcut <kbd>CTRL + SHIFT + F</kbd> opens screen pops. Next: <b>Making an Outbound Call</b>.</>, advance: 'next', setup: chain(activeIn, custView) },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-email', title: 'Handling Email', roles: ALL,
    summary: 'Open a new email in the agent canvas, read it, reply with the rich text editor, resize the panels, and close it with an outcome.',
    steps: [
      { title: 'Digital interactions', body: <>Besides calls, you can receive <b>digital interactions</b> such as email. They arrive in your <b>Interactions panel</b> like calls do. Let's handle an email.</>, target: t('ws-assign'), advance: 'next', placement: 'right', setup: chain(idle, available, panel('history'), () => ({ digital: null, digitalView: false })) },
      { title: 'A new email', body: <>A new email has arrived. The card shows the customer, the email <b>skill</b>, the envelope icon and how long you've had it. Below are <b>Consult / Transfer</b> and <b>Outcome</b>.</>, target: t('ws-email-card'), advance: 'next', placement: 'right', setup: chain(idle, available, panel('history'), freshEmail, () => ({ digitalView: false })) },
      { title: 'Open it', body: <>Click the email card.</>, target: t('ws-email-card-head'), advance: 'click', placement: 'right', setup: chain(idle, available, panel('history'), freshEmail, () => ({ digitalView: false })) },
      { title: 'The agent canvas', body: <>A new digital interaction opens in the <b>CXone Agent canvas</b>. It has <b>two panels</b>: the <b>Interaction space</b> and the <b>App Space</b>.</>, target: t('ws-canvas'), advance: 'next', placement: 'bottom', setup: chain(freshEmail, canvas) },
      { title: 'Interaction space', body: <>The <b>Interaction space</b> shows the conversation itself. Here it's the email thread.</>, target: t('ws-int-space'), advance: 'next', placement: 'right', setup: chain(freshEmail, canvas) },
      { title: 'App Space', body: <>The <b>App Space</b> shows information and tools for this customer: <b>Details</b>, <b>Contact History</b>, <b>Notes</b>, <b>Channels</b> and <b>Interaction History</b>, plus tabs for your other apps.</>, target: t('ws-dig-appspace'), advance: 'next', placement: 'left', setup: chain(freshEmail, canvas) },
      { title: 'Read the email', body: <>The incoming email is shown here. At the top is the <b>subject</b>, the <b>case number</b> and its <b>status</b> (New). Each message shows who it's <b>from</b> and when.<br /><br />Read it and decide what to do: <b>reply</b>, <b>transfer</b> it, or close it with an <b>outcome</b>.</>, target: t('ws-email-msg'), advance: 'next', placement: 'right', setup: chain(freshEmail, canvas) },
      { title: 'Reply', body: <>Click <b>Reply</b>.</>, target: t('ws-email-reply'), advance: 'click', placement: 'top', setup: chain(freshEmail, canvas, (s) => (s.digital!.replyOpen ? { digital: { ...s.digital!, replyOpen: false } } : {})) },
      { title: 'The response section', body: <>A <b>response section</b> opens where you draft your message. <b>To</b>, <b>From</b> (the mailbox you send from) and <b>Subject</b> are filled in for you. <b>CC</b> and <b>BCC</b> add more recipients.</>, target: t('ws-email-compose'), advance: 'next', placement: 'right', setup: chain(freshEmail, canvas, replying) },
      { title: 'Rich text editor', body: <>Email responses are unique because they have a <b>rich text editor</b> with formatting options: emoji, attachments, images, links, <b>bold</b>, <u>underline</u>, <i>italic</i>, lists, alignment, font color, highlight, font and size, text direction and tables.</>, target: t('ws-rte-toolbar'), advance: 'next', placement: 'top', setup: chain(freshEmail, canvas, replying) },
      { title: 'Quick Responses', body: <>Click the <b>Quick Responses</b> icon to use a ready-made reply.</>, target: t('ws-email-templates'), advance: 'click', placement: 'top', setup: chain(freshEmail, canvas, replying) },
      { title: 'Pick a response', body: <>The <b>Quick Responses</b> tab (⚡) opens in the App Space. Click <b>Agent Name Greeting</b> to add it to your reply. Its placeholders fill in with the customer's and your name.</>, target: t('ws-quick-first'), advance: 'click', placement: 'left', setup: chain(freshEmail, canvas, replying, () => ({ digitalTab: 'quick' })) },
      { title: 'Write your reply', body: <>Now finish the message in the editor. Type a line or two, and try the formatting: select some text and click <b>B</b> for bold.</>, target: t('ws-rte-body'), advance: 'next', interactive: true, placement: 'right', setup: chain(freshEmail, canvas, replying, withDraft) },
      { title: 'Move the divider', body: <>All digital interactions have an <b>Interaction space</b> and an <b>App Space</b>. Drag this <b>divider</b> left or right to give either side more room. You can also focus it and use the arrow keys.</>, target: t('ws-canvas-divider'), advance: 'next', interactive: true, placement: 'left', setup: chain(freshEmail, canvas, replying, withDraft) },
      { title: 'Send Message', body: <>Click <b>Send Message</b>. The arrow next to it can also set the case to Resolved as it sends.</>, target: t('ws-email-send'), advance: 'click', placement: 'top', setup: chain(freshEmail, canvas, replying, withDraft) },
      { title: 'Reply sent', body: <>Your reply is added to the <b>thread</b>. The status changes to <b>Pending</b> while you wait for the customer to answer.</>, target: t('ws-email-thread'), advance: 'next', placement: 'right', setup: chain(freshEmail, canvas, (s) => (s.digital!.sent ? {} : sendReply({ ...s, ...chain(replying, withDraft)(s) } as SimState))) },
      { title: 'Outcome', body: <>When you're done, click <b>Outcome</b> on the email card.</>, target: t('ws-email-outcome'), advance: 'click', placement: 'right', setup: chain(freshEmail, canvas, () => ({ digitalOutcomeOpen: false })) },
      { title: 'Choose a disposition', body: <>The <b>Outcomes</b> panel opens. Pick a <b>Disposition</b>, for example <b>Resolved - Replied</b>.</>, target: t('ws-email-outcomes'), advance: 'state', until: (s) => !!s.digital?.outcome.disposition, placement: 'right', setup: chain(freshEmail, canvas, () => ({ digitalOutcomeOpen: true })), actionHint: 'Select a disposition to continue' },
      { title: 'Save & Close', body: <>Click <b>Save &amp; Close</b>. The email closes and goes into your <b>Contact History</b>.</>, target: t('ws-email-save'), advance: 'click', placement: 'right', setup: chain(freshEmail, canvas, (s) => ({ digitalOutcomeOpen: true, digital: { ...s.digital!, outcome: { ...s.digital!.outcome, disposition: s.digital!.outcome.disposition || 'Resolved - Replied' } } })) },
      { title: 'Done', body: <>You've handled an email from start to finish. In free practice, a practice email arrives about 20 seconds after you first go Available.</>, advance: 'next', setup: chain(panel('history'), () => ({ digital: null, digitalView: false })) },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-chat', title: 'Handling Chat', roles: ALL,
    summary: 'Accept a webchat, use the customer details and customer card, reply with quick replies in plain text, and close it with an outcome.',
    steps: [
      { title: 'Accept or auto-accept', body: <>An incoming digital interaction may be set up to <b>auto-accept</b> (like the email you handled) or to need you to <b>accept it manually</b>. This webchat needs you to accept it.</>, target: t('ws-chat-offer'), advance: 'next', placement: 'right', setup: chain(idle, available, panel('history'), offeredChat) },
      { title: 'Accept', body: <>Click <b>Accept</b>. <b>Reject</b> sends it to someone else and puts you in <b>Refused</b>.</>, target: t('ws-digital-accept'), advance: 'click', placement: 'right', setup: chain(idle, available, panel('history'), offeredChat) },
      { title: 'In your inbox', body: <>Once accepted, the chat appears in your <b>inbox</b> (the Interactions panel) and opens in the canvas.</>, target: t('ws-chat-card'), advance: 'next', placement: 'right', setup: chain(activeChat, canvas) },
      { title: 'The conversation', body: <>The <b>Interaction space</b> shows the chat. The customer's messages are on the left, yours on the right. Their first message arrives in a moment.</>, target: t('ws-int-space'), advance: 'next', placement: 'right', setup: chain(activeChat, canvas) },
      { title: 'Customer details', body: <>Digital interactions often come with <b>customer details</b> in the App Space: here, the customer's fields, contact history, notes, channels and interaction history. Quick replies can pull values like the <b>contact's name</b> from here.</>, target: t('ws-dig-customer'), advance: 'next', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'details' })) },
      { title: 'Customer card', body: <>Click the <b>Customer Card</b> icon next to the customer's name.</>, target: t('ws-cust-card-btn'), advance: 'click', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'details' })) },
      { title: 'The customer card app', body: <>The <b>customer card</b> gives you a quick summary of who you're talking to.</>, target: t('ws-cust-card'), advance: 'next', placement: 'left' },
      { title: 'Quick replies', body: <>Instead of typing every answer, use a <b>quick reply</b>. Click the <b>⚡ Quick Replies</b> tab in the App Space.</>, target: t('ws-dig-tab-quick'), advance: 'click', placement: 'bottom', setup: chain(activeChat, canvas) },
      { title: 'Templated responses', body: <>The <b>quick reply</b> app lists templated responses. Your administrator <b>configures</b> them, so the list on your account may differ. Use <b>Search</b> to find one by name or wording. <b>View All</b> shows every reply. <b>Favorites</b> shows the ones you've starred.</>, target: t('ws-quick-responses'), advance: 'next', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'quick' })) },
      { title: 'Custom fields', body: <>Some quick replies have <b>custom fields</b>, shown in double braces like <b>{'{{customer.firstName}}'}</b> and <b>{'{{agent.firstName}}'}</b>. When you use the reply, CXone fills in the values for you, for example the <b>contact's name</b> from the customer details and <b>your</b> first name.</>, target: t('ws-quick-first'), advance: 'next', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'quick' })) },
      { title: 'Select a quick reply', body: <>Click <b>Agent Name Greeting</b> to open it.</>, target: t('ws-quick-first'), advance: 'click', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'quick' })) },
      { title: 'Preview & Insert', body: <>The preview shows the reply with its custom fields <b>filled in</b>: the contact's name and yours. <b>All Quick Replies</b> takes you back to the list. Click <b>Insert</b>.</>, target: t('ws-quick-insert'), advance: 'click', placement: 'left' },
      { title: 'Edit if needed', body: <>The reply is now in your message box. <b>Edit it if needed</b> before you send, for example to correct a name or add details. It's only sent when you click Send Message. The <b>×</b> clears the box.</>, target: t('ws-chat-input'), advance: 'next', interactive: true, placement: 'top', setup: chain(activeChat, canvas, chatDraft) },
      { title: 'Plain text only', body: <>Except for email, agent responses are limited to <b>plain text</b>. The only options are <b>emoji</b>, <b>attachments</b> and <b>text direction</b>. There's no bold, color or tables.</>, target: t('ws-chat-toolbar'), advance: 'next', placement: 'top', setup: chain(activeChat, canvas, chatDraft) },
      { title: 'Send', body: <>Click <b>Send Message</b>. Pressing Enter does the same.</>, target: t('ws-chat-send'), advance: 'click', placement: 'top', setup: chain(activeChat, canvas, chatDraft) },
      { title: 'Your send button may differ', body: <>What this button does depends on your <b>permissions</b>, so you'll see one of <b>3 variations</b>:<br />1. <b>Send Message</b> only: your reply goes straight to the customer.<br />2. <b>Request Approval</b> only: your reply goes to a <b>reviewer</b> first.<br />3. <b>Both</b>: Send Message, with the <b>arrow</b> letting you request approval instead.<br /><br />You'll try approvals in the next lesson.</>, target: t('ws-chat-send'), advance: 'next', placement: 'top', setup: chain(activeChat, canvas) },
      { title: 'The customer replies', body: <>After you reply, the status at the top changes to <b>Pending</b> (waiting for the customer). When they answer, it changes to <b>Open</b>. Wait for their answer.</>, target: t('ws-chat-thread'), advance: 'state', until: (s) => !!s.digital && s.digital.sent > 0 && s.digital.messages[s.digital.messages.length - 1].from === 'customer', placement: 'right', setup: chain(activeChat, canvas), actionHint: 'The customer is typing…' },
      { title: 'Favorite a reply', body: <>Use a reply often? Click the <b>star</b> next to it to make it a <b>favorite</b>. The star turns yellow. Click it again to remove it.</>, target: t('ws-quick-star'), advance: 'click', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'quick' })) },
      { title: 'Favorites tab', body: <>Click <b>Favorites</b>.</>, target: t('ws-quick-favtab'), advance: 'click', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'quick' })) },
      { title: 'Your favorites', body: <>Only your starred replies are listed here, so the ones you use most are quicker to find. Click <b>View All</b> to see every reply again.</>, target: t('ws-quick-responses'), advance: 'next', placement: 'left', setup: chain(activeChat, canvas, () => ({ digitalTab: 'quick' })) },
      { title: 'Load Previous Messages', body: <>Has this customer chatted before? Click <b>Load Previous Messages</b> to see the earlier conversation.</>, target: t('ws-load-previous'), advance: 'click', placement: 'left', setup: chain(activeChat, canvas) },
      { title: 'Earlier conversation', body: <>Earlier messages appear above today's conversation. Your own messages show your name above them.</>, target: t('ws-chat-thread'), advance: 'next', placement: 'right', setup: chain(activeChat, canvas, (s) => ({ digital: { ...s.digital!, showPrevious: true } })) },
      { title: 'Outcome', body: <>The issue is sorted. Click <b>Outcome</b> on the chat card.</>, target: t('ws-chat-outcome'), advance: 'click', placement: 'right', setup: chain(activeChat, canvas, () => ({ digitalOutcomeOpen: false })) },
      { title: 'Choose a disposition', body: <>Pick a <b>Disposition</b>, for example <b>Access Request Raised</b>.</>, target: t('ws-chat-outcomes'), advance: 'state', until: (s) => !!s.digital?.outcome.disposition, placement: 'right', setup: chain(activeChat, canvas, () => ({ digitalOutcomeOpen: true })), actionHint: 'Select a disposition to continue' },
      { title: 'Save & Close', body: <>Click <b>Save &amp; Close</b> to end the chat.</>, target: t('ws-chat-save'), advance: 'click', placement: 'right', setup: chain(activeChat, canvas, (s) => ({ digitalOutcomeOpen: true, digital: { ...s.digital!, outcome: { ...s.digital!.outcome, disposition: s.digital!.outcome.disposition || 'Access Request Raised' } } })) },
      { title: 'Done', body: <>You've handled a webchat. Remember: <b>email</b> has the rich text editor, while other digital channels use <b>plain text</b>. Next: <b>Approvals &amp; Digital Transfers</b>.</>, advance: 'next', setup: chain(panel('history'), () => ({ digital: null, digitalView: false })) },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-approval', title: 'Approvals & Digital Transfers', roles: ALL,
    summary: 'The 3 reply permission variations, sending a drafted response to a reviewer (approved or denied), and transferring a digital interaction.',
    steps: [
      { title: 'Three kinds of permission', body: <>When you respond to a digital interaction, what you can do depends on the <b>permissions</b> your administrator gives you. There are <b>3 variations</b>:<br />1. <b>Send directly</b>: the standard permission. You author the response and send it.<br />2. <b>Approval only</b>: you author the response, then send it to a <b>reviewer</b> for approval.<br />3. <b>Both</b>: send it directly, or optionally send it for approval.<br /><br />Let's see how each one looks.</>, advance: 'next', setup: chain(approvalStart, canvas, approvalDraft, perm('both')) },
      { title: '1 · Send directly', body: <>With the standard permission you <b>author</b> the response (type it or insert a quick reply) and click <b>Send Message</b>. It goes straight to the customer. The arrow next to it is <b>greyed out</b>: there's nothing else to choose.</>, target: t('ws-send-split'), advance: 'next', placement: 'top', setup: chain(approvalStart, canvas, approvalDraft, perm('send')) },
      { title: '2 · Approval only', body: <>With approval-only permission, the button reads <b>Request Approval</b> instead. Every response you author goes to a <b>reviewer</b> before the customer sees it. You can't send it directly.</>, target: t('ws-send-split'), advance: 'next', placement: 'top', setup: chain(approvalStart, canvas, approvalDraft, perm('approval')) },
      { title: '3 · Both', body: <>With both permissions, the button reads <b>Send Message</b>, and the <b>arrow</b> lets you optionally send the draft for approval. In this lesson you have both.</>, target: t('ws-send-split'), advance: 'next', placement: 'top', setup: chain(approvalStart, canvas, approvalDraft, perm('both')) },
      { title: 'Author the response', body: <>A response is authored for you here, inserted from the <b>Access request submitted</b> quick reply. You could type your own or edit this one. Promising access is something your team wants a reviewer to check first.</>, target: t('ws-chat-input'), advance: 'next', interactive: true, placement: 'top', setup: chain(chain(approvalStart, canvas, approvalDraft, perm('both')), () => ({ digitalTab: 'quick' })) },
      { title: 'Send options', body: <>The draft needs approval. Click the <b>arrow</b> next to Send Message.</>, target: t('ws-send-dd'), advance: 'click', placement: 'top', setup: chain(approvalStart, canvas, approvalDraft, perm('both')) },
      { title: 'Choose the review queue', body: <>The list shows the <b>review queues</b> you can send to. <b>Send Message</b> at the bottom sends it directly instead, and <b>Search</b> finds a queue by name. Click the first review queue.</>, target: t('ws-review-first'), advance: 'click', placement: 'left' },
      { title: 'Request Approval', body: <>The button now says <b>Request Approval</b>. Click it.</>, target: t('ws-request-approval'), advance: 'click', placement: 'top', setup: chain(approvalStart, canvas, approvalDraft, (s) => (s.reviewQueue ? {} : { reviewQueue: REVIEW_QUEUES[0] })) },
      { title: 'With the reviewer', body: <>Sending it for approval <b>removes the interaction from your inbox</b> and delivers it to the <b>reviewer's inbox</b>. If they <b>approve</b> it, your drafted message is sent immediately. If they <b>deny</b> it, the draft is returned to you. Wait for their decision.</>, target: t('ws-assign'), advance: 'state', until: (s) => !!s.digital?.denied, placement: 'right', actionHint: 'The reviewer is checking your draft…' },
      { title: 'Denied', body: <>This time the reviewer <b>denied</b> it. The draft is <b>returned to you</b> with their comment, so you can adjust it and try again.</>, target: t('ws-denied'), advance: 'next', placement: 'top', setup: chain(canvas, (s) => (s.digital ? {} : { digital: s.approval?.digital ? { ...s.approval.digital, denied: 'Please confirm the employee ID before promising access.', replyOpen: true } : null, approval: null, approvalsAnswered: 1 })) },
      { title: 'Revise the draft', body: <>Adjust the response to cover the reviewer's comment, for example add <b>"I've confirmed your employee ID E40219."</b> Then you'll try again with the revised response.</>, target: t('ws-chat-input'), advance: 'next', interactive: true, placement: 'top', setup: canvas },
      { title: 'Try again', body: <>Send it for approval again. Click <b>Request Approval</b>.</>, target: t('ws-request-approval'), advance: 'click', placement: 'top', setup: chain(canvas, (s) => ({ reviewQueue: s.reviewQueue ?? REVIEW_QUEUES[0], approvalsAnswered: Math.max(1, s.approvalsAnswered) })) },
      { title: 'Approved', body: <>Wait for the reviewer.</>, target: t('ws-assign'), advance: 'state', until: (s) => !s.approval && !!s.digital && s.digital.sent > 0, placement: 'right', actionHint: 'The reviewer is checking your draft…' },
      { title: 'Sent', body: <>Approved. Your revised message was <b>sent immediately</b> to the customer, and the chat is back in your inbox.</>, target: t('ws-chat-thread'), advance: 'next', placement: 'right', setup: canvas },
      { title: 'Transfer a digital interaction', body: <>Digital interactions can be <b>transferred</b> to other agents or queues. Do it from the <b>Consult / Transfer</b> icon (the person with a +) on the chat's <b>inbox tile</b>. Click it.</>, target: t('ws-chat-transfer'), advance: 'click', placement: 'right', setup: canvas },
      { title: 'The Directory app', body: <>Clicking Consult / Transfer opens the <b>Directory</b> app in the App Space. It lists the <b>skills</b>, <b>teams</b> and <b>agents</b> you can transfer to. The <b>All</b> dropdown narrows the list to one type.</>, target: t('ws-dig-transfer'), advance: 'next', placement: 'left', setup: chain(canvas, () => ({ digitalTab: 'directory', dirQuery: '' })) },
      { title: 'Search for the destination', body: <>Search for the <b>destination party</b>: type <b>Network</b>. Press <b>Enter</b> to see all results instead of the first few.</>, target: t('ws-dig-transfer-search'), advance: 'state', until: (s) => /network/i.test(s.dirQuery), placement: 'left', setup: chain(canvas, () => ({ digitalTab: 'directory', dirQuery: '' })), actionHint: 'Type "Network" to continue' },
      { title: 'Transfer', body: <>Point at a skill and a <b>Transfer</b> button (⇄) appears next to it. Click <b>Transfer</b> next to <b>DWCS_ITHD_L2_Network</b>.</>, target: t('ws-dig-transfer-network'), advance: 'click', placement: 'left', setup: chain(canvas, () => ({ digitalTab: 'directory', dirQuery: 'Network' })) },
      { title: 'Transferred', body: <>You'll see <b>Digital skill transferred successfully</b>. The chat leaves your inbox, which now shows <b>No Assignments</b>.</>, target: t('ws-assign'), advance: 'next', placement: 'right' },
      { title: 'In your Contact History', body: <>The transferred chat is listed in your <b>Contact History</b> as <b>Closed</b> for you, with the chat icon and its skill. The receiving skill's agents now handle it.</>, target: t('ws-history-list'), advance: 'next', placement: 'left', setup: panel('history') },
      { title: 'Done', body: <>You know your reply permissions, how approval works, and how to transfer a digital interaction.</>, advance: 'next', setup: chain(panel('history'), () => ({ digital: null, digitalView: false, approval: null, reviewQueue: null })) },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-outbound', title: 'Making an Outbound Call', roles: ALL,
    summary: 'Use New Outbound and the Directory to dial a number, choose your outbound skill, and complete the call.',
    steps: [
      { title: 'Two ways to call out', body: <>You can make an outbound call in two ways:<br />• open the <b>Directory</b> from the left menu, or<br />• click the <b>start another action</b> icon (<b>New Outbound</b>) at the top of the Interactions panel.<br /><br />Both open the Directory. Let's use the icon.</>, target: t('ws-assign'), advance: 'next', placement: 'right', setup: chain(idle, panel('history'), oneSkill) },
      { title: 'Start another action', body: <>Click the <b>start another action</b> icon. Its tooltip says <b>New Outbound</b>.</>, target: t('ws-outbound'), advance: 'click', placement: 'right', setup: chain(idle, panel('history'), oneSkill) },
      { title: 'Dial a number', body: <>The Directory opens. Type a phone number, for example <b>+15555550100</b>. You can also search for a person, skill or team.</>, target: t('ws-dir-search'), advance: 'state', until: (s) => s.dirQuery.replace(/\D/g, '').length >= 7, placement: 'bottom', setup: chain(oneSkill, panel('directory', { dirQuery: '' })), actionHint: 'Type at least 7 digits to continue' },
      { title: 'Voice Call', body: <>This number isn't a contact in the Directory, so a <b>Voice Call</b> option appears. Click <b>Voice Call</b>. Pressing Enter does the same.</>, target: t('ws-dir-voicecall'), advance: 'click', placement: 'bottom', setup: chain(oneSkill, (s) => (s.dirQuery.replace(/\D/g, '').length >= 7 ? {} : { ...CLOSED, wsPanel: 'directory', callView: false, dirQuery: '+15555550100' })) },
      { title: 'Dialed automatically', body: <>You have <b>one outbound skill</b> (<b>DWCS_ITHD_IAM_Outbound</b>), so the call was <b>placed automatically</b>. There was no skill to pick.<br /><br />While it rings, the card shows the number, the outbound skill, a ringing icon and the timer, with only <b>Hang Up</b>.</>, target: t('ws-int-card'), advance: 'next', placement: 'right', setup: (s) => (s.call ? {} : startOutbound({ ...s, ...CLOSED } as SimState, '+15555550100')) },
      { title: 'Connected', body: <>The customer answered. The call card now shows all your <b>phone controls</b>, and the App Space shows the call's details.</>, target: t('ws-int-card'), advance: 'next', placement: 'right', setup: activeOut() },
      hangupStep(activeOut()),
      ...dispositionSteps(wrapFrom(activeOut())),
      { title: 'Several outbound skills?', body: <>Some agents have <b>more than one outbound skill</b>. Then CXone asks which one to use for each call. For this exercise you've been given three. Click <b>Voice Call</b>.</>, target: t('ws-dir-voicecall'), advance: 'click', placement: 'bottom', setup: chain(idle, (s) => (s.agentStatus === 'Available' ? {} : statusPatch(s, 'Available')), panel('directory', { dirQuery: '+15555550188' }), () => ({ outboundSkills: MULTI_SKILLS, skillPrompt: null })) },
      { title: 'Pick the skill', body: <>A <b>dropdown list</b> of your outbound skills appears. Choose the one to use for this call.</>, target: t('ws-skill-dd'), advance: 'state', until: (s) => !!s.call, placement: 'right', setup: (s) => (s.call ? {} : { outboundSkills: MULTI_SKILLS, ...CLOSED, wsPanel: 'directory', callView: false, dirQuery: '+15555550188', skillPrompt: { number: '+15555550188' } }), actionHint: 'Choose a skill to continue' },
      { title: 'Placed on that skill', body: <>The call goes out on the skill you picked. You can see it under the number on the call card.</>, target: t('ws-int-card'), advance: 'next', placement: 'right', setup: (s) => (s.call ? {} : startOutbound({ ...s, ...CLOSED, outboundSkills: MULTI_SKILLS } as SimState, '+15555550188', undefined, MULTI_SKILLS[1])) },
      { title: 'Done', body: <>Tip: in the Directory you can also call an <b>agent</b> or a <b>skill</b> with the phone button next to them. Next: <b>Contact History &amp; Callback</b>.</>, advance: 'next', setup: chain(idle, (s) => (s.agentStatus === 'Available' ? {} : statusPatch(s, 'Available')), oneSkill, panel('history')) },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-callback', title: 'Contact History & Callback', roles: ALL,
    summary: 'Review recent contacts and call a customer back, then learn Save & Redial.',
    steps: [
      { title: 'Contact History', body: <>Click the history icon.</>, target: t('ws-rail-history'), advance: 'click', placement: 'right', setup: chain(idle, seedHistory, panel('search')) },
      { title: 'Recent contacts', body: <>Each row shows the <b>number</b>, the <b>skill</b> (↑ outbound, ↓ inbound), and the <b>date and time</b>. "No Records Found" means you haven't handled any contacts recently.</>, target: t('ws-history-list'), advance: 'next', placement: 'bottom', setup: chain(seedHistory, panel('history')) },
      { title: 'Open a contact', body: <>Click the first contact.</>, target: t('ws-history-first'), advance: 'click', placement: 'bottom', setup: chain(seedHistory, panel('history')) },
      { title: 'Contact details', body: <>Each card in Contact History shows the <b>number</b>, the <b>skill</b> the call came through, whether it was inbound or outbound (the arrow), the <b>date and time</b>, and how long it lasted.</>, target: t('ws-callback-modal'), advance: 'next', placement: 'right', setup: (s) => ({ callbackContact: s.callbackContact ?? s.contactHistory[0] }) },
      { title: 'Callback', body: <>Click <b>Callback</b>. With one outbound skill, the call is placed straight away.</>, target: t('ws-callback-btn'), advance: 'click', placement: 'right', setup: oneSkill },
      hangupStep((s) => activeOut(s.contactHistory[0]?.number)(s)),
      ...dispositionSteps(wrapFrom((s) => activeOut(s.contactHistory[0]?.number)(s))).slice(0, 1),
      { title: 'Save & Redial', body: <>If the call dropped or you need to call again right away, <b>Save &amp; Redial</b> saves the outcome and dials the same number again.</>, target: t('ws-save-redial'), advance: 'next', placement: 'top' },
      ...dispositionSteps(wrapFrom((s) => activeOut(s.contactHistory[0]?.number)(s))).slice(1),
      { title: 'Done', body: <>Next: <b>Directory &amp; Queue</b>.</>, advance: 'next', setup: panel('history') },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-directory', title: 'Directory & Queue', roles: ALL,
    summary: 'Find colleagues and skills, check availability, save favorites, and read the Queue Counter.',
    steps: [
      { title: 'Directory', body: <>Click <b>Directory</b>.</>, target: t('ws-rail-directory'), advance: 'click', placement: 'right', setup: chain(idle, panel('history', { dirQuery: '', dirFilter: 'All' })) },
      { title: 'Search', body: <>Type in this box to find a colleague, a skill or a team by name. You can also type a phone number to call it. Feel free to try it; we'll clear it for the next step.</>, target: t('ws-dir-search'), advance: 'next', interactive: true, placement: 'bottom', setup: panel('directory', { dirQuery: '', dirFilter: 'All' }) },
      { title: 'Filter', body: <>These chips <b>filter</b> the Directory. Pick <b>Agents</b> to see colleagues and whether they're Available, <b>Skills</b> for queues, <b>Teams</b>, the <b>Address Book</b>, or your <b>Favorites</b>.</>, target: t('ws-dir-filter'), advance: 'next', placement: 'bottom', setup: panel('directory', { dirQuery: '', dirFilter: 'All' }) },
      { title: 'Agents', body: <>This list shows your colleagues. Under each name you see their current state (<b>Available</b>, <b>Working</b> or <b>Unavailable</b>) and how long they've been in it. To call someone, click the <b>phone icon</b> at the right end of their row.</>, target: t('ws-dir-agents'), advance: 'next', placement: 'top', setup: panel('directory', { dirQuery: '', dirFilter: 'All' }) },
      { title: 'Favorite', body: <>Click the <b>star</b> next to a name to save that person as a favorite, so you can find them quickly later (up to 25).</>, target: t('ws-dir-star'), advance: 'click', placement: 'left', setup: panel('directory', { dirQuery: '', dirFilter: 'All' }) },
      { title: 'Skills', body: <>Further down are the <b>skills</b> (queues). For each one you see how many agents are Available, the <b>Queue</b> (how many contacts are waiting) and the <b>Wait</b> time of the oldest one.</>, target: t('ws-dir-skills'), advance: 'next', placement: 'top', setup: panel('directory', { dirQuery: '', dirFilter: 'All' }) },
      { title: 'Queue', body: <>Click the <b>Queue</b> icon.</>, target: t('ws-rail-queue'), advance: 'click', placement: 'right' },
      { title: 'Queue Counter', body: <>Contacts waiting for you by channel (Digital, Inbound Voice, Voicemail, Work Item) and the longest wait. Click a row to see the contacts.</>, target: t('ws-queue-table'), advance: 'next', placement: 'bottom', setup: panel('queue') },
      { title: 'Done', body: <>Next: <b>Schedule &amp; Commitments</b>.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-schedule', title: 'Schedule & Commitments', roles: ALL,
    summary: 'Read your schedule, book a commitment during a call (for you or a skill), then view, edit and remove it.',
    steps: [
      { title: 'Schedule', body: <>Click <b>Schedule</b>.</>, target: t('ws-rail-schedule'), advance: 'click', placement: 'right', setup: chain(idle, panel('history', { scheduleMode: 'calendar', scheduleView: 'day' })) },
      { title: 'My Schedule', body: <>Your <b>shift</b> for the day. The blue line marks the current time. Commitments you book for yourself show up here.</>, target: t('ws-sch-day'), advance: 'next', placement: 'top', setup: panel('schedule', { scheduleMode: 'calendar', scheduleView: 'day' }) },
      { title: 'Day / Week', body: <>These two buttons switch the view. <b>Day</b> shows one day hour by hour, with the blue current-time line and any commitments. <b>Week</b> shows all seven days side by side. The <b>arrows</b> next to the date move back or forward, and <b>Today</b> jumps back to today. You can also add a commitment from <b>Add</b> on the right, but most of the time you book one <b>during a call</b>.</>, target: t('ws-sch-view'), advance: 'next', placement: 'bottom' },
      { title: 'A caller needs a callback', body: <>You're on a call and the customer needs you to call back later. You can add a commitment <b>without leaving the call</b>.</>, target: t('ws-int-card'), advance: 'next', placement: 'right', setup: chain(activeIn, () => ({ ...CLOSED, callMenuOpen: false, wsPanel: 'schedule', scheduleMode: 'calendar' })) },
      { title: 'Call menu', body: <>Click the <b>⋮</b> next to the number on the call card.</>, target: t('ws-call-kebab'), advance: 'click', placement: 'right', setup: chain(activeIn, () => ({ callMenuOpen: false })) },
      { title: 'Add Commitment', body: <>Click <b>Add Commitment</b>.</>, target: t('ws-call-add-commit'), advance: 'click', placement: 'right', setup: chain(activeIn, () => ({ callMenuOpen: true })) },
      { title: 'Commitment editor', body: <>The editor opens beside your call. The caller's <b>phone number</b> and the call's <b>skill</b> are already filled in. Required fields have a red *.</>, target: t('ws-commit-form'), advance: 'next', placement: 'left', padding: -6, setup: commitFromCall },
      { title: 'Agent (Me) or Skill', body: <><b>Agent (Me)</b>: you make the callback yourself. It goes on <b>your schedule</b>.<br /><b>Skill</b>: anyone in that skill can call the customer back.</>, target: t('ws-commit-target'), advance: 'next', placement: 'bottom', setup: chain(commitFromCall, draftPatch({ target: 'me' })) },
      { title: 'Skill', body: <>Click <b>Skill</b> to see how a skill commitment works.</>, target: t('ws-commit-skill'), advance: 'click', placement: 'bottom', setup: chain(commitFromCall, draftPatch({ target: 'me' }), () => ({ skillDdOpen: false })) },
      { title: 'Choose the skill', body: <>Open the dropdown. It lists the skills that can make the callback.</>, target: t('ws-commit-skill-dd'), advance: 'click', placement: 'bottom', setup: chain(commitFromCall, draftPatch({ target: 'skill' }), () => ({ skillDdOpen: false })) },
      { title: 'Pick a skill', body: <>Click the skill that should call the customer back.</>, target: t('ws-commit-skill-menu'), advance: 'state', until: (s) => !s.skillDdOpen, placement: 'bottom', setup: chain(commitFromCall, draftPatch({ target: 'skill' }), () => ({ skillDdOpen: true })), actionHint: 'Pick a skill to continue' },
      { title: 'Back to Agent (Me)', body: <>For this lesson, make the callback yours so you can see it on your schedule. Click <b>Agent (Me)</b>.</>, target: t('ws-commit-me'), advance: 'click', placement: 'bottom', setup: chain(commitFromCall, draftPatch({ target: 'skill' }), () => ({ skillDdOpen: false })) },
      { title: 'Customer name', body: <>Type the customer's <b>First Name</b>, for example Hanzo.</>, target: t('ws-commit-first'), advance: 'state', until: (s) => !!s.draft.first.trim(), placement: 'bottom', setup: chain(commitFromCall, draftPatch({ target: 'me' })), actionHint: 'Type a first name' },
      { title: 'Last name', body: <>Type a <b>Last Name</b>.</>, target: t('ws-commit-last'), advance: 'state', until: (s) => !!s.draft.last.trim(), placement: 'bottom', setup: commitFromCall, actionHint: 'Type a last name' },
      { title: 'Time & notes', body: <><b>Time</b> defaults to one hour from now. Change the date, time and <b>Time Zone</b> if needed. Add <b>Notes</b> so you remember why you're calling back, for example "Callback - updates".</>, target: t('ws-commit-time'), advance: 'next', placement: 'top', setup: commitFromCall },
      { title: 'Save', body: <>Click <b>Save</b>.</>, target: t('ws-commit-save'), advance: 'click', placement: 'top', setup: chain(commitFromCall, (s) => draftPatch({ target: 'me', first: s.draft.first || 'Hanzo', last: s.draft.last || 'Test', notes: s.draft.notes || 'Callback - updates' })(s)) },
      { title: 'On your schedule', body: <>Your commitment is on your schedule at its time, and your call is still running. Point at the commitment (or click it) to see its details.</>, target: t('ws-sch-commit-item'), advance: 'click', placement: 'top', setup: onSchedule(null) },
      { title: 'Commitment details', body: <>The customer, number, time, skill and notes. Because it's yours, you can <b>Edit</b> or <b>Remove</b> it. Click <b>Edit</b>.</>, target: t('ws-commit-edit'), advance: 'click', placement: 'left', setup: (s) => onSchedule(lessonCommit(s)?.id ?? null)(s) },
      { title: 'Edit Commitment', body: <>The same editor, now called <b>Edit Commitment</b>. Change anything and click <b>Save</b>, or remove the commitment.</>, target: t('ws-commit-form'), advance: 'next', placement: 'left', padding: -6, setup: editLesson },
      { title: 'Remove', body: <>The customer's ticket is done, so the callback isn't needed. Click <b>Remove</b>.</>, target: t('ws-commit-remove'), advance: 'click', placement: 'top', setup: chain(editLesson, () => ({ commitRemoveFor: null })) },
      { title: 'Give a reason', body: <>You must say why you're removing it. Type a reason, for example <b>Ticket completed</b>.</>, target: t('ws-commit-remove-modal'), advance: 'state', until: (s) => !!s.commitRemoveReason.trim(), placement: 'right', setup: chain(editLesson, (s) => (s.commitRemoveFor ? {} : { commitRemoveFor: s.draft.id, commitRemoveReason: '' })), actionHint: 'Type a reason' },
      { title: 'Confirm', body: <>Click <b>Remove</b> to confirm. <b>Keep</b> would cancel.</>, target: t('ws-commit-remove-confirm'), advance: 'click', placement: 'right', setup: chain(editLesson, (s) => ({ commitRemoveFor: s.commitRemoveFor ?? s.draft.id, commitRemoveReason: s.commitRemoveReason.trim() ? s.commitRemoveReason : 'Ticket completed' })) },
      { title: 'Removed', body: <>Your schedule no longer shows the yellow commitment bar. The callback is cancelled, and the reason you typed is saved with it.</>, target: t('ws-sch-day'), advance: 'next', placement: 'top', setup: (s) => ({ ...panel('schedule', { scheduleMode: 'calendar', commitRemoveFor: null, commitRemoveReason: '', commitPopFor: null })(s), commitments: s.commitRemoveFor ? s.commitments.filter((c) => c.id !== s.commitRemoveFor) : s.commitments }) },
      { title: "When it's due", body: <>When a commitment's time arrives, it appears in your <b>Interactions</b> panel. <b>Proceed</b> calls the customer now, <b>Reschedule</b> moves it later, <b>Remove</b> deletes it. (We added one here so you can see it. Proceed is off while you're on another call.)</>, target: t('ws-commit-card'), advance: 'next', placement: 'right', setup: (s) => (s.commitments.some((c) => c.id === 'k-lesson-due') ? {} : { commitments: [...s.commitments, { ...emptyDraft(), id: 'k-lesson-due', first: 'Jamie', last: 'Rivera', phone: '+15555550177', due: true }] }) },
      { title: 'Done', body: <>You can book, edit and remove commitments, even mid-call. We ended the practice call for you. Next: <b>Breaks, Codes &amp; Logging Out</b>.</>, advance: 'next', setup: (s) => ({ ...idle(s), ...CLOSED, callMenuOpen: false, commitments: s.commitments.filter((c) => c.id !== 'k-lesson-due') }) },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-breaks', title: 'Breaks, Codes & Logging Out', roles: ALL,
    summary: 'Pick the right unavailable code for breaks and non-call work, then log out at the end of your shift.',
    steps: [
      { title: 'Open your status', body: <>Click your status.</>, target: t('ws-presence'), advance: 'click', placement: 'left', setup: chain(idle, panel('history'), available) },
      { title: 'Unavailable codes', body: <>Always choose the code that matches what you're doing. Supervisors see your code live, and it counts toward your productivity in Reporting.</>, target: t('ws-status-menu'), advance: 'next', placement: 'left', setup: { statusMenuOpen: true } },
      { title: 'Take a break', roles: ['agent', 'supervisor', 'supervisor_bo'], body: <>Click <b>Break - 15 min Break</b>.</>, target: t('ws-code-break-15-min-break'), advance: 'click', placement: 'left', setup: { statusMenuOpen: true } },
      { title: 'Backoffice work', roles: ['agent_bo'], body: <>For non-call work, use a backoffice or busy code. Click <b>Break - Backoffice</b>. Codes like <b>Busy - Process - IAM</b>, <b>Busy - SNOW - IAM</b> or <b>Busy - Project</b> are for specific tasks.</>, target: t('ws-code-break-backoffice'), advance: 'click', placement: 'left', setup: { statusMenuOpen: true } },
      { title: 'On break', body: <>You won't get contacts while you're in this code. When you're back, choose <b>Available</b> again.</>, target: t('ws-presence'), advance: 'next', placement: 'left', setup: { statusMenuOpen: false } },
      { title: 'Log Out', body: <>At the end of your shift, open the status list and click <b>Log Out</b> at the bottom. Don't just close the window.</>, target: t('ws-logout'), advance: 'next', placement: 'left', setup: { statusMenuOpen: true }, interactive: false },
      { title: 'Done', body: <>Next: <b>Settings</b>.</>, advance: 'next', setup: { statusMenuOpen: false } },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-settings', title: 'Settings', roles: ALL,
    summary: 'Voice preferences, notifications, display & keyboard shortcuts, connection info, your skills, and reporting an issue.',
    steps: [
      { title: 'Settings', body: <>Click <b>Settings</b>.</>, target: t('ws-rail-settings'), advance: 'click', placement: 'right', setup: chain(idle, panel('history', { settingsTab: 'login' })) },
      { title: 'Six tabs', body: <>Across the top of Settings are <b>six tabs</b>: Login &amp; Voice, Notifications, Display &amp; Keyboard, Information, Agent Skills and Report Issue. Let's go through them.</>, target: t('ws-set-tabs'), advance: 'next', placement: 'bottom', setup: panel('settings', { settingsTab: 'login' }) },
      { title: 'Softphone volume', body: <>This slider sets how loud calls are in your <b>Integrated Softphone</b> headset. Slide right for louder, left for quieter.</>, target: t('ws-set-volume'), advance: 'next', placement: 'bottom' },
      { title: 'Auto Accept', body: <>When it's on, incoming calls connect without you clicking Accept. Leave it off unless your team lead says otherwise. Below are the <b>ringtone</b> and a <b>secondary ringer</b> (a second device that rings after a delay). On the right is <b>Jabra</b> headset control.</>, target: t('ws-set-autoaccept'), advance: 'next', placement: 'right' },
      { title: 'A/V Notifications', body: <>Click <b>A/V Notifications</b>.</>, target: t('ws-set-av'), advance: 'click', placement: 'bottom' },
      { title: 'Sounds & pop-ups', body: <>Turn on a sound or a pop-up for new messages, new contacts, replies, and when a chat or call ends. You can pick one of 10 tones for each.</>, target: t('ws-set-av-body'), advance: 'next', placement: 'top', setup: { settingsTab: 'av' } },
      { title: 'Display & Keyboard', body: <>Click <b>Display &amp; Keyboard</b>.</>, target: t('ws-set-display'), advance: 'click', placement: 'bottom' },
      { title: 'Keyboard shortcuts', body: <>The full list of shortcuts, for example <kbd>ALT + H</kbd> to hold/resume and <kbd>ALT + M</kbd> to mute.</>, target: t('ws-set-shortcuts'), advance: 'next', placement: 'top', setup: { settingsTab: 'display' } },
      { title: 'Information', body: <>Click <b>Information</b>.</>, target: t('ws-set-info'), advance: 'click', placement: 'bottom' },
      { title: 'Connection status', body: <>Your <b>connection lag</b>. Green is good. If it moves toward red, expect choppy audio. Support may ask you for details from this tab, like your Agent ID and Session ID.</>, target: t('ws-set-conn'), advance: 'next', placement: 'bottom', setup: { settingsTab: 'info' } },
      { title: 'Agent Skills', body: <>Click <b>Agent Skills</b>.</>, target: t('ws-set-skills'), advance: 'click', placement: 'bottom' },
      { title: 'Your skills', body: <>The skills you're assigned: an outbound skill (↑) for dialing and an inbound skill (↓) that routes calls to you.</>, target: t('ws-set-skill-list'), advance: 'next', placement: 'bottom', setup: { settingsTab: 'skills' } },
      { title: 'Report Issue', body: <>Click <b>Report Issue</b>.</>, target: t('ws-set-issue'), advance: 'click', placement: 'bottom' },
      { title: 'Report an Issue', body: <>Pick a category and priority and describe the problem. CXone attaches your session details to the report.</>, target: t('ws-set-issue-form'), advance: 'next', interactive: true, placement: 'right', setup: { settingsTab: 'issue' } },
      { title: 'Done', body: <>Next: <b>Reporting, WEM &amp; Customize</b>.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-reporting', title: 'Reporting, WEM & Customize', roles: ALL,
    summary: 'Check your productivity by state, view recent interactions in WEM, and open the Customize menu.',
    steps: [
      { title: 'Reporting', body: <>Click <b>Reporting</b>.</>, target: t('ws-rail-reporting'), advance: 'click', placement: 'right', setup: chain(idle, panel('history', { reportTab: 'productivity', reportRange: 'today' })) },
      { title: 'Productivity', body: <>Time spent <b>Available</b>, <b>Working</b> and <b>Unavailable</b>, compared with your <b>Team</b>. "Today" uses your real time in this simulation.</>, target: t('ws-rep-table'), advance: 'next', placement: 'top', setup: panel('reporting', { reportTab: 'productivity', reportRange: 'today' }) },
      { title: 'Date range', body: <>These buttons change the <b>date range</b> of the report: <b>Today</b>, <b>Yesterday</b>, the <b>Last 7 days</b>, or a <b>Custom</b> range you choose.</>, target: t('ws-rep-range'), advance: 'next', placement: 'bottom' },
      { title: 'WEM', body: <>Click <b>WEM</b>.</>, target: t('ws-rail-wem'), advance: 'click', placement: 'right' },
      { title: 'Recent Interactions', body: <>Your recorded interactions (segments) for the selected period. The ↗ icon opens the full WEM / My Zone app.</>, target: t('ws-wem'), advance: 'next', placement: 'left', padding: -6, setup: panel('wem') },
      { title: 'More', body: <>Click the <b>⋯</b> icon.</>, target: t('ws-rail-more'), advance: 'click', placement: 'right', setup: { customizeOpen: false } },
      { title: 'Customize', body: <>Every app in Agent Workspace. Greyed-out items aren't turned on for your account. Click an item to open it.</>, target: t('ws-customize'), advance: 'next', placement: 'right', setup: { customizeOpen: true } },
      { title: 'All modules complete 🎉', body: <>You've covered all of Agent Workspace. To practice freely, close the lesson and go Available, or try the other <b>learning modes</b> at the bottom of the sidebar. In free practice, calls ring in about 10 seconds after you go Available.</>, advance: 'next', setup: { customizeOpen: false } },
    ],
  },
];

/**
 * Clicking any lesson puts the simulator in the right starting state straight away: the workspace is
 * launched (past the Voice Connection screen) and tidy (no menus, prompts or dialogs left open).
 * The Agent Workspace Tour starts on the Voice Connection screen because that's what it teaches.
 */
export const READY: P = {
  ...CLOSED, wsLaunch: false, voiceOption: 'softphone', crmRecord: null, appSpaceTab: 'details', screenPopOut: false, outboundSkills: [OUTBOUND_SKILL], skillPrompt: null, consultPick: null, completedAt: null, confMenuOpen: false, digital: null, digitalView: false, digitalOutcomeOpen: false, digitalTab: 'details', digitalSplit: 50, approval: null, reviewQueue: null, wsToast: null, outcomeOpen: false, dtmf: '', commitPopFor: null, commitRemoveFor: null, commitRemoveReason: '',
  callMenuOpen: false, skillDdOpen: false, keypadOpen: false, consultOpen: false, scheduleMode: 'calendar', dirQuery: '', dirFilter: 'All',
};
export const WS_TOURS: Tour[] = RAW_WS_TOURS.map((t) => ({
  ...t,
  init: { ...READY, ...(t.id === 'ws-tour' ? { wsLaunch: true, voiceOption: null, rememberSetting: false } : {}), ...t.init },
}));
