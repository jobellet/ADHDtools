# features/habits — habit tracker

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI, self-contained.

| File | Role |
| --- | --- |
| `habit-tracker.js` | `#habits`: habits list, calendar of check-ins, streaks, export. Stores `adhd-habits`, `adhd-habit-logs`, `adhd-habit-streak-awards`. Checking a habit creates a completed "habit" task in `TaskStore` and fires `habitToggled` / `taskCompleted`. |
