# features/breakdown — split a big task into small steps

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI.

| File | Role |
| --- | --- |
| `task-breakdown.js` | Tree of sub-steps in `adhd-breakdown-tasks` (`#project-list`), progress bar, task picker modal (`#task-select-modal`), AI breakdown (`data-cap="ai"`), send a step to the planner via `CrossTool` (`ef-receiveTaskFor-DayPlanner`). |

- Entry points: the Split buttons (Now view "Not now → split", Plan ahead) fire
  `ef-receiveTaskFor-TaskBreakdown` with `{ text, id, duration }`; this adds a root node and opens the screen.
- Known gap: sub-steps are not TaskStore tasks yet (roadmap).
