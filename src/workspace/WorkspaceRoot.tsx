import { SimProvider } from '../store';
import { ROLES, USER, type RoleId } from '../data/data';
import { TourProvider } from '../tour/TourEngine';
import { REMEMBER_KEY, WorkspaceApp } from './WorkspaceApp';
import { WorkspaceTraining } from '../training/Dock';
import { LearnUiProvider } from '../learn/LearnUi';
import { seedHistory, seedNotifications } from './wsData';

function laterToday(h: number, m: number) {
  const d = new Date(); d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now() + 30 * 60000) d.setTime(Date.now() + 90 * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  let hh = d.getHours(); const ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12;
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(hh)}:${p(d.getMinutes())} ${ap}`;
}

export function WorkspaceRoot() {
  const params = new URLSearchParams(location.search);
  const role = (params.get('role') as RoleId) || 'agent';
  const valid = ROLES.some((r) => r.id === role) ? role : 'agent';
  const now = Date.now();
  let remembered = false;
  try { remembered = !!localStorage.getItem(REMEMBER_KEY); } catch { /* ignore */ }
  // Real behaviour: the voice-connection prompt shows unless 'Remember Setting' was ticked. Training always shows it.
  const wsLaunch = params.get('prompt') === '1' && (!remembered || params.get('tour') === 'ws-tour');
  return (
    <SimProvider init={{
      wsLaunch, extPromptOpen: !wsLaunch, screen: 'workspace', role: valid, username: params.get('u') || USER.username,
      statusSince: now, stateLog: [{ status: 'Unavailable', start: now }],
      // seed data so every screen looks lived-in
      contactHistory: seedHistory(),
      notifications: seedNotifications(),
      commitments: [{ id: 'seed-c1', target: 'me', skill: 'DWCS_ITHD_IAM_Outbound', first: 'Jordan', last: 'Lee', phone: '+15555550155', time: laterToday(16, 30), tz: '(GMT+08:00) Manila', notes: 'Confirm badge access is working after the weekend migration.' }],
      favorites: ['Ana Bautista'],
    }}>
      <LearnUiProvider>
        <TourProvider docked finishPatch={{ statusMenuOpen: false, customizeOpen: false, callbackContact: null }}>
          <WorkspaceTraining autoTour={params.get('tour')} initialTab={params.get('mode')}>
            <WorkspaceApp />
          </WorkspaceTraining>
        </TourProvider>
      </LearnUiProvider>
    </SimProvider>
  );
}
