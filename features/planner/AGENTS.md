# features/planner — the day planner ("Plan" tab)

Read first: [../AGENTS.md](../AGENTS.md). ES modules: they `import` from `core/` directly.

| File | Role |
| --- | --- |
| `day-planner.js` | Entry. Toolbar (Add event, Lock plan, AI Plan `data-cap="ai"`, Record `data-cap="speech"`, Clear day), the **add/edit event form** (`#event-modal`: what, start, how long chips, "More options", inline conflict box with "Use HH:MM", Delete when editing), drag-to-resize, voice add. `window.DayPlanner`. |
| `planner-utils.js` | Builds the day's items with `buildSchedule` (tasks + routines + calendar), day bounds, defaults. |
| `render-day.js` | Draws the hour grid `#time-blocks`: calendar events, routine blocks (orange, click → Routines), fixed tasks, auto-placed tasks (dashed), current-time line. |
| `planner.css` | Timeline colours, now/next strip, Plan ahead panel, event form (bottom sheet on phones). |
| `strings.js` | Keys `plan.*`, `legend.*`, `conflict.*`, `event.*`. |

- The now/next strip and the Plan ahead panel **markup** is here, their **rendering** is in `features/now/now-view.js`.
- Every save/resize checks `findConflict()` (→ `UnifiedScheduler.findConflicts`); never save on top of something.
- Save with no deadline passes `deadline: null` (a start time is not a deadline).
- Re-renders on `dataChanged`, `calendarEventsUpdated`, `scheduleNeedsRefresh`, `routinesChanged`,
  `configUpdated`, `languageChanged`, and every minute. `toolChanged` → scroll to now.
- Receives `ef-receiveTaskFor-DayPlanner` (from Task Breakdown) → opens the form pre-filled.
