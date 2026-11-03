import {
  Settings, Network, Headset, Workflow, Move, Gauge, FileChartColumn, Activity, Sparkles, Bot, Puzzle, Zap, Disc3, User,
} from 'lucide-react';
import type { AppId } from '../data/data';

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <span className="logo-nice">NiCE</span>
      <span className="logo-cx">CX</span>
      <span className="logo-one">one</span>
    </span>
  );
}

export function HistoryIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function SidebarToggleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M3 5h18M9 10h12M9 14h12M3 19h18" />
      <path d="M3 9.5l3 2.5-3 2.5" />
    </svg>
  );
}

export function AgentWorkspaceIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x="9" y="11" width="21" height="15" rx="4" fill="#e8453c" />
      <path d="M14 26l-2 4 6-4z" fill="#e8453c" />
      <circle cx="15" cy="18.5" r="1.6" fill="#fff" />
      <circle cx="19.5" cy="18.5" r="1.6" fill="#fff" />
      <circle cx="24" cy="18.5" r="1.6" fill="#fff" />
      <path d="M4.5 3.5c-1 1-1.2 3 .3 5.6 1.4 2.4 3.4 4.4 5.6 5.6 2.6 1.4 4.4 1.3 5.4.3l.9-.9-3-2.6-1.6 1.1c-1.6-.7-3.4-2.5-4.1-4.1l1.1-1.6-2.6-3z" fill="#1f2a44" stroke="#fff" strokeWidth="1" />
    </svg>
  );
}

function Hex({ size, color, children }: { size: number; color: string; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 1.5l9 5.2v10.6l-9 5.2-9-5.2V6.7z" fill={color} />
      <g transform="translate(6 6) scale(0.5)">{children}</g>
    </svg>
  );
}

const APP_COLORS: Partial<Record<AppId, string>> = {
  admin: '#1e88e5', supervisor: '#f39c12', aistudio: '#1e88e5', aiagents: '#2f6fd1', agentintegrations: '#e8453c', wfi: '#18b6c9',
  acd: '#f5821f', max: '#f5821f', agent: '#f5821f', studio: '#f0612c', studioauth: '#f5a21f',
  interactions: '#18b6c9', myzone: '#7b3fe4', dashboard: '#f39c12', dashboard2: '#e0763a', reporting: '#e8453c', metrics: '#6c5ce7',
};

export function AppIcon({ id, size = 20 }: { id: AppId; size?: number }) {
  const c = APP_COLORS[id] ?? '#1e88e5';
  const p = { size, color: c, strokeWidth: 2 };
  switch (id) {
    case 'myzone':
      return (
        <Hex size={size} color={c}>
          <User size={24} color="#fff" strokeWidth={2.5} />
        </Hex>
      );
    case 'supervisor':
      return (
        <span className="app-ic-ring" style={{ width: size, height: size, borderColor: c }}>
          <User size={size * 0.6} color="#1e88e5" strokeWidth={2.4} />
        </span>
      );
    case 'admin': return <Settings {...p} />;
    case 'aistudio': return <Sparkles {...p} />;
    case 'aiagents': return <Bot {...p} />;
    case 'agentintegrations': return <Puzzle {...p} />;
    case 'wfi': return <Zap {...p} />;
    case 'acd': return <Network {...p} />;
    case 'max':
    case 'agent': return <Headset {...p} />;
    case 'studio': return <Workflow {...p} />;
    case 'studioauth': return <Move {...p} />;
    case 'interactions': return <Disc3 {...p} />;
    case 'dashboard':
    case 'dashboard2': return <Gauge {...p} />;
    case 'reporting': return <FileChartColumn {...p} />;
    case 'metrics': return <Activity {...p} />;
  }
}
