import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { SUP_AGENTS, type AppId, type Contact, type RoleId, type SupAgent } from './data/data';
import { QUICK_REPLIES } from './workspace/wsData';

const OUTBOUND_SKILL_DEFAULT = 'DWCS_ITHD_IAM_Outbound';

export type Screen = 'picker' | 'login' | 'cxone' | 'workspace';

export type CallPhase = 'ringing' | 'dialing' | 'active';
export interface Call {
  id: string;
  number: string;
  name?: string;
  skill: string;
  direction: 'in' | 'out';
  phase: CallPhase;
  start: number; // phase start
  connectedAt?: number;
  onHold: boolean;
  muted: boolean;
  masked: boolean;
  /** agent pressed Record: voice (and the screen, where configured) is being recorded. Can't be started twice. */
  recording: boolean;
  /** screen recording is configured for this agent (recorded together with the voice) */
  screenRec?: boolean;
  /** a consult leg to another agent / skill / number (the caller is on hold meanwhile) */
  consult?: { name: string; kind: 'agent' | 'skill' | 'team' | 'number'; phase: 'dialing' | 'active'; start: number; held?: boolean; skill?: string };
  /** parties merged into a conference with you and the caller */
  conference?: string[];
  /** Outcome fields filled in during the call (carried into wrap-up) */
  outcome?: { disposition: string; notes: string; tags: string[] };
  everHeld?: boolean;
  everRecorded?: boolean;
  everMasked?: boolean;
  /** caller scenario id (see training/scenarios.ts) */
  scenario?: string;
}
/** one message in an email thread */
export interface EmailMsg { id: string; from: 'customer' | 'agent'; address: string; to: string; at: number; html: string; attachments?: string[] }
export interface EmailDraft { to: string[]; cc: string; bcc: string; showCc: boolean; from: string; subject: string; html: string; attachments: string[] }
/** a digital interaction (email) assigned to the agent */
export interface Digital {
  id: string; channel: 'email' | 'chat'; scenario: string;
  /** offered = waiting for Accept / Reject (manual accept). Auto-accepted interactions start active. */
  phase: 'offered' | 'active';
  /** chat: how many scripted customer messages have been sent so far */
  script: number; name: string; address: string; skill: string; subject: string; caseId: string;
  /** New → Pending (you replied, waiting for the customer) → Open (customer answered) → Resolved */
  status: 'New' | 'Pending' | 'Open' | 'Resolved';
  /** set when a reviewer denied a drafted response: shown above the returned draft */
  denied?: string;
  /** earlier messages from a previous conversation, revealed by Load Previous Messages */
  previous?: EmailMsg[];
  showPrevious?: boolean; start: number; messages: EmailMsg[]; replyOpen: boolean; draft: EmailDraft;
  outcome: { disposition: string; notes: string }; notes: string[]; sent: number;
}
export type DigitalTab = 'details' | 'quick' | 'history' | 'search' | 'queue' | 'directory' | 'schedule' | 'wem';
export type AppSpaceTab = 'details' | 'consult' | 'screenpop' | 'history' | 'search' | 'queue' | 'directory' | 'schedule' | 'wem';
export interface HandledContact { number: string; direction: 'in' | 'out'; scenario?: string; disposition: string; notes: string; everHeld: boolean; everMasked: boolean; at: number }
export interface Stats {
  inboundAccepted: number; refused: number; outboundPlaced: number; transfers: number; handled: number;
  commitmentsBooked: number; issuesSent: number; lastIssueCategory: string; lastDialed: string;
  answerTimes: number[]; handledLog: HandledContact[];
}
export const emptyStats = (): Stats => ({
  inboundAccepted: 0, refused: 0, outboundPlaced: 0, transfers: 0, handled: 0, commitmentsBooked: 0, issuesSent: 0,
  lastIssueCategory: '', lastDialed: '', answerTimes: [], handledLog: [],
});
export interface Notification { id: string; kind: 'message' | 'wem' | 'system'; from: string; text: string; at: number; read: boolean }
export type TrainingMode = 'free' | 'tour' | 'explore' | 'story' | 'mission' | 'quiz' | 'sim';
export interface WrapUp { call: Call; endedAt: number; disposition: string; notes: string; tags: string[] }
export interface Commitment { id: string; target: 'me' | 'skill'; skill: string; first: string; last: string; phone: string; time: string; tz: string; notes: string; due?: boolean }
export interface StateLogEntry { status: string; start: number }

export interface SimState {
  screen: Screen;
  role: RoleId;
  rolePicked: boolean;
  loginStep: 'username' | 'redirect';
  username: string;
  // shell
  app: AppId;
  page: string;
  appMenuOpen: boolean;
  profileMenuOpen: boolean;
  sidebarCollapsed: boolean;
  profileTab: string;
  // agent launch dialog (CXone)
  launchOpen: boolean;
  voiceOption: 'phone' | 'station' | 'softphone' | null;
  rememberSetting: boolean;
  // ---------- Agent Workspace ----------
  wsLaunch: boolean; // showing the Voice Connection page inside the new window
  trainingMode: TrainingMode;
  stats: Stats;
  notifications: Notification[];
  agentStatus: string;
  statusSince: number;
  stateLog: StateLogEntry[];
  statusBeforeCall: string;
  statusMenuOpen: boolean;
  agentLeg: boolean;
  extPromptOpen: boolean;
  helpOpen: boolean;
  notifOpen: boolean;
  customizeOpen: boolean;
  assignCollapsed: boolean;
  wsPanel: string;
  callView: boolean; // main area shows the active interaction
  call: Call | null;
  wrap: WrapUp | null;
  skillPrompt: { number: string; name?: string } | null;
  /** outbound voice skills assigned to the agent. One = calls dial straight away; several = pick one from a dropdown */
  outboundSkills: string[];
  consultOpen: boolean;
  keypadOpen: boolean;
  dtmf: string;
  callbackContact: Contact | null;
  contactHistory: Contact[];
  dirQuery: string;
  dirFilter: string;
  favorites: string[];
  /** quick replies starred in the ⚡ Quick Responses app (they appear on its Favorites tab) */
  quickFavs: string[];
  scheduleView: 'day' | 'week';
  scheduleMode: 'calendar' | 'add' | 'edit';
  addMenuOpen: boolean;
  /** schedule: commitment whose details popover is pinned open */
  commitPopFor: string | null;
  /** commitment the Remove Commitment dialog is open for */
  commitRemoveFor: string | null;
  commitRemoveReason: string;
  /** commitment editor: skill dropdown open */
  skillDdOpen: boolean;
  /** ⋮ menu on the active call card */
  callMenuOpen: boolean;
  /** simulated CRM record window opened from the call's App Space */
  crmRecord: { type: string; id: string; subject: string; status: string; date?: string } | null;
  /** which App Space tab is showing during a call: customer details or the screen pop */
  appSpaceTab: AppSpaceTab;
  /** the Outcomes panel at the bottom of the Interactions panel is open during a call */
  outcomeOpen: boolean;
  /** the digital interaction (email) assigned to you, if any */
  digital: Digital | null;
  /** the agent canvas (Interaction space + App Space) for the digital interaction is showing */
  digitalView: boolean;
  /** width of the Interaction space in the canvas, % (the divider between the two panels can be dragged) */
  digitalSplit: number;
  digitalTab: DigitalTab;
  digitalOutcomeOpen: boolean;
  /**
   * What your account may do with a digital response (set by your administrator):
   * send = send directly, approval = must send to a reviewer, both = send directly or optionally request approval.
   */
  replyPermission: 'send' | 'approval' | 'both';
  /** review queue chosen in the Send Message dropdown (the button then reads Request Approval) */
  reviewQueue: string | null;
  /** a response waiting for a reviewer: it has left your inbox. `result` decides what the (simulated) reviewer does. */
  approval: { digital: Digital; queue: string; at: number; result: 'approve' | 'deny' } | null;
  /** how many approval requests the simulated reviewer has answered (the first one is denied, to show both outcomes) */
  approvalsAnswered: number;
  /** CXone-style notification at the top of the workspace (e.g. "Digital skill transferred successfully") */
  wsToast: { text: string; at: number; kind?: 'ok' | 'bad' } | null;
  /** an external number picked in the Directory during a call: choose the outbound skill for the consult / transfer */
  consultPick: { target: string; action: 'consult' | 'transfer' } | null;
  /** when the last interaction was completed by a transfer or by leaving a conference (shows "Interaction completed") */
  completedAt: number | null;
  /** the conference menu (Leave / End Call) is open */
  confMenuOpen: boolean;
  /** the call's screen pop is popped out into its own window */
  screenPopOut: boolean;
  commitments: Commitment[];
  draft: Commitment;
  settingsTab: string;
  prefs: Record<string, string | number | boolean>;
  reportTab: 'productivity' | 'performance';
  reportRange: 'today' | 'yesterday' | '7d' | 'custom';
  issue: { category: string; priority: string; comment: string; sent: boolean };
  // supervisor
  supTab: 'skills' | 'agents' | 'contacts';
  supAgents: SupAgent[];
  agentMenuFor: string | null;
  changeStateFor: string | null;
  // admin / acd
  adminSearch: string;
  acdSearch: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export function defaultCommitTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())} ${ap}`;
}
export const emptyDraft = (): Commitment => ({
  id: '', target: 'me', skill: 'DWCS_ITHD_IAM_Outbound', first: '', last: '', phone: '', time: defaultCommitTime(),
  tz: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi', notes: '',
});

export const DEFAULT_PREFS: Record<string, string | number | boolean> = {
  volume: 80, autoAccept: false, ringtone: 'Ring 1', secondaryDevice: 'None', delaySeconds: 'None',
  aMsg: false, aContact: false, aReply: false, aEnd: false,
  tMsg: 'Tone 1', tContact: 'Tone 2', tReply: 'Tone 3', tEnd: 'Tone 4',
  vMsg: false, vContact: false, vReply: false, vEnd: false,
  h24: false, panelGeneral: false, panelPageAction: true, emailSort: 'Oldest to newest (default)', sendEnter: 'All channels except email',
  logLevel: 'Error',
};

export const initialState: SimState = {
  screen: 'picker',
  role: 'agent',
  rolePicked: false,
  loginStep: 'username',
  username: '',
  app: 'myzone',
  page: 'profile',
  appMenuOpen: false,
  profileMenuOpen: false,
  sidebarCollapsed: false,
  profileTab: 'general',
  launchOpen: false,
  voiceOption: null,
  rememberSetting: false,
  wsLaunch: false,
  trainingMode: 'free',
  stats: emptyStats(),
  notifications: [],
  agentStatus: 'Unavailable',
  statusSince: Date.now(),
  stateLog: [{ status: 'Unavailable', start: Date.now() }],
  statusBeforeCall: 'Unavailable',
  statusMenuOpen: false,
  agentLeg: false,
  extPromptOpen: true,
  helpOpen: false,
  notifOpen: false,
  customizeOpen: false,
  assignCollapsed: false,
  wsPanel: 'history',
  callView: false,
  call: null,
  wrap: null,
  skillPrompt: null,
  outboundSkills: [OUTBOUND_SKILL_DEFAULT],
  consultOpen: false,
  keypadOpen: false,
  dtmf: '',
  callbackContact: null,
  contactHistory: [],
  dirQuery: '',
  dirFilter: 'All',
  favorites: [],
  quickFavs: QUICK_REPLIES.filter((r) => r.fav).map((r) => r.title),
  scheduleView: 'day',
  scheduleMode: 'calendar',
  addMenuOpen: false,
  commitPopFor: null,
  commitRemoveFor: null,
  commitRemoveReason: '',
  skillDdOpen: false,
  callMenuOpen: false,
  crmRecord: null,
  appSpaceTab: 'details',
  outcomeOpen: false,
  digital: null,
  digitalView: false,
  digitalSplit: 50,
  digitalTab: 'details',
  digitalOutcomeOpen: false,
  replyPermission: 'both',
  reviewQueue: null,
  approval: null,
  approvalsAnswered: 0,
  wsToast: null,
  consultPick: null,
  completedAt: null,
  confMenuOpen: false,
  screenPopOut: false,
  commitments: [],
  draft: emptyDraft(),
  settingsTab: 'login',
  prefs: DEFAULT_PREFS,
  reportTab: 'productivity',
  reportRange: 'today',
  issue: { category: '', priority: '', comment: '', sent: false },
  supTab: 'skills',
  supAgents: SUP_AGENTS,
  agentMenuFor: null,
  changeStateFor: null,
  adminSearch: '',
  acdSearch: '',
};

/** Patch that changes the agent's presence and records it for Reporting. */
export function statusPatch(s: SimState, status: string): Partial<SimState> {
  const now = Date.now();
  return { agentStatus: status, statusSince: now, stateLog: [...s.stateLog, { status, start: now }] };
}

type Action = { type: 'set'; patch: Partial<SimState> | ((s: SimState) => Partial<SimState>) } | { type: 'reset'; patch?: Partial<SimState> };

function reducer(s: SimState, a: Action): SimState {
  if (a.type === 'reset') {
    const now = Date.now();
    return { ...initialState, statusSince: now, stateLog: [{ status: 'Unavailable', start: now }], draft: emptyDraft(), stats: emptyStats(), ...a.patch };
  }
  const p = typeof a.patch === 'function' ? a.patch(s) : a.patch;
  return { ...s, ...p };
}

type Setter = (p: Partial<SimState> | ((s: SimState) => Partial<SimState>)) => void;
interface Ctx { s: SimState; set: Setter; reset: (p?: Partial<SimState>) => void }
const SimCtx = createContext<Ctx | null>(null);

export function SimProvider({ children, init }: { children: ReactNode; init?: Partial<SimState> }) {
  const [s, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState, ...init }));
  const set: Setter = (patch) => dispatch({ type: 'set', patch });
  const reset = (patch?: Partial<SimState>) => dispatch({ type: 'reset', patch });
  return <SimCtx.Provider value={{ s, set, reset }}>{children}</SimCtx.Provider>;
}

export function useSim() {
  const c = useContext(SimCtx);
  if (!c) throw new Error('useSim outside provider');
  return c;
}
