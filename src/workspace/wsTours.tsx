import { emptyDraft, statusPatch, type Commitment, type SimState } from '../store';
import type { RoleId } from '../data/data';
import type { Tour } from '../tour/tours';
import { accept, hangUp, historyDate, ringInbound, startOutbound } from './callActions';
import { DISPOSITIONS, SEED_HISTORY } from './wsData';
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
const custView: Fn = () => ({ keypadOpen: false, consultOpen: false, crmRecord: null, callView: true });

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
      { title: '3 · Interactions panel', body: <>Your <b>live work queue</b>. Ringing calls, active calls, wrap-ups and due commitments land here. The person + icon at the top starts an <b>outbound call</b>.</>, target: t('ws-assign'), advance: 'next', placement: 'right' },
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
      { title: 'Mute, Mask & Record', body: <>The icon with the line through it is <b>Mask</b>.<br /><b>Mute</b>: the caller can't hear you.<br /><b>Mask</b>: covers the recording with white noise while the caller gives sensitive details, like card numbers. You can't hang up while masked.<br /><b>Record</b>: shows whether the call is being recorded.</>, target: t('ws-vc-mask'), advance: 'next', placement: 'right', setup: chain(activeIn, (s) => ({ call: { ...s.call!, onHold: false } })) },
      { title: 'Keypad', body: <>Click <b>Keypad</b>. Use it to send tones, for example to pick an option in another company's phone menu.</>, target: t('ws-vc-keypad'), advance: 'click', placement: 'right', setup: chain(activeIn, () => ({ keypadOpen: false })) },
      { title: 'Send tones', body: <>The keypad is open. The display at the top shows the tones you've sent. Press a few keys, for example <b>1</b> to pick option one in another company's phone menu, then continue.</>, target: t('ws-keypad'), advance: 'next', interactive: true, placement: 'top', setup: { keypadOpen: true } },
      { title: 'Consult / Transfer', body: <>Use this to search for an agent, skill or number. You can then <b>Transfer</b> the caller or consult and <b>Conference</b> (up to 8 parties). We won't transfer this one.</>, target: t('ws-vc-consult'), advance: 'next', placement: 'right', setup: { keypadOpen: false } },
      hangupStep(chain(activeIn, (s) => ({ keypadOpen: false, consultOpen: false, call: { ...s.call!, masked: false } }))),
      { title: 'Wrap up', body: <>The call has ended and you're in <b>Wrap Up</b>. Finish the Outcome before taking the next contact.</>, target: t('ws-outcome'), advance: 'next', placement: 'left', padding: -6, setup: wrapFrom(activeIn) },
      ...dispositionSteps(wrapFrom(activeIn)).slice(0, 1),
      { title: 'Notes & Tags', body: <>Add <b>Disposition Notes</b> (for example the ticket number or what you did) and any <b>Tags</b>.</>, target: t('ws-disp-notes'), advance: 'next', placement: 'right' },
      ...dispositionSteps(wrapFrom(activeIn)).slice(1),
      { title: 'Back to Available', body: <>The call is finished: your state is back to <b>Available</b>, so you can take the next call. The call you just handled now sits at the top of <b>Contact History</b>, with its number, skill and time.</>, target: t('ws-history-list'), advance: 'next', placement: 'bottom', setup: chain(panel('history'), (s) => (s.wrap ? {} : {})) },
      { title: 'Done', body: <>You've handled a full inbound call. Next: <b>Making an Outbound Call</b>.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ws-outbound', title: 'Making an Outbound Call', roles: ALL,
    summary: 'Use New Outbound and the Directory to dial a number, choose your outbound skill, and complete the call.',
    steps: [
      { title: 'New Outbound', body: <>Click the <b>New Outbound</b> icon.</>, target: t('ws-outbound'), advance: 'click', placement: 'right', setup: chain(idle, panel('history')) },
      { title: 'Dial a number', body: <>The Directory opens. Type a phone number, for example <b>+15555550100</b>. You can also search for a person, skill or team.</>, target: t('ws-dir-search'), advance: 'state', until: (s) => s.dirQuery.replace(/\D/g, '').length >= 7, placement: 'bottom', setup: panel('directory', { dirQuery: '' }), actionHint: 'Type at least 7 digits to continue' },
      { title: 'Voice Call', body: <>CXone recognizes the number. Click <b>Voice Call</b>. Pressing Enter does the same.</>, target: t('ws-dir-voicecall'), advance: 'click', placement: 'bottom', setup: (s) => (s.dirQuery.replace(/\D/g, '').length >= 7 ? {} : { ...CLOSED, wsPanel: 'directory', callView: false, dirQuery: '+15555550100' }) },
      { title: 'Select a skill', body: <>Outbound calls go out through an <b>outbound skill</b>. Yours is <b>DWCS_ITHD_IAM_Outbound</b>. Click <b>Call</b>.</>, target: t('ws-skill-call'), advance: 'click', placement: 'right', setup: (s) => (s.skillPrompt ? {} : { skillPrompt: { number: s.dirQuery.replace(/[^\d+]/g, '') || '+15555550100' } }) },
      { title: 'Dialing', body: <>The call card shows <b>Dialing…</b> until the customer answers, then <b>Active</b>. Your agent leg connected automatically.</>, target: t('ws-int-card'), advance: 'next', placement: 'right', setup: (s) => (s.call ? {} : activeOut()(s)) },
      hangupStep(activeOut()),
      ...dispositionSteps(wrapFrom(activeOut())),
      { title: 'Done', body: <>Tip: in the Directory you can also call an <b>agent</b> or a <b>skill</b> with the phone button next to them. Next: <b>Contact History &amp; Callback</b>.</>, advance: 'next', setup: panel('history') },
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
      { title: 'Callback', body: <>Click <b>Callback</b>.</>, target: t('ws-callback-btn'), advance: 'click', placement: 'right' },
      { title: 'Choose the skill', body: <>Confirm your outbound skill and click <b>Call</b>.</>, target: t('ws-skill-call'), advance: 'click', placement: 'right', setup: (s) => (s.skillPrompt ? {} : { callbackContact: null, skillPrompt: { number: s.contactHistory[0]?.number ?? '+15555550142' } }) },
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
  ...CLOSED, wsLaunch: false, voiceOption: 'softphone', crmRecord: null, commitPopFor: null, commitRemoveFor: null, commitRemoveReason: '',
  callMenuOpen: false, skillDdOpen: false, keypadOpen: false, consultOpen: false, scheduleMode: 'calendar', dirQuery: '', dirFilter: 'All',
};
export const WS_TOURS: Tour[] = RAW_WS_TOURS.map((t) => ({
  ...t,
  init: { ...READY, ...(t.id === 'ws-tour' ? { wsLaunch: true, voiceOption: null, rememberSetting: false } : {}), ...t.init },
}));
