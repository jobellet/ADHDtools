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
| deadline | ISO datetime string or null. Used to derive urgency. A deadline alone never pins a task to a time. |
| plannerDate | Optional local datetime (`YYYY-MM-DDTHH:MM`) that places the task at a time on the planner. |
| dependency | Hash of another task that must be completed first. |
| urgency | 1–10. Auto-derived from deadline when not provided. |
| importance | 1–10 priority weight from the user. |
| durationMinutes | Estimated duration in minutes (positive number). |
| isFixed | Boolean flag for fixed calendar events/blocks. |
| autoPinned | Set by the Now view when a task placed by the scheduler becomes the current task (so its countdown is stable). If the slot ends and the task is not done, it goes back into the queue. |
| snoozedUntil | ISO datetime set by **Not now → Later today**. The scheduler does not start the task before this time. |
| completed | Boolean completion flag. |
| completedAt | ISO string of when the task was finished. |
| achievementScore | importance × (durationMinutes / 60) when completed. |

Utility helpers:

* `createTask(raw, overrides)` – normalize any incoming object into a Task.
* `updateTask(task, updates)` – merge updates without losing the deterministic hash or any extra field (notes, category…).
* `markTaskCompleted(task, completedAt)` – set completion flags and recompute the achievement score.
* `computeUrgencyFromDeadline(deadline)` – derive urgency once per day from the deadline.
* `computeAchievementScore(task)` – shared scoring logic for achievements/rewards.

## Task Storage

All tasks are persisted in the browser under the `adhd-unified-tasks` key (via `core/task-store.js`). The store exposes:

* `getAllTasks()`, `getPendingTasks()`, `getTasksByUser(user)`
* `addTask(task)`, `updateTaskByHash(hash, updates)`, `getTaskByHash(hash)`
* `markComplete(hash)`
* `getOverdueTasks(now, user)` – pending tasks whose deadline has passed.
* `deleteTasks(hashes)` / `undeleteTasks(removed)` – delete for good (used by the *Plan ahead* panel) and undo. Deleted ids are kept in `adhd-deleted-tasks`, so a Google Drive merge or a file import does not bring deleted tasks back.

Urgency scores are recalculated once per day from task deadlines, and the duration-learning module updates `durationMinutes` with a rolling average every time a task is marked complete.

Urgency smoothing lives in `core/urgency-helpers.js`. Deadlines more than 48 hours out receive a gentler urgency slope, while tasks that are repeatedly skipped gain urgency faster through a skip ledger (stored locally) so they bubble back into the schedule.

Legacy modules still calling `DataManager` automatically read/write through this shared store, so new tools should prefer `TaskStore` directly.

## Unified Scheduler

`core/scheduler.js` builds the plan of a day. Main functions: `getTodaySchedule()`, `getCurrentTask()`, `buildSchedule()`. The scheduler:

* reads pending tasks from the shared **TaskStore** (active user only), and skips completed or dependency-blocked tasks,
* places **fixed items** first: tasks with a time on that day (`plannerDate`/`startTime`), `[FIX]`-tagged items, calendar events (when *Calendar events block time in the plan* is on) and **routine blocks**,
* fills the free gaps with the other tasks, from **now** onwards, in `importance × urgency` order, with a pause between tasks (`bufferDurationMinutes`, 5 min by default),
* never puts two items at the same time: an item that would overlap starts after the previous one,
* keeps the real start time of a block that is already in progress.

### Routines book time

Routines are stored under `adhd-tool-routines`. On each weekday a routine is active, it becomes a fixed block:

* start = the routine's start time,
* length = total of its steps × (1 + `routineBufferPercent` / 100), rounded up (10 % by default). Example: 30 min of steps → 33 min booked.

When a routine is finished (or skipped for today), its date is saved in `adhd-routine-runs` and its block is removed for the rest of the day, so the time is free again.

### Conflict helpers

These functions are used by the Day Planner, quick capture and the routine editor to prevent double booking:

* `getBusyBlocks(dateStr)` – routines, fixed calendar events and pinned tasks of a day.
* `findConflicts({ dateStr, startMinutes, durationMinutes, ignore })` – the blocks a new item would overlap.
* `findNextFreeSlot({ dateStr, fromMinutes, durationMinutes })` – the first start time where the item fits.
* `findRoutineConflicts(routine, routines)` – routines that share a weekday and overlap in time (saving is refused).

## Now state

`core/now-state.js` turns the schedule into what the user should see:

* `doing` – an item runs now → the **Now** view shows it with a countdown,
* `break` – nothing now, but the next item starts within `breakWindowMinutes` (15 by default) → countdown to it,
* `free` – nothing now or soon → the app opens the **Day Planner**.

`features/now/now-view.js` renders this state (and the planner's now/next strip and *Plan ahead* panel); `shell/app.js` picks the default view with `NowState.defaultToolFor(state)`.

In the Day Planner, **Lock plan** writes the current automatic times into the tasks (`plannerDate`), so they stop moving.

---

[← Back to README](../README.md)
