// Fictional training data for the Agent Workspace window.
import type { Contact } from '../data/data';

export const OUTBOUND_SKILL = 'DWCS_ITHD_IAM_Outbound';
export const INBOUND_SKILL = 'DWCS_ITHD_IAM_SolCenter';

export const AGENT_SKILLS = [
  { name: OUTBOUND_SKILL, outbound: true },
  { name: INBOUND_SKILL, outbound: false },
];

export interface DirAgent { name: string; state: 'Available' | 'Unavailable' | 'Working'; since: string }
export const DIR_AGENTS: DirAgent[] = [
  { name: 'Ana Bautista', state: 'Available', since: '7 mins' },
  { name: 'Eric Hale', state: 'Available', since: '4 hrs 41 mins' },
  { name: 'Gabor Kovacs', state: 'Unavailable', since: '12 mins' },
  { name: 'Maria Fernandez', state: 'Working', since: '3 mins' },
  { name: 'Liam Ortega', state: 'Available', since: '52 mins' },
  { name: 'Sofia Nagy', state: 'Unavailable', since: '1 hr 5 mins' },
  { name: 'Tamas Farkas (Team Lead)', state: 'Available', since: '2 hrs 3 mins' },
  { name: 'Benjamin San Jose', state: 'Working', since: '9 mins' },
];
export const DIR_TEAMS = [
  { name: 'DWCS_ITHD_IAM', members: 14, available: 6 },
  { name: 'DWCS_ITHD_L2_Network', members: 8, available: 3 },
  { name: 'DWCS_ITHD_L1_HT_Markets', members: 11, available: 0 },
];

/** External contacts in the Directory's Address Book (fictional). */
export const DIR_ADDRESS_BOOK = [
  { name: 'Network Vendor Support', number: '+15555550170' },
  { name: 'Facilities Helpdesk', number: '+15555550171' },
  { name: 'HR Service Centre', number: '+15555550172' },
];

export interface DirSkill { name: string; available: number; queue: number; wait: string }
export const DIR_SKILLS: DirSkill[] = [
  { name: 'DWCS_ITHD_IAM_SolCenter', available: 5, queue: 0, wait: '0 min' },
  { name: 'DWCS_ITHD_L1_HT_Markets', available: 0, queue: 0, wait: '0 min' },
  { name: 'DWCS_ITHD_L2_VIP', available: 2, queue: 1, wait: '1 min' },
  { name: 'DWCS_ITHD_L2_Network', available: 3, queue: 2, wait: '2 min' },
  { name: 'DWCS_ITHD_RTS', available: 0, queue: 0, wait: '0 min' },
];

export const DIR_FILTERS = ['All', 'Agents', 'Skills', 'Teams', 'Address Book', 'Favorites'];

export const QUEUE_CHANNELS = [
  { id: 'digital', label: 'Digital' },
  { id: 'voice', label: 'Inbound Voice' },
  { id: 'vm', label: 'Voicemail' },
  { id: 'work', label: 'Work Item' },
];

export const DISPOSITIONS = ['Resolved - First Contact', 'Password Reset', 'Access Request Raised', 'Escalated to L2', 'Callback Required', 'Wrong Number', 'No Answer / Voicemail'];
export const TAGS = ['IAM', 'VIP', 'Follow-up', 'Ticket Created'];

export const INBOUND_CALLERS = [
  { number: '+15555550123', skill: INBOUND_SKILL },
  { number: '+442075550199', skill: INBOUND_SKILL },
  { number: '+6325550111', skill: INBOUND_SKILL },
];

/** Seed contact history (last ~3 days). `hoursAgo` is turned into a real date at load time. */
export const EMAIL_SKILL = 'DWCS_ITHD_IAM_Email';
/** the mailbox replies are sent from */
export const EMAIL_FROM = ['Email_ITHD_IAM', 'Email_ITHD_ServiceDesk'];
export const EMAIL_DISPOSITIONS = ['Resolved - Replied', 'Access Request Raised', 'Escalated to L2', 'Pending Customer Reply', 'No Action Required'];
/** fictional customer fields shown in the App Space Details for a digital interaction */
export const EMAIL_FIELDS = ['Preferred contact', 'Employee ID', 'Department', 'Cost centre', 'Location', 'Manager'];
/**
 * Quick replies (templated responses). Administrators configure these; {{placeholders}} are filled in
 * with the customer's and agent's details when you use one.
 */
export const QUICK_REPLIES = [
  { title: 'Agent Name Greeting', text: 'Hi {{customer.firstName}}. My name is {{agent.firstName}} and I will be helping you today.', fav: true },
  { title: 'MFA re-registration', text: 'To move MFA to your new phone: sign in to the self-service portal from your laptop, choose Security info > Add sign-in method, then scan the QR code with the authenticator app.', fav: false },
  { title: 'Ticket raised', text: 'I have raised ticket {{case.number}} for you. You will get updates by email.', fav: false },
  { title: 'Access request submitted', text: 'I have submitted an access request for you. Your manager gets an approval email, and access usually works within 1 business day.', fav: true },
  { title: 'Thanks for contacting us', text: 'Thanks for contacting the IT Service Desk, {{customer.firstName}}. Is there anything else I can help with?', fav: false },
];
export const CHAT_SKILL = 'DWCS_ITHD_IAM_Chat';
/** review queues a drafted digital response can be sent to for approval (fictional) */
export const REVIEW_QUEUES = ['DWCS_ITHD_Review_QA', 'DWCS_ITHD_Review_TeamLead', 'DWCS_ITHD_Review_Compliance', 'DWCS_ITHD_Review_Newhire'];
export const DENY_REASONS = ['Please confirm the employee ID before promising access.', 'Add the ticket number so the customer can follow up.'];
export interface ChatScenario { id: string; name: string; address: string; caseId: string; expected: string; fields: string[]; lines: string[]; previous?: string[] }
/** fictional webchat: the first line arrives on accept, the rest after each agent reply */
export const CHATS: ChatScenario[] = [
  { id: 'hrportal', name: 'Ravi Menon', address: 'ravi.menon@example.com', caseId: '510600491260', expected: 'Access Request Raised',
    fields: ['Chat', 'E40219', 'Human Resources', 'CC-1180', 'Bengaluru', 'Tamas Farkas'],
    previous: ['Hi, my laptop won\u2019t connect to the office Wi-Fi.', 'Thanks, forgetting the network and joining again worked.'],
    lines: ['Hi, I get "access denied" when I open the HR portal since this morning.', 'It says my role is missing. My manager said she approved it last week.', 'Great, thanks for the help!'] },
];

export interface EmailScenario { id: string; name: string; address: string; subject: string; caseId: string; html: string; expected: string; fields: string[] }
export const EMAILS: EmailScenario[] = [
  { id: 'mfa', name: 'Kenji Tanaka', address: 'kenji.tanaka@example.com', subject: 'MFA approvals not arriving on my new phone', caseId: '510600482913', expected: 'Resolved - Replied',
    fields: ['Email', 'E10442', 'Treasury Operations', 'CC-3310', 'Singapore', 'Ana Bautista'],
    html: '<p>Hi,</p><p>I replaced my phone over the weekend and now the sign-in approvals don\u2019t arrive on the new one. I can still get into my laptop but not into email on my phone.</p><p>Could you tell me what I need to do?</p><p>Regards,<br>Kenji</p>' },
  { id: 'mailbox', name: 'Lucia Moreno', address: 'lucia.moreno@example.com', subject: 'Access to the Risk shared mailbox', caseId: '510600483377', expected: 'Access Request Raised',
    fields: ['Email', 'E20981', 'Market Risk', 'CC-4120', 'Madrid', 'Eric Hale'],
    html: '<p>Hello Service Desk,</p><p>My manager approved my access to the <b>Risk-Reporting</b> shared mailbox yesterday, but it still doesn\u2019t show in Outlook.</p><p>Thanks,<br>Lucia</p>' },
  { id: 'reset', name: 'Omar Haddad', address: 'omar.haddad@example.com', subject: 'Password reset link expired', caseId: '510600484102', expected: 'Resolved - Replied',
    fields: ['Phone', 'E31507', 'Payments', 'CC-2075', 'Dubai', 'Liam Ortega'],
    html: '<p>Hi team,</p><p>The password reset link you sent me says it has expired. Can you send a new one?</p><p>Omar</p>' },
];

export const SEED_HISTORY_RAW: (Omit<Contact, 'date'> & { hoursAgo: number })[] = [
  { id: 'h1', number: '+15555550142', skill: INBOUND_SKILL, outbound: false, duration: '00:03:12', hoursAgo: 1.2 },
  { id: 'h2', number: '+15555550188', skill: OUTBOUND_SKILL, outbound: true, duration: '00:01:47', hoursAgo: 2.6 },
  { id: 'h3', number: '+442075550133', skill: INBOUND_SKILL, outbound: false, duration: '00:06:05', hoursAgo: 5.1 },
  { id: 'h4', number: '+6325550174', skill: INBOUND_SKILL, outbound: false, duration: '00:02:21', hoursAgo: 22 },
  { id: 'h5', number: '+15555550142', skill: OUTBOUND_SKILL, outbound: true, duration: '00:04:40', hoursAgo: 26 },
  { id: 'h6', number: '+15555550109', skill: INBOUND_SKILL, outbound: false, duration: '00:00:58', hoursAgo: 49 },
  // earlier calls from saved customers, so their Contact History isn't empty during a call
  { id: 'h7', number: '+15555550123', skill: INBOUND_SKILL, outbound: false, duration: '00:05:31', hoursAgo: 50 },
  { id: 'h8', number: '+15555550123', skill: OUTBOUND_SKILL, outbound: true, duration: '00:02:09', hoursAgo: 48.5 },
  { id: 'h9', number: '+6325550111', skill: INBOUND_SKILL, outbound: false, duration: '00:07:44', hoursAgo: 27 },
  // earlier emails (digital interactions show the customer name and the email skill)
  { id: 'h10', number: 'Kenji Tanaka', skill: 'DWCS_ITHD_IAM_Email', outbound: false, duration: '00:09:12', hoursAgo: 3.4, channel: 'email' },
  { id: 'h11', number: 'Lucia Moreno', skill: 'DWCS_ITHD_IAM_Email', outbound: false, duration: '00:04:30', hoursAgo: 30, channel: 'email' },
];
export const seedHistory = (): Contact[] => [...SEED_HISTORY_RAW].sort((a, b) => a.hoursAgo - b.hoursAgo).map(({ hoursAgo, ...c }) => {
  const d = new Date(Date.now() - hoursAgo * 3600000);
  const p = (n: number) => String(n).padStart(2, '0');
  return { ...c, date: `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}` };
});
export const SEED_HISTORY = SEED_HISTORY_RAW.slice(0, 2).map(({ hoursAgo: _h, ...c }) => ({ ...c, date: '' }));

export const seedNotifications = () => [
  { id: 'n1', kind: 'message' as const, from: 'Tamas Farkas (Team Lead)', text: 'Team huddle at 3:00 PM in the IAM channel. Please be on Available by 3:10.', at: Date.now() - 25 * 60000, read: false },
  { id: 'n2', kind: 'wem' as const, from: 'WEM', text: 'Your schedule for tomorrow was updated: lunch moved to 12:30 PM.', at: Date.now() - 3 * 3600000, read: false },
  { id: 'n3', kind: 'system' as const, from: 'System', text: 'Reminder: install the CXone Softphone Extension for better call quality.', at: Date.now() - 26 * 3600000, read: true },
];

/** Recorded segments shown in WEM > Recent Interactions. */
export const WEM_SEGMENTS = [
  { id: 's1', when: 1.2, direction: 'Inbound', number: '+15555550142', skill: INBOUND_SKILL, duration: '03:12' },
  { id: 's2', when: 2.6, direction: 'Outbound', number: '+15555550188', skill: OUTBOUND_SKILL, duration: '01:47' },
  { id: 's3', when: 5.1, direction: 'Inbound', number: '+442075550133', skill: INBOUND_SKILL, duration: '06:05' },
  { id: 's4', when: 22, direction: 'Inbound', number: '+6325550174', skill: INBOUND_SKILL, duration: '02:21' },
];

/** Today's shift activities shown on the Schedule (hour, minute, length in minutes). */
export const SHIFT_BLOCKS = [
  { label: 'Open', start: [8, 0], mins: 120, kind: 'open' },
  { label: 'Break', start: [10, 0], mins: 15, kind: 'break' },
  { label: 'Open', start: [10, 15], mins: 105, kind: 'open' },
  { label: 'Lunch', start: [12, 0], mins: 60, kind: 'lunch' },
  { label: 'Open', start: [13, 0], mins: 120, kind: 'open' },
  { label: 'Team Huddle', start: [15, 0], mins: 15, kind: 'meeting' },
  { label: 'Break', start: [15, 15], mins: 15, kind: 'break' },
  { label: 'Open', start: [15, 30], mins: 90, kind: 'open' },
] as const;

export const TIMEZONES = [
  '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi',
  '(GMT+08:00) Manila',
  '(GMT+00:00) London',
  '(GMT-05:00) Eastern Time (US & Canada)',
];

export const RINGTONES = ['Ring 1', 'Ring 2', 'Ring 3', 'Ring 4'];
export const TONES = Array.from({ length: 10 }, (_, i) => `Tone ${i + 1}`);
export const LOG_LEVELS = ['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal'];
export const ISSUE_CATEGORIES = ['Audio Quality', 'Call Dropped', 'Unable to Login', 'Application Error', 'Other'];
export const ISSUE_PRIORITIES = ['Low', 'Medium', 'High'];

export const SHORTCUTS: [string, [string, string][]][] = [
  ['Top Navigation Shortcuts', [['Focus Top Navigation', 'CTRL + ALT + T'], ['Open Notifications', 'CTRL + ALT + N'], ['Open Help', 'CTRL + F2'], ['Open Settings', 'CTRL + SHIFT + 4']]],
  ['Voice Shortcuts', [['Accept Incoming Call', 'SHIFT + ALT + A'], ['Reject Incoming Call', 'SHIFT + ALT + R'], ['Call Hold / Resume', 'ALT + H'], ['Call Mute / Unmute', 'ALT + M'], ['Call Mask / Unmask', 'ALT + N'], ['Call Record', 'ALT + R'], ['Open Keypad', 'ALT + K'], ['Hang Up', 'ALT + \\']]],
  ['Interaction Shortcuts', [['Open Outcome Panel', 'CTRL + ALT + D'], ['Open Screen Pops', 'CTRL + SHIFT + F']]],
];

export const AGENT_INFO = {
  agentId: '70410001',
  version: '26.3.1.1-AGENT',
  build: '40b5615235',
  sessionId: '721330001209',
  callerId: '6315550184',
  cluster: 'AOA-C203COR01',
  team: 'DWCS_ITHD_IAM',
};

// Team comparison numbers shown in Reporting > Productivity (fictional).
export const TEAM_PRODUCTIVITY = {
  today: { available: [0, '00:00:00'], working: [0, '00:00:00'], unavailable: [100, '00:03:30'] },
  yesterday: { available: [82, '05:48:29'], working: [6, '00:25:26'], unavailable: [8, '00:32:22'] },
  '7d': { available: [93, '12:55:11'], working: [1, '00:29:31'], unavailable: [6, '03:44:02'] },
} as const;

// Items in the "More / Customize" menu. `enabled` = available for this tenant.
export const CUSTOMIZE_ITEMS: { group: number; label: string; panel?: string; enabled: boolean }[] = [
  { group: 0, label: 'Customer Card', enabled: false },
  { group: 0, label: 'Multi-party', enabled: false },
  { group: 0, label: 'Agent Assist', enabled: false },
  { group: 0, label: 'Copilot', enabled: false },
  { group: 0, label: 'Quick Responses', enabled: false },
  { group: 0, label: 'Screen Pop', enabled: false },
  { group: 1, label: 'Desk', enabled: false },
  { group: 1, label: 'Contact History', panel: 'history', enabled: true },
  { group: 1, label: 'Search', panel: 'search', enabled: true },
  { group: 1, label: 'Queue', panel: 'queue', enabled: true },
  { group: 1, label: 'Directory', panel: 'directory', enabled: true },
  { group: 1, label: 'Schedule', panel: 'schedule', enabled: true },
  { group: 1, label: 'Launch', enabled: false },
  { group: 1, label: 'WEM', panel: 'wem', enabled: true },
  { group: 2, label: 'Settings', panel: 'settings', enabled: true },
  { group: 2, label: 'Custom Workspace', enabled: false },
  { group: 2, label: 'Reporting', panel: 'reporting', enabled: true },
  { group: 2, label: 'Help', panel: 'help', enabled: true },
];
