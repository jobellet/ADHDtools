# features/pomodoro — Pomodoro timer

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI, self-contained.

| File | Role |
| --- | --- |
| `pomodoro.js` | `#pomodoro` timer (focus/short/long breaks, interval chime). Bell / chime / digital sounds are synthesised with Web Audio (`playSound`), so they work offline with no download. Fires `pomodoroCompleted` on `EventBus`. Uses wall-clock delta timing (`targetEndTimeMs` and `Math.ceil`) to prevent timer drift and integrates with `window.AttentionService` for OS notifications, native audio fallback, screen wake locks, and system tray countdowns. |

- Stores `pomodoroSettings`, `pomodoroSessionsCompleted`, `pomodoroIntervalChime`. Settings UI: Settings → Pomodoro.

