# features/focus — full-screen focus timer

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI.

| File | Role |
| --- | --- |
| `focus-mode.js` | `#focus` screen and the overlay `#fullscreen-focus-mode` (timer, background, sound, notes). |

- Started from the Now view: it sets `window.FocusTaskContext = { taskHash, startedAt, durationMinutes }`
  and clicks `#enter-focus-mode`. On finish with "complete", marks the task done and records the duration
  (`DurationLearning`), then fires `dataChanged` + `scheduleNeedsRefresh`.
- Stores `focus-session`, `focus-notes`. Settings: Settings → Focus Mode.
