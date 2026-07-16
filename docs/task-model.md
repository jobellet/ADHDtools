# Core Data Model, Task Storage & Scheduler

## The Task Object

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

## Task Storage

All tasks are persisted in the browser under the `adhd-unified-tasks` key (via `core/task-store.js`). The store exposes:

* `getAllTasks()`, `getPendingTasks()`, `getTasksByUser(user)`
* `addTask(task)`, `updateTaskByHash(hash, updates)`, `getTaskByHash(hash)`
* `markComplete(hash)`

Urgency scores are recalculated once per day from task deadlines, and the duration-learning module updates `durationMinutes` with a rolling average every time a task is marked complete.

Urgency smoothing lives in `core/urgency-helpers.js`. Deadlines more than 48 hours out receive a gentler urgency slope, while tasks that are repeatedly skipped gain urgency faster through a skip ledger (stored locally) so they bubble back into the schedule.

Legacy modules still calling `DataManager` automatically read/write through this shared store, so new tools should prefer `TaskStore` directly.

## Unified Scheduler

`core/scheduler.js` exposes `getTodaySchedule()` and `getCurrentTask()` to produce a prioritized plan for the current day. The scheduler:

* reads tasks from the shared **TaskStore** (including routines, planner items, and calendar imports),
* excludes completed or dependency-blocked tasks,
* blocks out fixed calendar events and `[FIX]`-tagged items,
* scores tasks with `importance × urgency`, then fills open time in priority order.

The Day Planner includes a **Generate schedule for today** action that applies the scheduler to the timeline, and the **Start Focus Session for Current Task** button boots focus mode with the active slot.

The **Today View** (on the Home tab) highlights the current task, the next three items, and quick actions to start focus, mark done (updates TaskStore), or skip/reschedule with higher urgency. The skip flow offers "end of day", "tomorrow", or a custom date/time while recording a skip count that feeds into urgency smoothing and guards against violating dependencies.

---

[← Back to README](../README.md)
