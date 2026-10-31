# features/routine — routines: list, editor, player

Read first: [../AGENTS.md](../AGENTS.md). Booking math is in `core/scheduler.js` (`routineBookedMinutes`, `findRoutineConflicts`).

| File | Role |
| --- | --- |
| `routine.js` | Everything routine (one big IIFE, sections marked by comments): routine cards + templates (`#routine-list-cards`), **edit sheet** (`#routine-edit-modal`: AI & voice assistant with `#routine-ai-input` / `#routine-ai-voice-btn`, name, start, days, show steps in day view checkbox, steps with drag handle / tap to edit duration / ↑↓ / delete, CSV export/import), run picker, **player** (`#routine-view-player`, full-screen `#routine-focus-mode`, skip, reorder, auto-run). `window.RoutinePlayer` (including `parseRoutineOffline`, `applyRoutineAI`), `activateRoutine`, `manualAdvanceTask`. |
| `routine.css` | Routines tab, step editor, and AI & voice box (`.routine-ai-box`). Player styles: `styles/routine-player.css`; older sheet styles: `styles/routine-*.css`. |
| `strings.js` | Keys `routine.*`, `player.*`. |

- **Storage:** routines in `adhd-tool-routines` (`{ id, name, startTime, weekDays[0-6], tasks: [{ id, name, duration }], showTasksInDayView }`
  — `tasks` here are **steps**); finished/skipped today in `adhd-routine-runs` (`{ [id]: 'YYYY-MM-DD' }`).
- **Save refuses overlaps** with another routine on a shared weekday (`findRoutineConflicts`).
- Fires `routinesChanged` on save, `routinePlayerChanged` on start/stop, `scheduleNeedsRefresh` when done.
- Step order = DOM order of `.routine-task-item` in the edit list (`collectTaskRows`).
- Drag uses pointer events on `document` (moving a node drops pointer capture); handle has `touch-action: none`.
