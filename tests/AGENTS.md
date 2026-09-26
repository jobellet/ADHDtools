# tests/ — how to check changes (read [../AGENTS.md](../AGENTS.md) first)

`npm test` = `node --test tests/*.test.js` (Node 22, no browser, no network).
`npm run test:ui` = `tests/ui/*.test.js` (the real app in headless Chromium through Playwright).
CI runs both on every PR. Both must pass after merging the latest `main`.

| Test file | Covers |
| --- | --- |
| `scheduler.test.js` | Fixed/flexible placement, routine booking + buffer, conflicts, snooze, pins, fixed items keep time |
| `now-state.test.js` | doing / break / free, default screen |
| `task-model.test.js`, `task-store.test.js` | Task fields, deadlines, delete/undo/tombstones, overdue |
| `task-parser.test.js` | Offline natural-language parsing |
| `sync-merge.test.js` | Backup merge levels, deleted tasks stay deleted |
| `urgency-helpers.test.js`, `duration-learning.test.js` | Urgency smoothing, learned durations |
| `i18n.test.js` | Every `features/*/strings.js` key exists in en/fr/de/es with the same placeholders; every `data-i18n*` key in `index.html` exists in all four |
| `application-shell.test.js` | `index.html` references existing scripts; key ids exist |
| `assistant-ops.test.js` | AI assistant ops: schemas, refuse vs move on a busy time, breakdown, tombstones |
| `mcp.test.js` | MCP server over stdio and HTTP: protocol, reads backup, writes inbox only, secrets hidden, token needed |
| `mcp-coverage.test.js` | Every TaskStore method, scheduler function, task field, storage key, global and tool is covered by `mcp/coverage.js`, documented and tested |
| `architecture.test.js` | Every JS/CSS file is loaded or imported; every file is listed in an `AGENTS.md`; paths in `AGENTS.md` exist; globals table matches the code |

### Browser tests (`tests/ui/`)
| File | Covers |
| --- | --- |
| `harness.js` | `startServer()` (serves the repo like GitHub Pages), `launch()`, `openApp(browser, url, { device, time, storage, session, routes })`, `sampleDay(date)`, `VIEWPORTS` (phone 390×844, desktop 1366×900). `openApp` fixes the clock, seeds `localStorage`, blocks every outside request and returns `errors` (page + console) and `external` (requests made while loading). |
| `now.test.js` | The app opens on the right screen: routine time → Now with timer; free time with work → next auto-placed task; nothing planned → planner. Never an all-day event as "now". |
| `assistant.test.js` | MCP server queues changes → the real app applies them (moved if the time got taken) → backs up → the server sees them done. Fake Drive via `routes`. |
| `planner.test.js` | The whole day is drawn at both sizes (timeline height = day × zoom, every item present, no NaN, no overlap, no sideways scroll, desktop fills the window); Ctrl+scroll zoom keeps blocks on their times; add-event form refuses a taken time and saves at the suggested one. |

`sampleDay()` holds the tricky data that broke the app once: an all-day event and the task copies the
Calendar tool makes. When you fix a UI bug, add its data to `sampleDay()` or a new test so it can't come back.
Every test asserts `errors` and `external` are empty.

## Patterns
- ES modules: `import { fn } from '../core/x.js'`; pass data via `config` instead of `localStorage`.
- Classic scripts (IIFE): set `global.window = {}` then `await import(...)`, or run them in `node:vm`
  (see `i18n.test.js`). For storage, give an in-memory `localStorage` (see `task-store.test.js`).

## Browser check (UI changes)
First `npm run test:ui`. Then look at your own screen: serve with `node .claude/static-server.cjs` and open it
at **390×844** and **1366×900**: no console errors, no 404, the changed flow works, French text shows when
`localStorage['adhd-lang'] = 'fr'`. Useful: `page.clock.install({ time })` to test the Now view modes; seed
`adhd-unified-tasks` / `adhd-tool-routines` in `localStorage` (or reuse `openApp` from the harness).
