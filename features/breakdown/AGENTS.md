# features/breakdown — split a big task into small steps

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI.

| File | Role |
| --- | --- |
| `task-breakdown.js` | Tree of sub-steps in `adhd-breakdown-tasks` (`#project-list`), progress bar, task picker modal (`#task-select-modal`), AI breakdown (`data-cap="ai"`), send a step to the planner via `CrossTool` (`ef-receiveTaskFor-DayPlanner`). |

- Entry points: the Split buttons (Now view "Not now → split", Plan ahead) fire
  `ef-receiveTaskFor-TaskBreakdown` with `{ text, id, duration }`; this adds a root node and opens the screen.
- Subtasks created manually, via AI, or by dropping a task onto `#plan-breakdown-dropzone` are synced to `TaskStore` (`syncSubtaskToStore`), archiving the split parent task (`archivedReason: 'split'`) so subtasks appear directly in `#plan-deadlines`.
