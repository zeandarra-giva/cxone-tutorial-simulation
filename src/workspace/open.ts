import type { RoleId } from '../data/data';

/** Opens Agent Workspace in its own browser window, like the real "Agent" app does. */
export function openWorkspace(role: RoleId, tour?: string, username?: string, mode?: string) {
  const q = new URLSearchParams({ app: 'cxa', role, prompt: '1' });
  if (tour) q.set('tour', tour);
  if (username) q.set('u', username);
  if (mode) q.set('mode', mode);
  const url = `${location.pathname}?${q.toString()}`;
  const w = window.open(url, 'cxagent', 'popup=yes,width=1440,height=900');
  if (w) w.focus();
  else location.href = url; // popup blocked: open in this tab instead
  return !!w;
}

/**
 * Leave the Agent Workspace window and go back to the training home (overview) in the main window.
 * If the main window is still open we tell it to show home and close this window; otherwise
 * (e.g. pop-ups were blocked and this tab replaced the main one) we load home in this tab.
 */
export function goTrainingHome(role: RoleId) {
  const homeUrl = `${location.pathname}?home=1&role=${role}`;
  const op = window.opener as Window | null;
  if (op && !op.closed) {
    try { op.postMessage({ type: 'cxone-training-home' }, location.protocol === 'file:' ? '*' : location.origin); op.focus(); } catch { /* ignore */ }
    window.close();
    // some browsers refuse to close; fall back to loading home here
    setTimeout(() => { if (!window.closed) location.href = homeUrl; }, 400);
    return;
  }
  location.href = homeUrl;
}
