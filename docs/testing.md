# Manual Test Cases

Scenarios to verify core behavior after changes.

## Now view & routines

* **Default view:** open the app root while a task or routine is scheduled now → the Now view shows it with a countdown. With nothing planned now (and nothing within the break window, 15 min by default) → the Day Planner opens.
* **Routine booking:** create a routine at 07:00 with 30 min of steps. The planner shows an orange block 07:00–07:33 (10 % buffer). Add a task “Call dentist at 7:10am” in **Add** → it moves to 07:35 and the message says why.
* **No overlapping routines:** create a second routine at 07:20 on the same weekday → Save is refused with the name of the conflicting routine.
* **Routine from Now:** during the routine's time, tap **Start routine** → the full-screen player opens. Close it: the Now view shows the current step and its timer. Finish all steps → the routine is marked done for today and its remaining time frees up.
* **Not now:** on a task, tap **Not now → Later today** → the task disappears for one hour, then comes back. **Tomorrow** moves it to tomorrow.
* **Setup-based UI:** set `localStorage.gcalConnected = 'true'` and reload → *Calendar file / link import (.ics)* and the ICS refresh field disappear from Settings; *Show all options* brings them back. Without an AI provider, **AI Plan** and **AI Breakdown** are hidden.

## Scheduler & TaskStore

* **[FIX] stays pinned:**
  1. Run in console: `window.TaskStore.addTask({ name: '[FIX] Standup', plannerDate: new Date().toISOString().slice(0,16), durationMinutes: 30, isFixed: true });`
  2. Click **Lock plan** in Day Planner. The block should remain at its set time and appear in Now view as current/upcoming; skipping should keep it on today.
* **[FLEX] reschedules:**
  1. Run: `window.TaskStore.addTask({ name: '[FLEX] Write report', importance: 8, urgency: 7, durationMinutes: 45 });`
  2. Generate the schedule. The task should land in the next available slot and can move to later today/tomorrow via the Now view skip action.
* **Quick/routine tasks surface:** add a quick routine task (Routine tab) and generate the schedule; it should populate on the Day Planner timeline and in the Now view upcoming list.
* **Multi-user filtering:** create tasks for two users via `window.TaskStore.addTask({ name: 'Main task', user: 'main' }); window.TaskStore.addTask({ name: 'Sibling task', user: 'sibling' });` then switch the user dropdown in the navbar — Now view, the scheduler output, and Rewards/Achievements should show only the active profile.
* **Rewards ledger:** complete a few tasks (or run `window.TaskStore.markComplete(hash)` for an existing one) and open Rewards. Earned/available points should reflect completed tasks, and claiming a reward should increase the “Spent” total while reducing available points.
* **Focus mode completion:** start focus from Now view, let the timer finish, and choose to complete the task. The task should flip to completed, and the learned duration should reflect the session length.
* **Category achievements + toggle:** finish a few tasks for two different users. In Rewards/Achievements, toggle between active user and all users and verify category rows list counts, points, and minutes.
* **Habit → achievements:** add a habit, mark today as complete, then open Rewards/Achievements. A new “habit” task for the active user should appear in TaskStore (via console `window.TaskStore.getAllTasks().filter(t => t.category === 'habit')`), and totals/ledger should refresh without switching users.

## Google Calendar sync

* **Pipeline without OAuth:** in the console run
  `window.CalendarTool.ingestExternalEvents([{ uid: 't1@test', title: 'Probe', start: '2026-01-01T10:00:00', end: '2026-01-01T11:00:00' }])`
  — the event should appear in the Calendar tool and as a `calendar-import` task in `window.TaskStore.getAllTasks()`.
* **Private sync round-trip:** save a Client ID, click **Connect & Sync**, verify events from your primary calendar appear in Calendar/Day Planner and that **Sync now** / **Disconnect** update the status line.

## Cross-device sync

* **Drive backup/restore:** on device A run **About → Back up now**; on device B (same Client ID + Google account) run **Restore from Drive**. Overlapping items should raise the conflict dialog; after reload the merged data must be present.

---

[← Back to README](../README.md)
