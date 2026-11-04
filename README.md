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

## Screen pops

During a call the main area is the **App Space**, with two tabs: customer details and **Screen Pops**
(`src/workspace/ScreenPop.tsx`). A screen pop is a web page a system administrator configures to open for a contact.
Here each caller scenario pops a matching, fictional knowledge-base article. **Pop Out** opens it in its own window
(`?app=pop`), and **Pop In** (in that window or in the App Space) brings it back. Closing the window or ending the
call also brings it back. Shortcut: `CTRL + SHIFT + F`. Lesson: *Screen Pops* (`ws-screenpop`), under Handle calls.

## Phone controls

The call card (`CallCard` in `src/workspace/CallView.tsx`) matches CXone Agent: Hold, Mute, Mask / Record, Consult-Transfer,
Keypad / Hang Up, Outcome. Only controls assigned to an agent appear in the real app; the simulator shows all of them.
- **Record** starts voice recording (and screen recording where configured, `call.screenRec`). Once started it's greyed out.
  **Mask** pauses the recording and **Unmask** continues it. You can't hang up while masked.
- **Consult / Transfer** opens the Directory in the App Space (`DirectoryPanel consult`). Each agent, skill or typed number
  has Consult (caller on hold, consult leg on the card) and Transfer. A consult leg can be **merged** into a conference,
  transferred, or ended (`startConsult`, `mergeConsult`, `endConsult` in `callActions.ts`).
- **Keypad** opens inside the call card, for entering IVR tones.
- **Outcome** opens the Outcomes panel at the bottom of the Interactions panel. What you fill in there during the call is
  carried into wrap-up.
Lesson: *Phone Controls* (`ws-controls`), under Handle calls.

## Outbound calls

Start from the **Directory** (left menu) or the **start another action** icon (tooltip "New Outbound") at the top of the
Interactions panel. A number that isn't a Directory contact shows a **Voice Call** option. `requestOutbound` in
`callActions.ts` dials straight away when the agent has one outbound skill (`s.outboundSkills`, the default), or shows a
skill dropdown (`SkillDropdown` in `panels.tsx`) when they have several. While dialing, the call card shows only Hang Up.
The *Making an Outbound Call* lesson demonstrates both cases.

## Transfers & conferences

Consult / Transfer opens the **Directory tab** of the App Space (`ConsultDirectory` in `src/workspace/ConsultPanel.tsx`).
Results appear as you search (filter: Agents, Skills, Teams, Address Book, Favorites) or type a number. Each has
**Call** (consult first) and **Transfer** (⇄, blind/direct). An external number asks for the outbound skill first.
- **Blind transfer**: the call goes straight to the party. The card shows "Interaction completed" and you're Available
  again (`blindTransfer` → `completeInteraction` in `callActions.ts`).
- **Warm transfer**: Call opens the **Consult tab** (`ConsultPanel`). The caller is on hold while the party rings, then
  connects. Swap between them with Resume/Hold (`swapTo`). Transfer (⇄) hands the caller over and ends your interaction.
  Conference (≫) merges the calls (`mergeConsult`).
- **Conference**: hang up either party, add another party (Consult / Transfer icon, back to the Directory), or use the
  Leave split button: **Leave** (others stay connected) or **End Call** (ends it for everyone, then wrap-up).
Lesson: *Transfers & Conferences* (`ws-transfer`), after Phone Controls.

## Testing note

Test runs use a muted browser (`--mute-audio`, with speech and audio stubbed) so nothing plays out loud.

## Digital channels (email & webchat)

`src/workspace/DigitalCanvas.tsx` + `digitalActions.ts`. A digital interaction (`s.digital`) opens in the **agent canvas**:
the **Interaction space** (left) and the **App Space** (right), with a draggable divider (`s.digitalSplit`, arrow keys too).
- **Email** (auto-accepted): thread with From/date headers, Reply opens the response section (To/CC/BCC/From/Subject) with
  the **rich text editor** (emoji, attach, image, links, B/U/I, lists, alignment, color, highlight, font, size, LTR/RTL,
  table), Quick Responses, Discard, Send Message (dropdown: send & resolve).
- **Webchat** (manual accept: Accept/Reject card, or auto-accept when Auto Accept is on): chat bubbles, "Replying to …",
  **plain text only** (emoji, attachments, text direction). The simulated customer answers each reply.
- App Space: customer details, **customer card** app (icon next to the name), Notes, Channels, Interaction History, and
  the ⚡ **quick replies** app (search, View All / Favorites, {{placeholders}}).
- Outcomes panel below the Interaction space; Save & Close adds the interaction to Contact History (chat-bubble icon).
In free practice, a practice email arrives about 20 s after you first go Available.
Lessons: *Handling Email* (`ws-email`) and *Handling Chat* (`ws-chat`), under Digital channels.

### Approvals, quick reply details, transfers (from the CXone training recording)
- **Reply permissions** (`s.replyPermission`): send directly, approval only, or both. The Send Message dropdown lists
  review queues (with search); picking one turns the button into **Request Approval**. The draft leaves the inbox for the
  reviewer. The simulated reviewer denies the first request (the draft comes back with a comment) and approves later
  ones (sent immediately). See `requestApproval` / `resolveApproval` in `digitalActions.ts`.
- **Quick replies**: select one to preview it with custom fields filled in, then **Insert** and edit before sending.
  Stars add it to **Favorites**.
- **Chat**: status New → Pending (after your reply) → Open (customer answered); **Load Previous Messages**; your name
  above your messages; × clears the reply box; card timer switches to "05 min" after 5 minutes.
- **Digital transfer**: Consult / Transfer on the inbox tile → Directory app → search → Transfer next to a skill, team
  or agent → "Digital skill transferred successfully".
Lesson: *Approvals & Digital Transfers* (`ws-approval`).
