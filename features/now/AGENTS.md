# features/now — the default "Now" screen + the Add sheet

Read first: [../AGENTS.md](../AGENTS.md). Logic lives in `core/now-state.js` (modes `doing`/`break`/`free`).

| File | Role |
| --- | --- |
| `now-view.js` | Renders `#now-view` (kicker, title, countdown ring, steps, 2–3 action buttons, Next up). Also renders two planner parts: the now/next strip `#plan-next-strip` and the **Plan ahead** panel `#plan-deadlines` (deadlines, big tasks, Split, delete one / delete all overdue with Undo). |
| `quick-capture.js` | The **Add** sheet (`#quick-capture-form`, voice button): parses text with `TaskParser`, moves a busy time to the next free slot, adds to `TaskStore`. Also renders **Today's progress** (`#daily-progress`). |
| `now.css` | Now view, Add sheet, progress card. |
| `strings.js` | Keys `now.*`, `strip.*`, `due.*`, `unit.*`, `progress.*`, `capture.*`. |

- **Loop:** `computeState()` every 20 s and on events (`dataChanged`, `scheduleNeedsRefresh`, `routinesChanged`,
  `routinePlayerChanged`, `configUpdated`, `languageChanged`, `activeUserChanged`); `tick()` every second only
  updates countdowns. Re-render only when the state key changes.
- **Side effects:** pins the current auto-placed task (`autoPinned`); auto-starts a routine if
  `contextAutoSwitch`; calls `AppRouter.autoRoute(state)` when the mode changes.
- **Actions:** event → `CalendarTool.postponeEvent` (+15/+60 min, refused on conflict) / `markEventPassive`
  (“it’s an event, not a task”: stays in the calendar, frees its time); Done → `TaskStore.markComplete`;
  Not now → snooze 60 min / tomorrow / send to Breakdown;
  routine → `RoutinePlayer.start/show/edit`, "skip today" writes `adhd-routine-runs`.
- Tests: `tests/now-state.test.js` (logic). UI: browser check of the 3 modes (see `tests/AGENTS.md`).
