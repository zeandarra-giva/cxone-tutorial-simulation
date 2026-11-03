import { useEffect, useState } from 'react';
import {
  CircleUser, Users, User, FileText, Lock, Search, Funnel, EllipsisVertical, CircleCheck, CircleX, ArrowUp, ArrowDown,
  Gauge, List, FileChartColumn, Settings, LayoutList, Phone, Voicemail, TriangleAlert, Headset, ChevronDown, Table,
  Network, Tag, Clock, MapPin, Building, MessageSquare, FolderOpen, BookUser, Workflow, Megaphone, ListChecks, CircleDot, Hash,
} from 'lucide-react';
import { useSim } from '../store';
import { ACD_USERS, DASH_SKILLS, EMPLOYEES, ROLES, SKILLS, TENANT, UNAVAILABLE_CODES, USER } from '../data/data';
import { ComingSoon, Sidebar, type NavItem } from '../components/Shell';
import { HistoryIcon } from '../components/icons';

const nowTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/* ================= MY ZONE ================= */
export function MyZone() {
  const { s } = useSim();
  const items: NavItem[] = [
    { id: 'profile', label: 'My Profile', icon: <CircleUser size={17} /> },
    { id: 'recent', label: 'Recent Interactions', icon: <Users size={17} /> },
  ];
  return (
    <div className="app-body">
      <Sidebar items={items} accent="purple" />
      <main className="content">{s.page === 'recent' ? <RecentInteractions /> : <Profile />}</main>
    </div>
  );
}

const PROFILE_TABS = [
  ['general', 'General'], ['account', 'Account'], ['a11y', 'Accessibility Settings'], ['a11ystmt', 'Accessibility Statement'], ['additional', 'Additional Applications'],
] as const;

function Profile() {
  const { s, set } = useSim();
  const role = ROLES.find((r) => r.id === s.role)!;
  return (
    <div className="profile">
      <div className="profile-head" data-tour="profile-head">
        <div className="profile-avatar">{USER.initials}</div>
        <div>
          <div className="profile-name">{USER.first} {USER.last}</div>
          <div className="profile-title">{role.title}</div>
        </div>
      </div>
      <div className="tabs" data-tour="profile-tabs">
        {PROFILE_TABS.map(([id, label]) => (
          <button key={id} className={'tab' + (s.profileTab === id ? ' active' : '')} data-tour={`ptab-${id}`} onClick={() => set({ profileTab: id })}>{label}</button>
        ))}
      </div>
      <div className="profile-body">
        {s.profileTab === 'general' && (
          <div className="two-col">
            <div>
              <h4>User Information</h4>
              <Field label="Username" value={s.username || USER.username} />
              <Field label="Email" value={USER.email} />
              <Field label="User ID" value={USER.userId} />
            </div>
            <div>
              <h4>General Information</h4>
              <Field label="Account" value={TENANT.account} />
              <Field label="Tenant ID" value={TENANT.tenantId} />
            </div>
          </div>
        )}
        {s.profileTab === 'account' && (
          <div className="two-col">
            <div>
              <h4>Account</h4>
              <Field label="Time Zone" value="(UTC+08:00) Manila" />
              <Field label="Language" value="English (US)" />
            </div>
          </div>
        )}
        {s.profileTab === 'a11y' && (
          <div>
            <h4>Accessibility Settings</h4>
            <label className="check-row"><input type="checkbox" /> High contrast mode</label>
            <label className="check-row"><input type="checkbox" /> Show focus indicators</label>
          </div>
        )}
        {s.profileTab === 'a11ystmt' && (
          <div><h4>Accessibility Statement</h4><p className="muted">The vendor's accessibility statement is shown here.</p></div>
        )}
        {s.profileTab === 'additional' && (
          <div><h4>Additional Applications</h4><p className="muted">No additional applications assigned.</p></div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  );
}

function RecentInteractions() {
  return (
    <div className="page">
      <div className="page-title">Recent Interactions</div>
      <div className="empty-big">No recent interactions</div>
    </div>
  );
}

/* ================= ADMIN ================= */
export function Admin() {
  const { s } = useSim();
  const items: NavItem[] = [
    { id: 'employees', label: 'Employees', icon: <User size={17} /> },
    { id: 'templates', label: 'Employee Templates', icon: <FileText size={17} /> },
    { id: 'teams', label: 'Teams', icon: <Users size={17} /> },
    { id: 'units', label: 'Scheduling Unit', icon: <Building size={17} /> },
    { id: 'locked', label: 'Locked Employees', icon: <Lock size={17} />, section: 'Security Settings' },
  ];
  return (
    <div className="app-body">
      <Sidebar items={items} />
      <main className="content">
        {s.page === 'employees' && <Employees />}
        {s.page === 'locked' && <Employees lockedOnly />}
        {s.page === 'templates' && <ComingSoon name="Employee Templates" />}
        {s.page === 'teams' && <ComingSoon name="Teams" />}
        {s.page === 'units' && <ComingSoon name="Scheduling Unit" />}
      </main>
    </div>
  );
}

function Employees({ lockedOnly = false }: { lockedOnly?: boolean }) {
  const { s, set } = useSim();
  const [selected, setSelected] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const q = s.adminSearch.toLowerCase();
  const rows = EMPLOYEES
    .map((e) => (unlocked.includes(e.username) ? { ...e, state: 'Active' as const } : e))
    .filter((e) => (!lockedOnly || e.state === 'Locked User') && (!q || e.name.toLowerCase().includes(q) || e.username.includes(q)));
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-title">{lockedOnly ? 'Locked Employees' : 'Employees'}</div>
        {!lockedOnly && (
          <div className="page-actions" data-tour="emp-actions">
            <button className="btn-outline">Import Employees</button>
            <button className="btn-primary">Create Employee</button>
          </div>
        )}
      </div>
      <div className="toolbar">
        <span className="tb-count">{rows.length} employees</span>
        <span className="tb-count">{selected.length} Selected</span>
        <div className="search-box" data-tour="emp-search">
          <Search size={14} />
          <input placeholder="Start typing to find user" value={s.adminSearch} onChange={(e) => set({ adminSearch: e.target.value })} />
        </div>
        <button className="icon-btn" aria-label="Filter"><Funnel size={15} /></button>
      </div>
      <div className="table-wrap" data-tour="emp-table">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-check"><input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.username) : [])} /></th>
              <th className="w-av" />
              <th>Name <ArrowUp size={11} /></th><th>Role</th><th>Type</th><th>Username</th><th>Scheduling Unit</th><th>Virtual Agent</th>
              <th data-tour="emp-state-col">State</th><th className="w-act" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.username}>
                <td><input type="checkbox" checked={selected.includes(e.username)} onChange={(ev) => setSelected(ev.target.checked ? [...selected, e.username] : selected.filter((x) => x !== e.username))} /></td>
                <td><span className="row-av">{e.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span></td>
                <td className="ellipsis">{e.name}</td><td className="ellipsis">{e.role}</td><td /><td className="ellipsis">{e.username}</td>
                <td className="ellipsis">{e.unit}</td><td>False</td>
                <td>
                  {e.state === 'Active'
                    ? <span className="state ok"><CircleCheck size={15} /> Active</span>
                    : <span className="state locked"><Lock size={14} /> Locked User</span>}
                </td>
                <td className="rel">
                  <button className="kebab" data-tour={`emp-kebab-${e.username}`} onClick={() => setMenuFor(menuFor === e.username ? null : e.username)}><EllipsisVertical size={15} /></button>
                  {menuFor === e.username && (
                    <div className="row-menu">
                      <button onClick={() => setMenuFor(null)}>Edit</button>
                      {e.state === 'Locked User' && <button data-tour="emp-unlock" onClick={() => { setUnlocked([...unlocked, e.username]); setMenuFor(null); }}>Unlock</button>}
                      <button onClick={() => setMenuFor(null)}>Deactivate</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="empty-row">No employees found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= SUPERVISOR ================= */
export function Supervisor() {
  const { s } = useSim();
  const items: NavItem[] = [
    { id: 'live', label: 'Live Monitoring', icon: <User size={17} /> },
    { id: 'dash1', label: 'Dashboards', icon: <Gauge size={17} color="#e0763a" /> },
    { id: 'dash2', label: 'Dashboards', icon: <Gauge size={17} /> },
    { id: 'reporting', label: 'Reporting', icon: <FileChartColumn size={17} /> },
    { id: 'isearch', label: 'Interactions Search', icon: <Search size={17} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={17} /> },
  ];
  return (
    <div className="app-body">
      <Sidebar items={items} />
      <main className="content">
        {s.page === 'live' ? <LiveMonitoring /> : s.page === 'dash1' || s.page === 'dash2' ? <DashboardView /> : <ComingSoon name={items.find((i) => i.id === s.page)?.label ?? ''} />}
      </main>
    </div>
  );
}

function LiveMonitoring() {
  const { s, set } = useSim();
  const [q, setQ] = useState('');
  const tabs = [['skills', 'Skills'], ['agents', 'Agents'], ['contacts', 'Contacts']] as const;
  return (
    <div className="page live">
      <div className="live-main">
        <div className="live-top">
          <div className="search-box wide" data-tour="sup-search">
            <Search size={14} />
            <input placeholder="Search by name, number, ID, text, or skill" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="icon-btn" aria-label="Filter"><Funnel size={15} /></button>
          <div className="live-selects" data-tour="sup-view">
            <label>View <span className="select">Focused <ChevronDown size={13} /></span></label>
            <label>Sort By <span className="select">{s.supTab === 'agents' ? 'Agent State' : 'Contacts'} <ChevronDown size={13} /></span></label>
          </div>
        </div>
        <div className="tabs" data-tour="sup-tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={'tab' + (s.supTab === id ? ' active' : '')} data-tour={`sup-tab-${id}`} onClick={() => set({ supTab: id, agentMenuFor: null })}>{label}</button>
          ))}
          <span className="show-metrics">Show Metrics <ChevronDown size={12} /></span>
        </div>
        {s.supTab === 'skills' && <SkillsGrid q={q} />}
        {s.supTab === 'agents' && <AgentsGrid q={q} />}
        {s.supTab === 'contacts' && <div className="empty-big">No active contacts</div>}
      </div>
      <div className="live-rail">
        <button aria-label="Columns"><LayoutList size={17} /></button>
        <button aria-label="Alerts"><TriangleAlert size={17} /></button>
        <button aria-label="Monitor"><Headset size={17} /></button>
      </div>
    </div>
  );
}

function SkillsGrid({ q }: { q: string }) {
  const rows = SKILLS.filter((k) => k.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="table-wrap" data-tour="sup-skills">
      <table className="grid">
        <thead>
          <tr>
            <th>Skill (2806)</th><th data-tour="sup-wait">Wait Time</th><th data-tour="sup-sla">SLA</th>
            <th data-tour="sup-queue">Contacts in Queue <span className="sort-ind">1 <ArrowDown size={11} /></span></th><th>Logged In Agents</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.name}>
              <td className="skill-name">
                {k.kind === 'vm' ? <Voicemail size={15} className="skill-ic" /> : <Phone size={14} className="skill-ic" />}
                <span className="dir">{k.outbound ? '↑' : '↓'}</span>{k.name}
              </td>
              <td>{k.wait}</td>
              <td><span className={'sla ' + (k.sla >= 80 ? 'good' : 'bad')}>{k.sla}%</span></td>
              <td>{k.queue}</td>
              <td>{k.loggedIn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentsGrid({ q }: { q: string }) {
  const { s, set } = useSim();
  const rows = s.supAgents.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  const changeState = (name: string, state: string) =>
    set({ supAgents: s.supAgents.map((a) => (a.name === name ? { ...a, state, since: '0m' } : a)), agentMenuFor: null, changeStateFor: null });
  return (
    <div className="table-wrap" data-tour="sup-agents">
      <table className="grid">
        <thead>
          <tr><th>Agent ({rows.length})</th><th>Team</th><th>State <span className="sort-ind">1 <ArrowUp size={11} /></span></th><th>Next State</th><th>Contacts</th><th>Active Contact</th><th className="w-act" /></tr>
        </thead>
        <tbody>
          {rows.map((a, i) => {
            const isAvail = a.state === 'Available';
            const isOut = a.state === 'Logged Out';
            return (
              <tr key={a.name}>
                <td className="ellipsis">
                  {isAvail ? <CircleCheck size={15} className="st-ic ok" /> : isOut ? <CircleX size={15} className="st-ic out" /> : <CircleDot size={15} className="st-ic unavail" />}
                  {a.name}
                </td>
                <td className="ellipsis">{a.team}</td>
                <td className={'agent-state ' + (isAvail ? 'ok' : isOut ? 'out' : 'unavail')}>{a.state} ({a.since})</td>
                <td>{a.next}</td>
                <td>{a.contacts}</td>
                <td>-</td>
                <td className="rel">
                  <button className="kebab" data-tour={i === 0 ? 'sup-agent-kebab' : undefined} onClick={() => set({ agentMenuFor: s.agentMenuFor === a.name ? null : a.name, changeStateFor: null })}><EllipsisVertical size={15} /></button>
                  {s.agentMenuFor === a.name && (
                    <div className="row-menu right" data-tour="sup-agent-menu">
                      <button data-tour="sup-change-state" onClick={() => set({ changeStateFor: s.changeStateFor === a.name ? null : a.name })}>Change State ›</button>
                      <button onClick={() => changeState(a.name, 'Logged Out')} disabled={isOut}>Log Out Agent</button>
                      <button disabled title="Available while the agent is on a contact">Monitor</button>
                      {s.changeStateFor === a.name && (
                        <div className="sub-menu" data-tour="sup-state-list">
                          <button data-tour="sup-set-available" onClick={() => changeState(a.name, 'Available')}><CircleCheck size={13} className="st-ic ok" /> Available</button>
                          {UNAVAILABLE_CODES.map((c) => (
                            <button key={c} onClick={() => changeState(a.name, c)}><CircleDot size={13} className="st-ic unavail" /> {c}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ================= DASHBOARD ================= */
export function Dashboard() {
  const { s } = useSim();
  const items: NavItem[] = [
    { id: 'dashboards', label: 'Dashboards', icon: <Gauge size={17} color="#e0763a" /> },
    { id: 'manage', label: 'Manage Dashboards', icon: <List size={17} /> },
  ];
  return (
    <div className="app-body">
      <Sidebar items={items} />
      <main className="content">{s.page === 'manage' ? <ComingSoon name="Manage Dashboards" /> : <DashboardView />}</main>
    </div>
  );
}

function DashboardView() {
  const [t, setT] = useState(nowTime());
  useEffect(() => {
    const id = setInterval(() => setT(nowTime()), 30000);
    return () => clearInterval(id);
  }, []);
  const cols = ['Skill Name', 'Abandon', 'Available', 'Logged In', 'Unavailable', 'Handled', 'Incoming', 'Queued', 'Current'];
  return (
    <div className="page dash">
      <div className="dash-head" data-tour="dash-select">
        <span className="dash-label">My Dashboards</span>
        <span className="select big">Routing Demo Dashboard (Supervisor) <ChevronDown size={14} /></span>
      </div>
      <div className="widget" data-tour="dash-skill-summary">
        <div className="widget-title"><Table size={17} /> Skill Summary</div>
        <div className="widget-sub">Last updated: {t}</div>
        <table className="grid compact">
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{DASH_SKILLS.map((k) => <tr key={k}><td>{k}</td>{cols.slice(1).map((c) => <td key={c}>0</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="dash-grid">
        <div className="dash-col">
          <div className="widget" data-tour="dash-agent-state">
            <div className="widget-title"><Clock size={17} /> Agent State Counter</div>
            <div className="widget-sub">Last updated: {t}</div>
            <div className="empty-data">Empty data</div>
          </div>
          <div className="widget tall" data-tour="dash-agent-list">
            <div className="widget-title"><Table size={17} /> Agent List</div>
            <div className="widget-sub">Last updated: {t}</div>
            <div className="no-data"><span>No data</span></div>
          </div>
        </div>
        <div className="widget side" data-tour="dash-queue">
          <div className="widget-title"><Hash size={17} /> Queue Counter</div>
          <div className="widget-sub">Last updated: {t}</div>
          <div className="empty-data">Empty data</div>
        </div>
      </div>
    </div>
  );
}

/* ================= ACD ================= */
export function ACD() {
  const { s } = useSim();
  const items: NavItem[] = [
    { id: 'users', label: 'ACD Users', icon: <User size={17} /> },
    { id: 'skills', label: 'ACD Skills', icon: <Network size={16} />, section: 'Contact Settings' },
    { id: 'routing', label: 'Routing Attributes', icon: <Workflow size={16} />, section: 'Contact Settings' },
    { id: 'campaigns', label: 'Campaigns', icon: <Megaphone size={16} />, section: 'Contact Settings' },
    { id: 'dispositions', label: 'Dispositions', icon: <ListChecks size={16} />, section: 'Contact Settings' },
    { id: 'poc', label: 'Points of Contact', icon: <CircleDot size={16} />, section: 'Contact Settings' },
    { id: 'scripts', label: 'Scripts', icon: <FileText size={16} />, section: 'Contact Settings' },
    { id: 'hours', label: 'Hours of Operation', icon: <Clock size={16} />, section: 'Contact Settings' },
    { id: 'workflow', label: 'Workflow Data', icon: <Workflow size={16} />, section: 'Contact Settings' },
    { id: 'tags', label: 'Tags', icon: <Tag size={16} />, section: 'Contact Settings' },
    { id: 'ucodes', label: 'Unavailable Codes', icon: <User size={16} />, section: 'ACD Settings' },
    { id: 'address', label: 'Address Books', icon: <BookUser size={16} />, section: 'ACD Settings' },
    { id: 'locations', label: 'Locations', icon: <MapPin size={16} />, section: 'ACD Settings' },
    { id: 'bu', label: 'Business Units', icon: <Building size={16} />, section: 'ACD Configuration' },
    { id: 'messaging', label: 'Agent Messaging', icon: <MessageSquare size={16} />, section: 'ACD Configuration' },
    { id: 'issues', label: 'Agent Issues', icon: <User size={16} />, section: 'Support' },
    { id: 'files', label: 'Browse ACD Files', icon: <FolderOpen size={16} />, section: 'Support' },
  ];
  return (
    <div className="app-body">
      <Sidebar items={items} />
      <main className="content">
        {s.page === 'users' ? <AcdUsers /> : s.page === 'ucodes' ? <UnavailableCodesPage /> : <ComingSoon name={items.find((i) => i.id === s.page)?.label ?? ''} />}
      </main>
    </div>
  );
}

function AcdUsers() {
  const { s, set } = useSim();
  const q = s.acdSearch.toLowerCase();
  const rows = ACD_USERS.filter((u) => !q || `${u.first} ${u.last} ${u.username} ${u.id}`.toLowerCase().includes(q));
  return (
    <div className="page">
      <div className="toolbar acd">
        <button className="btn-primary sm" data-tour="acd-manage-multi">Manage Multiple Users</button>
        <div className="search-line" data-tour="acd-search">
          <input placeholder="Search..." value={s.acdSearch} onChange={(e) => set({ acdSearch: e.target.value })} />
          <Search size={16} />
        </div>
        <label className="show-sel">Show <span className="select">All <ChevronDown size={13} /></span></label>
      </div>
      <div className="table-wrap" data-tour="acd-table">
        <table className="grid">
          <thead><tr><th>ID</th><th>First Name</th><th>Last Name</th><th>Username</th><th>Email</th><th>Team</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td><td className="ellipsis">{u.first}</td><td className="ellipsis">{u.last}</td><td className="ellipsis">{u.username}</td>
                <td className="ellipsis">{u.email}</td><td className="ellipsis">{u.team}</td><td>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnavailableCodesPage() {
  return (
    <div className="page">
      <div className="page-title">Unavailable Codes</div>
      <div className="table-wrap">
        <table className="grid">
          <thead><tr><th>Code</th><th>Status</th></tr></thead>
          <tbody>{UNAVAILABLE_CODES.map((c) => <tr key={c}><td>{c}</td><td>Active</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

