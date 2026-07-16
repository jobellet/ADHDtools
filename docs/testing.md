# Manual Test Cases

Scenarios to verify core behavior after changes.

## Scheduler & TaskStore

* **[FIX] stays pinned:**
  1. Run in console: `window.TaskStore.addTask({ name: '[FIX] Standup', plannerDate: new Date().toISOString().slice(0,16), durationMinutes: 30, isFixed: true });`
  2. Click **Generate schedule for today** in Day Planner. The block should remain at its set time and appear in Today View as current/upcoming; skipping should keep it on today.
* **[FLEX] reschedules:**
  1. Run: `window.TaskStore.addTask({ name: '[FLEX] Write report', importance: 8, urgency: 7, durationMinutes: 45 });`
  2. Generate the schedule. The task should land in the next available slot and can move to later today/tomorrow via the Today View skip action.
* **Quick/routine tasks surface:** add a quick routine task (Routine tab) and generate the schedule; it should populate on the Day Planner timeline and in the Today View upcoming list.
* **Multi-user filtering:** create tasks for two users via `window.TaskStore.addTask({ name: 'Main task', user: 'main' }); window.TaskStore.addTask({ name: 'Sibling task', user: 'sibling' });` then switch the user dropdown in the navbar — Today View, the scheduler output, and Rewards/Achievements should show only the active profile.
* **Rewards ledger:** complete a few tasks (or run `window.TaskStore.markComplete(hash)` for an existing one) and open Rewards. Earned/available points should reflect completed tasks, and claiming a reward should increase the “Spent” total while reducing available points.
* **Focus mode completion:** start focus from Today View, let the timer finish, and choose to complete the task. The task should flip to completed, and the learned duration should reflect the session length.
* **Category achievements + toggle:** finish a few tasks for two different users. In Rewards/Achievements, toggle between active user and all users and verify category rows list counts, points, and minutes.
* **Family overview:** create at least one task per user with planner dates today. The Home view should show a card per user with current/next populated and remain readable on mobile widths.
* **Habit → achievements:** add a habit, mark today as complete, then open Rewards/Achievements. A new “habit” task for the active user should appear in TaskStore (via console `window.TaskStore.getAllTasks().filter(t => t.category === 'habit')`), and totals/ledger should refresh without switching users.

## Family view

* **Family columns render:** create 3–4 users with routine tasks inside a morning window (e.g., 06:00–10:00). Open the Family tab and confirm each user receives a column with vertically spaced tasks.
* **Window refresh:** change the window start/end fields and click Refresh. Verify task positions update relative to the adjusted window bounds.
* **Dependency styling:** add an incomplete dependency; the dependent task should display the blocked styling in the Family view.
* **Images for non-readers:** set `canRead=false` for a child, map their tasks to images, and confirm the column shows image-first tiles.
* **Display mode:** toggle big-screen display mode to hide navigation chrome and ensure the layout remains readable on large and small screens.

## Google Calendar sync

* **Pipeline without OAuth:** in the console run
  `window.CalendarTool.ingestExternalEvents([{ uid: 't1@test', title: 'Probe', start: '2026-01-01T10:00:00', end: '2026-01-01T11:00:00' }])`
  — the event should appear in the Calendar tool and as a `calendar-import` task in `window.TaskStore.getAllTasks()`.
* **Private sync round-trip:** save a Client ID, click **Connect & Sync**, verify events from your primary calendar appear in Calendar/Day Planner and that **Sync now** / **Disconnect** update the status line.

## Cross-device sync

* **Drive backup/restore:** on device A run **About → Back up now**; on device B (same Client ID + Google account) run **Restore from Drive**. Overlapping items should raise the conflict dialog; after reload the merged data must be present.

---

[← Back to README](../README.md)
