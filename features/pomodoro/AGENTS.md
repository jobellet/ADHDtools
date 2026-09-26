# features/pomodoro — Pomodoro timer

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI, self-contained.

| File | Role |
| --- | --- |
| `pomodoro.js` | `#pomodoro` timer (focus/short/long breaks, bell/chime sounds, interval chime). Fires `pomodoroCompleted` on `EventBus`. |

- Stores `pomodoroSettings`, `pomodoroSessionsCompleted`, `pomodoroIntervalChime`. Settings UI: Settings → Pomodoro.

- Known issue: the bell/chime/digital sounds load from soundbible.com (external request, breaks offline).
  Prefer local files in `sounds/` (used by Focus Mode backgrounds) when you touch this.
