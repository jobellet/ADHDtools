function getConfig() {
  if (typeof window !== 'undefined') {
    const cfg = window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG;
    if (cfg) return cfg;
  }
  return { defaultTaskMinutes: 25 };
}

function generateId() {
  if (typeof window !== 'undefined' && window.CrossTool?.generateId) {
    return window.CrossTool.generateId();
  }
  if (typeof window !== 'undefined' && window.DataManager?.generateId) {
    return window.DataManager.generateId();
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

export function createTask(raw = {}, overrides = {}) {
  return {
    id: raw.id ?? generateId(),
    title: raw.title ?? '',
    source: raw.source ?? 'manual',
    importance: raw.importance ?? 5,
    urgency: raw.urgency ?? 5,
    estimatedMinutes: raw.estimatedMinutes ?? getConfig().defaultTaskMinutes,
    isFixed: raw.isFixed ?? false,
    startTime: raw.startTime ?? null,
    durationMinutes: raw.durationMinutes ?? raw.estimatedMinutes ?? getConfig().defaultTaskMinutes,
    calendarUid: raw.calendarUid ?? null,
    calendarInstanceId: raw.calendarInstanceId ?? null,
    assignedTo: raw.assignedTo ?? null,
    iconId: raw.iconId ?? null,
    status: raw.status ?? 'pending',
    ...overrides,
  };
}

if (typeof window !== 'undefined') {
  window.TaskModel = { createTask };
}

export default { createTask };
