// Fictional IT service-desk callers used by Missions, Story mode and the Shift Simulator.
// Each one has a "correct" disposition that the transcript hints at.
import { INBOUND_SKILL } from '../workspace/wsData';

export interface Line { who: 'customer' | 'agent'; text: string }
export interface Scenario {
  id: string; name: string; number: string; skill: string; issue: string; expected: string; lines: Line[];
  /** saved as a contact: the call card shows the name. Unsaved numbers show "Unknown". */
  saved?: boolean;
  /** channels saved for this customer (shown in the Channels section during a call) */
  channels?: { type: 'Phone' | 'Email' | 'Chat'; value: string }[];
  /** CRM records that match this customer (shown in Related Interactions) */
  related?: CrmRecord[];
}

export interface CrmRecord { type: 'Case' | 'Task' | 'Contact'; id: string; subject: string; status: string; date?: string }

export const SCENARIOS: Scenario[] = [
  {
    id: 'lockout', saved: true, name: 'Priya Natarajan', number: '+15555550123',
    channels: [{ type: 'Phone', value: '+15555550123' }, { type: 'Email', value: 'priya.natarajan@example.com' }],
    related: [{ type: 'Contact', id: '003Ke00000PN2231', subject: 'Priya Natarajan · Finance', status: 'Active' }, { type: 'Case', id: '00001842', subject: 'Password expired, cannot sign in', status: 'Closed', date: '2 days ago' }],
    skill: INBOUND_SKILL, issue: 'Locked out after password expiry', expected: 'Password Reset',
    lines: [
      { who: 'customer', text: "Hi, this is Priya from Treasury Ops. My password expired over the weekend and now it says my account is locked." },
      { who: 'customer', text: "I've got a payments cut-off in an hour, so I really need to get back in." },
      { who: 'customer', text: "Okay, I can see the reset email now. Logging in… yes, I'm in. Thank you so much!" },
    ],
  },
  {
    id: 'access', name: 'Marcus Webb', number: '+442075550199', skill: INBOUND_SKILL, issue: 'Needs access to a shared drive', expected: 'Access Request Raised',
    lines: [
      { who: 'customer', text: "Hello, Marcus here. I moved to the Risk team last week and I can't open the team's shared drive." },
      { who: 'customer', text: "My manager already approved it on email. Can you put the request in for me?" },
      { who: 'customer', text: "Great, so I'll get a ticket number by email? Perfect, cheers." },
    ],
  },
  {
    id: 'vpn', saved: true, name: 'Hana Kobayashi', number: '+6325550111',
    channels: [{ type: 'Phone', value: '+6325550111' }, { type: 'Email', value: 'hana.kobayashi@example.com' }, { type: 'Chat', value: 'hana.k (Teams)' }],
    related: [{ type: 'Contact', id: '003Ke00000HK7710', subject: 'Hana Kobayashi · Markets Ops', status: 'Active' }, { type: 'Case', id: '00001907', subject: 'Hardware token re-issued', status: 'Closed', date: 'Yesterday' }],
    skill: INBOUND_SKILL, issue: 'VPN fails after token reset', expected: 'Escalated to L2',
    lines: [
      { who: 'customer', text: "Hi, I reset my soft token this morning and now the VPN keeps failing with error 809." },
      { who: 'customer', text: "I've already restarted twice and reinstalled the client. Still the same." },
      { who: 'customer', text: "So you'll pass this to the network team? Okay, I'll wait for their call." },
    ],
  },
  {
    id: 'wrong', name: 'Unknown caller', number: '+15555550190', skill: INBOUND_SKILL, issue: 'Wrong number', expected: 'Wrong Number',
    lines: [
      { who: 'customer', text: "Hi, is this the pizza place on Fifth Street? I'd like to order a large margherita." },
      { who: 'customer', text: "Oh, this is a service desk? Sorry, wrong number!" },
    ],
  },
  {
    id: 'callback', saved: true, name: 'Daniel Okafor', number: '+15555550161',
    channels: [{ type: 'Phone', value: '+15555550161' }, { type: 'Email', value: 'daniel.okafor@example.com' }],
    related: [{ type: 'Contact', id: '003Ke00000DO4419', subject: 'Daniel Okafor · Treasury', status: 'Active' }],
    skill: INBOUND_SKILL, issue: 'Wants a call back later', expected: 'Callback Required',
    lines: [
      { who: 'customer', text: "Hi, Daniel here. I need help moving my MFA to a new phone, but I'm walking into a meeting." },
      { who: 'customer', text: "Could someone call me back at three this afternoon instead?" },
    ],
  },
  {
    id: 'howto', name: 'Sofia Reyes', number: '+15555550177', skill: INBOUND_SKILL, issue: 'How-to question, solved on the call', expected: 'Resolved - First Contact',
    lines: [
      { who: 'customer', text: "Quick one: how do I set my out-of-office in the new mail client?" },
      { who: 'customer', text: "Settings, then Automatic replies… found it. That's all I needed, thanks!" },
    ],
  },
];

export const scenarioById = (id?: string) => SCENARIOS.find((s) => s.id === id);
