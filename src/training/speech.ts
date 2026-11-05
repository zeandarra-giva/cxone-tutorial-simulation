// Text-to-speech via the browser's built-in Web Speech API (free, offline, no external service).
// Quality depends on the voices installed: we rank them and prefer the natural / neural ones
// (Edge "Natural", macOS "Premium"/"Enhanced", Chrome "Google" voices) over the old robotic ones.
import { getProgress } from './progress';

export type Speaker = 'narrator' | 'customer' | 'supervisor' | 'agent';
const VOICE: Record<Speaker, { pitch: number; rate: number; pick: RegExp }> = {
  narrator: { pitch: 1, rate: 0.96, pick: /(Ava|Jenny|Aria|Samantha|Zoe|Allison|Emma|Google US English|Female)/i },
  customer: { pitch: 1.05, rate: 1.02, pick: /(Guy|Ryan|Daniel|Evan|Tom|Google UK English Male|Male)/i },
  supervisor: { pitch: 0.95, rate: 0.97, pick: /(Libby|Sonia|Serena|Kate|Google UK English Female)/i },
  agent: { pitch: 1, rate: 1, pick: /(Karen|Moira|Tessa|Natasha)/i },
};

/** the trainee's chosen speaking speed, kept within what browsers handle well */
export const SPEECH_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const userRate = () => { const r = Number(getProgress().speechRate); return r >= 0.5 && r <= 2 ? r : 1; };

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Higher = sounds more human and starts speaking without delay. */
function quality(v: SpeechSynthesisVoice) {
  const n = v.name;
  let q = 0;
  if (/natural|neural|premium|enhanced|wavenet|studio/i.test(n)) q += 10;
  // network voices (Chrome's "Google …", Edge's "… Online") are synthesised on a server and start ½–2 s late,
  // so the narration trails the spotlight. Prefer voices installed on the computer, which start at once.
  if (!v.localService) q -= 6;
  if (/^Google/i.test(n)) q += 5;
  if (/en[-_]US/i.test(v.lang)) q += 2;
  if (/compact|espeak|robot|novelty|bells|bubbles|zarvox|trinoids|whisper|bad news|good news|cellos|organ|boing|jester|superstar|wobble|albert|bahh|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i.test(n)) q -= 20;
  return q;
}

export function englishVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en')).sort((a, b) => quality(b) - quality(a));
}

function voiceFor(sp: Speaker) {
  const all = englishVoices().filter((v) => quality(v) > -10);
  if (sp === 'narrator') {
    const chosen = getProgress().narratorVoice;
    const v = chosen && all.find((x) => x.name === chosen);
    if (v) return v;
  }
  const best = all[0] ? quality(all[0]) : 0;
  // among the most natural voices, prefer one that suits the speaker
  const good = all.filter((v) => quality(v) >= best - 3);
  return good.find((v) => VOICE[sp].pick.test(v.name)) ?? all.find((v) => VOICE[sp].pick.test(v.name)) ?? all[sp === 'customer' ? 1 : 0] ?? null;
}

// voices load asynchronously in most browsers
if (speechSupported()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => window.dispatchEvent(new CustomEvent('voices-changed')));
}

/** Make written UI text sound like speech. */
function humanize(text: string) {
  return text
    .replace(/\s+/g, ' ')
    // say the product name letter by letter, "C X one", not "see-zone"
    .replace(/\bCX[\s-]?one\b/gi, 'C X one')
    .replace(/\be\.g\./gi, 'for example')
    .replace(/\bi\.e\./gi, 'that is')
    .replace(/\s+\/\s+/g, ' or ')
    .replace(/\s*·\s*/g, ', ')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\+/g, ' plus ')
    .replace(/\bSHIFT\b/g, 'Shift').replace(/\bALT\b/g, 'Alt')
    .trim();
}

/** Split into sentences so the voice pauses naturally (also avoids Chrome cutting long utterances off). */
function sentences(text: string) {
  const parts = (text.match(/[^.!?:]+[.!?:]*(\s|$)/g) ?? [text]).map((t) => t.trim()).filter(Boolean);
  // every utterance has start-up latency, so join sentences into chunks of up to ~180 characters
  // the first chunk stays short so the voice starts as soon as the step shows
  const out: string[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && out.length > 1 && last.length + p.length < 180) out[out.length - 1] = `${last} ${p}`;
    else if (last && out.length === 1 && last.length + p.length < 40) out[0] = `${last} ${p}`;
    else out.push(p);
  }
  return out;
}

/* Captions: speak(..., { caption: true }) broadcasts the sentence being spoken ('speech-caption' event). */
let captionTimers: number[] = [];
let live: SpeechSynthesisUtterance[] = [];
const started = new WeakSet<SpeechSynthesisUtterance>();
let gen = 0;
let justCancelled = false;
function emitCaption(text: string | null) { window.dispatchEvent(new CustomEvent('speech-caption', { detail: text })); }
function clearCaptionTimers() { captionTimers.forEach((t) => clearTimeout(t)); captionTimers = []; }

/** Speak a line. Resolves when finished (or after a reading delay if voice is off / unsupported). */
export function speak(text: string, sp: Speaker = 'narrator', opts: { caption?: boolean } = {}): Promise<void> {
  const parts = sentences(humanize(text));
  if (!speechSupported() || !getProgress().voice) {
    // no audio: still show captions, one sentence at a time, at reading speed
    if (opts.caption) {
      clearCaptionTimers();
      let at = 0;
      parts.forEach((part) => { captionTimers.push(window.setTimeout(() => emitCaption(part), at)); at += (1200 + part.length * 55) / userRate(); });
      captionTimers.push(window.setTimeout(() => emitCaption(null), at));
    }
    return new Promise((r) => setTimeout(r, Math.min(6000, 900 + text.length * 45) / userRate()));
  }
  const myGen = gen;
  const rate = userRate();
  return new Promise((resolve) => {
    let done = false;
    // only clear captions if nothing newer has started speaking since
    const finish = () => { if (!done) { done = true; if (opts.caption && myGen === gen) emitCaption(null); resolve(); } };
    const v = voiceFor(sp);
    window.speechSynthesis.resume();
    const queue = () => parts.forEach((part, i) => {
      if (myGen !== gen) return finish(); // stopped before we started
      const u = new SpeechSynthesisUtterance(part);
      if (v) { u.voice = v; u.lang = v.lang; }
      // tiny natural variation so consecutive sentences don't sound stamped out
      u.pitch = VOICE[sp].pitch + (i % 2 ? -0.02 : 0.02);
      u.rate = Math.min(2, VOICE[sp].rate * rate);
      u.onstart = () => {
        // a sentence from an earlier step that starts late (online voices can lag) silences itself,
        // then the current step's sentences are queued again
        if (myGen !== gen) {
          const current = live.filter((x) => !started.has(x));
          window.speechSynthesis.cancel();
          current.forEach((x) => window.speechSynthesis.speak(x));
          return;
        }
        started.add(u);
        if (opts.caption) emitCaption(part);
      };
      if (i === parts.length - 1) {
        u.onend = () => { live = live.filter((x) => x !== u); finish(); };
        // 'interrupted' / 'canceled' come from cancel(); the safety net below still resolves
        u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') finish(); };
      }
      live.push(u); // Chrome stops mid-queue if utterances are garbage-collected: keep references
      window.speechSynthesis.speak(u);
    });
    // Chrome drops utterances queued right after cancel(): give it a moment
    if (justCancelled) { justCancelled = false; setTimeout(queue, 15); } else queue();
    setTimeout(finish, (2000 + text.length * 80) / rate); // safety net, longer when speaking slowly (some browsers never fire onend)
  });
}
export function stopSpeech() {
  gen += 1;
  clearCaptionTimers();
  emitCaption(null);
  const busy = speechSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending || live.length > 0);
  live = [];
  // cancel unconditionally: while an online voice is still loading, Chrome reports neither speaking nor pending
  if (speechSupported()) window.speechSynthesis.cancel();
  if (busy) justCancelled = true;
}
