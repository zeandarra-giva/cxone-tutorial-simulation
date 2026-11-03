import type { ReactNode } from 'react';
import type { SimState } from '../store';
import { ROLES, SUP_AGENTS, type AppId, type RoleId } from '../data/data';

export interface TourStep {
  title: string;
  body: ReactNode;
  /** CSS selector of the element to spotlight. Omit for a centered message. */
  target?: string;
  /** next = Next button, click = click the target, state = wait for `until` */
  advance: 'next' | 'click' | 'state';
  until?: (s: SimState) => boolean;
  /** state to apply when the step is entered (makes Back/skip work) */
  setup?: Partial<SimState> | ((s: SimState) => Partial<SimState>);
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  padding?: number;
  actionHint?: string;
  interactive?: boolean;
  roles?: RoleId[];
}

export interface Tour {
  id: string;
  title: string;
  summary: string;
  roles: RoleId[];
  init?: Partial<SimState>;
  /** 'cxa' = runs inside the Agent Workspace window */
  opensIn?: 'cxa';
  steps: TourStep[];
}

const t = (id: string) => `[data-tour="${id}"]`;
const ALL: RoleId[] = ['agent', 'agent_bo', 'supervisor', 'supervisor_bo'];
const SUPS: RoleId[] = ['supervisor', 'supervisor_bo'];

const PAGE: Partial<Record<AppId, string>> = { myzone: 'profile', admin: 'employees', supervisor: 'live', dashboard: 'dashboards', acd: 'users' };
const CLOSED = { appMenuOpen: false, profileMenuOpen: false, launchOpen: false };

const inApp = (app: AppId, page?: string) => (): Partial<SimState> => ({ ...CLOSED, screen: 'cxone', app, page: page ?? PAGE[app] ?? 'home' });
const home = (s: SimState): Partial<SimState> => {
  const app = ROLES.find((r) => r.id === s.role)!.defaultApp;
  return { ...CLOSED, screen: 'cxone', app, page: PAGE[app] ?? 'home' };
};
const menuOpen = (s: SimState): Partial<SimState> => ({ ...home(s), app: s.screen === 'cxone' ? s.app : home(s).app, page: s.screen === 'cxone' ? s.page : home(s).page, appMenuOpen: true });

export const TOURS: Tour[] = [
  /* ------------------------------------------------------------------ */
  {
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'Sign in and learn the CXone layout: app menu, top banner, help, notifications, profile and sidebar.',
    roles: ALL,
    init: { screen: 'login' },
    steps: [
      {
        title: 'Welcome to CXone',
        body: <>This is a hands-on simulation of <b>NiCE CXone</b>. When a step asks you to do something, do it on the screen to move on. Use <b>Back</b> any time, or <b>Exit lesson</b> to explore on your own.</>,
        advance: 'next',
        setup: { screen: 'login' },
      },
      {
        title: 'The sign-in page',
        body: <>This is where every CXone session starts. The red banner reminds you the system is for <b>approved business purposes only</b>.</>,
        target: t('login-card'), advance: 'next', placement: 'right',
      },
      {
        title: 'Username',
        body: <>Enter your corporate username (your email format). We pre-filled a training username for you.</>,
        target: t('login-username'), advance: 'next', placement: 'right',
      },
      {
        title: 'Corporate sign-in',
        body: <>You can also sign in with <b>Active Directory</b> or <b>SSO</b>, which sends you to your company login. In this simulation, both buttons sign you in right away.</>,
        target: t('login-sso'), advance: 'next', placement: 'right',
      },
      {
        title: 'Sign in',
        body: <>Click <b>NEXT</b> to sign in. CXone opens the last page or app you visited.</>,
        target: t('login-next'), advance: 'click', placement: 'right',
      },
      {
        title: 'Applications Menu',
        body: <>CXone is made up of several <b>Applications</b>, each for a specific job. Open them all from this grid.</>,
        target: t('app-menu-btn'), advance: 'next', setup: home,
      },
      {
        title: 'Top banner with application name',
        body: <>This shows the app you're in now. Most apps use the same layout.</>,
        target: t('app-name'), advance: 'next',
      },
      { title: 'Help', body: <>The question-mark icon opens NiCE CXone <b>online help</b> for the page you're on, in a new tab.</>, target: t('help'), advance: 'next' },
      { title: 'Notifications', body: <>The bell shows <b>notifications</b>: system messages and workflow updates. A number on the bell means you have unread ones.</>, target: t('notifications'), advance: 'next' },
      { title: 'My Profile', body: <>Your initials. Click to open your profile menu.</>, target: t('profile-btn'), advance: 'click', placement: 'left' },
      {
        title: 'Profile menu',
        body: <>From here you can open <b>My Profile</b> or <b>Support &amp; Downloads</b>, or <b>Sign Out</b>.<br /><br />⏱ CXone <b>signs you out automatically after 30 minutes of inactivity</b>.</>,
        target: t('profile-menu'), advance: 'next', placement: 'left',
        setup: (s) => ({ ...home(s), profileMenuOpen: true }),
      },
      {
        title: 'Side bar with app functionalities',
        body: <>The sidebar lists the <b>features of the current app</b>. It changes when you switch apps. The ☰ icon collapses it.</>,
        target: t('sidebar'), advance: 'next', placement: 'right',
        setup: (s) => ({ ...home(s), profileMenuOpen: false }),
      },
      {
        title: 'Main page content',
        body: <>The page for the feature you picked in the sidebar appears here.</>,
        target: 'main.content', advance: 'next', placement: 'left', padding: -4,
      },
      { title: 'Module complete 🎉', body: <>You've learned the CXone layout. Next, try <b>Navigating Applications</b>.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'apps',
    title: 'Navigating Applications',
    summary: 'Open the Applications menu and learn what each app is for.',
    roles: ALL,
    steps: [
      { title: 'Open the Applications menu', body: <>Click the grid icon.</>, target: t('app-menu-btn'), advance: 'click', setup: home },
      {
        title: 'Applications',
        body: <>Apps are grouped by area. <b>You only see the apps your role allows.</b> Agents mostly use <b>My Zone</b> and <b>Agent</b>. Admins and supervisors see many more.</>,
        target: t('app-menu'), advance: 'next', placement: 'right', setup: menuOpen,
      },
      {
        title: 'General', roles: SUPS,
        body: <><b>Admin</b>: manage users and what they can do based on their permissions.<br /><b>Supervisor</b>: monitor the queue and operations, and change agent states.</>,
        target: t('group-general'), advance: 'next', placement: 'right', setup: menuOpen,
      },
      {
        title: 'Omnichannel Routing',
        body: <><b>ACD</b>: telephony and IVR setup, such as Scripts (IVR call flows), Skills and Hours of Operation.<br /><b>Agent</b>: the softphone you take calls in. It opens in a new window.</>,
        target: t('group-omnichannel-routing'), advance: 'next', placement: 'right', setup: menuOpen,
      },
      {
        title: 'Workforce Engagement',
        body: <><b>Interactions Hub</b>: listen to call recordings.<br /><b>My Zone</b>: your profile and recent interactions.</>,
        target: t('group-workforce-engagement'), advance: 'next', placement: 'right', setup: menuOpen,
      },
      {
        title: 'Data & Analytics', roles: SUPS,
        body: <><b>Dashboard</b>: real-time status of agents and skill performance.<br /><b>Reporting</b>: historical and monthly reporting.</>,
        target: t('group-data-analytics'), advance: 'next', placement: 'right', setup: menuOpen,
      },
      { title: 'Open My Zone', body: <>Click <b>My Zone</b> to open it.</>, target: t('app-myzone'), advance: 'click', placement: 'right', setup: menuOpen },
      {
        title: 'App switched',
        body: <>The banner now shows <b>My Zone</b>, and the sidebar shows My Zone's features.</>,
        target: t('app-name'), advance: 'next', setup: inApp('myzone'),
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'myzone',
    title: 'My Zone — Your Profile',
    summary: 'View your user information, account and accessibility settings.',
    roles: ALL,
    steps: [
      { title: 'My Profile', body: <>Your name and role/team. Everyone has My Zone, also called the <b>Agent\'s View</b>.</>, target: t('profile-head'), advance: 'next', setup: inApp('myzone', 'profile') },
      { title: 'Profile tabs', body: <>These tabs split your profile. <b>General</b>, open now, shows your username, email, user ID, account and tenant ID. Support may ask you for these.</>, target: t('profile-tabs'), advance: 'next' },
      { title: 'Account', body: <>Click <b>Account</b>.</>, target: t('ptab-account'), advance: 'click' },
      { title: 'Accessibility Settings', body: <>Click <b>Accessibility Settings</b> to adjust display options.</>, target: t('ptab-a11y'), advance: 'click', setup: { profileTab: 'account' } },
      { title: 'Recent Interactions', body: <>Click <b>Recent Interactions</b> in the sidebar to see contacts you handled recently.</>, target: t('nav-recent'), advance: 'click', placement: 'right', setup: { profileTab: 'general' } },
      { title: 'Done', body: <>That's My Zone. Next: <b>Launching Agent Workspace</b>.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'agent-launch',
    title: 'Launching Agent Workspace',
    summary: 'Start the softphone: Applications → Omnichannel Routing → Agent. It opens in a new window, where you choose Integrated Softphone and Launch.',
    roles: ALL,
    steps: [
      { title: 'Open Applications', body: <>The softphone is at <b>Applications / Omnichannel Routing / Agent</b>. Click the grid icon.</>, target: t('app-menu-btn'), advance: 'click', setup: (s) => ({ ...home(s), voiceOption: null, rememberSetting: false }) },
      { title: 'Agent', body: <>Under <b>Omnichannel Routing</b>, click <b>Agent</b>. The ↗ icon means it opens in a new window.</>, target: t('app-agent'), advance: 'click', placement: 'right', setup: menuOpen },
      { title: 'A new window opens', body: <>Agent Workspace opened in a <b>new browser window</b>. Switch to the <b>NiCE CXone</b> window. It asks for your voice connection there, and the guided tour continues.<br /><br />If no window appeared, allow pop-ups for this site and click <b>Agent</b> again. Keep this CXone window open too, for My Zone and other apps.</>, advance: 'next', setup: { appMenuOpen: false } },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'supervisor-live',
    title: 'Supervisor — Live Monitoring',
    summary: 'Monitor skills and queues, view agents, and change an agent\'s state.',
    roles: SUPS,
    steps: [
      { title: 'Supervisor App', body: <>Use the Supervisor app to <b>monitor the queue</b> and see what's happening in operations. You can change it live.</>, target: t('nav-live'), advance: 'next', placement: 'right', setup: () => ({ ...inApp('supervisor', 'live')(), supTab: 'skills', agentMenuFor: null, changeStateFor: null, supAgents: SUP_AGENTS }) },
      { title: 'Skills / Agents / Contacts', body: <>These three tabs switch the view: <b>Skills</b> (your queues), <b>Agents</b> (who is in which state) and <b>Contacts</b> (live calls and chats).</>, target: t('sup-tabs'), advance: 'next' },
      { title: 'Skills', body: <>Every skill (queue) you can see, with icons for voicemail ✉ and phone ☎ skills.</>, target: t('sup-skills'), advance: 'next', placement: 'top', padding: -2 },
      { title: 'Wait Time', body: <>The <b>Wait Time</b> column shows how long the <b>oldest</b> contact in each queue has been waiting. A long wait means callers are getting impatient.</>, target: t('sup-wait'), advance: 'next' },
      { title: 'SLA', body: <>The <b>SLA</b> column shows the service level. <span className="sla bad">0%</span> in red means the target is being missed; <span className="sla good">100%</span> in green means it's met.</>, target: t('sup-sla'), advance: 'next' },
      { title: 'Contacts in Queue', body: <>Contacts waiting right now. Sorted highest first, so problem queues are at the top.</>, target: t('sup-queue'), advance: 'next', placement: 'left' },
      { title: 'Search', body: <>The <b>search</b> box finds anything on this page: an agent's name, a phone number, a contact ID, text or a skill.</>, target: t('sup-search'), advance: 'next' },
      { title: 'Agents tab', body: <>Click <b>Agents</b>.</>, target: t('sup-tab-agents'), advance: 'click', setup: { supTab: 'skills' } },
      { title: 'Agent list', body: <>Each agent's team, <b>current state and how long they've been in it</b>, next state, and contacts.</>, target: t('sup-agents'), advance: 'next', placement: 'top', setup: { supTab: 'agents', agentMenuFor: null } },
      { title: "Change an agent's state", body: <>Click the ⋮ menu on the first agent.</>, target: t('sup-agent-kebab'), advance: 'click', placement: 'left', setup: { supTab: 'agents', agentMenuFor: null, changeStateFor: null } },
      { title: 'Change State', body: <>Click <b>Change State</b>.</>, target: t('sup-change-state'), advance: 'click', placement: 'left', setup: { supTab: 'agents', agentMenuFor: SUP_AGENTS[0].name, changeStateFor: null } },
      { title: 'Pick a state', body: <>Choose any state, for example <b>Break - 15 min Break</b>.</>, target: t('sup-state-list'), advance: 'state', until: (s) => s.agentMenuFor === null, placement: 'left', setup: { supTab: 'agents', agentMenuFor: SUP_AGENTS[0].name, changeStateFor: SUP_AGENTS[0].name }, actionHint: 'Pick a state to continue' },
      { title: 'Updated', body: <>Look at the first agent's row: their <b>state</b> changed right away to the one you picked, and the timer next to it restarted from zero.</>, target: t('sup-agents'), advance: 'next', placement: 'top' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'dashboards',
    title: 'Supervisor — Dashboards',
    summary: 'Real-time widgets: Skill Summary, Agent State Counter, Queue Counter and Agent List.',
    roles: SUPS,
    steps: [
      { title: 'Open Applications', body: <>Click the grid icon.</>, target: t('app-menu-btn'), advance: 'click', setup: inApp('supervisor', 'live') },
      { title: 'Dashboard', body: <>Under <b>Data &amp; Analytics</b>, click <b>Dashboard</b>.</>, target: t('app-dashboard'), advance: 'click', placement: 'right', setup: (s) => ({ ...menuOpen(s) }) },
      { title: 'My Dashboards', body: <>Pick which dashboard to show. Dashboards display <b>real-time status of agents and skill performance</b>.</>, target: t('dash-select'), advance: 'next', setup: inApp('dashboard') },
      { title: 'Skill Summary', body: <>Per skill: Abandoned, Available, Logged In, Unavailable, Handled, Incoming, Queued and Current. Shows when it was last updated.</>, target: t('dash-skill-summary'), advance: 'next', placement: 'bottom' },
      { title: 'Agent State Counter', body: <>Counts agents in each state. It says <i>Empty data</i> when no agents are logged in.</>, target: t('dash-agent-state'), advance: 'next' },
      { title: 'Queue Counter', body: <>The <b>Queue Counter</b> widget shows how many contacts are waiting in queue right now, so you can spot a build-up early.</>, target: t('dash-queue'), advance: 'next', placement: 'left' },
      { title: 'Agent List', body: <>The <b>Agent List</b> widget shows every agent in this dashboard's teams and skills, with their live state and how long they've been in it.</>, target: t('dash-agent-list'), advance: 'next', placement: 'top' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'admin',
    title: 'Admin — Managing Employees',
    summary: 'Find employees, read their state, and unlock locked users.',
    roles: ['supervisor_bo'],
    steps: [
      { title: 'Open Applications', body: <>Click the grid icon.</>, target: t('app-menu-btn'), advance: 'click', setup: (s) => ({ ...home(s), app: 'myzone', page: 'profile', adminSearch: '' }) },
      { title: 'Admin', body: <>Under <b>General</b>, click <b>Admin</b>.</>, target: t('app-admin'), advance: 'click', placement: 'right', setup: menuOpen },
      { title: "Admin's View", body: <>Admin is mainly about <b>managing users</b> and what they can do based on their permissions.</>, target: t('sidebar'), advance: 'next', placement: 'right', setup: { ...inApp('admin', 'employees')(), adminSearch: '' } },
      { title: 'Create / Import', body: <>These buttons add people: <b>Create</b> adds one employee by hand, <b>Import</b> adds many at once from a file.</>, target: t('emp-actions'), advance: 'next', placement: 'left' },
      { title: 'Find a user', body: <>Type part of a name, for example <b>an</b>.</>, target: t('emp-search'), advance: 'state', until: (s) => s.adminSearch.trim().length >= 2, actionHint: 'Type 2+ characters to continue' },
      { title: 'Employee list', body: <>The table lists every employee: <b>Name</b>, <b>Role</b>, <b>Username</b>, <b>Scheduling Unit</b>, whether they're a <b>Virtual Agent</b>, and their <b>State</b>.</>, target: t('emp-table'), advance: 'next', placement: 'top', padding: -2 },
      { title: 'State', body: <><b>Active</b> users can sign in. <b>Locked User</b> means the account is locked, often after too many failed sign-ins.</>, target: t('emp-state-col'), advance: 'next', placement: 'left' },
      { title: 'Locked Employees', body: <>Under <b>Security Settings</b>, click <b>Locked Employees</b>.</>, target: t('nav-locked'), advance: 'click', placement: 'right', setup: { adminSearch: '' } },
      { title: 'Unlock a user', body: <>Open the ⋮ menu for the first locked employee.</>, target: t('emp-kebab-aa11512.dev@citi.com'), advance: 'click', placement: 'left', setup: { page: 'locked', adminSearch: '' } },
      { title: 'Unlock', body: <>Click <b>Unlock</b>. The user disappears from this list.</>, target: t('emp-unlock'), advance: 'click', placement: 'left' },
      { title: 'Done', body: <>You've managed employees in Admin.</>, advance: 'next' },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'acd',
    title: 'ACD — Users & Routing Setup',
    summary: 'Tour the ACD app: users, skills, scripts, hours of operation and unavailable codes.',
    roles: SUPS,
    steps: [
      { title: 'Open Applications', body: <>Click the grid icon.</>, target: t('app-menu-btn'), advance: 'click', setup: (s) => ({ ...home(s), acdSearch: '' }) },
      { title: 'ACD', body: <>Under <b>Omnichannel Routing</b>, click <b>ACD</b>.</>, target: t('app-acd'), advance: 'click', placement: 'right', setup: menuOpen },
      { title: 'ACD', body: <>You're in <b>ACD</b>. It holds everything about <b>telephony and IVR setup</b>: users, skills, scripts (call flows), hours of operation and unavailable codes. The menu on the left lists them.</>, target: t('sidebar'), advance: 'next', placement: 'right', setup: inApp('acd', 'users') },
      { title: 'ACD Users', body: <>The table lists every ACD user with their <b>ID</b>, <b>name</b>, <b>username</b>, <b>email</b>, <b>team</b> and whether they're active.</>, target: t('acd-table'), advance: 'next', placement: 'top', padding: -2 },
      { title: 'Manage Multiple Users', body: <><b>Manage Multiple Users</b> lets you edit several users at once, for example to move them to another team or give them a new skill.</>, target: t('acd-manage-multi'), advance: 'next' },
      { title: 'Scripts', body: <><b>Scripts</b> is NiCE's name for IVR call flows. They're under Contact Settings, with Skills and Hours of Operation.</>, target: t('nav-scripts'), advance: 'next', placement: 'right' },
      { title: 'Unavailable Codes', body: <>Click <b>Unavailable Codes</b>. These are the codes agents see in their status list.</>, target: t('nav-ucodes'), advance: 'click', placement: 'right' },
      { title: 'Done', body: <>You've toured ACD.</>, advance: 'next' },
    ],
  },
];

export function toursForRole(role: RoleId) {
  return TOURS.filter((x) => x.roles.includes(role));
}
