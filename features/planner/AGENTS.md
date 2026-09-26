# features/planner — the day planner ("Plan" tab)

Read first: [../AGENTS.md](../AGENTS.md). ES modules: they `import` from `core/` directly.

| File | Role |
| --- | --- |
| `day-planner.js` | Entry. **Zoom** (`--minute-height` px per minute, 0.5–5, saved in `adhd-planner-zoom`): two-finger pinch on the list, trackpad pinch / Ctrl+scroll on desktop, anchored on the pinch point. Tap on free timeline space → new event at that time. Toolbar (Add event, Lock plan, AI Plan `data-cap="ai"`, Record `data-cap="speech"`, Clear day), the **add/edit event form** (`#event-modal`: what, start, how long chips, "More options", inline conflict box with "Use HH:MM", Delete when editing), drag-to-resize, voice add. `window.DayPlanner`. |
| `planner-utils.js` | Builds the day's items with `buildSchedule` (tasks + routines + calendar), day bounds, defaults. |
| `ai-plan.js` | AI Plan button: strict prompt + local validation/conflict repair of the model's plan (`planDayWithAI`). Never trusts the model: unknown texts, duplicates and overlaps are fixed or dropped before saving. |
| `render-day.js` | Draws one continuous `.timeline` in `#time-blocks`: y = (minute − day start) × `--minute-height`, so zoom only changes that CSS variable. Left gutter labels: item **starts** first, then ends, then whole hours (every 1/2/3/6 h by zoom), never closer than 18 px (`relabelTimeline()`). Overlapping items share the width (columns). Calendar events, routine blocks (orange, click → Routines), fixed tasks, auto-placed tasks (dashed), resize handle, current-time line + label. |
| `routing.js` | Geocoding and routing with OpenStreetMap (Nominatim, OSRM): travel time on foot, by bike or car. Called **only** when the user types a place in the event form. The travel block it creates goes through `findConflicts` like any other time. |
| `planner.css` | Timeline colours, now/next strip, Plan ahead panel, event form (bottom sheet on phones). |
| `strings.js` | Keys `plan.*`, `legend.*`, `conflict.*`, `event.*`. |

- The now/next strip and the Plan ahead panel **markup** is here, their **rendering** is in `features/now/now-view.js`.
- Every save/resize checks `findConflict()` (→ `UnifiedScheduler.findConflicts`); never save on top of something.
- Save with no deadline passes `deadline: null` (a start time is not a deadline).
- Browser tests: `tests/ui/planner.test.js` (whole day drawn on phone + desktop, zoom alignment, conflict
  form). Run `npm run test:ui` after any change here.
- Desktop (≥ 1025 px): the planner fills the window; timeline and Plan ahead scroll inside it.
- `.timeline .event` must keep `transition: none` (base.css animates `.event`; blocks would lag behind labels while zooming).
- Re-renders on `dataChanged`, `calendarEventsUpdated`, `scheduleNeedsRefresh`, `routinesChanged`,
  `configUpdated`, `languageChanged`, and every minute. `toolChanged` → scroll to now.
- Receives `ef-receiveTaskFor-DayPlanner` (from Task Breakdown) → opens the form pre-filled.
