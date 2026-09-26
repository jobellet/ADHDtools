# features/rewards — points, rewards, achievements

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI.

| File | Role |
| --- | --- |
| `reward-system.js` | `#rewards`: points from completed tasks (`achievementScore`), rewards the user defines (`adhd-rewards`), spent points (`adhd-points-ledger`), achievements (`adhd-achievements`), evening review of past unclaimed tasks, celebration animation (`#celebration-container`). `window.RewardSystem`. |

- Listens to `dataChanged`, `taskCompleted`, `activeUserChanged`. Points = `importance × hours` (`core/task-model.js`).
