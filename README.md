# ADHD Tools Hub

[View Live Website](https://jobellet.github.io/ADHDtools/)

Interactive tools to help manage ADHD symptoms and improve productivity.

---

## 🌍 Vision: What ADHDtools Should Become

ADHDtools is evolving toward a unified personal assistant that organizes your day around what truly matters — not endless to-do lists, but smart tasks that adapt to your context, priorities, and time. The goal is to make it the one dashboard you open in the morning and immediately see what to do now, what comes next, and why.

Once everything is set up, the user should only have to:

1. Add or speak a new task naturally (“Call mom”, “Finish report by Friday”).
2. Tag its importance if desired (1–10).
3. Let the app handle everything else — urgency tracking, scheduling, focus timing, and rewarding.

All tools (Pomodoro, Planner, Focus Mode, Routine, Calendar, Habit Tracker, Rewards) will operate on a shared task data format, ensuring every feature reflects the same task universe.

---

## 🧩 Core Data Model: The Task Object

Every tool communicates through a unified data structure — the Task. The helper functions live in `core/task-model.js` and generate deterministic identifiers so the same task can flow across tools.

Each task includes:

| Field | Description |
| --- | --- |
| user | Owner of the task (default: `main`). |
| name | Short description, e.g., “Finish report”. |
| text | Human-friendly label (alias of `name` for legacy tools). |
| hash | Deterministic unique identifier derived from user + name + createdAt. Also mirrored to `id` for backwards compatibility. |
| deadline | ISO datetime string or null. Used to derive urgency and schedule fixed blocks. |
| plannerDate | Optional ISO datetime for day-planner placements. |
| dependency | Hash of another task that must be completed first. |
| urgency | 1–10. Auto-derived from deadline when not provided. |
| importance | 1–10 priority weight from the user. |
| durationMinutes | Estimated duration in minutes (positive number). |
| isFixed | Boolean flag for fixed calendar events/blocks. |
| completed | Boolean completion flag. |
| completedAt | ISO string of when the task was finished. |
| achievementScore | importance × (durationMinutes / 60) when completed. |

Utility helpers:

* `createTask(raw, overrides)` – normalize any incoming object into a Task.
* `updateTask(task, updates)` – merge updates without losing the deterministic hash.
* `markTaskCompleted(task, completedAt)` – set completion flags and recompute the achievement score.
* `computeUrgencyFromDeadline(deadline)` – derive urgency once per day from the deadline.
* `computeAchievementScore(task)` – shared scoring logic for achievements/rewards.

---

## 🧠 Typical User Workflow (Once Fully Implemented)

1. **Morning start**

   You open the app and instantly see “What to do now” — the first task scheduled by the adaptive algorithm.

   A timeline below shows the next few tasks, adjusted automatically for deadlines and available time.

2. **During the day**

   As you complete tasks, they’re marked “done” and converted into achievement points.

   If you skip or delay a task, urgency scores automatically adapt — the system learns your real pacing.

   Focus Mode can be launched directly from any task to work distraction-free, with automatic logging.

3. **Evening review**

   You see a quick summary: completed tasks, achievement points gained, and categories where you made progress.

   Rewards are unlocked based on your total score, giving an encouraging feedback loop.

   Tomorrow’s plan is already built — balancing deadlines, priorities, and your learned daily rhythm.

4. **Family mode (future)**

   Each family member can have their own user profile.

   Shared routines (e.g. “Prepare kids for school”) synchronize tasks and show joint achievements.

---

## 🚀 Roadmap

| Phase | Goal | Key Steps |
| --- | --- | --- |
| 1. Data Unification | Merge all existing modules (Routine, Planner, Pomodoro, Rewards, etc.) to use the same Task data schema. | - Define shared JSON schema for Task.<br> - Create a central task_store.json to be read/write by all tools.<br> - Add helper functions to convert legacy data. |
| 2. Core Scheduler Integration | Build the unified day planner that auto-fills the timeline based on urgency × importance × available time. | - Implement scoring algorithm.<br> - Allow manual override and re-ordering.<br> - Integrate calendar imports and routines. |
| 3. Learning Layer | Make duration and urgency adaptive. | - Track real completion times.<br> - Update estimated duration automatically.<br> - Recalculate urgency each morning. |
| 4. Unified Interface | Create a single dashboard (“Today view”) accessible from any device. | - Combine Planner, Focus Mode, and Rewards.<br> - Make it fully responsive for smartphones.<br> - Implement notifications for upcoming tasks. |
| 5. Achievements & Gamification | Turn progress into motivation. | - Aggregate completed task scores.<br> - Display graphs of achievement over time.<br> - Link to reward unlocks and family comparisons. |
| 6. Multi-User Extension | Expand to families and teams. | - Add user selection and permission levels.<br> - Share tasks and routines.<br> - Sync through cloud or local shared file. |

---

## 💡 Philosophy

The app should feel like a cognitive prosthesis for people who struggle with task switching or priority overload. Rather than forcing users to plan everything, it helps them see only what matters right now — and rewards consistent progress rather than perfection.

**Note for contributors and AI agents:** Treat this vision and data model as the global north star. When implementing new features or refactors, align them with this roadmap and update this README to reflect progress so future work stays cohesive.

## Current Status

✅ Unified Task model and helper functions in `core/task-model.js` (hashes, urgency, achievement scoring).

✅ Shared task storage via `core/task-store.js`, mirrored through `DataManager` for legacy tools.

✅ Day Planner events and Routine quick tasks persist into the shared store with deadlines/durations.

✅ Basic unified scheduler (`core/scheduler.js`) can return a prioritized schedule and the task to do “right now.”

✅ Scheduler respects task dependencies and FIX/FLEX tags, reordering only flexible tasks and showing blocked items in the Today View.

✅ Urgency auto-refreshes daily based on deadlines, with skip/reschedule controls raising urgency when tasks slip.

✅ Achievements and rewards now use completed Task scores instead of a separate points ledger.

🛠️ In progress: deeper Focus Mode integration with the scheduled task of the moment.

🔜 Planned: richer calendar imports, smarter dependency handling, and family profiles.

## Task Storage

All tasks are persisted in the browser under the `adhd-unified-tasks` key (via `core/task-store.js`). The store exposes:

* `getAllTasks()`, `getPendingTasks()`, `getTasksByUser(user)`
* `addTask(task)`, `updateTaskByHash(hash, updates)`, `getTaskByHash(hash)`
* `markComplete(hash)`

Urgency scores are recalculated once per day from task deadlines, and the duration-learning module updates `durationMinutes` with a rolling average every time a task is marked complete.

Legacy modules still calling `DataManager` automatically read/write through this shared store, so new tools should prefer `TaskStore` directly.

## Features

*   **Pomodoro Timer:** Work in focused sprints with timed breaks to maintain productivity.
*   **Eisenhower Matrix:** Prioritize tasks based on importance and urgency.
*   **Day Planner:** Visualize your day with time blocks for better time management.
*   **Task Manager:** Keep track of your to-do list with priorities and categories.
*   **Task Breakdown:** Break complex tasks into smaller, manageable steps.
*   **Habit Tracker:** Build consistency with daily habit tracking and streaks.
*   **Routine Tool:** Create and run daily routines with timed tasks.
*   **Focus Mode:** Minimize distractions with a clean, focused interface.
*   **Rewards:** Celebrate your accomplishments with visual rewards.
*   **Calendar Tool:** Import events from ICS files and integrate them with other tools.
*   **Unified Scheduler:** Generate a daily schedule across tools using shared TaskStore data and calendar blocks.
*   **Today View:** A lightweight dashboard that surfaces the current task, upcoming items, and quick actions.

## Privacy

All data is stored locally in your browser. Nothing is sent to any server, ensuring your information remains private.

## Unified Scheduler & TaskStore

`core/scheduler.js` exposes `getTodaySchedule()` and `getCurrentTask()` to produce a prioritized plan for the current day. The scheduler:

* reads tasks from the shared **TaskStore** (including routines, planner items, and calendar imports),
* excludes completed or dependency-blocked tasks,
* blocks out fixed calendar events and `[FIX]`-tagged items,
* scores tasks with `importance × urgency`, then fills open time in priority order.

The Day Planner includes a **Generate schedule for today** action that applies the scheduler to the timeline, and the **Start Focus Session for Current Task** button boots focus mode with the active slot.

The **Today View** (on the Home tab) highlights the current task, the next three items, and quick actions to start focus, mark done (updates TaskStore), or skip/reschedule with higher urgency.

## Feedback

If you have suggestions or feedback, please let me know!

## Gemini API Setup
Some tools in this application can use the Google Gemini API to provide intelligent suggestions, such as breaking down tasks or categorizing items. Using the API may consume your quota and could incur charges beyond the free tier. See [Google's pricing page](https://ai.google.dev/pricing) for details and keep your key private.

### 1. Obtain Your API Key from Google AI Studio
First, get an API key from Google AI Studio.

**Go to Google AI Studio:** Open [aistudio.google.com](https://aistudio.google.com) and sign in with your Google account.

**Create a Project and Key:** Create a new project (for example `ADHD-Tools-Project`) and generate an API key. Copy this key and store it somewhere safe.

### 2. Add the API Key in the App
On the ADHD Tools website, scroll to the **About** section and find the **Gemini API Key** box. Paste your key into the field and click **Save**. The key is stored only in your browser's `localStorage`. You can remove it at any time by clicking **Clear**.

That's it! The Gemini-powered features in ADHD Tools should now be enabled.

### Troubleshooting
**No key saved:** If the tools say the key is missing, return to the **Gemini API Key** box and re-enter your key. Clearing your browser data will remove the saved key.

**API errors:** Ensure your key is correct and has not been revoked in Google AI Studio.

## Optional Google Calendar Integration

To connect the Day Planner to your Google Calendar:

1. **Create API credentials** – In the [Google Cloud Console](https://console.cloud.google.com/), enable the *Google Calendar API* and create an **API key** and an **OAuth client ID** (type Web application).
2. **Enter credentials in the Calendar tool** – Open the Calendar page and use the **Google Calendar API** box at the top to save your Client ID and API key.
3. **Connect your calendar** – After saving, click **Connect Google Calendar** in the Day Planner or Task Manager and authorize access. Events from the current day in your primary calendar are saved locally and shown automatically.

Your credentials remain in your browser only. Use the **Clear** button in the Calendar settings to remove them at any time.


## Contributing

If you'd like to contribute, please follow these steps:

1.  **Fork the repository:** Create your own copy of the project.
2.  **Create a new branch:** Make a new branch for your changes (e.g., `feature/new-tool` or `bugfix/timer-issue`).
3.  **Make your changes:** Implement your new feature or bug fix.
4.  **Test your changes:** Ensure your changes work as expected and don't break existing functionality.
5.  **Commit your changes:** Write clear and concise commit messages.
6.  **Submit a pull request:** Push your changes to your fork and open a pull request to the main repository.

## Importing ICS Files

The Calendar tool can load `.ics` files exported from other apps like Google Calendar or Outlook.

1. Export your calendar as an `.ics` file.
   - In **Google Calendar** open **Settings → Import & export** and choose **Export** to download a ZIP containing your calendars. Extract the `.ics` file from it.
2. Open the **Calendar** tool and click **Import ICS**.
3. Select the `.ics` file and the events will appear in the list and be stored locally.

Imported calendar events are converted into TaskStore entries using deterministic hashes based on the ICS UID and start time. `[FIX]` and `[FLEX]` tags set whether the scheduler treats them as fixed or flexible blocks.

Only simple events are supported and nothing is uploaded anywhere.

### Loading a Public Google Calendar

Instead of manually exporting files, you can fetch events directly from a public link:

1. In **Google Calendar** open **Settings** and choose your calendar under **Settings for my calendars**.
2. Under **Access permissions for events** check **Make available to public** (Google warns that everything will be visible to anyone with the link).
3. Go to **Integrate calendar** and copy the **Public address in iCal format**.
4. In the Calendar tool paste this link into the **Load ICS URL** field and click **Load ICS URL**. Events will refresh automatically every 30 seconds.

**Privacy Risks:** anyone who has this link can view your calendar details. Share it carefully. To change the link later, disable public sharing (uncheck **Make available to public**) and enable it again to generate a new address or use **Reset private URLs** under **Integrate calendar**.


## License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.
