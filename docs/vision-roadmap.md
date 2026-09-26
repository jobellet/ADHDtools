# Vision, Roadmap & Current Status

## 🌍 Vision: What ADHDtools Should Become

ADHDtools is evolving toward a unified personal assistant that organizes your day around what truly matters — not endless to-do lists, but smart tasks that adapt to your context, priorities, and time. The goal is to make it the one dashboard you open in the morning and immediately see what to do now, what comes next, and why.

Once everything is set up, the user should only have to:

1. Add or speak a new task naturally (“Call mom”, “Finish report by Friday”).
2. Tag its importance if desired (1–10).
3. Let the app handle everything else — urgency tracking, scheduling, focus timing, and rewarding.

All tools (Pomodoro, Planner, Focus Mode, Routine, Calendar, Habit Tracker, Rewards) operate on a shared task data format, ensuring every feature reflects the same task universe. See [task-model.md](task-model.md).

See also the [**Transition Plan**](transition-plan.md): the roadmap to a context-aware dashboard that automatically displays the appropriate tool based on the time of day and user habits. How the app works today is described in the [user guide](using-the-app.md).

## 🧠 Typical User Workflow

1. **Morning start** — You open the app and instantly see “What to do now”: your morning routine, step by step, with a timer. Then the first task placed by the scheduler. *Next up* shows what follows, adjusted for deadlines, routines and available time. *(Works today.)*
2. **During the day** — As you complete tasks, they’re marked “done” and converted into achievement points. If you skip or delay a task, urgency scores automatically adapt — the system learns your real pacing. Focus Mode can be launched directly from any task to work distraction-free, with automatic logging.
3. **Evening review** — You see a quick summary: completed tasks, achievement points gained, and categories where you made progress. Rewards are unlocked based on your total score, giving an encouraging feedback loop. Tomorrow’s plan is already built — balancing deadlines, priorities, and your learned daily rhythm.
4. **Family mode (future)** — Each family member can have their own user profile. Shared routines (e.g. “Prepare kids for school”) synchronize tasks and show joint achievements.

## 🚀 Roadmap

| Phase | Goal | Key Steps |
| --- | --- | --- |
| 1. Data Unification | Merge all existing modules (Routine, Planner, Pomodoro, Rewards, etc.) to use the same Task data schema. | - Define shared JSON schema for Task.<br> - Create a central task_store.json to be read/write by all tools.<br> - Add helper functions to convert legacy data. |
| 2. Core Scheduler Integration | Build the unified day planner that auto-fills the timeline based on urgency × importance × available time. | - Implement scoring algorithm.<br> - Allow manual override and re-ordering.<br> - Integrate calendar imports and routines. |
| 3. Learning Layer | Make duration and urgency adaptive. | - Track real completion times.<br> - Update estimated duration automatically.<br> - Recalculate urgency each morning. |
| 4. Unified Interface ✅ | A single dashboard (the “Now” view) on any device. | - Combine Planner, Focus Mode, and Rewards.<br> - Make it fully responsive for smartphones.<br> - Implement notifications for upcoming tasks. |
| 5. Achievements & Gamification | Turn progress into motivation. | - Aggregate completed task scores.<br> - Display graphs of achievement over time.<br> - Link to reward unlocks and family comparisons. |
| 6. Multi-User Extension | Expand to families and teams. | - Add user selection and permission levels.<br> - Share tasks and routines.<br> - Sync through cloud or local shared file. |

## 💡 Philosophy

The app should feel like a cognitive prosthesis for people who struggle with task switching or priority overload. Rather than forcing users to plan everything, it helps them see only what matters right now — and rewards consistent progress rather than perfection.

The end goal is for the user not to have to search for the right tool to use at a given time but for the system to remove cognitive and tool-search burden. For instance, at a certain time of the day the only thing to do is to display a given routine. When it is time to cook, the system just displays the recipe of the day, when it is work time, the system only displays the day plan and pomodoro, etc. Read more in the [Transition Plan](transition-plan.md).

## Current Status

✅ Unified Task model and helper functions in `core/task-model.js` (hashes, urgency, achievement scoring).

✅ Shared task storage via `core/task-store.js`, mirrored through `DataManager` for legacy tools.

✅ Day Planner events persist into the shared store with deadlines/durations, and the **Lock plan** button stamps planner times directly from the scheduler output.

✅ Unified scheduler (`core/scheduler.js`) feeds both the Day Planner timeline and the Now view, keeping current/upcoming items in sync.

✅ Scheduler respects task dependencies and FIX/FLEX tags, reordering only flexible tasks.

✅ Urgency auto-refreshes daily based on deadlines, with skip/reschedule controls raising urgency when tasks slip; smoothing tempers far-away deadlines and accelerates urgency when tasks are repeatedly skipped.

✅ Achievements and rewards use completed Task scores instead of a separate points ledger, with per-user filtering and a multi-user selector across the Now view, scheduler output, and stats.

✅ Day Planner “Add Event” modal with dependency/priority fields and scheduler-aware edits.

🆕 Achievements grouped by task category with time-spent rollups; Habit Tracker check-ins create completed “habit” tasks automatically.

🆕 **Natural-language quick capture** in the **Add** sheet: type or speak “Call mom tomorrow at 5pm for 20 min !7” and it becomes a fully-tagged Task. Works completely offline (`core/task-parser.js`), smarter when an [AI provider](ai-providers.md) is configured.

🆕 **Now view as the default screen** (`core/now-state.js`, `features/now/now-view.js`): while something runs, the app shows only that — task, routine step or event — with a countdown and 2–3 buttons (Done / Focus / Not now). Short gaps show a break countdown to the next item. When nothing is planned, the app opens the Day Planner, with a *Plan ahead* panel to split big or deadline tasks into small steps.

🆕 **Routines book time**: each routine blocks its steps + a buffer (10 % by default) in the unified schedule. Overlapping routines can't be saved, and a task added at a busy time moves to the next free slot.

🆕 **UI adapts to the setup** (`shell/capabilities.js`): `.ics` import hides once Google Calendar is connected, AI buttons hide without an AI provider; *Show all options* restores everything.

🆕 **Provider-agnostic AI assistance** (`core/ai-provider.js`): works with OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter, or any local OpenAI-compatible server. AI remains strictly optional.

🆕 **Private Google Calendar sync** ([tutorial](google-calendar-sync.md)): OAuth-based sync straight from your Google account — no public links, no API key, multi-calendar, configurable window — plus event export back to Google Calendar.

🆕 **Cross-device sync via Google Drive** ([tutorial](sync-across-devices.md)): back up all app data into a private Drive app folder and restore it on any device, with conflict resolution.

✅ Focus Mode starts from the Now view with the time left in the current slot.

✅ Stale tools and code removed (Eisenhower Matrix, Task Manager, old Today view and context banner, unused Family view).

✅ The Now view, planner, Add sheet and routine player are translated (English, Deutsch, Français, Español); overdue tasks can be deleted one by one or all at once, and deletions sync across devices.

🛠️ In progress: notifications for upcoming tasks, translating the older tools and the offline parser (today English only).

🔜 Planned: smarter dependency handling, family profiles, and turning Task Breakdown steps into schedulable tasks automatically.

---

[← Back to README](../README.md)
