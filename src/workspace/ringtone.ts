// Softphone ringtones, synthesized with the Web Audio API (no audio files, nothing downloaded).
// Each ringtone is one "cycle" of tones that repeats until the call is answered, rejected or missed.

interface Tone { at: number; dur: number; freqs: number[]; type?: OscillatorType; decay?: boolean }
interface Pattern { cycle: number; tones: Tone[] }

const PATTERNS: Record<string, Pattern> = {
  // Classic double ring
  'Ring 1': { cycle: 3, tones: [{ at: 0, dur: 0.4, freqs: [400, 450] }, { at: 0.6, dur: 0.4, freqs: [400, 450] }] },
  // Long single ring
  'Ring 2': { cycle: 4, tones: [{ at: 0, dur: 1.6, freqs: [440, 480] }] },
  // Digital chirp
  'Ring 3': {
    cycle: 2.2,
    tones: [0, 0.12, 0.24, 0.36, 0.48, 0.6].map((at, i) => ({ at, dur: 0.1, freqs: [i % 2 ? 1600 : 1300], type: 'square' as OscillatorType })),
  },
  // Soft marimba
  'Ring 4': {
    cycle: 2.4,
    tones: [523.25, 659.25, 783.99, 1046.5].map((f, i) => ({ at: i * 0.16, dur: 0.5, freqs: [f], decay: true })),
  },
};

let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function playCycle(c: AudioContext, out: GainNode, p: Pattern, start: number) {
  for (const t of p.tones) {
    const g = c.createGain();
    const t0 = start + t.at, t1 = t0 + t.dur;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1 / t.freqs.length, t0 + 0.01);
    if (t.decay) g.gain.exponentialRampToValueAtTime(0.001, t1);
    else { g.gain.setValueAtTime(1 / t.freqs.length, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1); }
    g.connect(out);
    for (const f of t.freqs) {
      const o = c.createOscillator();
      o.type = t.type ?? 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(t0);
      o.stop(t1 + 0.02);
    }
  }
}

/** Start ringing. Returns a function that stops it. `volume` is 0–100 (the Settings slider). */
export function startRinging(ringtone: string, volume: number, loop = true): () => void {
  const c = audio();
  if (!c || volume <= 0) return () => {};
  const p = PATTERNS[ringtone] ?? PATTERNS['Ring 1'];
  const out = c.createGain();
  out.gain.value = Math.min(1, volume / 100) * 0.22;
  out.connect(c.destination);
  let next = c.currentTime + 0.05;
  playCycle(c, out, p, next);
  next += p.cycle;
  // schedule cycles slightly ahead so the rhythm stays even
  const id = loop ? window.setInterval(() => {
    while (next < c.currentTime + 1) { playCycle(c, out, p, next); next += p.cycle; }
  }, 250) : 0;
  return () => {
    if (id) window.clearInterval(id);
    out.gain.cancelScheduledValues(c.currentTime);
    out.gain.setValueAtTime(out.gain.value, c.currentTime);
    out.gain.linearRampToValueAtTime(0, c.currentTime + 0.05);
    window.setTimeout(() => out.disconnect(), 150);
  };
}

/** Play one cycle of a ringtone (the ▶ button in Settings). */
export function previewRingtone(ringtone: string, volume: number) {
  const stop = startRinging(ringtone, volume, false);
  window.setTimeout(stop, ((PATTERNS[ringtone] ?? PATTERNS['Ring 1']).cycle) * 1000);
}

// Browsers only allow audio after the user interacts with the page: unlock on the first click or key press.
if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
