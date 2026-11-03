import type { ReactNode } from 'react';
import { Bell, CircleQuestionMark, Grip, LogOut, Presentation, ChevronDown, ExternalLink } from 'lucide-react';
import { useSim } from '../store';
import { APP_GROUPS, APPS, USER, appsForRole, type AppId } from '../data/data';
import { AppIcon, Logo, SidebarToggleIcon } from './icons';
import { openWorkspace } from '../workspace/open';
import { useTour } from '../tour/TourEngine';

const DEFAULT_PAGE: Partial<Record<AppId, string>> = {
  myzone: 'profile', admin: 'employees', supervisor: 'live', dashboard: 'dashboards', dashboard2: 'dashboards', acd: 'users',
};

export function useOpenApp() {
  const { s, set } = useSim();
  const { tour } = useTour();
  return (id: AppId) => {
    if (id === 'agent' || id === 'max') {
      // Like the real app: Agent opens in a NEW window, which asks for the voice connection first.
      set({ appMenuOpen: false });
      openWorkspace(s.role, tour?.id === 'agent-launch' ? 'ws-tour' : undefined, s.username || undefined);
      return;
    }
    set({ app: id, page: DEFAULT_PAGE[id] ?? 'home', appMenuOpen: false, profileMenuOpen: false });
  };
}

export function TopBar() {
  const { s, set } = useSim();
  const app = APPS.find((a) => a.id === s.app)!;
  const showChevron = s.role === 'supervisor' || s.role === 'supervisor_bo';
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="tb-icon" data-tour="app-menu-btn" aria-label="Applications" onClick={() => set({ appMenuOpen: !s.appMenuOpen, profileMenuOpen: false })}>
          <Grip size={22} />
        </button>
        <div className="tb-app" data-tour="app-name">
          <span className="tb-app-icon"><AppIcon id={app.id} size={22} /></span>
          <span>{app.name}</span>
        </div>
      </div>
      <div className="topbar-center"><Logo size={20} /></div>
      <div className="topbar-right">
        <button className="tb-icon" data-tour="help" aria-label="Help"><CircleQuestionMark size={19} /></button>
        <button className="tb-icon" data-tour="whatsnew" aria-label="What's new"><Presentation size={19} /></button>
        <button className="tb-icon" data-tour="notifications" aria-label="Notifications"><Bell size={19} /></button>
        <button className="tb-avatar-btn" data-tour="profile-btn" onClick={() => set({ profileMenuOpen: !s.profileMenuOpen, appMenuOpen: false })}>
          <span className="tb-avatar">{USER.initials}</span>
          {showChevron && <ChevronDown size={14} />}
        </button>
      </div>
      {s.profileMenuOpen && <ProfileMenu />}
    </header>
  );
}

function ProfileMenu() {
  const { set, reset, s } = useSim();
  return (
    <>
      <div className="backdrop-clear" onClick={() => set({ profileMenuOpen: false })} />
      <div className="profile-menu" data-tour="profile-menu">
        <button data-tour="pm-profile" onClick={() => set({ app: 'myzone', page: 'profile', profileMenuOpen: false })}>My Profile</button>
        <button data-tour="pm-support" onClick={() => set({ profileMenuOpen: false })}>Support &amp; Downloads</button>
        <button data-tour="pm-signout" onClick={() => reset({ screen: 'login', role: s.role, rolePicked: true })}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </>
  );
}

export function AppMenu() {
  const { s, set } = useSim();
  const open = useOpenApp();
  if (!s.appMenuOpen) return null;
  const apps = appsForRole(s.role);
  return (
    <>
      <div className="backdrop-clear" onClick={() => set({ appMenuOpen: false })} />
      <aside className="app-menu" data-tour="app-menu">
        <div className="app-menu-head">
          <button className="tb-icon dark" onClick={() => set({ appMenuOpen: false })} aria-label="Close applications"><Grip size={20} /></button>
          <span>Applications</span>
        </div>
        <div className="app-menu-body">
          {APP_GROUPS.map((g) => {
            const list = apps.filter((a) => a.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="app-group" data-tour={`group-${g.replace(/\W+/g, '-').toLowerCase()}`}>
                <div className="app-group-title">{g}</div>
                {list.map((a) => (
                  <button key={a.id} className={'app-item' + (s.app === a.id ? ' active' : '')} data-tour={`app-${a.id}`} onClick={() => open(a.id)} title={a.desc}>
                    <span className="app-item-icon"><AppIcon id={a.id} size={20} /></span>
                    <span className="app-item-name">{a.name}</span>
                    {a.external && <ExternalLink size={13} className="app-ext" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

export interface NavItem { id: string; label: string; icon: ReactNode; section?: string }

export function Sidebar({ items, accent = 'blue' }: { items: NavItem[]; accent?: 'blue' | 'purple' }) {
  const { s, set } = useSim();
  let lastSection: string | undefined;
  return (
    <nav className={'sidebar' + (s.sidebarCollapsed ? ' collapsed' : '')} data-tour="sidebar">
      <button className="sidebar-toggle" onClick={() => set({ sidebarCollapsed: !s.sidebarCollapsed })} aria-label="Toggle sidebar">
        <SidebarToggleIcon />
      </button>
      {items.map((it) => {
        const header = it.section && it.section !== lastSection ? it.section : null;
        lastSection = it.section;
        return (
          <div key={it.id}>
            {header && !s.sidebarCollapsed && (
              <div className="sidebar-section">{header}<ChevronDown size={13} /></div>
            )}
            <button
              className={'side-item' + (s.page === it.id ? ` active ${accent}` : '') + (it.section ? ' indented' : '')}
              data-tour={`nav-${it.id}`}
              onClick={() => set({ page: it.id })}
              title={it.label}
            >
              <span className="side-icon">{it.icon}</span>
              {!s.sidebarCollapsed && <span>{it.label}</span>}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function ComingSoon({ name }: { name: string }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-card">
        <h3>{name}</h3>
        <p>This screen hasn't been captured for the simulation yet.</p>
      </div>
    </div>
  );
}
