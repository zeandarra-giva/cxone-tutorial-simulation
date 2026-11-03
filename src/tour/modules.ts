import type { RoleId } from '../data/data';
import { toursForRole, type Tour } from './tours';
import { WS_TOURS } from '../workspace/wsTours';

// Groups individual tours (lessons) into learning modules shown as cards on the role picker.
// A module with sections shows its lessons in small groups so long modules stay easy to scan.

export interface ModuleSection { title: string; lessons: string[] }
export interface LearningModule {
  id: string;
  title: string;
  summary: string;
  icon: 'start' | 'zone' | 'workspace' | 'supervisor' | 'admin';
  sections: ModuleSection[];
}

export const MODULES: LearningModule[] = [
  {
    id: 'm-start',
    title: 'Getting Started',
    summary: 'Sign in, learn the CXone layout and move between applications.',
    icon: 'start',
    sections: [{ title: 'Lessons', lessons: ['getting-started', 'apps'] }],
  },
  {
    id: 'm-myzone',
    title: 'My Zone',
    summary: 'Your profile, account and accessibility settings.',
    icon: 'zone',
    sections: [{ title: 'Lessons', lessons: ['myzone'] }],
  },
  {
    id: 'm-workspace',
    title: 'Agent Workspace',
    summary: 'Launch the softphone, get ready for calls, handle contacts and manage your day.',
    icon: 'workspace',
    sections: [
      { title: 'Get set up', lessons: ['agent-launch', 'ws-quick', 'ws-tour', 'ws-ready'] },
      { title: 'Handle calls', lessons: ['ws-inbound', 'ws-outbound', 'ws-callback', 'ws-directory'] },
      { title: 'Manage your day', lessons: ['ws-schedule', 'ws-breaks', 'ws-settings', 'ws-reporting'] },
    ],
  },
  {
    id: 'm-supervisor',
    title: 'Supervising',
    summary: 'Monitor queues and agents live, and read real-time dashboards.',
    icon: 'supervisor',
    sections: [{ title: 'Lessons', lessons: ['supervisor-live', 'dashboards'] }],
  },
  {
    id: 'm-admin',
    title: 'Administration',
    summary: 'Manage employees and the ACD routing setup.',
    icon: 'admin',
    sections: [{ title: 'Lessons', lessons: ['admin', 'acd'] }],
  },
];

// Remember which module the trainee was in, so exiting or finishing a lesson lands back on that module.
const LAST_KEY = 'cxone-sim-module';
export function lastModule(): string | null {
  try { return sessionStorage.getItem(LAST_KEY); } catch { return null; }
}
export function rememberModule(id: string | null) {
  try { if (id) sessionStorage.setItem(LAST_KEY, id); else sessionStorage.removeItem(LAST_KEY); } catch { /* storage unavailable */ }
}

export interface RoleModule { mod: LearningModule; sections: { title: string; lessons: Tour[] }[]; lessons: Tour[] }

/** The modules a role sees, with their lessons resolved (Agent Workspace lessons are marked opensIn 'cxa'). */
export function modulesForRole(role: RoleId): RoleModule[] {
  const ws: Tour[] = WS_TOURS.filter((t) => t.roles.includes(role)).map((t) => ({ ...t, opensIn: 'cxa' }));
  const byId = new Map([...toursForRole(role), ...ws].map((t) => [t.id, t]));
  return MODULES.map((mod) => {
    const sections = mod.sections
      .map((sec) => ({ title: sec.title, lessons: sec.lessons.map((id) => byId.get(id)).filter((t): t is Tour => !!t) }))
      .filter((sec) => sec.lessons.length > 0);
    return { mod, sections, lessons: sections.flatMap((sec) => sec.lessons) };
  }).filter((m) => m.lessons.length > 0);
}
