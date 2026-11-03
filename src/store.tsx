import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { SUP_AGENTS, type AppId, type Contact, type RoleId, type SupAgent } from './data/data';

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
  recording: boolean;
  everHeld?: boolean;
  everMasked?: boolean;
  /** caller scenario id (see training/scenarios.ts) */
  scenario?: string;
}
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
  consultOpen: boolean;
  keypadOpen: boolean;
  dtmf: string;
  callbackContact: Contact | null;
  contactHistory: Contact[];
  dirQuery: string;
  dirFilter: string;
  favorites: string[];
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
  appSpaceTab: 'details' | 'screenpop';
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
  consultOpen: false,
  keypadOpen: false,
  dtmf: '',
  callbackContact: null,
  contactHistory: [],
  dirQuery: '',
  dirFilter: 'All',
  favorites: [],
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
