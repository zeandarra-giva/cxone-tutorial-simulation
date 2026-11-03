# CXone Training Simulator

An interactive replica of the NiCE CXone screens with spotlight walkthroughs for 4 roles: Agent, Agent Backoffice, Supervisor and Supervisor Backoffice.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ (opens from any web server)
```

All people, usernames and phone numbers are fictional (`src/data/data.ts`). Nothing typed into the simulation leaves the browser.

## Where things live
| What | File |
|---|---|
| Mock data, roles, which apps each role sees | `src/data/data.ts` |
| Top banner, Applications menu, sidebar | `src/components/Shell.tsx` |
| Login | `src/apps/Login.tsx` |
| My Zone, Admin, Supervisor, Dashboard, ACD | `src/apps/CxoneApps.tsx` |
| Agent Workspace window (`?app=cxa`): shell, Voice Connection page | `src/workspace/WorkspaceApp.tsx` |
| Workspace panels (History, Directory, Schedule, Settings, Reporting…) | `src/workspace/panels.tsx` |
| Call controls + Outcome | `src/workspace/CallView.tsx`, `callActions.ts` |
| Workspace walkthrough modules | `src/workspace/wsTours.tsx` |
| Walkthrough modules (steps) | `src/tour/tours.tsx` |
| Spotlight engine | `src/tour/TourEngine.tsx` |

## Adding a tour step
Add `data-tour="my-id"` to an element. Then add a step in `tours.tsx`:
```ts
{ title: 'Title', body: <>Explanation</>, target: t('my-id'), advance: 'click' /* or 'next' | 'state' */, setup: {/* sim state for this step */} }
```
Use `roles: [...]` on a step or tour to limit it to certain roles.

## Agent Workspace window
Clicking **Applications → Agent** opens Agent Workspace in a separate browser window (`?app=cxa`), the same way the real app does. That window has its own **Training** button and modules. In free practice, a simulated inbound call rings about 10 s after you go Available. Allow pop-ups for the site.

## Training modes (Agent Workspace window → Training button)
| Mode | File |
|---|---|
| Tour (Quick Tour + full lessons) | `src/workspace/wsTours.tsx` |
| Explore hotspots | `src/training/Explore.tsx` |
| Story with voice (browser text-to-speech + captions) | `src/training/Story.tsx`, `speech.ts` |
| Missions | `src/training/Missions.tsx` |
| Quiz (Find-it + scenario questions) | `src/training/Quiz.tsx` |
| Shift Simulator | `src/training/ShiftSim.tsx` |
| XP, levels, badges, certificate | `src/training/progress.ts`, `Dock.tsx` |
| Fictional callers + correct dispositions | `src/training/scenarios.ts` |
| Seed data (history, notifications, WEM, schedule, directory) | `src/workspace/wsData.ts` |

Progress is saved per browser (localStorage). Nothing leaves the browser.

## Sharing with trainees (no install needed)

```
npm run build:single
```

This writes **`CXone-Training-Simulator.html`**, one self-contained file with all the HTML, CSS and JavaScript inside.
Trainees just double-click it (or open it from a shared drive / SharePoint / email attachment) in Chrome or Edge.
No Node, no React install, no server, no internet needed. Progress (XP, badges, scores) is saved in that browser.
Allow pop-ups for the file the first time, since Agent Workspace opens in its own window.
