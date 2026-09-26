// coverage.js — what the AI assistant (MCP server) can see and do, for EVERY part of the app's API.
// tests/mcp-coverage.test.js fails when the app gets something new that is not listed here, so
// each new function, task field, storage key or global gets a decision:
//   'tool:<name>'   exposed through that MCP tool
//   'read'          the MCP server reads it (storage keys) / shows it (task fields)
//   'write'         the AI can set it (task fields, through add_task / update_task)
//   'no: <reason>'  deliberately not exposed, with the reason
// See mcp/AGENTS.md → "When you add something to the app".

export const taskStore = {
  getAllTasks: 'tool:list_tasks',
  getActiveTasks: 'tool:list_tasks',
  getArchivedTasks: 'no: archived tasks are hidden from the user too',
  getTasksByUser: 'tool:list_tasks',
  getTaskByHash: 'tool:list_tasks',
  getPendingTasks: 'tool:list_tasks',
  addTask: 'tool:add_task',
  updateTaskByHash: 'tool:update_task',
  restoreTask: 'no: restoring archived tasks is done in the app',
  deleteTasks: 'tool:delete_task',
  undeleteTasks: 'no: undo lives in the app for 15 seconds',
  getOverdueTasks: 'tool:list_tasks',
  archiveStaleTasks: 'no: housekeeping the app runs by itself',
  upsertTaskByHash: 'tool:update_task',
  saveTasks: 'no: bulk overwrite is too risky for an assistant',
  markComplete: 'tool:complete_task',
  getTaskScoreTotals: 'no: reward points are shown in the app',
  getCategoryStats: 'no: reward statistics are shown in the app',
  getActiveUser: 'tool:get_overview',
};

export const scheduler = {
  getTodaySchedule: 'tool:get_schedule',
  getCurrentTask: 'tool:get_overview',
  buildSchedule: 'tool:get_schedule',
  getRoutineBlocks: 'tool:get_schedule',
  getBusyBlocks: 'tool:find_free_slots',
  findConflicts: 'tool:schedule_task',
  findNextFreeSlot: 'tool:find_free_slots',
  findRoutineConflicts: 'no: routines are edited in the app',
  routineBookedMinutes: 'tool:list_routines',
  isPassiveOrAllDay: 'tool:list_tasks',
  localDateString: 'tool:get_overview',
};

// Every field createTask() makes (core/task-model.js) and every field an op writes.
export const taskFields = {
  hash: 'read', id: 'read', user: 'read', createdAt: 'read',
  name: 'write', text: 'write', deadline: 'write', plannerDate: 'write', isFixed: 'write',
  durationMinutes: 'write', importance: 'write', urgency: 'write', location: 'write', notes: 'write',
  dependency: 'read', parentId: 'read', completed: 'read', completedAt: 'read',
  isArchived: 'read', archivedReason: 'read', source: 'read', originalTool: 'read',
  startTime: 'no: legacy field, plannerDate holds the time',
  achievementScore: 'no: computed by the app when a task is done',
  needsBreakdown: 'no: break_down_task does the split directly',
  locationCoords: 'no: set by the app when the user picks a place',
  startLocationCoords: 'no: set by the app for travel time',
  travelMode: 'no: chosen in the app for travel time',
};

// Every localStorage key the app uses ('adhd-…' literals in core/, shell/, services/, features/).
export const storageKeys = {
  'adhd-unified-tasks': 'read',
  'adhd-deleted-tasks': 'read',
  'adhd-tool-routines': 'read',
  'adhd-routine-runs': 'read',
  'adhd-calendar-events': 'read',
  'adhd-tools-config': 'read',
  'adhd-active-user': 'read',
  'adhd-assistant-applied': 'read',
  'adhd-known-users': 'no: other profiles are not shown to the assistant',
  'adhd-tasks': 'no: legacy key, migrated into adhd-unified-tasks',
  'adhd-hub-data': 'no: legacy mirror of the tasks',
  'adhd-breakdown-tasks': 'no: legacy breakdown tree, break_down_task writes real tasks',
  'adhd-projects': 'no: legacy project list, unused',
  'adhd-habits': 'no: habits are tracked in the app',
  'adhd-habit-logs': 'no: habits are tracked in the app',
  'adhd-habit-streak-awards': 'no: habit rewards are computed in the app',
  'adhd-rewards': 'no: rewards are managed in the app',
  'adhd-achievements': 'no: rewards are managed in the app',
  'adhd-points-ledger': 'no: rewards are managed in the app',
  'adhd-lang': 'no: the assistant talks in its own language',
  'adhd-planner-zoom': 'no: display setting of one device',
  'adhd-device-id': 'no: identifies one device, not useful',
  'adhd-storage-log': 'no: internal sync bookkeeping',
  'adhd-duration-learning': 'no: the app learns durations by itself',
  'adhd-task-skip-ledger': 'no: internal urgency bookkeeping',
  'adhd-urgency-refresh-date': 'no: internal urgency bookkeeping',
  'adhd-calendar-ics-url': 'no: private calendar link stays in the app',
  'adhd-calendar-voice-enabled': 'no: sound setting of one device',
  'adhd-calendar-voice-early': 'no: sound setting of one device',
  'adhd-ai-settings': 'no: API keys never leave the device',
  'adhd-ai-': 'no: prefix of AI settings keys, API keys never leave the device',
};

// Every row of the globals table in AGENTS.md.
export const globals = {
  EventBus: 'no: browser page events only',
  DataManager: 'no: the MCP server reads the Drive backup made by DataManager.collectAllData',
  TaskStore: 'tool:list_tasks',
  TaskModel: 'tool:add_task',
  UnifiedScheduler: 'tool:get_schedule',
  NowState: 'tool:get_overview',
  UrgencyHelpers: 'no: internal urgency bookkeeping',
  DurationLearning: 'no: the app learns durations by itself',
  TaskParser: 'no: the assistant understands language itself',
  AIAssistant: 'no: the assistant is the AI',
  UserContext: 'tool:get_overview',
  ConfigManager: 'tool:get_overview',
  I18n: 'no: the assistant talks in its own language',
  AppRouter: 'no: screen navigation only',
  AppSheets: 'no: screen navigation only',
  switchTool: 'no: screen navigation only',
  AppCapabilities: 'no: device setup detection',
  GoogleAuth: 'no: the MCP server has its own Google sign-in (npm run mcp:auth)',
  DriveSync: 'no: the MCP server talks to Drive directly (mcp/store.js)',
  CredentialsSync: 'no: API keys never leave the device',
  CrossTool: 'no: screen to screen hand-off',
  RoutinePlayer: 'tool:list_routines',
  DayPlanner: 'no: screen rendering only',
  CalendarTool: 'tool:get_schedule',
  RewardSystem: 'no: rewards are managed in the app',
  AssistantInbox: 'no: the app side of this MCP server',
};

export const STORAGE_READ = Object.keys(storageKeys).filter(k => storageKeys[k] === 'read');
