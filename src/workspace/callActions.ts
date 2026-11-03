import { statusPatch, type Call, type SimState, type Stats } from '../store';
import { OUTBOUND_SKILL } from './wsData';
import type { Contact } from '../data/data';
import { SCENARIOS, scenarioById } from '../training/scenarios';

const uid = () => Math.random().toString(36).slice(2, 9);
const blankCall = (p: Partial<Call>): Call => ({
  id: uid(), number: '', skill: OUTBOUND_SKILL, direction: 'out', phase: 'dialing', start: Date.now(),
  onHold: false, muted: false, masked: false, recording: true, ...p,
});
const bump = (s: SimState, p: Partial<Stats>): Partial<SimState> => ({ stats: { ...s.stats, ...p } });

export const fmtDur = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
};
export const fmtTimer = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};
export const historyDate = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Begin an outbound call (after skill chosen). Agent leg connects automatically. */
export function startOutbound(s: SimState, number: string, name?: string, skill = OUTBOUND_SKILL, scenario?: string): Partial<SimState> {
  if (s.call || s.wrap) return {};
  return {
    ...statusPatch(s, 'Working'),
    statusBeforeCall: s.agentStatus,
    agentLeg: true,
    call: blankCall({ number, name, skill, direction: 'out', phase: 'dialing', scenario }),
    callView: true, skillPrompt: null, statusMenuOpen: false, callbackContact: null, dirQuery: '',
    ...bump(s, { outboundPlaced: s.stats.outboundPlaced + 1, lastDialed: number }),
  };
}

/** Ring an inbound call. `which` = scenario id or index. */
export function ringInbound(s: SimState, which: string | number = 0): Partial<SimState> {
  if (s.call || s.wrap) return {};
  const sc = typeof which === 'string' ? scenarioById(which) ?? SCENARIOS[0] : SCENARIOS[which % SCENARIOS.length];
  // saved contacts show their name on the call; unsaved numbers show "Unknown"
  const call = blankCall({ number: sc.number, skill: sc.skill, direction: 'in', phase: 'ringing', scenario: sc.id, name: sc.saved ? sc.name : undefined });
  if (s.prefs.autoAccept) return accept({ ...s, call });
  return { call, agentLeg: true, statusBeforeCall: s.agentStatus };
}

export function accept(s: SimState): Partial<SimState> {
  if (!s.call) return {};
  const now = Date.now();
  return {
    ...statusPatch(s, 'Working'),
    call: { ...s.call, phase: 'active', start: now, connectedAt: now }, callView: true, agentLeg: true,
    ...bump(s, { inboundAccepted: s.stats.inboundAccepted + 1, answerTimes: [...s.stats.answerTimes, now - s.call.start] }),
  };
}

export function reject(s: SimState): Partial<SimState> {
  return { ...statusPatch(s, 'Refused'), call: null, callView: false, ...bump(s, { refused: s.stats.refused + 1 }) };
}

export function hangUp(s: SimState): Partial<SimState> {
  if (!s.call || s.call.masked) return {};
  return {
    ...statusPatch(s, 'Wrap Up'),
    wrap: { call: s.call, endedAt: Date.now(), disposition: '', notes: '', tags: [] },
    call: null, callView: true, keypadOpen: false, consultOpen: false, dtmf: '',
  };
}

/** Transfer: the call leaves the agent and goes to wrap-up. */
export const transferCall = (s: SimState) => ({
  ...hangUp({ ...s, call: s.call ? { ...s.call, masked: false } : null }),
  ...bump(s, { transfers: s.stats.transfers + 1 }),
});

export function saveOutcome(s: SimState, redial = false): Partial<SimState> {
  if (!s.wrap) return {};
  const c = s.wrap.call;
  const entry: Contact = {
    id: c.id, number: c.number, skill: c.skill, outbound: c.direction === 'out', date: historyDate(),
    duration: fmtDur(s.wrap.endedAt - (c.connectedAt ?? s.wrap.endedAt)),
  };
  const stats = bump(s, {
    handled: s.stats.handled + 1,
    handledLog: [...s.stats.handledLog, { number: c.number, direction: c.direction, scenario: c.scenario, disposition: s.wrap.disposition, notes: s.wrap.notes, everHeld: !!c.everHeld, everMasked: !!c.everMasked, at: Date.now() }],
  });
  const back = s.statusBeforeCall === 'Available' || c.direction === 'in' ? 'Available' : s.statusBeforeCall;
  const base: Partial<SimState> = { wrap: null, callView: false, contactHistory: [entry, ...s.contactHistory], ...stats };
  if (redial) return { ...base, skillPrompt: { number: c.number, name: c.name } };
  return { ...base, ...statusPatch(s, back === 'Working' || back === 'Wrap Up' ? 'Unavailable' : back) };
}
