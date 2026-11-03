import { LearnLayout, LearnUiProvider } from './learn/LearnUi';
import { MainSidebar } from './learn/MainSidebar';
import { SimProvider, useSim } from './store';
import { useEffect } from 'react';
import { TourProvider, useTour } from './tour/TourEngine';
import { RolePicker } from './tour/RolePicker';
import { Login } from './apps/Login';
import { AppMenu, ComingSoon, TopBar } from './components/Shell';
import { ACD, Admin, Dashboard, MyZone, Supervisor } from './apps/CxoneApps';
import { WorkspaceRoot } from './workspace/WorkspaceRoot';
import { PopOutRoot } from './workspace/ScreenPop';
import { APPS, ROLES } from './data/data';

function CxoneShell() {
  const { s } = useSim();
  const app = APPS.find((a) => a.id === s.app)!;
  let body;
  switch (s.app) {
    case 'myzone': body = <MyZone />; break;
    case 'admin': body = <Admin />; break;
    case 'supervisor': body = <Supervisor />; break;
    case 'dashboard':
    case 'dashboard2': body = <Dashboard />; break;
    case 'acd': body = <ACD />; break;
    default: body = <div className="app-body"><main className="content"><ComingSoon name={app.name} /></main></div>;
  }
  return (
    <div className="cx">
      <TopBar />
      <AppMenu />
      {body}
    </div>
  );
}

function Screens() {
  const { s, set } = useSim();
  const { exit } = useTour();
  // "Training home" clicked in the Agent Workspace window
  useEffect(() => {
    const f = (e: MessageEvent) => {
      if ((location.protocol !== 'file:' && e.origin !== location.origin) || e.data?.type !== 'cxone-training-home') return;
      exit();
      set({ screen: 'picker', ...CLOSE });
    };
    window.addEventListener('message', f);
    return () => window.removeEventListener('message', f);
  }, [exit, set]);
  if (s.screen === 'picker') return <RolePicker />;
  return (
    <LearnLayout sidebar={<MainSidebar />}>
      {s.screen === 'login' && <Login />}
      {s.screen === 'cxone' && <CxoneShell />}
    </LearnLayout>
  );
}

const CLOSE = { appMenuOpen: false, profileMenuOpen: false, launchOpen: false, statusMenuOpen: false };

// read once at load: ?home=1&role=… opens straight on that role's training home (used when leaving Agent Workspace)
const BOOT = new URLSearchParams(location.search);
const HOME_ROLE = BOOT.get('home') ? ROLES.find((r) => r.id === BOOT.get('role'))?.id : undefined;
if (BOOT.get('home')) history.replaceState(null, '', location.pathname);

export function App() {
  if (BOOT.get('app') === 'cxa') return <WorkspaceRoot />;
  if (BOOT.get('app') === 'pop') return <PopOutRoot />;
  return (
    <SimProvider init={HOME_ROLE ? { role: HOME_ROLE, rolePicked: true, screen: 'picker' } : undefined}>
      <LearnUiProvider>
        {/* finishing or exiting a lesson keeps you in the simulator, with the lesson list in the sidebar */}
        <TourProvider docked={(s) => s.screen !== 'picker'} finishPatch={CLOSE}>
          <Screens />
        </TourProvider>
      </LearnUiProvider>
    </SimProvider>
  );
}
