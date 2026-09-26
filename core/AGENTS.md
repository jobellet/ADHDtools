# core/ — pure logic (read [../AGENTS.md](../AGENTS.md) first)

No DOM, no `document`, no UI text here. Everything must run in Node for the unit tests
(guard browser globals: `typeof window !== 'undefined'`). Each module also sets a `window.*` global
so classic scripts can use it. Data model details: [docs/task-model.md](../docs/task-model.md).

| File | Format | Exposes | Tested in |
| --- | --- | --- | --- |
| `task-model.js` | ES module | `createTask`, `updateTask`, `markTaskCompleted`, `computeUrgencyFromDeadline`, `computeAchievementScore`, `isPassiveOrAllDay` · `window.TaskModel` | `tests/task-model.test.js` |
| `task-store.js` | ES module | `TaskStore` (default, `window.TaskStore`), `DELETED_TASKS_KEY` | `tests/task-store.test.js` |
| `scheduler.js` | ES module | `buildSchedule`, `getTodaySchedule`, `getCurrentTask`, `getRoutineBlocks`, `routineBookedMinutes`, `getBusyBlocks`, `findConflicts`, `findNextFreeSlot`, `findRoutineConflicts`, `localDateString` · `window.UnifiedScheduler` | `tests/scheduler.test.js` |
| `assistant-ops.js` | ES module | `OPS` (changes an AI assistant may make: schema + plan), `makeOp`, `planOp`, `applyEffects`, `pendingOps`, `validate` · shared by `mcp/` and `features/assistant/` | `tests/assistant-ops.test.js` |
| `urgency-helpers.js` | ES module | Urgency smoothing + skip ledger · `window.UrgencyHelpers` | `tests/urgency-helpers.test.js` |
| `duration-learning.js` | ES module | `recordTaskDuration`, `getEstimatedDuration` · `window.DurationLearning` | `tests/duration-learning.test.js` |
| `sync-merge.js` | ES module | `mergeBackup`, `mergeArrayKey` (loaded with `import()` by `services/data-manager.js`) | `tests/sync-merge.test.js` |
| `now-state.js` | classic IIFE | `window.NowState`: `computeNowState`, `defaultToolFor`, `formatDuration`, `getState` | `tests/now-state.test.js` |
| `task-parser.js` | classic IIFE | `window.TaskParser`: `parse` (offline, English), `parseSmart` (AI when enabled) | `tests/task-parser.test.js` |
| `ai-provider.js` | classic IIFE | `window.AIAssistant` (any provider, optional); `window.callGemini` legacy shim | — |
| `user-context.js` | classic IIFE | `window.UserContext` (active user, profiles) | — |

Import graph (ES modules): `task-model` ← `urgency-helpers` ← `task-store` ← `scheduler`;
`duration-learning` ← `task-store`. Features import `scheduler`/`task-model` only via
`features/planner/*`; everything else uses the `window.*` globals.

## Scheduler invariants (tests guard them — keep them true)
- Slots never overlap. An overlapping fixed item moves after the other one and **keeps its length**.
- Fixed items keep their exact time; the pause (`bufferDurationMinutes`) only follows auto-placed tasks.
- Routines book `steps × (1 + routineBufferPercent/100)` on their weekdays; a routine done today
  (`adhd-routine-runs`) books nothing for the rest of the day.
- Auto-placed tasks start from *now*, ordered by importance × urgency; snoozed tasks wait for `snoozedUntil`.
- A block already in progress keeps its real start. `autoPinned` tasks whose slot ended go back to the queue.
- A `deadline` never pins a task to a time; only `plannerDate` (with time) or `startTime` does.
- All-day events and passive calendar copies (`isPassiveOrAllDay`) are not scheduled and book no time.
- A flexible task that no longer fits before `dayEnd` is left out; it never blocks the tasks after it.
- Tests pass data through `config` (`routines`, `routineRuns`, `tasks`) instead of `localStorage`.

## Task store rules
- `updateTask` keeps unknown fields (notes, category…); `createTask(raw, raw)` keeps them on add.
- `deadline: null` means no deadline; missing `deadline` falls back to `plannerDate` (legacy).
- `getOverdueTasks` never lists calendar copies or all-day events.
- Delete with `deleteTasks(hashes)` (tombstones in `adhd-deleted-tasks`); undo with `undeleteTasks(removed)`.
