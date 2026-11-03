import { Fragment, useEffect, useState } from 'react';
import { previewRingtone } from './ringtone';
import {
  Search, List, BookUser, CalendarDays, CircleUserRound, Settings, ChartColumn, Phone, Star, Headset, Wrench, ChevronDown, ChevronRight, ChevronLeft,
  LocateFixed, CalendarPlus, Waypoints, PhoneIncoming, Voicemail, ExternalLink, Volume1, Volume2, Play, Clock, AppWindow, ArrowUpDown, SendHorizontal,
  Keyboard, Funnel, CircleCheck, CircleMinus, CircleQuestionMark, Users, Calendar, CalendarClock, TriangleAlert,
} from 'lucide-react';
import { useSim, emptyDraft, type Commitment, type SimState } from '../store';
import { toast } from '../training/progress';
import { USER } from '../data/data';
import { HistoryIcon } from '../components/icons';
import { fmtDur } from './callActions';
import {
  AGENT_INFO, AGENT_SKILLS, DIR_AGENTS, DIR_FILTERS, DIR_SKILLS, ISSUE_CATEGORIES, ISSUE_PRIORITIES, LOG_LEVELS, QUEUE_CHANNELS, RINGTONES, SHORTCUTS,
  TEAM_PRODUCTIVITY, TIMEZONES, TONES, WEM_SEGMENTS, SHIFT_BLOCKS, DIR_TEAMS,
} from './wsData';

function PanelTitle({ icon, children, right }: { icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="aw-ptitle">{icon}<span>{children}</span>{right && <span className="aw-ptitle-right">{right}</span>}</div>;
}

/* ---------------- Contact History ---------------- */
export function ContactHistoryPanel() {
  const { s, set } = useSim();
  return (
    <div className="aw-panel">
      <PanelTitle icon={<HistoryIcon size={20} />}>Contact History</PanelTitle>
      {s.contactHistory.length ? (
        <div className="ch-list aw-ch" data-tour="ws-history-list">
          {s.contactHistory.map((c, i) => (
            <button key={c.id + i} className="ch-item" data-tour={i === 0 ? 'ws-history-first' : undefined} onClick={() => set({ callbackContact: c })}>
              <div className="ch-left">
                <div className="ch-num">{c.number}</div>
                <div className="ch-skill"><span className="dir">{c.outbound ? '↑' : '↓'}</span><Phone size={13} /> {c.skill}</div>
              </div>
              <div className="ch-right"><div>{c.date}</div><div className="ch-closed">Closed</div></div>
            </button>
          ))}
        </div>
      ) : (
        <div className="aw-empty" data-tour="ws-history-list">No Records Found</div>
      )}
    </div>
  );
}

/* ---------------- Search ---------------- */
export function SearchPanel() {
  const { s, set } = useSim();
  const [q, setQ] = useState('');
  const rows = q ? s.contactHistory.filter((c) => c.number.includes(q) || c.skill.toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <div className="aw-panel">
      <PanelTitle icon={<Search size={19} />}>Search</PanelTitle>
      <div className="dir-search" data-tour="ws-search-box">
        <Search size={17} />
        <input placeholder="Search past interactions by phone number or skill" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!q ? <div className="aw-empty">Type to search your interactions</div> : rows.length ? (
        <div className="ch-list aw-ch">
          {rows.map((c, i) => (
            <button key={c.id + i} className="ch-item" onClick={() => set({ callbackContact: c })}>
              <div className="ch-left"><div className="ch-num">{c.number}</div><div className="ch-skill"><Phone size={13} /> {c.skill}</div></div>
              <div className="ch-right"><div>{c.date}</div><div className="ch-closed">Closed</div></div>
            </button>
          ))}
        </div>
      ) : <div className="aw-empty">No Matches Found</div>}
    </div>
  );
}

/* ---------------- Queue Counter ---------------- */
export function QueuePanel() {
  const { s } = useSim();
  const ringing = s.call?.phase === 'ringing' ? 1 : 0;
  useNowTick();
  const wave = Math.floor(Date.now() / 20000) % 4; // counts change every ~20s
  const counts: Record<string, [number, string]> = { digital: [[0, 1, 0, 2][wave], ['0s', '14s', '0s', '41s'][wave]], voice: [[1, 2, 0, 3][wave] + ringing, ['22s', '1m 05s', '0s', '1m 48s'][wave]], vm: [[2, 2, 3, 3][wave], ['3h 12m', '3h 13m', '3h 14m', '3h 15m'][wave]], work: [0, '0s'] };
  const icon = (id: string) =>
    id === 'digital' ? <Waypoints size={18} color="#f0a030" /> : id === 'voice' ? <PhoneIncoming size={17} color="#3c3c8c" /> : id === 'vm' ? <Voicemail size={18} color="#c0392b" /> : <List size={18} color="#3c6cc0" />;
  return (
    <div className="aw-panel">
      <PanelTitle icon={<List size={19} />}>Queue Counter</PanelTitle>
      <table className="aw-qtable" data-tour="ws-queue-table">
        <thead><tr><th>Channel</th><th>Contacts in Queue</th><th>Wait</th><th /></tr></thead>
        <tbody>
          {QUEUE_CHANNELS.map((c) => (
            <tr key={c.id}>
              <td><span className="q-ch">{icon(c.id)} {c.label}</span></td>
              <td>{counts[c.id][0]}</td>
              <td>{counts[c.id][1]}</td>
              <td className="q-chev"><ChevronRight size={18} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Directory ---------------- */
export function DirectoryPanel() {
  const { s, set } = useSim();
  const [showAll, setShowAll] = useState({ agents: false, skills: false });
  const [filterOpen, setFilterOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const q = s.dirQuery.trim();
  const digits = q.replace(/[\s()-]/g, '');
  const isNumber = /^\+?\d{3,}$/.test(digits);
  const ql = q.toLowerCase();
  const fav = (k: string) => s.favorites.includes(k);
  const toggleFav = (k: string) => set((x) => ({ favorites: x.favorites.includes(k) ? x.favorites.filter((f) => f !== k) : [...x.favorites, k].slice(0, 25) }));
  const f = s.dirFilter;
  let agents = DIR_AGENTS.filter((a) => !ql || a.name.toLowerCase().includes(ql));
  let skills = DIR_SKILLS.filter((k) => !ql || k.name.toLowerCase().includes(ql));
  if (f === 'Favorites') { agents = agents.filter((a) => fav(a.name)); skills = skills.filter((k) => fav(k.name)); }
  const showAgents = (f === 'All' || f === 'Agents' || f === 'Favorites') && !isNumber;
  const showSkills = (f === 'All' || f === 'Skills' || f === 'Favorites') && !isNumber;
  const teams = DIR_TEAMS.filter((t) => !ql || t.name.toLowerCase().includes(ql));
  const showTeams = (f === 'All' || f === 'Teams') && !isNumber && (f === 'Teams' || !!ql);
  const callTo = (number: string, name?: string) => set({ skillPrompt: { number, name } });
  const busy = !!s.call || !!s.wrap;
  return (
    <div className="aw-panel">
      <PanelTitle icon={<BookUser size={19} />}>Directory</PanelTitle>
      <div className="rel">
        <div className={'dir-search' + (focus ? ' focus' : '')} data-tour="ws-dir-search">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Search for people, skills, teams, dial in a number to call, etc."
            value={s.dirQuery}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onChange={(e) => set({ dirQuery: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { if (isNumber && !busy) callTo(digits); else setShowAll({ agents: true, skills: true }); } }}
          />
        </div>
        {focus && !q && <div className="aw-tip center">Search Directory or press Enter for all results</div>}
      </div>
      <div className="rel">
        <button className="dir-filter" data-tour="ws-dir-filter" onClick={() => setFilterOpen(!filterOpen)}>{f}<ChevronDown size={16} /></button>
        {filterOpen && (
          <div className="dir-filter-menu">
            {DIR_FILTERS.map((x) => <button key={x} className={x === f ? 'on' : ''} onClick={() => { set({ dirFilter: x }); setFilterOpen(false); }}>{x}</button>)}
          </div>
        )}
      </div>
      <div className="dir-results" data-tour="ws-dir-results">
        {isNumber && (
          <>
            <div className="dir-outbound">Outbound: {digits}</div>
            <button className="dir-voice" data-tour="ws-dir-voicecall" disabled={busy} onClick={() => callTo(digits)}><Phone size={18} /> Voice Call</button>
            <div className="aw-empty small">No Matches Found</div>
          </>
        )}
        {showAgents && (
          <div data-tour="ws-dir-agents">
            <div className="dir-sec">Agents</div>
            {(showAll.agents ? agents : agents.slice(0, 2)).map((a, i) => (
              <div key={a.name} className="dir-row">
                <div className="flex1">
                  <div className="dir-name"><Headset size={17} className="dir-ic" /> {a.name}</div>
                  <div className="dir-meta">
                    <StateIcon state={a.state} /> {a.state} <span className="muted">{a.since}</span>
                    <button className="dir-call" title="Call" disabled={busy} data-tour={i === 0 ? 'ws-dir-agent-call' : undefined} onClick={() => callTo('Ext. ' + (1001 + i), a.name)}><Phone size={13} /></button>
                  </div>
                </div>
                <button className={'dir-star' + (fav(a.name) ? ' on' : '')} data-tour={i === 0 ? 'ws-dir-star' : undefined} onClick={() => toggleFav(a.name)} aria-label="Favorite"><Star size={18} /></button>
              </div>
            ))}
            {!agents.length && <div className="aw-empty small">No agents</div>}
            {agents.length > 2 && !showAll.agents && <button className="dir-more" onClick={() => setShowAll({ ...showAll, agents: true })}>load more...</button>}
          </div>
        )}
        {showSkills && (
          <div data-tour="ws-dir-skills">
            <div className="dir-sec">Skills</div>
            {(showAll.skills ? skills : skills.slice(0, 2)).map((k) => (
              <div key={k.name} className="dir-row">
                <div className="flex1">
                  <div className="dir-name"><Wrench size={17} className="dir-ic" /> {k.name}</div>
                  <div className="dir-meta">
                    {k.available ? <><StateIcon state="Available" /> Available ({k.available})</> : <><StateIcon state="Unavailable" /> Unavailable</>}
                    <span className="muted">Queue: {k.queue}</span><span className="muted">Wait: {k.wait}</span>
                    <button className="dir-call boxed" title="Call" disabled={busy} onClick={() => callTo('Skill ' + k.name, k.name)}><Phone size={13} /></button>
                  </div>
                </div>
                <button className={'dir-star' + (fav(k.name) ? ' on' : '')} onClick={() => toggleFav(k.name)} aria-label="Favorite"><Star size={18} /></button>
              </div>
            ))}
            {!skills.length && <div className="aw-empty small">No skills</div>}
            {skills.length > 2 && !showAll.skills && <button className="dir-more" onClick={() => setShowAll({ ...showAll, skills: true })}>load more...</button>}
          </div>
        )}
        {showTeams && (
          <div>
            <div className="dir-sec">Teams</div>
            {teams.map((t) => (
              <div key={t.name} className="dir-row">
                <div className="flex1">
                  <div className="dir-name"><Users size={17} className="dir-ic" /> {t.name}</div>
                  <div className="dir-meta"><span className="muted">{t.members} members</span><span className="muted">{t.available} available</span></div>
                </div>
              </div>
            ))}
            {!teams.length && <div className="aw-empty small">No teams</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: string }) {
  if (state === 'Available') return <CircleCheck size={15} className="st-fill ok" />;
  if (state === 'Working') return <Clock size={15} className="st-ic" style={{ color: '#f0a030' }} />;
  return <CircleMinus size={15} className="st-fill bad" />;
}

/* ---------------- Schedule & Commitments ---------------- */
export function parseCommitTime(t: string): number {
  const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return Number.POSITIVE_INFINITY;
  let h = +m[4] % 12;
  if (m[6].toUpperCase() === 'PM') h += 12;
  return new Date(+m[3], +m[1] - 1, +m[2], h, +m[5]).getTime();
}

export function SchedulePanel() {
  const { s } = useSim();
  return (
    <div className="aw-panel">
      <PanelTitle icon={<CalendarDays size={19} />}>Schedule</PanelTitle>
      {s.scheduleMode === 'calendar' ? <ScheduleCalendar /> : <CommitmentEditor />}
      {s.commitRemoveFor && <RemoveCommitment />}
    </div>
  );
}

function ScheduleCalendar() {
  const { s, set } = useSim();
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); });
  const d = new Date(day);
  const nowD = new Date();
  const isToday = d.toDateString() === nowD.toDateString();
  // only commitments booked for me show on my schedule (skill commitments go to the skill's queue)
  const dayCommits = s.commitments.filter((c) => c.target === 'me' && new Date(parseCommitTime(c.time)).toDateString() === d.toDateString());
  const commitHours = dayCommits.map((c) => new Date(parseCommitTime(c.time)).getHours());
  const base = isToday ? nowD.getHours() : 8;
  const startHour = Math.max(0, Math.min(base, ...commitHours));
  const endHour = Math.min(24, Math.max(startHour + 5, ...commitHours.map((h) => h + 2)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const label = (h: number) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
  const rowH = 70;
  const nowTop = isToday ? ((nowD.getHours() - startHour) + nowD.getMinutes() / 60) * rowH : -1;
  const shift = (n: number) => setDay(day + n * (s.scheduleView === 'week' ? 7 : 1) * 86400000);
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(day - d.getDay() * 86400000 + i * 86400000));
  return (
    <>
      <div className="aw-subtabs"><button className="on">My Schedule</button></div>
      <div className="sch-bar" data-tour="ws-sch-bar">
        <div className="sch-date">
          <button onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft size={16} /></button>
          <span>{d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <button onClick={() => shift(1)} aria-label="Next"><ChevronRight size={16} /></button>
        </div>
        <button className="sch-today" onClick={() => { const t = new Date(); t.setHours(0, 0, 0, 0); setDay(t.getTime()); }}><LocateFixed size={16} /> Today</button>
        <div className="sch-seg" data-tour="ws-sch-view">
          <button className={s.scheduleView === 'day' ? 'on' : ''} onClick={() => set({ scheduleView: 'day' })}>Day</button>
          <button className={s.scheduleView === 'week' ? 'on' : ''} onClick={() => set({ scheduleView: 'week' })}>Week</button>
        </div>
        <span className="flex1" />
        <div className="rel">
          <button className="btn-primary sch-add" data-tour="ws-sch-add" onClick={() => set({ addMenuOpen: !s.addMenuOpen })}><CalendarPlus size={16} /> Add ▾</button>
          {s.addMenuOpen && (
            <div className="sch-add-menu">
              <button data-tour="ws-sch-commitment" onClick={() => set({ addMenuOpen: false, scheduleMode: 'add', draft: emptyDraft() })}>Commitment</button>
            </div>
          )}
        </div>
      </div>
      {s.scheduleView === 'day' ? (
        <div className="sch-day" data-tour="ws-sch-day">
          <div className="sch-dayhead">{d.toLocaleDateString('en-US', { weekday: 'long' })} {d.getMonth() + 1}/{d.getDate()}</div>
          <div className="sch-shift"><span>Shift</span>{isToday && <span className="sch-blocks">{SHIFT_BLOCKS.map((b, i) => <span key={i} className={'sch-block ' + b.kind} title={`${b.label} ${b.start[0] % 12 || 12}:${String(b.start[1]).padStart(2, '0')} (${b.mins} min)`} style={{ flex: b.mins }}>{b.mins >= 45 ? b.label : ''}</span>)}</span>}</div>
          {isToday && <div className="sch-legend"><span className="sch-block open" /> Open <span className="sch-block break" /> Break <span className="sch-block lunch" /> Lunch <span className="sch-block meeting" /> Meeting · 8:00 AM – 5:00 PM</div>}
          <div className="sch-grid" style={{ height: hours.length * rowH }}>
            {hours.map((h, i) => <div key={h} className="sch-hour" style={{ top: i * rowH }}><span>{label(h)}</span></div>)}
            {nowTop >= 0 && nowTop <= hours.length * rowH && <div className="sch-now" style={{ top: nowTop }}><span /></div>}
            {dayCommits.map((c) => {
              const t = new Date(parseCommitTime(c.time));
              const top = ((t.getHours() - startHour) + t.getMinutes() / 60) * rowH;
              if (top < 0 || top > hours.length * rowH) return null;
              return <ScheduleCommitment key={c.id} c={c} top={top} />;
            })}
          </div>
          {dayCommits.length > 0 && <div className="sch-list">{dayCommits.map((c) => <div key={c.id}><Calendar size={13} /> {c.time} — {c.first} {c.last} ({c.phone}){c.due ? ' · due now' : ''}</div>)}</div>}
        </div>
      ) : (
        <div className="sch-week">
          {weekDays.map((w) => (
            <div key={w.toDateString()} className={'sch-wday' + (w.toDateString() === nowD.toDateString() ? ' today' : '')}>
              <div className="sch-wday-h">{w.toLocaleDateString('en-US', { weekday: 'short' })} {w.getMonth() + 1}/{w.getDate()}</div>
              {s.commitments.filter((c) => c.target === 'me' && new Date(parseCommitTime(c.time)).toDateString() === w.toDateString()).map((c) => <div key={c.id} className="sch-commit static">{c.first} {c.last}</div>)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** A commitment block on the day grid. Hover (or click to pin) shows its details with Edit / Remove. */
function ScheduleCommitment({ c, top }: { c: Commitment; top: number }) {
  const { s, set } = useSim();
  const [hover, setHover] = useState(false);
  const open = hover || s.commitPopFor === c.id;
  return (
    <div className="sch-commit-wrap" style={{ top }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button className={'sch-commit' + (c.due ? ' due' : '')} data-tour="ws-sch-commit-item" onClick={() => set({ commitPopFor: s.commitPopFor === c.id ? null : c.id })}>
        Commitment
      </button>
      {open && (
        <div className="sch-pop" data-tour="ws-sch-pop">
          <div className="sch-pop-h"><CalendarClock size={16} /> Commitment{c.due && <span className="sch-pop-due">Due now</span>}</div>
          <div className="sch-pop-grid">
            <span>Customer</span><b>{c.first} {c.last}</b>
            <span>Phone</span><b>{c.phone}</b>
            <span>Time</span><b>{c.time}</b>
            <span>Time Zone</span><b>{c.tz}</b>
            <span>Skill</span><b>{c.skill}</b>
            {c.notes && <><span>Notes</span><b>{c.notes}</b></>}
          </div>
          <div className="sch-pop-actions">
            <button className="btn-outline" data-tour="ws-sch-commit-remove" onClick={() => set({ commitPopFor: null, commitRemoveFor: c.id, commitRemoveReason: '' })}>Remove</button>
            <button className="btn-primary" data-tour="ws-commit-edit" onClick={() => { setHover(false); set({ commitPopFor: null, scheduleMode: 'edit', skillDdOpen: false, draft: { ...c } }); }}>Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Add / Edit Commitment. Opened from Schedule › Add › Commitment, from ⋮ › Add Commitment on a call, or Edit on the schedule. */
function CommitmentEditor() {
  const { s, set } = useSim();
  const d = s.draft;
  const editing = s.scheduleMode === 'edit';
  const upd = (p: Partial<typeof d>) => set((x) => ({ draft: { ...x.draft, ...p } }));
  const valid = d.first.trim() && d.last.trim() && d.phone.trim() && isFinite(parseCommitTime(d.time));
  const skills = [...new Set([d.skill, s.call?.skill, ...AGENT_SKILLS.filter((k) => k.outbound).map((k) => k.name)].filter((k): k is string => !!k))];
  const close = () => set({ scheduleMode: 'calendar', skillDdOpen: false });
  const save = () => {
    if (!valid) return;
    const forSkill = d.target === 'skill';
    set((x) => editing
      ? { commitments: x.commitments.map((k) => (k.id === x.draft.id ? { ...x.draft, due: parseCommitTime(x.draft.time) <= Date.now() && x.draft.target === 'me' } : k)), scheduleMode: 'calendar', skillDdOpen: false, draft: emptyDraft() }
      : { commitments: [...x.commitments, { ...x.draft, id: 'k' + Date.now() }], scheduleMode: 'calendar', skillDdOpen: false, draft: emptyDraft(), stats: { ...x.stats, commitmentsBooked: x.stats.commitmentsBooked + 1 } });
    toast(forSkill ? `Commitment saved to ${d.skill}. Any agent in that skill can call ${d.first} back.` : editing ? 'Commitment updated' : 'Commitment saved to your schedule', 'info');
  };
  return (
    <div className="ac" data-tour="ws-commit-form">
      <button className="ac-back" onClick={close}><ChevronLeft size={16} /> {editing ? 'Edit Commitment' : 'Add Commitment'}</button>
      <div className="ac-radios" data-tour="ws-commit-target">
        <label data-tour="ws-commit-me"><input type="radio" name="commit-target" checked={d.target === 'me'} onChange={() => upd({ target: 'me' })} /> Agent (Me)</label>
        <label data-tour="ws-commit-skill"><input type="radio" name="commit-target" checked={d.target === 'skill'} onChange={() => upd({ target: 'skill' })} /> Skill</label>
      </div>
      <div className="rel">
        <button className={'ac-dd' + (s.skillDdOpen ? ' open' : '')} data-tour="ws-commit-skill-dd" onClick={() => set({ skillDdOpen: !s.skillDdOpen })} aria-expanded={s.skillDdOpen}>
          <span>{d.skill}</span><ChevronDown size={16} />
        </button>
        {s.skillDdOpen && (
          <div className="ac-dd-menu" data-tour="ws-commit-skill-menu">
            {skills.map((k) => <button key={k} className={k === d.skill ? 'on' : ''} onClick={() => set((x) => ({ skillDdOpen: false, draft: { ...x.draft, skill: k } }))}>{k}</button>)}
          </div>
        )}
      </div>
      <div className="ac-hint">{d.target === 'me' ? 'You will make this callback. It appears on your schedule.' : 'Any agent in this skill can make this callback. It will not appear on your schedule.'}</div>
      <div className="ac-sec">Customer</div>
      <div className="ac-two">
        <label className="ac-f" data-tour="ws-commit-first"><span>First Name <i>*</i></span><input value={d.first} onChange={(e) => upd({ first: e.target.value })} /></label>
        <label className="ac-f" data-tour="ws-commit-last"><span>Last Name <i>*</i></span><input value={d.last} onChange={(e) => upd({ last: e.target.value })} /></label>
      </div>
      <label className="ac-f" data-tour="ws-commit-phone"><span>Contact Information <i>*</i></span>
        <div className="ac-phone"><span className="ac-chip">Phone</span><input value={d.phone} onChange={(e) => upd({ phone: e.target.value })} /></div>
      </label>
      <label className="ac-f" data-tour="ws-commit-time"><span>Time <i>*</i></span>
        <div className="ac-time"><input value={d.time} onChange={(e) => upd({ time: e.target.value })} /><span className="ac-ic"><Calendar size={16} /></span><span className="ac-ic"><Clock size={16} /></span></div>
      </label>
      <label className="ac-f"><span>Time Zone</span>
        <select className="ac-select" value={d.tz} onChange={(e) => upd({ tz: e.target.value })}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      <label className="ac-f" data-tour="ws-commit-notes"><span>Notes</span><textarea rows={2} placeholder="Add Notes" value={d.notes} onChange={(e) => upd({ notes: e.target.value })} /></label>
      <div className="ac-actions">
        <button className="btn-outline" onClick={close}>Cancel</button>
        <button className="btn-primary" data-tour="ws-commit-save" disabled={!valid} onClick={save}>Save</button>
        {editing && <button className="btn-primary" data-tour="ws-commit-remove" onClick={() => set({ commitRemoveFor: d.id, commitRemoveReason: '', skillDdOpen: false })}>Remove</button>}
      </div>
    </div>
  );
}

/** "Remove Commitment" confirmation. A reason is required. */
function RemoveCommitment() {
  const { s, set } = useSim();
  const reason = s.commitRemoveReason;
  const remove = () => {
    if (!reason.trim()) return;
    set((x) => ({ commitments: x.commitments.filter((k) => k.id !== x.commitRemoveFor), commitRemoveFor: null, commitRemoveReason: '', commitPopFor: null, scheduleMode: 'calendar', draft: emptyDraft() }));
    toast('Commitment removed', 'info');
  };
  return (
    <div className="rc-scrim">
      <div className="rc" role="dialog" aria-label="Remove Commitment" data-tour="ws-commit-remove-modal">
        <div className="rc-h"><TriangleAlert size={26} className="rc-warn" /> <span>Remove Commitment</span></div>
        <div className="rc-body">
          <p>Are you sure you want to remove this commitment?</p>
          <input autoFocus placeholder="Reason for removing" value={reason} data-tour="ws-commit-reason" onChange={(e) => set({ commitRemoveReason: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') remove(); }} />
          <div className={'rc-help' + (reason.trim() ? '' : ' req')}>Notes are required</div>
          <div className="rc-btns">
            <button className="btn-primary" data-tour="ws-commit-remove-confirm" disabled={!reason.trim()} onClick={remove}>Remove</button>
            <button className="btn-outline" onClick={() => set({ commitRemoveFor: null, commitRemoveReason: '' })}>Keep</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WemPanel() {
  const [range, setRange] = useState('Last 24 hours');
  const now = new Date();
  const from = new Date(now.getTime() - (range === 'Last 24 hours' ? 1 : 7) * 86400000);
  const segs = WEM_SEGMENTS.filter((g) => g.when <= (range === 'Last 24 hours' ? 24 : 168));
  const f = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
  return (
    <div className="aw-panel">
      <PanelTitle icon={<CircleUserRound size={20} />} right={<ExternalLink size={18} />}>WEM</PanelTitle>
      <div className="wem" data-tour="ws-wem">
        <div className="wem-rail"><Users size={18} /></div>
        <div className="wem-main">
          <h3>Recent Interactions</h3>
          <div className="wem-card">
            <select className="wem-select" value={range} onChange={(e) => setRange(e.target.value)}>
              <option>Last 24 hours</option><option>Last 7 days</option>
            </select>
            <div className="wem-found">Found <b>{segs.length}</b> segments | {f(from)} - {f(now)}</div>
            {segs.length ? (
              <table className="wem-table">
                <thead><tr><th>Start time</th><th>Direction</th><th>Customer</th><th>Skill</th><th>Duration</th><th /></tr></thead>
                <tbody>{segs.map((g) => (
                  <tr key={g.id}><td>{f(new Date(now.getTime() - g.when * 3600000))}</td><td>{g.direction}</td><td>{g.number}</td><td>{g.skill}</td><td>{g.duration}</td><td><button className="wem-play" title="Play recording (simulated)"><Play size={13} /></button></td></tr>
                ))}</tbody>
              </table>
            ) : (
              <div className="wem-empty">
                <svg width="120" height="90" viewBox="0 0 120 90" aria-hidden>
                  <ellipse cx="60" cy="72" rx="48" ry="14" fill="#e6ebf2" />
                  <circle cx="52" cy="38" r="20" fill="none" stroke="#9fb3cf" strokeWidth="5" />
                  <line x1="66" y1="52" x2="84" y2="70" stroke="#9fb3cf" strokeWidth="7" strokeLinecap="round" />
                </svg>
                <div>We didn't find any results</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
const SETTINGS_TABS = [
  ['login', 'Login & Voice\nPreferences'], ['av', 'A/V Notifications'], ['display', 'Display &\nKeyboard'], ['info', 'Information'], ['skills', 'Agent Skills'], ['issue', 'Report Issue'],
] as const;

function Toggle({ on, onChange, tour }: { on: boolean; onChange: (v: boolean) => void; tour?: string }) {
  return <button className={'aw-toggle' + (on ? ' on' : '')} role="switch" aria-checked={on} data-tour={tour} onClick={() => onChange(!on)}><span /></button>;
}
function OSelect({ label, value, options, onChange, tour }: { label?: string; value: string; options: string[]; onChange: (v: string) => void; tour?: string }) {
  return (
    <label className="o-select" data-tour={tour}>
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
    </label>
  );
}

export function SettingsPanel() {
  const { s, set } = useSim();
  return (
    <div className="aw-panel">
      <PanelTitle icon={<Settings size={19} />}>Settings</PanelTitle>
      <div className="set-tabs" data-tour="ws-set-tabs">
        {SETTINGS_TABS.map(([id, label]) => (
          <button key={id} className={s.settingsTab === id ? 'on' : ''} data-tour={`ws-set-${id}`} onClick={() => set({ settingsTab: id })}>{label}</button>
        ))}
      </div>
      <div className="set-body">
        {s.settingsTab === 'login' && <LoginVoice />}
        {s.settingsTab === 'av' && <AvNotif />}
        {s.settingsTab === 'display' && <DisplayKb />}
        {s.settingsTab === 'info' && <Information />}
        {s.settingsTab === 'skills' && <AgentSkillsTab />}
        {s.settingsTab === 'issue' && <ReportIssue />}
      </div>
    </div>
  );
}

function usePref() {
  const { s, set } = useSim();
  return [s.prefs, (k: string, v: string | number | boolean) => set((x) => ({ prefs: { ...x.prefs, [k]: v } }))] as const;
}

function LoginVoice() {
  const [p, setP] = usePref();
  return (
    <div className="set-two">
      <div>
        <div className="set-h">Softphone</div>
        <div className="set-vol" data-tour="ws-set-volume"><Volume1 size={18} /><input type="range" min={0} max={100} value={p.volume as number} onChange={(e) => setP('volume', +e.target.value)} /><Volume2 size={18} /></div>
        <div className="set-row" data-tour="ws-set-autoaccept"><Phone size={17} /> <span className="flex1">Auto Accept</span><Toggle on={!!p.autoAccept} onChange={(v) => setP('autoAccept', v)} /></div>
        <div className="set-inline"><OSelect label="Ringtone" value={p.ringtone as string} options={RINGTONES} onChange={(v) => setP('ringtone', v)} /><button className="play" aria-label="Play ringtone" onClick={() => previewRingtone(p.ringtone as string, p.volume as number)}><Play size={14} /></button></div>
        <div className="set-h light">Secondary Ringer</div>
        <OSelect label="Secondary Device" value={p.secondaryDevice as string} options={['None', 'Speakers (Built-in)', 'Headset Earphone']} onChange={(v) => setP('secondaryDevice', v)} />
        <OSelect label="Delay Seconds" value={p.delaySeconds as string} options={['None', ...Array.from({ length: 10 }, (_, i) => String(i + 1))]} onChange={(v) => setP('delaySeconds', v)} />
      </div>
      <div>
        <div className="set-h dark">Jabra Call Control</div>
        <p className="set-p">Use your headset to answer and end calls, mute and other features supported by your headset.</p>
        <div className="set-h dark sm">Add Devices</div>
        <p className="set-p">Choose Add Devices button to select which headset(s) you will be using. You will be asked to provide consent before adding devices.</p>
        <button className="set-link">Add Devices</button>
        <div className="set-h dark sm">Selected Devices</div>
        <p className="set-p">Any added devices will appear here.</p>
        <OSelect label="Selected Devices" value="No Devices" options={['No Devices']} onChange={() => {}} />
      </div>
    </div>
  );
}

function AvNotif() {
  const [p, setP] = usePref();
  const rows: [string, string, string, string][] = [['New Agent Message', 'aMsg', 'tMsg', 'vMsg'], ['New Contact', 'aContact', 'tContact', 'vContact'], ['New Contact Reply', 'aReply', 'tReply', 'vReply'], ['End Chat or Call', 'aEnd', 'tEnd', 'vEnd']];
  return (
    <div className="set-two av" data-tour="ws-set-av-body">
      <div>
        <div className="set-h blue">Audio Notifications</div>
        {rows.map(([l, a, t], i) => (
          <div key={a} className="set-row" data-tour={i === 1 ? 'ws-set-av-contact' : undefined}>
            <span className="set-lbl">{l}</span><Toggle on={!!p[a]} onChange={(v) => setP(a, v)} />
            <OSelect label={l} value={p[t] as string} options={TONES} onChange={(v) => setP(t, v)} />
            <Volume2 size={18} className="muted" />
          </div>
        ))}
      </div>
      <div>
        <div className="set-h blue">Visual Notifications</div>
        {rows.map(([l, , , v]) => <div key={v} className="set-row"><span className="set-lbl">{l}</span><Toggle on={!!p[v]} onChange={(x) => setP(v, x)} /></div>)}
      </div>
    </div>
  );
}

function DisplayKb() {
  const [p, setP] = usePref();
  return (
    <div className="set-one">
      <div className="set-h">Display</div>
      <div className="set-row w"><Clock size={17} /> <span className="flex1">24 hour time</span><Toggle on={!!p.h24} onChange={(v) => setP('h24', v)} /></div>
      <div className="set-row w"><AppWindow size={17} /> <span className="flex1">Panel Open in Browser: General</span><Toggle on={!!p.panelGeneral} onChange={(v) => setP('panelGeneral', v)} /></div>
      <div className="set-row w"><AppWindow size={17} /> <span className="flex1">Panel Open in Browser: Page Action Only</span><Toggle on={!!p.panelPageAction} onChange={(v) => setP('panelPageAction', v)} /></div>
      <div className="set-row w"><ArrowUpDown size={17} /> <span className="set-lbl wide">Email Message Sort Order</span><OSelect value={p.emailSort as string} options={['Oldest to newest (default)', 'Newest to oldest']} onChange={(v) => setP('emailSort', v)} /></div>
      <div className="set-h">Keyboard</div>
      <div className="set-row w"><SendHorizontal size={17} /> <span className="set-lbl wide">Send with Enter</span><OSelect value={p.sendEnter as string} options={['All channels except email', 'All channels', 'None']} onChange={(v) => setP('sendEnter', v)} /></div>
      <div className="set-row w"><Keyboard size={17} /> <span>Shortcuts</span></div>
      <table className="set-short" data-tour="ws-set-shortcuts">
        <thead><tr><th>Action</th><th>Shortcut</th></tr></thead>
        <tbody>
          {SHORTCUTS.map(([g, list]) => (
            <Fragment key={g}><tr className="grp"><td colSpan={2}>{g}</td></tr>{list.map(([a, k]) => <tr key={a}><td>{a}</td><td><kbd>{k}</kbd></td></tr>)}</Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Information() {
  const [p, setP] = usePref();
  const { s } = useSim();
  const [lag] = useState(() => +(0.3 + Math.random() * 0.4).toFixed(2));
  const items: [string, string][] = [
    ['Agent Name', `${USER.first} ${USER.last}`], ['Displayed Username', s.username || USER.username], ['Agent ID', AGENT_INFO.agentId],
    [`Version ${AGENT_INFO.version}`, AGENT_INFO.build], ['Station ID', 'N/A'], ['Session ID', AGENT_INFO.sessionId],
    ['Phone Number', 'WebRTC'], ['Agent Leg ID', s.agentLeg ? '18' + AGENT_INFO.sessionId.slice(0, 6) : 'N/A'], ['Caller ID', AGENT_INFO.callerId],
    ['Browser Version', 'Chrome'], ['Web Server', '--'], ['Virtual Cluster', AGENT_INFO.cluster],
    ['Browser Language', 'en-US'], ['Browser Localization', 'en-US'], ['Team Name', AGENT_INFO.team],
  ];
  return (
    <div className="set-one">
      <div className="info-conn" data-tour="ws-set-conn">
        <div>
          <div className="info-h">Platform Connection Status</div>
          <div className="muted">{new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          <div className="muted">Your connection lag time is <b>{lag} Seconds</b></div>
        </div>
        <div className="info-gauge">
          <div className="muted small center">Connection lag time in seconds</div>
          <div className="info-bar"><span>0</span><div className="info-grad"><i style={{ left: `${(lag / 4) * 100}%` }} /></div><span>4.00</span></div>
          <div className="info-val" style={{ marginLeft: `calc(28px + ${(lag / 4) * 100}% * 0.86)` }}>{lag}</div>
        </div>
      </div>
      <div className="info-grid">{items.map(([k, v]) => <div key={k}><div className="info-h">{k}</div><div className="muted">{v}</div></div>)}</div>
      <div className="info-sec">Interaction Routing</div>
      <div className="info-grid">
        {[['Contact Limit', '1 Call, 1 Digital'], ['Total Limit', '1'], ['Routing', 'Omni'], ['Request Contact', 'Disabled'], ['Contact Auto Focus', 'Disabled']].map(([k, v]) => <div key={k}><div className="info-h">{k}</div><div className="muted">{v}</div></div>)}
      </div>
      <div className="info-sec">Logging Configuration</div>
      <div style={{ width: 220 }}><OSelect label="Log Level" value={p.logLevel as string} options={LOG_LEVELS} onChange={(v) => setP('logLevel', v)} /></div>
    </div>
  );
}

function AgentSkillsTab() {
  const [q, setQ] = useState('');
  const list = AGENT_SKILLS.filter((k) => k.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="set-one">
      <div className="dir-search sm"><Search size={17} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /><Funnel size={17} /></div>
      <div className="sk-h" data-tour="ws-set-skill-list">Assigned Skills ({list.length})</div>
      {list.map((k) => <div key={k.name} className="sk-row"><span className="dir">{k.outbound ? '↑' : '↓'}</span><Phone size={14} /> {k.name}</div>)}
    </div>
  );
}

function ReportIssue() {
  const { s, set } = useSim();
  const i = s.issue;
  const upd = (p: Partial<typeof i>) => set((x) => ({ issue: { ...x.issue, ...p, sent: false } }));
  const ok = i.category && i.priority && i.comment.trim();
  return (
    <div className="set-one ri" data-tour="ws-set-issue-form">
      <div className="ri-h">Report an Issue</div>
      <label className="ri-f"><span>Category <i>*</i></span><select value={i.category} onChange={(e) => upd({ category: e.target.value })}><option value="">Select</option>{ISSUE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="ri-f"><span>Priority <i>*</i></span><select value={i.priority} onChange={(e) => upd({ priority: e.target.value })}><option value="">Select</option>{ISSUE_PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="ri-f"><span>Comment <i>*</i></span><textarea rows={6} value={i.comment} onChange={(e) => upd({ comment: e.target.value })} /></label>
      <button className="btn-primary" disabled={!ok} onClick={() => set((x) => ({ issue: { category: '', priority: '', comment: '', sent: true }, stats: { ...x.stats, issuesSent: x.stats.issuesSent + 1, lastIssueCategory: x.issue.category } }))}>Submit</button>
      {i.sent && <div className="ri-sent"><CircleCheck size={15} /> Issue submitted (simulation — nothing was sent).</div>}
    </div>
  );
}

/* ---------------- Reporting ---------------- */
function liveProductivity(s: SimState) {
  const now = Date.now();
  const tot = { Available: 0, Working: 0, Unavailable: 0 } as Record<string, number>;
  const sub: Record<string, number> = {};
  s.stateLog.forEach((e, i) => {
    const end = s.stateLog[i + 1]?.start ?? now;
    const d = end - e.start;
    if (e.status === 'Logged Out') return;
    const cat = e.status === 'Available' ? 'Available' : e.status === 'Working' ? 'Working' : 'Unavailable';
    tot[cat] += d;
    sub[e.status] = (sub[e.status] ?? 0) + d;
  });
  const all = tot.Available + tot.Working + tot.Unavailable || 1;
  return { tot, sub, all };
}

export function ReportingPanel() {
  const { s, set } = useSim();
  useNowTick();
  const r = s.reportRange;
  const live = liveProductivity(s);
  const pct = (n: number) => Math.round((n / live.all) * 100);
  const mine = r === 'today' || r === 'custom';
  const team = TEAM_PRODUCTIVITY[r === 'custom' ? 'today' : r];
  const workingAgent = Object.entries(live.sub).filter(([k]) => k === 'Working');
  const unavailSubs = Object.entries(live.sub).filter(([k]) => k !== 'Available' && k !== 'Working');
  const max = Math.max(live.all, 1);
  const Bar = ({ ms, color, label }: { ms: number; color: string; label?: string }) => (
    <div className="rp-time">
      <span className="rp-tick" style={{ background: color }} />
      {ms > 0 && <span className="rp-bar" style={{ width: `${Math.max(2, (ms / max) * 82)}%`, background: color }} />}
      <span className="rp-val">{label ?? fmtDur(ms)}</span>
    </div>
  );
  const TeamBar = ({ p, t, color }: { p: number; t: string; color: string }) => (
    <div className="rp-time"><span className="rp-tick" style={{ background: color }} />{p > 0 && <span className="rp-bar" style={{ width: `${p * 0.82}%`, background: color, opacity: 0.75 }} />}<span className="rp-val">{t}</span></div>
  );
  const prodPct = mine ? pct(live.tot.Available + live.tot.Working) : 0;
  return (
    <div className="aw-panel">
      <PanelTitle icon={<ChartColumn size={19} />}>Reporting</PanelTitle>
      <div className="aw-subtabs">
        <button className={s.reportTab === 'productivity' ? 'on' : ''} onClick={() => set({ reportTab: 'productivity' })}>Productivity</button>
        <button className={s.reportTab === 'performance' ? 'on' : ''} data-tour="ws-rep-performance" onClick={() => set({ reportTab: 'performance' })}>Performance</button>
      </div>
      <div className="rp-head">
        <div className="rp-title">{s.reportTab === 'productivity' ? `Productivity (${prodPct}%)` : 'Performance'}</div>
        <div className="sch-seg rp-range" data-tour="ws-rep-range">
          {([['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['custom', 'Custom']] as const).map(([id, l]) => (
            <button key={id} className={r === id ? 'on' : ''} onClick={() => set({ reportRange: id })}>{l}</button>
          ))}
        </div>
      </div>
      {r === 'custom' && (
        <div className="rp-custom">
          <label>Start Date<input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label>End Date<input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        </div>
      )}
      {s.reportTab === 'productivity' ? (
        <div className="rp-table" data-tour="ws-rep-table">
          <div className="rp-hrow"><span>Agent states</span><span>Time</span></div>
          <div className="rp-row main"><span><CircleCheck size={18} className="st-fill ok" /> Available ({mine ? pct(live.tot.Available) : 0}%)</span><Bar ms={mine ? live.tot.Available : 0} color="#3bb54a" /></div>
          <div className="rp-row"><span>Team ({team.available[0]}%)</span><TeamBar p={team.available[0]} t={team.available[1]} color="#6cc96c" /></div>
          <div className="rp-row main"><span><span className="rp-ring" /> Working ({mine ? pct(live.tot.Working) : 0}%)</span><Bar ms={mine ? live.tot.Working : 0} color="#e3a72f" /></div>
          {mine && <div className="rp-row"><span>OutboundContact</span><Bar ms={workingAgent.reduce((a, [, v]) => a + v, 0)} color="#e3a72f" /></div>}
          <div className="rp-row"><span>Team ({team.working[0]}%)</span><TeamBar p={team.working[0]} t={team.working[1]} color="#e3a72f" /></div>
          <div className="rp-row main"><span><CircleMinus size={18} className="st-fill bad" /> Unavailable ({mine ? pct(live.tot.Unavailable) : 0}%)</span><Bar ms={mine ? live.tot.Unavailable : 0} color="#e8202a" /></div>
          {mine && unavailSubs.map(([k, v]) => <div key={k} className="rp-row"><span>{k}</span><Bar ms={v} color="#e8202a" /></div>)}
          <div className="rp-row"><span>Team ({team.unavailable[0]}%)</span><TeamBar p={team.unavailable[0]} t={team.unavailable[1]} color="#e8656b" /></div>
        </div>
      ) : (
        <div className="rp-perf">
          {[['Contacts Handled', String(mine ? s.contactHistory.length : r === 'yesterday' ? 14 : 63)], ['Average Handle Time', mine && s.contactHistory.length ? 'see Contact History' : '00:04:12'], ['Inbound', String(mine ? s.contactHistory.filter((c) => !c.outbound).length : 9)], ['Outbound', String(mine ? s.contactHistory.filter((c) => c.outbound).length : 5)]].map(([k, v]) => (
            <div key={k} className="rp-kpi"><div className="muted">{k}</div><div className="rp-kpi-v">{v}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

function useNowTick() {
  const [, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(id); }, []);
}

/* ---------------- Help ---------------- */
export function HelpPanel() {
  return (
    <div className="aw-panel">
      <PanelTitle icon={<CircleQuestionMark size={19} />}>Help</PanelTitle>
      <div className="help-body">
        <p>In the real application, Help opens the CXone online help for Agent Workspace in a new tab.</p>
        <p>Use the <b>lessons sidebar</b> on the left to replay any guided lesson in this simulation.</p>
      </div>
    </div>
  );
}
