import { statusPatch, type Call, type SimState, type Stats } from '../store';
import { OUTBOUND_SKILL } from './wsData';
import type { Contact } from '../data/data';
import { SCENARIOS, scenarioById } from '../training/scenarios';

const uid = () => Math.random().toString(36).slice(2, 9);
const blankCall = (p: Partial<Call>): Call => ({
  id: uid(), number: '', skill: OUTBOUND_SKILL, direction: 'out', phase: 'dialing', start: Date.now(),
  onHold: false, muted: false, masked: false, recording: false, screenRec: true, ...p,
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

/**
 * Ask to call a number (Voice Call in the Directory, Callback, Save & Redial).
 * One outbound skill: the call is placed straight away. Several: show the skill dropdown first.
 */
export function requestOutbound(s: SimState, number: string, name?: string): Partial<SimState> {
  if (s.call || s.wrap) return {};
  if (s.outboundSkills.length <= 1) return startOutbound(s, number, name, s.outboundSkills[0] ?? OUTBOUND_SKILL);
  return { skillPrompt: { number, name } };
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
    call: { ...s.call, phase: 'active', start: now, connectedAt: now }, callView: true, digitalView: false, agentLeg: true,
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
    wrap: { call: s.call, endedAt: Date.now(), disposition: s.call.outcome?.disposition ?? '', notes: s.call.outcome?.notes ?? '', tags: s.call.outcome?.tags ?? [] },
    call: null, callView: true, keypadOpen: false, consultOpen: false, outcomeOpen: false, dtmf: '',
  };
}


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
  if (redial) {
    const after = { ...s, ...base, wrap: null, call: null } as SimState;
    const out = requestOutbound(after, c.number, c.name);
    return { ...base, ...(out.call ? out : { ...out, ...statusPatch(s, 'Available') }) };
  }
  return { ...base, ...statusPatch(s, back === 'Working' || back === 'Wrap Up' ? 'Unavailable' : back) };
}

/* ---------- transfer / consult / conference ---------- */
type Party = NonNullable<Call['consult']>;

/**
 * The interaction leaves you without wrap-up: after a blind or warm transfer, or when you leave a conference.
 * The card shows "Interaction completed" and you go back to the state you were in before (normally Available).
 */
export function completeInteraction(s: SimState, how: string, transferred: boolean): Partial<SimState> {
  const c = s.call;
  if (!c) return {};
  const now = Date.now();
  const entry: Contact = { id: c.id, number: c.number, skill: c.skill, outbound: c.direction === 'out', date: historyDate(), duration: fmtDur(now - (c.connectedAt ?? now)) };
  const back = s.statusBeforeCall === 'Available' || c.direction === 'in' ? 'Available' : s.statusBeforeCall;
  return {
    ...statusPatch(s, back === 'Working' || back === 'Wrap Up' ? 'Available' : back),
    call: null, wrap: null, callView: false, keypadOpen: false, consultOpen: false, outcomeOpen: false, confMenuOpen: false, consultPick: null, dtmf: '',
    appSpaceTab: 'details', completedAt: now, contactHistory: [entry, ...s.contactHistory],
    ...bump(s, {
      handled: s.stats.handled + 1, transfers: s.stats.transfers + (transferred ? 1 : 0),
      handledLog: [...s.stats.handledLog, { number: c.number, direction: c.direction, scenario: c.scenario, disposition: how, notes: how, everHeld: !!c.everHeld, everMasked: !!c.everMasked, at: now }],
    }),
  };
}
/** Blind (direct) transfer: the caller goes straight to the other party. You don't talk to them first. */
export const blindTransfer = (s: SimState, to: string) => completeInteraction(s, `Transferred to ${to}`, true);
/** Warm transfer: hand the caller to the party you're consulting. */
export const warmTransfer = (s: SimState) => (s.call?.consult?.phase === 'active' ? completeInteraction(s, `Transferred to ${s.call.consult.name}`, true) : {});
/** kept for older callers (missions etc.): blind transfer to "the selected party" */
export const transferCall = (s: SimState) => blindTransfer(s, 'another party');

/** Consult another party: the caller goes on hold while you call them (warm / consultative transfer). */
export function startConsult(s: SimState, name: string, kind: Party['kind'], skill?: string): Partial<SimState> {
  if (!s.call || s.call.phase !== 'active' || s.call.consult) return {};
  return { call: { ...s.call, onHold: true, everHeld: true, consult: { name, kind, skill, phase: 'dialing', start: Date.now(), held: false } }, callView: true, appSpaceTab: 'consult', consultPick: null, consultOpen: false };
}
/** Swap: talk to the caller (consulted party goes on hold) or to the consulted party (caller on hold). */
export function swapTo(s: SimState, who: 'caller' | 'party'): Partial<SimState> {
  const c = s.call;
  if (!c?.consult || c.consult.phase !== 'active') return {};
  return { call: { ...c, onHold: who !== 'caller', consult: { ...c.consult, held: who === 'caller' } } };
}
/** Hang up the consulted party. The caller stays on hold until you resume them. */
export function endConsult(s: SimState): Partial<SimState> {
  if (!s.call?.consult) return {};
  const { consult: _c, ...rest } = s.call;
  return { call: rest, appSpaceTab: rest.conference?.length ? 'consult' : 'details' };
}
/** Conference: merge the consulted party into the call. Everyone can hear everyone. */
export function mergeConsult(s: SimState): Partial<SimState> {
  const c = s.call;
  if (!c?.consult || c.consult.phase !== 'active') return {};
  const { consult, ...rest } = c;
  return { call: { ...rest, onHold: false, conference: [...(c.conference ?? []), consult.name].slice(0, 6) }, appSpaceTab: 'consult' };
}
/** In a conference: hang up one party. Hanging up the caller ends the interaction for you (wrap-up). */
export function hangUpParty(s: SimState, name: string): Partial<SimState> {
  const c = s.call;
  if (!c?.conference) return {};
  if (name === (c.name ?? c.number)) return hangUp({ ...s, call: { ...c, masked: false } });
  const left = c.conference.filter((p) => p !== name);
  return { call: { ...c, conference: left.length ? left : undefined }, appSpaceTab: left.length ? 'consult' : 'details' };
}
/** Leave the conference: the others stay connected; your part of the interaction is complete. */
export const leaveConference = (s: SimState) => completeInteraction(s, 'Left conference', false);
/** End Call: ends the call for everyone and you go to wrap-up. */
export const endConference = (s: SimState) => ({ ...hangUp({ ...s, call: s.call ? { ...s.call, masked: false } : null }), confMenuOpen: false });

/** Record: starts voice (+ screen, if configured) recording. Once started it can't be started again. */
export function startRecording(s: SimState): Partial<SimState> {
  if (!s.call || s.call.recording) return {};
  return { call: { ...s.call, recording: true, everRecorded: true } };
}
/** Outcome fields during the call */
export function setCallOutcome(s: SimState, p: Partial<NonNullable<Call['outcome']>>): Partial<SimState> {
  if (!s.call) return {};
  return { call: { ...s.call, outcome: { disposition: '', notes: '', tags: [], ...s.call.outcome, ...p } } };
}
