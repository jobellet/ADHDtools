1. **Explore `core/task-store.js`**
   - Understand how tasks are queried and updated.
2. **Implement `archiveStaleTasks`**
   - Add a method to iterate over `tasks`, checking if an uncompleted task's `updatedAt` (or `createdAt`) is older than `daysThreshold` (default 7).
   - If older, set `isArchived: true` and `archivedReason: 'stale'`.
   - Persist the changes if any task was updated.
3. **Add `restoreTask`**
   - Add a method to update a given task by its ID to remove the archived status (`isArchived: false`, `archivedReason: null`).
4. **Update task queries**
   - Provide `getActiveTasks()` and `getArchivedTasks()`.
   - Update existing methods (`getAllTasks`, `getPendingTasks`, `getTasksByUser`) to filter out archived tasks by default, ensuring they are excluded from the default view.
   - For `updateTaskByHash`, record `updatedAt` to ensure timestamps are refreshed when a user modifies a task.
5. **Complete pre commit steps**
   - Ensure proper testing, verification, review, and reflection are done by calling `pre_commit_instructions` before submitting.
6. **Submit changes**
   - Push and submit the change.
