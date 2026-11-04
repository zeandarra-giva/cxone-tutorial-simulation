import { useEffect, useMemo, useState } from 'react';
import { Zap, X, Crosshair, Trophy } from 'lucide-react';
import { useSim } from '../store';
import { award, getProgress, updateProgress } from './progress';
import { stageBox, tsel, useRect } from './common';
import { uiScale } from '../scale';

type Q =
  | { kind: 'find'; q: string; sel: string; explain: string }
  | { kind: 'mcq'; q: string; options: string[]; answer: number; explain: string };

const BANK: Q[] = [
  { kind: 'find', q: 'Where do you connect your audio (the agent leg)?', sel: tsel('ws-agent-leg'), explain: 'The link icon in the top bar. Crossed out means disconnected.' },
  { kind: 'find', q: 'Click where you would change your status to a break.', sel: tsel('ws-presence'), explain: 'Your status bar, top right.' },
  { kind: 'find', q: 'Where do you start a brand-new outbound call?', sel: tsel('ws-outbound'), explain: 'The start another action icon (New Outbound) above the Interactions panel. The Directory in the left menu works too.' },
  { kind: 'find', q: "Where would you check a colleague's availability?", sel: tsel('ws-rail-directory'), explain: 'Directory shows agents, skills and teams with live states.' },
  { kind: 'find', q: 'Where can you see how many calls are waiting?', sel: tsel('ws-rail-queue'), explain: 'Queue opens the Queue Counter.' },
  { kind: 'find', q: 'Where do you see your shift and commitments?', sel: tsel('ws-rail-schedule'), explain: 'Schedule.' },
  { kind: 'find', q: 'Where do you check how long you were Available today?', sel: tsel('ws-rail-reporting'), explain: 'Reporting → Productivity.' },
  { kind: 'find', q: 'Where would you report a problem with your softphone?', sel: tsel('ws-rail-settings'), explain: 'Settings → Report Issue.' },
  { kind: 'find', q: 'Where will a ringing call appear?', sel: tsel('ws-assign'), explain: 'The Interactions panel is your live work queue.' },
  { kind: 'find', q: 'Where do you find a caller you spoke to yesterday?', sel: tsel('ws-rail-history'), explain: 'Contact History keeps about 3 days.' },
  { kind: 'mcq', q: "You're working a ServiceNow ticket off the phone. Which status fits best?", options: ['Available', 'Busy - SNOW - IAM', 'Away - Personal Reason', 'Call Wrap Up'], answer: 1, explain: 'Use the busy code that matches the task so reporting and adherence stay accurate.' },
  { kind: 'mcq', q: 'A caller is about to read out a PIN. What should you do?', options: ['Hold', 'Mute', 'Mask', 'Record'], answer: 2, explain: 'Mask covers the recording with white noise while sensitive details are spoken.' },
  { kind: 'mcq', q: "The Hang Up button won't work. What's the most likely reason?", options: ['Agent leg disconnected', 'Masking is still on', 'You are on hold', 'Recording is on'], answer: 1, explain: "You can't end a call while it is masked. Unmask first." },
  { kind: 'mcq', q: 'After you hang up, what must you complete before the next contact?', options: ['The Outcome (disposition)', 'A Report Issue form', 'A commitment', 'A Directory favorite'], answer: 0, explain: 'The Outcome panel closes the contact. Pick a disposition and Save & Close.' },
  { kind: 'mcq', q: 'The Agent Workspace window reloads while you are Available. What is your state afterwards?', options: ['Available', 'Unavailable', 'Logged Out', 'Working'], answer: 1, explain: 'A reload sets you back to Unavailable. Go Available again.' },
  { kind: 'mcq', q: 'What happens if you Reject an incoming call?', options: ['Nothing changes', 'You go Unavailable (Refused) and the call goes to someone else', 'You are logged out', 'The call goes to voicemail'], answer: 1, explain: 'Rejecting or missing a call puts you in Refused. Set yourself Available again.' },
  { kind: 'mcq', q: 'A customer says: "Can you call me back at 3 PM?" Best tool?', options: ['A commitment in Schedule', 'Add them as a favorite', 'Report Issue', 'Put them on hold until 3'], answer: 0, explain: 'A commitment pops into your Interactions panel at the time you set.' },
  { kind: 'mcq', q: 'Which voice connection do most agents choose at launch?', options: ['Set Phone Number', 'Set Station ID', 'Integrated Softphone'], answer: 2, explain: 'Integrated Softphone runs calls through your headset in the browser.' },
  { kind: 'mcq', q: 'Where do you see your connection lag time?', options: ['Settings → Information', 'Reporting', 'Directory', 'Queue Counter'], answer: 0, explain: 'Green is good. Support may ask for details from that tab.' },
  { kind: 'mcq', q: "You use a hard phone and your voice isn't connected. A call is offered. What happens?", options: ['Your hard phone rings first to establish the voice connection', 'The call is rejected automatically', 'The call goes to voicemail', 'Agent Workspace switches to the softphone'], answer: 0, explain: 'Answer the hard phone to connect your voice, then the call is delivered.' },
  { kind: 'mcq', q: 'A ringing call card says "Unknown". Why?', options: ["The caller's number isn't a saved contact", 'The caller hid their number', 'The call came from another agent', 'The skill is not set up'], answer: 0, explain: 'Saved contacts show their name. Any other number shows Unknown.' },
  { kind: 'mcq', q: 'With Auto Accept turned on…', options: ['Calls connect without clicking Accept', 'Calls are rejected', 'Dispositions are picked for you', 'You are logged out after each call'], answer: 0, explain: 'Only use it if your team lead tells you to.' },
  { kind: 'mcq', q: 'How should you end your shift?', options: ['Close the browser window', 'Log Out from the status menu', 'Go Unavailable', 'Disconnect the agent leg'], answer: 1, explain: 'Closing the window is not the same as logging out.' },
  { kind: 'mcq', q: 'A caller dialed the wrong company. Which disposition?', options: ['Resolved - First Contact', 'Wrong Number', 'Escalated to L2', 'No Answer / Voicemail'], answer: 1, explain: 'Accurate dispositions keep reporting honest.' },
  { kind: 'mcq', q: 'You need to place an outbound call. What do you need?', options: ['An outbound voice skill', 'Auto Accept on', 'A commitment', 'Supervisor approval'], answer: 0, explain: 'Outbound calls go out through your outbound skill (yours ends in _Outbound).' },
  { kind: 'mcq', q: 'Who decides which web pages pop into your App Space as screen pops?', options: ['You, in Settings', 'Your system administrator', 'The caller', 'Your team lead, during the call'], answer: 1, explain: 'Screen pops are configured by system administrators. You use them; you don’t set them up.' },
  { kind: 'mcq', q: 'You want the screen pop on your second monitor. What do you do?', options: ['Click Pop Out, then move that window', 'Take a screenshot', 'Hang up and reopen it', 'Ask the caller to email it'], answer: 0, explain: 'Pop Out opens it in its own window. Pop In brings it back to the App Space.' },
  { kind: 'mcq', q: 'You started recording a call. How do you pause it while the caller reads out card details?', options: ['Click Record again', 'Click Mask, then Unmask afterwards', 'Put the caller on hold', 'Hang up and call back'], answer: 1, explain: 'Mask pauses the recording. Unmask continues it. Record is greyed out once started.' },
  { kind: 'mcq', q: 'You consulted a colleague and want all three of you on one call. What do you click?', options: ['Transfer (⇄)', 'Hang Up', 'Conference (≫)', 'Keypad'], answer: 2, explain: 'Conference merges the consult and the caller into one call.' },
  { kind: 'mcq', q: 'What is a blind (direct) transfer?', options: ['You talk to the receiving party first', 'The call goes straight to the other party without you speaking to them', 'The caller is put on hold forever', 'The call is recorded'], answer: 1, explain: 'In a warm (consultative) transfer you speak to them first.' },
  { kind: 'mcq', q: 'You are in a conference and want to drop off, leaving the caller and your colleague talking. Which option?', options: ['End Call', 'Leave', 'Mask', 'Hold'], answer: 1, explain: 'Leave keeps the others connected. End Call ends it for everyone.' },
  { kind: 'mcq', q: 'You type an external number in the Directory to consult. What does CXone ask you?', options: ['The caller’s email', 'Which outbound skill to use', 'A disposition', 'Your password'], answer: 1, explain: 'External consults and transfers go out on the outbound skill you select.' },
  { kind: 'mcq', q: "A colleague's call card has more buttons than yours. Why?", options: ['Their app is newer', 'Only controls assigned to you appear', 'You need to restart', 'Your agent leg is off'], answer: 1, explain: 'Administrators assign phone controls per agent or team.' },
  { kind: 'mcq', q: 'A digital interaction opens in the agent canvas. What are its two panels?', options: ['Interaction space and App Space', 'Directory and Schedule', 'Outcome and Reporting', 'Queue and WEM'], answer: 0, explain: 'You can drag the divider between them to resize.' },
  { kind: 'mcq', q: 'Which channel gives you a rich text editor (bold, colors, tables) for your reply?', options: ['Webchat', 'Email', 'SMS', 'All of them'], answer: 1, explain: 'Except for email, agent responses are plain text.' },
  { kind: 'mcq', q: 'A webchat card shows Accept and Reject. Why?', options: ['It is broken', 'The channel is set to manual accept', 'You are Unavailable', 'It is an email'], answer: 1, explain: 'Digital interactions can be set to auto-accept or to need manual acceptance.' },
  { kind: 'mcq', q: 'Who sets up the templated responses in the quick reply app?', options: ['The customer', 'Your administrator', 'Each agent, in Settings', 'Nobody, they are fixed'], answer: 1, explain: 'Quick replies are configured. You can search them and star favorites.' },
  { kind: 'mcq', q: 'You sent a drafted reply for approval and the reviewer denied it. What happens?', options: ['The chat is closed', 'The draft is returned to you to adjust and try again', 'It is sent anyway', 'You are logged out'], answer: 1, explain: 'If approved, it is sent immediately. If denied, it comes back to you.' },
  { kind: 'mcq', q: 'You chose a review queue and clicked Request Approval. What happens to the interaction?', options: ['It stays in your inbox while you wait', 'It leaves your inbox and goes to the reviewer’s inbox', 'It is sent to the customer straight away', 'It is closed with an outcome'], answer: 1, explain: 'It comes back to you only if the reviewer denies it. If they approve, it is sent immediately.' },
  { kind: 'mcq', q: 'Your Send button reads Request Approval and you can’t send directly. Which permission do you have?', options: ['Send directly', 'Approval only', 'Both', 'None'], answer: 1, explain: 'With approval only, every response goes to a reviewer first. With both, Send Message has an arrow to optionally request approval.' },
  { kind: 'mcq', q: 'How do you transfer a webchat to another skill?', options: ['Hang Up and ask the customer to chat again', 'Consult / Transfer on the inbox tile, search the Directory, click Transfer next to the skill', 'Send it for approval', 'Close it with the Transferred outcome'], answer: 1, explain: 'You see "Digital skill transferred successfully" and it leaves your inbox.' },
  { kind: 'mcq', q: 'After you reply to a chat, its status changes to…', options: ['Resolved', 'Pending', 'New', 'Closed'], answer: 1, explain: 'Pending while you wait for the customer. It changes to Open when they answer.' },
  { kind: 'mcq', q: 'How do you use a quick reply?', options: ['Copy it from a document', 'Select it in the ⚡ tab and click Insert, then edit if needed', 'Ask your team lead', 'Type its name in the chat'], answer: 1, explain: 'Custom fields like the contact’s name are filled in for you.' },
  { kind: 'mcq', q: 'A quick reply reads "Hi {{customer.firstName}}". What happens to {{customer.firstName}} when you insert it?', options: ['It is sent exactly as typed', 'It is filled in with the contact’s first name', 'You must delete it first', 'It becomes a link'], answer: 1, explain: 'Custom fields in double braces are filled in with values such as the contact’s name and yours.' },
  { kind: 'mcq', q: 'You inserted a quick reply. When is it sent to the customer?', options: ['As soon as you click Insert', 'When you click Send Message, after any edits', 'After the reviewer reads it', 'When the chat closes'], answer: 1, explain: 'Insert only places it in your message box. Edit it if needed, then Send Message.' },
  { kind: 'mcq', q: 'How do you make a quick reply appear on the Favorites tab?', options: ['Use it three times', 'Click the star next to it', 'Ask your administrator', 'Drag it to the top'], answer: 1, explain: 'Starred replies are listed on the Favorites tab. Click the star again to remove it.' },
  { kind: 'mcq', q: 'Why might your Send Message button look different from a colleague’s?', options: ['Their browser is newer', 'It depends on your permissions: send only, approval only, or both', 'You have too many favorites', 'You are on a different channel'], answer: 1, explain: 'There are 3 variations: send directly, request approval from a reviewer, or both.' },
  { kind: 'mcq', q: 'In Contact History, what does ↑ next to a skill mean?', options: ['Inbound', 'Outbound', 'Missed', 'Transferred'], answer: 1, explain: '↑ outbound, ↓ inbound.' },
];

const ROUND = 10, SECS = 20;
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

export function QuizRunner({ onExit }: { onExit: () => void }) {
  const { set } = useSim();
  const [seed, setSeed] = useState(0);
  const qs = useMemo(() => {
    const finds = shuffle(BANK.filter((q) => q.kind === 'find')).slice(0, 4);
    const mcqs = shuffle(BANK.filter((q) => q.kind === 'mcq')).slice(0, ROUND - 4);
    return shuffle([...finds, ...mcqs]);
  }, [seed]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [left, setLeft] = useState(SECS);
  const [result, setResult] = useState<{ ok: boolean; picked?: number; pts: number } | null>(null);
  const [done, setDone] = useState(false);
  const q = qs[i];

  useEffect(() => { set({ statusMenuOpen: false, customizeOpen: false, notifOpen: false, extPromptOpen: false, callbackContact: null, skillPrompt: null }); }, []);
  useEffect(() => {
    if (result || done) return;
    if (left <= 0) { answer(false); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result, done]);

  function answer(ok: boolean, picked?: number) {
    if (result) return;
    const mult = 1 + Math.min(streak, 5) * 0.1;
    const pts = ok ? Math.round((100 + left * 2.5) * mult) : 0;
    setResult({ ok, picked, pts });
    if (ok) { setScore((x) => x + pts); setCorrect((x) => x + 1); setStreak((x) => x + 1); } else setStreak(0);
  }
  function next() {
    if (i + 1 >= qs.length) {
      const c = correct;
      const pct = Math.round((c / qs.length) * 100);
      setDone(true);
      const prev = getProgress().quizBest;
      updateProgress((p) => ({ ...p, quizBest: Math.max(p.quizBest, pct) }));
      award(Math.round(score / 20), `Quiz round (${pct}%)`, pct === 100 ? 'quiz-100' : pct >= 80 ? 'quiz-80' : undefined);
      if (pct === 100) award(0, '', 'quiz-80');
      if (pct > prev && prev > 0) award(20, 'New personal best');
      return;
    }
    setI(i + 1); setLeft(SECS); setResult(null);
  }
  const restart = () => { setSeed(seed + 1); setI(0); setScore(0); setCorrect(0); setStreak(0); setLeft(SECS); setResult(null); setDone(false); };

  if (done) {
    const pct = Math.round((correct / qs.length) * 100);
    return (
      <div className="quiz-scrim">
        <div className="quiz-card result">
          <Trophy size={40} className="quiz-trophy" />
          <div className="quiz-big">{pct}%</div>
          <div>{correct} of {qs.length} correct · {score} points</div>
          <div className="muted small">Best: {Math.max(getProgress().quizBest, pct)}%</div>
          <div className="mc-btns center">
            <button className="tour-btn ghost" onClick={onExit}>Close</button>
            <button className="tour-btn" onClick={restart}>Play again</button>
          </div>
        </div>
      </div>
    );
  }

  const head = (
    <div className="quiz-head">
      <span><Zap size={14} /> Quiz · {i + 1}/{qs.length}</span>
      <span>🔥 {streak}</span>
      <span>{score} pts</span>
      <span className={'quiz-timer' + (left <= 5 ? ' low' : '')}>{left}s</span>
      <button onClick={onExit} aria-label="Exit quiz"><X size={15} /></button>
    </div>
  );

  if (q.kind === 'find') return <FindQuestion key={i} q={q} head={head} result={result} onAnswer={answer} onNext={next} />;
  return (
    <div className="quiz-scrim">
      <div className="quiz-card">
        {head}
        <div className="quiz-q">{q.q}</div>
        <div className="quiz-opts">
          {q.options.map((o, k) => (
            <button key={k} disabled={!!result}
              className={'quiz-opt' + (result ? (k === q.answer ? ' right' : k === result.picked ? ' wrong' : '') : '')}
              onClick={() => answer(k === q.answer, k)}>{o}</button>
          ))}
        </div>
        {result && <Feedback ok={result.ok} pts={result.pts} explain={q.explain} onNext={next} last={i + 1 >= qs.length} />}
      </div>
    </div>
  );
}

function FindQuestion({ q, head, result, onAnswer, onNext }: { q: Extract<Q, { kind: 'find' }>; head: React.ReactNode; result: { ok: boolean; pts: number } | null; onAnswer: (ok: boolean) => void; onNext: () => void }) {
  const r = useRect(q.sel);
  const [click, setClick] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <div className="find-catch" style={{ cursor: result ? 'default' : 'crosshair' }} onClick={(e) => {
        if (result || !r) return;
        const o = stageBox();
        const cx = e.clientX / uiScale() - o.x, cy = e.clientY / uiScale() - o.y;
        setClick({ x: cx, y: cy });
        const pad = 8;
        onAnswer(cx >= r.left - pad && cx <= r.left + r.width + pad && cy >= r.top - pad && cy <= r.top + r.height + pad);
      }} />
      {click && <div className={'find-click ' + (result?.ok ? 'ok' : 'bad')} style={{ left: click.x - 12, top: click.y - 12 }} />}
      {result && r && <div className="find-answer" style={{ top: r.top - 5, left: r.left - 5, width: r.width + 10, height: r.height + 10 }} />}
      <div className="find-banner">
        {head}
        <div className="quiz-q"><Crosshair size={16} /> {q.q}</div>
        {!result && <div className="muted small">Click the right spot on the screen.</div>}
        {result && <Feedback ok={result.ok} pts={result.pts} explain={q.explain} onNext={onNext} />}
      </div>
    </>
  );
}

function Feedback({ ok, pts, explain, onNext, last }: { ok: boolean; pts: number; explain: string; onNext: () => void; last?: boolean }) {
  return (
    <div className={'quiz-fb ' + (ok ? 'ok' : 'bad')}>
      <b>{ok ? `Correct! +${pts}` : 'Not quite'}</b> {explain}
      <button className="tour-btn" onClick={onNext} autoFocus>{last ? 'See results' : 'Next →'}</button>
    </div>
  );
}
