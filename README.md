# ADHD Tools Hub

[**▶ Open the Live App**](https://jobellet.github.io/ADHDtools/)

Interactive tools to help manage ADHD symptoms and improve productivity. Everything runs in your browser — your data stays on your device unless *you* connect a sync option.

## Quick demo

The offline quick-capture flow works without an AI provider:

```text
Input:  Call mom tomorrow at 5pm for 20 min !7
Result: [FIX] Call mom — scheduled tomorrow at 17:00 · 20 min · importance 7
```

The task is stored locally as a fixed, scheduled task with its duration and importance preserved. This is the same flow covered by the browser smoke test, with no AI provider configured.

The long-term goal: a unified personal assistant where you just add or speak a task ("Call mom tomorrow at 5pm !7") and the app handles urgency, scheduling, focus timing and rewards. Read the full [vision, roadmap & current status](docs/vision-roadmap.md) and the [Transition Plan](transition_plan.md).

## 📚 Guides & Tutorials

| Guide | What you'll learn |
| --- | --- |
| [**Sync your data across devices**](docs/sync-across-devices.md) | Google Drive backup/restore, file export/import via any cloud folder, email — with conflict-safe merging. |
| [**Google Calendar sync**](docs/google-calendar-sync.md) | Private OAuth sync (recommended — no public link!), `.ics` file import, or a public ICS URL. Full Google Cloud setup tutorial included. |
| [**Optional AI assistance**](docs/ai-providers.md) | Bring your own provider — OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter, or a local model. Every feature also works without AI. |
| [**Vision, roadmap & status**](docs/vision-roadmap.md) | Where the project is heading and what already works. |
| [**Data model & scheduler**](docs/task-model.md) | The unified Task object, TaskStore, and how the scheduler prioritizes your day. |
| [**Manual test cases**](docs/testing.md) | Scenarios to verify behavior after changes. |
| [**Contributing**](docs/contributing.md) | How to set up locally and submit changes. |

## 🧰 Features

*   **Pomodoro Timer:** Work in focused sprints with timed breaks.
*   **Eisenhower Matrix:** Prioritize tasks based on importance and urgency.
*   **Day Planner:** Visualize your day with time blocks.
*   **Task Manager & Breakdown:** Track to-dos and split complex tasks into manageable steps.
*   **Habit Tracker:** Build consistency with daily habit tracking and streaks.
*   **Routines:** Create and run daily routines with timed steps. A routine books its time in your day (steps + a 10 % buffer, configurable), so nothing else can be scheduled on top of it.
*   **Focus Mode:** Minimize distractions with a clean, focused interface.
*   **Rewards:** Celebrate your accomplishments with visual rewards.
*   **Calendar:** Sync privately with [Google Calendar](docs/google-calendar-sync.md) or import ICS files.
*   **Now view (default):** The app opens on what to do *now* — the current task, routine step or event with a big countdown, and what comes next. When nothing is planned, it opens the Day Planner instead.
*   **Unified Scheduler:** One plan across tasks, routines and calendar events, with no double booking.
*   **Quick Capture:** Add or speak tasks in natural language — works offline, enhanced by [AI](docs/ai-providers.md) when configured.
*   **Adapts to your setup:** Options you don't need are tucked away (e.g. `.ics` import once Google Calendar is connected, AI buttons without an AI provider). *Settings → General → Show all options* brings them back.
*   **Cross-device sync:** [Back up to Google Drive or move a file](docs/sync-across-devices.md) — you choose.

## 🔒 Privacy

All data is stored locally in your browser. Nothing is sent to any server unless you explicitly enable an integration (Google sync goes directly from your browser to Google; AI requests go directly to the provider you configured). There is no middleman server.

## 💬 Feedback

If you have suggestions or feedback, please open an issue — or just let me know!

## License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.
