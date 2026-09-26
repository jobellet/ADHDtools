# features/pomodoro — Pomodoro timer

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI, self-contained.

| File | Role |
| --- | --- |
| `pomodoro.js` | `#pomodoro` timer (focus/short/long breaks, interval chime). Bell / chime / digital sounds are synthesised with Web Audio (`playSound`), so they work offline with no download. Fires `pomodoroCompleted` on `EventBus`. |

- Stores `pomodoroSettings`, `pomodoroSessionsCompleted`, `pomodoroIntervalChime`. Settings UI: Settings → Pomodoro.

