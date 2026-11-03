import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward, RotateCcw, Volume2, VolumeX, Captions, X } from 'lucide-react';
import { useSim, statusPatch, type SimState, type Stats } from '../store';
import { ringInbound } from '../workspace/callActions';
import { SCENARIOS } from './scenarios';
import { speak, stopSpeech, type Speaker } from './speech';
import { award, getProgress, updateProgress } from './progress';
import { HintRing, tsel } from './common';

type P = Partial<SimState>;
interface Ctx { base: Stats }
interface Beat {
  who: Speaker;
  text: string;
  setup?: (s: SimState) => P;
  ring?: string; // scenario id to ring when this beat starts
  wait?: { objective: string; until: (s: SimState, c: Ctx) => boolean; hint?: string | ((s: SimState) => string) };
  /** shown/spoken (once) if this goes wrong while waiting */
  oops?: { when: (s: SimState, c: Ctx) => boolean; line: string; who?: Speaker; fix?: (s: SimState) => P; reRing?: string };
}
export interface Chapter { id: string; title: string; time: string; beats: Beat[] }

const lines = (id: string) => SCENARIOS.find((x) => x.id === id)!.lines;
const CLOSE: P = { extPromptOpen: false, statusMenuOpen: false, customizeOpen: false, notifOpen: false, callbackContact: null, skillPrompt: null, keypadOpen: false, consultOpen: false, scheduleMode: 'calendar' };
const live = (s: SimState): P => ({ ...CLOSE, call: null, wrap: null, callView: false, agentLeg: true, ...(s.agentStatus === 'Available' ? {} : statusPatch(s, 'Available')), wsPanel: 'history' });
const handled = (s: SimState, c: Ctx, sc?: string) => s.stats.handledLog.slice(c.base.handledLog.length).find((h) => !sc || h.scenario === sc);

export const CHAPTERS: Chapter[] = [
  {
    id: 'clock-in', title: 'Clocking in', time: '8:00 AM',
    beats: [
      { who: 'narrator', text: "It's eight on a Monday morning. You've just opened Agent Workspace for your first shift on the IAM service desk.", setup: (s) => ({ ...CLOSE, call: null, wrap: null, callView: false, agentLeg: false, ...statusPatch(s, 'Unavailable'), wsPanel: 'history' }) },
      { who: 'narrator', text: 'Before any call can reach you, CXone needs an audio connection, called the agent leg. Click the crossed-out link icon in the top bar.', wait: { objective: 'Connect your agent leg', until: (s) => s.agentLeg, hint: tsel('ws-agent-leg') } },
      { who: 'supervisor', text: "Morning, it's Tamas, your team lead. Once you're connected, set yourself Available so calls can find you.", wait: { objective: 'Go Available', until: (s) => s.agentStatus === 'Available', hint: tsel('ws-presence') } },
      { who: 'narrator', text: "Green badge, fresh timer. You're live." },
    ],
  },
  {
    id: 'lockout', title: 'The locked-out trader', time: '8:07 AM',
    beats: [
      { who: 'narrator', text: 'Your first call is coming in. Keep an eye on the Interactions panel on the left.', setup: live, ring: 'lockout' },
      {
        who: 'narrator', text: 'Accept the call.', wait: { objective: 'Accept the ringing call', until: (s) => !!s.call && s.call.phase === 'active', hint: tsel('ws-accept') },
        oops: { when: (s, c) => s.stats.refused > c.base.refused, who: 'supervisor', line: "Careful, rejecting a call puts you in Refused and the caller waits longer. I've set you back to Available. Here she is again.", fix: live, reRing: 'lockout' },
      },
      { who: 'customer', text: lines('lockout')[0].text },
      { who: 'customer', text: lines('lockout')[1].text },
      { who: 'narrator', text: "Tell her you'll check her account, then put her on Hold while you look.", wait: { objective: 'Put the caller on Hold', until: (s) => !!s.call?.onHold, hint: tsel('ws-vc-hold') } },
      { who: 'narrator', text: 'You find the account and send a reset link. Take her off hold.', wait: { objective: 'Resume the call', until: (s) => !!s.call && !s.call.onHold, hint: tsel('ws-vc-hold') } },
      { who: 'customer', text: lines('lockout')[2].text },
      { who: 'narrator', text: 'Problem solved. End the call with Hang Up.', wait: { objective: 'Hang Up', until: (s) => !!s.wrap, hint: tsel('ws-vc-hangup') } },
      {
        who: 'narrator', text: 'In the Outcome panel, pick the disposition that matches what you did. Add a short note, then Save and Close.',
        wait: { objective: 'Disposition, note, Save & Close', until: (s, c) => !!handled(s, c, 'lockout'), hint: (s) => (s.wrap?.disposition ? tsel('ws-save-close') : tsel('ws-disposition')) },
      },
      {
        who: 'supervisor', text: 'Nice first call. CXone put you back to Available automatically.',
        oops: { when: (s, c) => { const h = handled(s, c, 'lockout'); return !!h && h.disposition !== 'Password Reset'; }, who: 'supervisor', line: "One note: the disposition should have been Password Reset. Accurate outcomes keep our reports honest." },
      },
    ],
  },
  {
    id: 'promise', title: 'A promise to keep', time: '11:40 AM',
    beats: [
      { who: 'narrator', text: 'Late morning. Another call is ringing.', setup: live, ring: 'callback' },
      { who: 'narrator', text: 'Accept it.', wait: { objective: 'Accept the call', until: (s) => !!s.call && s.call.phase === 'active', hint: tsel('ws-accept') }, oops: { when: (s, c) => s.stats.refused > c.base.refused, line: 'That one was refused. Let us try again.', fix: live, reRing: 'callback' } },
      { who: 'customer', text: lines('callback')[0].text },
      { who: 'customer', text: lines('callback')[1].text },
      { who: 'narrator', text: 'He needs a call back at three. Hang up, and give the call the Callback Required disposition.', wait: { objective: 'Close the call as Callback Required', until: (s, c) => !!handled(s, c, 'callback'), hint: (s) => (s.wrap ? tsel('ws-disposition') : tsel('ws-vc-hangup')) } },
      {
        who: 'narrator', text: 'Now keep that promise. Open Schedule, choose Add, then Commitment, and book a call back for Daniel Okafor on plus one, five five five, five five five, zero one six one.',
        wait: { objective: 'Book a commitment for Daniel Okafor', until: (s) => s.commitments.some((k) => /daniel/i.test(k.first)), hint: (s) => (s.wsPanel !== 'schedule' ? tsel('ws-rail-schedule') : s.scheduleMode === 'add' ? tsel('ws-commit-save') : tsel('ws-sch-add')) },
      },
      { who: 'narrator', text: "Fast forward. It's three o'clock and the commitment appears in your Interactions panel. Click Proceed to call Daniel.", setup: (s) => ({ ...CLOSE, commitments: s.commitments.map((k) => (/daniel/i.test(k.first) ? { ...k, due: true } : k)) }), wait: { objective: 'Proceed with the commitment', until: (s) => !!s.call && s.call.direction === 'out', hint: tsel('ws-commit-proceed') } },
      { who: 'narrator', text: 'Daniel answers and you move his MFA to his new phone in two minutes. Hang up and save the outcome as Resolved, First Contact.', wait: { objective: 'Finish the call', until: (s, c) => s.stats.handledLog.length >= c.base.handledLog.length + 2, hint: (s) => (s.wrap ? tsel('ws-disposition') : tsel('ws-vc-hangup')) } },
      { who: 'supervisor', text: 'Promise kept. That is exactly how callbacks should work.' },
    ],
  },
  {
    id: 'break', title: 'Break time', time: '3:15 PM',
    beats: [
      { who: 'supervisor', text: 'Your break is scheduled for three fifteen. Use the correct break code so your adherence stays green.', setup: live, wait: { objective: 'Go on your 15 minute break', until: (s) => s.agentStatus.startsWith('Break'), hint: tsel('ws-presence') }, oops: { when: (s) => s.agentStatus.startsWith('Away'), line: 'Away codes are for unplanned time. Your break is planned, so pick a Break code.' } },
      { who: 'narrator', text: "Fifteen minutes later, you're back at your desk. Set yourself Available.", wait: { objective: 'Go Available', until: (s) => s.agentStatus === 'Available', hint: tsel('ws-presence') } },
    ],
  },
  {
    id: 'eos', title: 'End of shift', time: '5:00 PM',
    beats: [
      { who: 'narrator', text: 'Before you leave, check how your day went. Open Reporting.', setup: live, wait: { objective: 'Open Reporting', until: (s) => s.wsPanel === 'reporting', hint: tsel('ws-rail-reporting') } },
      { who: 'narrator', text: 'This shows your time Available, Working and Unavailable today, next to your team.' },
      { who: 'supervisor', text: "Great first day. Log out from your status menu. Don't just close the window.", wait: { objective: 'Log Out', until: (s) => s.agentStatus === 'Logged Out', hint: tsel('ws-presence') } },
      { who: 'narrator', text: "That's a wrap. See you tomorrow." },
    ],
  },
];

const WHO: Record<Speaker, { name: string; avatar: string }> = {
  narrator: { name: 'Narrator', avatar: '🎙️' },
  customer: { name: 'Caller', avatar: '📞' },
  supervisor: { name: 'Tamas · Team Lead', avatar: '🧑‍💼' },
  agent: { name: 'You', avatar: '🎧' },
};

export function StoryPlayer({ chapterIds, onExit }: { chapterIds: string[]; onExit: () => void }) {
  const { s, set } = useSim();
  const [ci, setCi] = useState(0);
  const [bi, setBi] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState<{ who: Speaker; text: string } | null>(null);
  const [voice, setVoice] = useState(getProgress().voice);
  const [captions, setCaptions] = useState(getProgress().captions);
  const [idleSince, setIdleSince] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const ctx = useRef<Ctx>({ base: s.stats });
  const oopsDone = useRef<string>('');
  const run = useRef(0);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const chapter = CHAPTERS.find((c) => c.id === chapterIds[ci])!;
  const beat = chapter?.beats[bi];

  useEffect(() => () => stopSpeech(), []);

  // play a beat
  useEffect(() => {
    if (!beat || paused || finished) return;
    const my = ++run.current;
    if (bi === 0) ctx.current = { base: s.stats };
    if (beat.setup) set((x) => beat.setup!(x));
    if (beat.ring) setTimeout(() => set((x) => ringInbound({ ...x, prefs: { ...x.prefs, autoAccept: false } }, beat.ring!)), 1200);
    setCaption({ who: beat.who, text: beat.text });
    setSpeaking(true);
    setIdleSince(Date.now());
    speak(beat.text, beat.who).then(() => {
      if (run.current !== my) return;
      setSpeaking(false);
      if (!beat.wait) setTimeout(() => run.current === my && advance(), 500);
    });
  }, [ci, bi, paused, finished]);

  // the trainee already did the action (even mid-sentence): move on straight away
  useEffect(() => {
    if (!beat?.wait || paused || finished || !speaking) return;
    if (beat.wait.until(s, ctx.current)) { stopSpeech(); run.current++; setSpeaking(false); advance(); }
  }, [s]);

  // waiting for the trainee
  useEffect(() => {
    if (!beat || paused || speaking || finished) return;
    if (beat.oops && oopsDone.current !== `${ci}.${bi}` && beat.oops.when(s, ctx.current)) {
      oopsDone.current = `${ci}.${bi}`;
      const o = beat.oops;
      setCaption({ who: o.who ?? 'supervisor', text: o.line });
      speak(o.line, o.who ?? 'supervisor');
      if (o.fix) set((x) => o.fix!(x));
      if (o.reRing) setTimeout(() => set((x) => ringInbound({ ...x, prefs: { ...x.prefs, autoAccept: false } }, o.reRing!)), 2500);
      setTimeout(() => { oopsDone.current = ''; }, 6000);
      if (!beat.wait) return;
    }
    if (beat.wait && beat.wait.until(s, ctx.current)) advance();
  }, [s, speaking, paused]);

  function advance() {
    if (bi + 1 < chapter.beats.length) { setBi(bi + 1); return; }
    // chapter complete
    const first = !getProgress().storyDone.includes(chapter.id);
    updateProgress((p) => ({ ...p, storyDone: [...new Set([...p.storyDone, chapter.id])] }));
    award(first ? 80 : 20, `Story: ${chapter.title}`, getProgress().storyDone.length >= CHAPTERS.length ? 'storyteller' : undefined);
    if (ci + 1 < chapterIds.length) { setCi(ci + 1); setBi(0); }
    else { setFinished(true); stopSpeech(); }
  }
  const replay = () => { stopSpeech(); const my = ++run.current; setPaused(false); setCaption({ who: beat.who, text: beat.text }); setSpeaking(true); speak(beat.text, beat.who).then(() => { if (run.current !== my) return; setSpeaking(false); if (!beat.wait) advance(); }); };
  const skip = () => { stopSpeech(); run.current++; setSpeaking(false); if (!beat.wait) advance(); };
  const togglePause = () => { if (!paused) stopSpeech(); setPaused(!paused); };
  const toggleVoice = () => { const v = !voice; setVoice(v); updateProgress((p) => ({ ...p, voice: v })); if (!v) stopSpeech(); };
  const toggleCaptions = () => { const v = !captions; setCaptions(v); updateProgress((p) => ({ ...p, captions: v })); };

  if (finished) {
    return (
      <div className="story-bar done">
        <div className="story-end">🎬 <b>Story complete!</b> {chapterIds.length > 1 ? 'You finished your first shift.' : `Chapter "${chapter.title}" done.`}</div>
        <button className="tour-btn" onClick={onExit}>Close</button>
      </div>
    );
  }
  const waiting = beat?.wait && !speaking;
  const hintSel = waiting && Date.now() - idleSince > 9000 && beat.wait!.hint ? (typeof beat.wait!.hint === 'function' ? beat.wait!.hint(s) : beat.wait!.hint) : undefined;

  return (
    <>
      {hintSel && <HintRing selector={hintSel} label="Here" />}
      <div className="story-bar">
        <div className="story-chapter">
          <span className="story-time">{chapter.time}</span> Chapter {CHAPTERS.findIndex((c) => c.id === chapter.id) + 1} · {chapter.title}
          <span className="story-dots">{chapter.beats.map((_, k) => <i key={k} className={k < bi ? 'd' : k === bi ? 'c' : ''} />)}</span>
        </div>
        <div className="story-main">
          <div className={'story-avatar ' + (caption?.who ?? 'narrator') + (speaking ? ' talking' : '')}>{WHO[caption?.who ?? 'narrator'].avatar}</div>
          <div className="story-text">
            <div className="story-who">{WHO[caption?.who ?? 'narrator'].name}{paused && ' · paused'}</div>
            {captions ? <div className="story-line">{caption?.text}</div> : <div className="story-line muted">{speaking ? 'Speaking…' : ' '}</div>}
            {waiting && <div className="story-obj">👉 Your move: <b>{beat.wait!.objective}</b></div>}
          </div>
        </div>
        <div className="story-ctrls">
          <button onClick={togglePause} title={paused ? 'Resume' : 'Pause'}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
          <button onClick={replay} title="Replay line"><RotateCcw size={16} /></button>
          <button onClick={skip} title="Skip line" disabled={!!waiting}><SkipForward size={16} /></button>
          <button onClick={toggleVoice} title={voice ? 'Mute voice' : 'Turn voice on'}>{voice ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
          <button onClick={toggleCaptions} title="Captions" className={captions ? 'on' : ''}><Captions size={16} /></button>
          <button onClick={() => { stopSpeech(); onExit(); }} title="Exit story"><X size={16} /></button>
        </div>
      </div>
    </>
  );
}

