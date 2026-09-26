# tests/ — how to check changes (read [../AGENTS.md](../AGENTS.md) first)

`npm test` = `node --test tests/*.test.js` (Node 22, no browser, no network). CI runs it on every PR.

| Test file | Covers |
| --- | --- |
| `scheduler.test.js` | Fixed/flexible placement, routine booking + buffer, conflicts, snooze, pins, fixed items keep time |
| `now-state.test.js` | doing / break / free, default screen |
| `task-model.test.js`, `task-store.test.js` | Task fields, deadlines, delete/undo/tombstones, overdue |
| `task-parser.test.js` | Offline natural-language parsing |
| `sync-merge.test.js` | Backup merge levels, deleted tasks stay deleted |
| `urgency-helpers.test.js`, `duration-learning.test.js` | Urgency smoothing, learned durations |
| `i18n.test.js` | Every `features/*/strings.js` key exists in en/fr/de/es with the same placeholders |
| `application-shell.test.js` | `index.html` references existing scripts; key ids exist |
| `architecture.test.js` | Every JS/CSS file is loaded or imported; every file is listed in an `AGENTS.md`; paths in `AGENTS.md` exist; globals table matches the code |

## Patterns
- ES modules: `import { fn } from '../core/x.js'`; pass data via `config` instead of `localStorage`.
- Classic scripts (IIFE): set `global.window = {}` then `await import(...)`, or run them in `node:vm`
  (see `i18n.test.js`). For storage, give an in-memory `localStorage` (see `task-store.test.js`).

## Browser check (UI changes)
Serve with `node .claude/static-server.cjs` and use Playwright (preinstalled in some sandboxes) or any
browser at **390×844** and **1366×900**: no console errors, no 404, the changed flow works, French
text shows when `localStorage['adhd-lang'] = 'fr'`. Useful: `page.clock.install({ time })` to test
the Now view modes; seed `adhd-unified-tasks` / `adhd-tool-routines` in `localStorage`.
