// Per-browser training progress (XP, badges, best scores). Shared by both windows (same origin).
const KEY = 'cxone-sim-progress';

export interface Progress {
  xp: number;
  badges: string[];
  explored: string[];
  missions: Record<string, number>; // id -> best stars (1-3)
  quizBest: number; // percent
  simBest: number; // percent
  storyDone: string[]; // chapter ids
  voice: boolean;
  /** chosen narrator voice name ('' = pick the most natural one available) */
  narratorVoice: string;
  /** how fast every voice speaks (1 = normal; 0.5 slowest, 2 fastest) */
  speechRate: number;
  captions: boolean;
  traineeName: string;
}
const blank = (): Progress => ({ xp: 0, badges: [], explored: [], missions: {}, quizBest: 0, simBest: 0, storyDone: [], voice: true, narratorVoice: '', speechRate: 1, captions: true, traineeName: '' });

export function getProgress(): Progress {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); }
}
function save(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent('progress-changed'));
}
export function updateProgress(fn: (p: Progress) => Progress) { save(fn(getProgress())); }

export const BADGES: Record<string, { icon: string; label: string; how: string }> = {
  'first-call': { icon: '📞', label: 'First Call', how: 'Handle your first call end-to-end' },
  explorer: { icon: '🧭', label: 'Explorer', how: 'Discover every hotspot in Explore mode' },
  'mission-5': { icon: '🎯', label: 'Mission Ready', how: 'Complete 5 missions' },
  'mission-all': { icon: '🏅', label: 'Mission Master', how: 'Complete every mission' },
  'three-star': { icon: '⭐', label: 'No Hints Needed', how: 'Earn 3 stars on a mission' },
  'quiz-80': { icon: '🧠', label: 'Quiz Whiz', how: 'Score 80%+ in a quiz round' },
  'quiz-100': { icon: '💯', label: 'Perfect Round', how: 'Score 100% in a quiz round' },
  storyteller: { icon: '🎬', label: 'Storyteller', how: 'Finish every Story chapter' },
  'shift-pro': { icon: '🏁', label: 'Shift Pro', how: 'Score 85%+ in the Shift Simulator' },
  'zero-refused': { icon: '🛡️', label: 'Zero Refused', how: 'Finish a simulated shift without refusing or missing a call' },
  certified: { icon: '🎓', label: 'Certified', how: 'Earn your Agent Workspace certificate' },
};

export const LEVELS = [0, 150, 400, 800, 1300, 2000, 3000];
export const LEVEL_NAMES = ['Trainee', 'Rookie', 'Agent I', 'Agent II', 'Senior Agent', 'Expert', 'CXone Pro'];
export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]) i++;
  const next = LEVELS[i + 1] ?? LEVELS[i];
  return { level: i + 1, name: LEVEL_NAMES[i], from: LEVELS[i], to: next, pct: next === LEVELS[i] ? 100 : Math.round(((xp - LEVELS[i]) / (next - LEVELS[i])) * 100) };
}

/** Award XP (and optionally a badge). Fires a toast. */
export function award(xp: number, reason: string, badge?: string) {
  let newBadge: string | undefined;
  updateProgress((p) => {
    const badges = badge && !p.badges.includes(badge) ? ((newBadge = badge), [...p.badges, badge]) : p.badges;
    return { ...p, xp: p.xp + xp, badges };
  });
  if (xp) toast(`+${xp} XP · ${reason}`);
  if (newBadge) toast(`${BADGES[newBadge].icon} Badge unlocked: ${BADGES[newBadge].label}`, 'badge');
}
export function grantBadge(badge: string) {
  if (getProgress().badges.includes(badge)) return;
  award(0, '', badge);
}

export function toast(text: string, kind: 'xp' | 'badge' | 'info' | 'bad' = 'xp') {
  window.dispatchEvent(new CustomEvent('sim-toast', { detail: { text, kind, id: Math.random() } }));
}

/** Certificate requirements. */
export function certificateStatus(p = getProgress(), totalMissions = 12) {
  const done = Object.keys(p.missions).length;
  const reqs = [
    { label: 'Complete at least 8 missions', ok: done >= 8, detail: `${done}/${totalMissions}` },
    { label: 'Score 80%+ in a quiz round', ok: p.quizBest >= 80, detail: `best ${p.quizBest}%` },
    { label: 'Score 70%+ in the Shift Simulator', ok: p.simBest >= 70, detail: `best ${p.simBest}%` },
  ];
  return { reqs, ok: reqs.every((r) => r.ok) };
}
