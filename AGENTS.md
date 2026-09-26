# AGENTS.md — ADHD Tools Hub

Shared instructions for every coding agent (Claude, Codex, Gemini, Mistral, Copilot…) and for humans.

**How to read (save tokens):** read this file, then only the `AGENTS.md` of the folder you change.
Do not read whole folders to "get context": each `AGENTS.md` lists what is inside and what depends on it.

| Folder | What it holds | Read |
| --- | --- | --- |
| `core/` | Pure logic: tasks, scheduler, parser, sync merge. No DOM. | [core/AGENTS.md](core/AGENTS.md) |
| `shell/` | Router, config, translations, setup detection | [shell/AGENTS.md](shell/AGENTS.md) |
| `services/` | Storage, Google (auth, Calendar, Drive), import/export | [services/AGENTS.md](services/AGENTS.md) |
| `features/<name>/` | One screen each: JS + CSS + `strings.js` + `AGENTS.md` | [features/AGENTS.md](features/AGENTS.md) |
| `mcp/` | MCP server: AI assistants read the day and queue changes via Google Drive (Node only) | [mcp/AGENTS.md](mcp/AGENTS.md) |
| `styles/` | Legacy shared CSS and the app shell CSS | [styles/AGENTS.md](styles/AGENTS.md) |
| `tests/` | `node:test` unit tests (no browser) | [tests/AGENTS.md](tests/AGENTS.md) |
| `docs/` | User guides and design docs; READMEs in 4 languages | [docs/AGENTS.md](docs/AGENTS.md) |

`index.html` holds all screens (one `<section class="tool-section" id="…">` per feature) and the script load order.

## The product in 5 lines

A day planner for people with ADHD that shows **one thing at a time**. It opens on the **Now** view (current
task/routine/event + countdown) while something is scheduled, and on the **Plan** view (day planner) otherwise.
Routines **book** their time (+ buffer). **Nothing is ever scheduled on top of something else.**
Everything runs in the browser, offline, with `localStorage`. Google and AI are optional add-ons.

**UX rules (do not break):** one main action per screen; at most 2–3 buttons; no `alert()`/`prompt()` for
normal flows (show messages inline); rarely used fields go under "More options"; every text is translated;
works on a 390 px phone (bottom tab bar) and on desktop.

## Commands

```bash
npm ci && npm test                  # unit tests (Node 22, node:test) — must pass before every commit
npm run test:ui                     # browser tests: the real app in headless Chromium, phone + desktop
node .claude/static-server.cjs      # serve on http://localhost:8422 (also under /ADHDtools/ like GitHub Pages)
node mcp/server.js                  # MCP server for AI assistants (stdio); setup: docs/mcp.md
```
`npm run test:ui` needs Chromium once: `npx playwright install chromium` (skip it where Playwright
browsers are preinstalled). CI runs **both** `npm test` and `npm run test:ui` on every PR.
No build step, no bundler, no runtime npm packages: files are served as they are (GitHub Pages).
`jsdom` and `playwright` are for tests only. CI: `.github/workflows/ci.yml` (jobs `test` and `ui`).

## Glossary (use these words in code, comments, commits and PRs)

| Term | Meaning |
| --- | --- |
| **Task** | The one data object for anything to do (`core/task-model.js`). Stored in `TaskStore`. Key = `hash` (`id` is an alias). |
| **Routine** | Ordered list of **steps** (name + minutes) with a start time and weekdays. Stored in `adhd-tool-routines`, not in TaskStore. |
| **Step** | One item of a routine. Never call it a task. |
| **Booking / booked time** | Time a routine reserves: steps × (1 + `routineBufferPercent`/100). Default buffer 10 %. |
| **Pause** | Gap the scheduler keeps after a task it placed (`bufferDurationMinutes`, default 5). Never moves fixed items. |
| **Slot** | One scheduled entry `{ task, startTime, endTime }` from the scheduler. |
| **Fixed** | Has its own time: `plannerDate` with a time, `[FIX]` tag, routine block, calendar event. Keeps its time. |
| **Flexible / auto-placed** | No time: the scheduler places it from *now*, by importance × urgency. |
| **Pinned (`autoPinned`)** | A flexible task the Now view fixed when it became current. Unfinished → back to the queue. |
| **Snooze (`snoozedUntil`)** | "Later today": not scheduled before that time. |
| **Conflict** | Two items overlapping. Always refused or moved to the next free slot (`findConflicts`, `findNextFreeSlot`). |
| **Now state** | `doing` (item running) · `break` (next item soon) · `free` (nothing soon → Plan view). `core/now-state.js`. |
| **Overdue** | Pending task whose `deadline` has passed. |
| **Calendar copy** | Task the Calendar tool makes from a calendar event (`isCalendarEvent`). All-day or passive ones (`isPassiveOrAllDay`) never book time, never run in Now and are never overdue. |
| **Tombstone** | Id of a deleted task in `adhd-deleted-tasks`, so sync never brings it back. |
| **Tool / screen** | A `<section class="tool-section">`; opened with `window.switchTool(id)`. |
| **Capability** | A detected part of the user's setup (`gcal`, `ics`, `ai`, `speech`) that shows/hides UI. |
| **Strings** | Translations. JS: `I18n.t('key', vars)`. HTML: `data-i18n="key"`. Languages: en, fr, de, es. |

## Contracts between files

### Load order (index.html)
1. `services/timestamp-storage.js` (patches `localStorage.setItem`), `shell/app.js`, `shell/config.js`,
   `shell/i18n.js`, then every `features/*/strings.js`, then services, `core/*` classic scripts, settings, pomodoro.
2. ES modules: `core/duration-learning` → `urgency-helpers` → `task-model` → `task-store` → `scheduler` → `features/planner/day-planner.js`.
3. Other features. Deferred classic scripts and modules run in document order, all before `DOMContentLoaded`.

Rules: do not reorder existing tags; add a new feature's tags inside its group; code that needs a global
from a later script must read it **at runtime** (`window.X?.…`), not at load time. `UnifiedScheduler` may
arrive after a classic script: listen to `schedulerReady`.

### Globals (`window.*`) — the public API between files

| Global | Defined in | Use it for |
| --- | --- | --- |
| `EventBus` | `services/data-manager.js` | `EventTarget` for data events (see below) |
| `DataManager` | `services/data-manager.js` | Legacy task API, export/import, `showNotification(msg, type)` |
| `TaskStore` | `core/task-store.js` | Tasks: get/add/update/`markComplete`/`deleteTasks`/`undeleteTasks`/`getOverdueTasks` |
| `TaskModel` | `core/task-model.js` | `createTask`, `updateTask`, scoring helpers |
| `UnifiedScheduler` | `core/scheduler.js` | `getTodaySchedule`, `getCurrentTask`, `findConflicts`, `findNextFreeSlot`, routine helpers |
| `NowState` | `core/now-state.js` | `getState()`, `computeNowState()`, `defaultToolFor()` |
| `UrgencyHelpers` | `core/urgency-helpers.js` | Urgency smoothing, skip ledger |
| `DurationLearning` | `core/duration-learning.js` | Learned task durations |
| `TaskParser` | `core/task-parser.js` | Natural-language task parsing (offline; AI if set) |
| `AIAssistant` | `core/ai-provider.js` | Optional AI: `isEnabled()`, `complete()`, `completeJSON()` |
| `UserContext` | `core/user-context.js` | Active user / profiles |
| `ConfigManager` | `shell/config.js` | `getConfig()`, `updateConfig(partial)` |
| `I18n` | `shell/i18n.js` | `t(key, vars, fallback)`, `getLang()`, `register(dict)` |
| `AppRouter` | `shell/app.js` | `autoRoute(state)`, `isAuto()`, `current()` |
| `AppSheets` | `shell/app.js` | `open('capture' \| 'more')`, `close()` |
| `switchTool` | `shell/app.js` | Open a screen by section id (turns auto-routing off) |
| `AppCapabilities` | `shell/capabilities.js` | `get()`, `refresh()` |
| `GoogleAuth` | `services/google-auth.js` | OAuth tokens for Google APIs |
| `DriveSync` | `services/drive-sync.js` | Google Drive backup/restore |
| `CredentialsSync` | `services/credentials-sync.js` | Encrypted export of keys |
| `CrossTool` | `services/cross-tool-interaction.js` | Send a task to another tool |
| `RoutinePlayer` | `features/routine/routine.js` | `start(id)`, `show()`, `edit(id)`, `getState()`, `isRunning()` |
| `DayPlanner` | `features/planner/day-planner.js` | `rerender()`, `scrollToCurrent()` |
| `CalendarTool` | `features/calendar/calendar-tool.js` | `ingestExternalEvents(events)` |
| `RewardSystem` | `features/rewards/reward-system.js` | Points and rewards |
| `AssistantInbox` | `features/assistant/assistant-inbox.js` | `check()`: apply changes queued by the MCP server |

Add a global only when another file needs it, and add a row here.

### Events
On `window.EventBus`: `dataChanged` (tasks changed — re-render), `calendarEventsUpdated`, `taskCompleted`,
`habitToggled`, `pomodoroCompleted`, `ef-receiveTaskFor-<Tool>` (CrossTool hand-off, `detail` = task).
On `window`: `scheduleNeedsRefresh`, `routinesChanged`, `routinePlayerChanged`, `configUpdated`,
`languageChanged`, `activeUserChanged`, `aiSettingsChanged`, `capabilitiesChanged` (setup changed, e.g.
Google connected), `capabilitiesApplied`, `toolChanged` (`detail.tool`), `schedulerReady`, `taskCaptured`.
After changing tasks, dispatch `dataChanged` on `EventBus` **and** `scheduleNeedsRefresh` on `window`.

### Storage keys (`localStorage`) — one owner each
| Key | Owner | | Key | Owner |
| --- | --- | --- | --- | --- |
| `adhd-unified-tasks` | core/task-store | | `adhd-tool-routines` | features/routine (read by core/scheduler) |
| `adhd-deleted-tasks` | core/task-store (tombstones) | | `adhd-routine-runs` | features/routine (routine done today) |
| `adhd-tools-config` | shell/config | | `adhd-lang` | shell/i18n |
| `adhd-calendar-events` | features/calendar | | `adhd-calendar-ics-url` | features/calendar |
| `gcalClientId`, `gcal*` | services/google-* | | `adhd-ai-settings` | core/ai-provider (never exported) |
| `adhd-hub-data` | services/data-manager (legacy mirror) | | `adhd-storage-log` | services/timestamp-storage |
| `adhd-assistant-applied` | features/assistant (ops applied, read by mcp/) | | | |
Other keys belong to the feature that names them (`adhd-habits`, `adhd-rewards`, `adhd-breakdown-tasks`…).
Changing the shape of stored data needs a migration that reads the old shape (users keep their data).

## Rules that keep things from breaking

- **Tests first:** `npm test` green before and after. Logic changes in `core/` need a unit test.
- **UI tests for UI work:** any change to `index.html`, `features/`, `shell/`, `styles/`, `core/scheduler.js`
  or `core/now-state.js` must pass `npm run test:ui`. A new screen or flow gets a test in `tests/ui/`.
- **Merge `main` before you open a PR,** then run `npm test && npm run test:ui` again. Two PRs that each
  pass alone can break the app together (this happened: a 1-minute calendar sync + all-day events hid
  every other task from the planner).
- **Never double-book:** anything that sets a time uses `UnifiedScheduler.findConflicts` / `findNextFreeSlot`
  (this includes blocks the app creates by itself, like travel time).
- **Nothing hides the day:** all-day events and calendar copies never book time (`isPassiveOrAllDay`);
  a task longer than the time left today is not placed, it never blocks the tasks behind it.
- **Delete tasks with `TaskStore.deleteTasks`** (writes tombstones). Never filter the array by hand.
- **Deadlines:** a planned time is not a deadline. Pass `deadline: null` when there is none.
- **Strings:** no user-visible English literal in JS. Add keys to the feature's `strings.js` in **all four**
  languages with the same `{placeholders}`. Every `data-i18n*` key in `index.html` must exist too (tests check both).
- **Events on the right target:** `dataChanged` on `window.EventBus`, `scheduleNeedsRefresh` on `window`
  (see Events). An event sent to the wrong target does nothing, and no error shows.
- **Privacy:** no servers, no analytics, no new third-party requests. API keys never leave `localStorage`
  and are excluded from export/sync (`isSensitiveKey` in `services/data-manager.js`). Opt-in services are
  called only after a clear user action, never at load (the UI tests fail on any request while loading).
  Allowed today: Google (when connected), the chosen AI provider, OpenStreetMap geocoding/routing when the
  user types a place in the event form (`features/planner/routing.js`).
- **Setup-aware UI:** controls for optional integrations get `data-cap="ai|speech"` or `data-cap-hide="gcal"`.
- **No dead code:** remove files/keys you replace. `tests/architecture.test.js` fails on unreferenced files.
- **Keep the AI assistant in step:** a new TaskStore method, scheduler function, task field, `adhd-…` storage
  key or global makes `tests/mcp-coverage.test.js` fail until `mcp/coverage.js` says which MCP tool uses it
  (or `no: <reason>`). See [mcp/AGENTS.md](mcp/AGENTS.md) → "When you add something to the app".
- **Keep docs true:** if you change a contract above, update this file in the same commit.

## Working in parallel

Each feature folder is a **lane**: two agents can work on two different features at the same time
without touching the same files. Shared files are **hotspots** — change them in small, separate commits:

| Hotspot | How to avoid conflicts |
| --- | --- |
| `index.html` | Only touch your feature's `<section>`; add script/link tags at the end of their group. |
| `core/scheduler.js`, `core/task-store.js` | One agent at a time; add functions, don't change signatures. |
| `styles/base.css` (legacy) | Don't add to it. Put new CSS in `features/<name>/<name>.css`. |
| `shell/i18n.js` | Only static-page keys. Feature strings go in `features/<name>/strings.js`. |
| `AGENTS.md` tables | Add rows; don't reorder. |

Good parallel splits: (a) one feature's UI, (b) a `core/` function + its test, (c) docs/translations.
Sequential: anything that changes a global, an event or a storage shape (update contracts first).

## Definition of done
1. `npm test` and `npm run test:ui` pass, **after merging the latest `main`**; new logic and new flows have tests.
2. Checked in a browser at 390×844 and 1366×900 with no console errors (the UI tests do this for the main
   screens; look at your own screen too — see [tests/AGENTS.md](tests/AGENTS.md)).
3. Strings in en/fr/de/es; no `alert()` in new flows.
4. The folder's `AGENTS.md` (and this file, if a contract changed) and user docs (`docs/using-the-app.md`) are updated.
5. Commit message: imperative summary line, then what and why.
6. Never merge a PR with red CI. (Repo owner: in GitHub → Settings → Branches, require the `test` and `ui`
   checks on `main` so this is enforced.)
