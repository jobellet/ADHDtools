const DEFAULT_USER = 'main';

function getConfig() {
  if (typeof window !== 'undefined') {
    const cfg = window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG;
    if (cfg) return cfg;
  }
  return { defaultTaskMinutes: 25 };
}

function normalizeNumber(val, fallback) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

function computeUrgencyFromDeadline(deadline) {
  if (!deadline) return 5;
  const now = new Date();
  const due = new Date(deadline);
  if (isNaN(due.getTime())) return 5;
  const diffDays = Math.floor((due.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 10;
  if (diffDays === 1) return 9;
  if (diffDays <= 3) return 8;
  if (diffDays <= 5) return 7;
  if (diffDays <= 7) return 6;
  return 5;
}

function baseHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `task-${Math.abs(hash)}`;
}

function generateHash({ user, name, createdAt, seed }) {
  const basis = `${user || DEFAULT_USER}|${name || 'task'}|${createdAt || new Date().toISOString()}|${seed || ''}`;
  return baseHash(basis);
}

function computeAchievementScore(task) {
  const durationHours = normalizeNumber(task.durationMinutes, 0) / 60;
  const importance = normalizeNumber(task.importance, 0);
  const score = importance * durationHours;
  return Number.isFinite(score) ? Number(score.toFixed(2)) : 0;
}

function createTask(raw = {}, overrides = {}) {
  const cfg = getConfig();
  const createdAt = raw.createdAt || new Date().toISOString();
  const user = raw.user || DEFAULT_USER;
  const name = raw.name || raw.title || raw.text || 'Untitled Task';
  const deadline = raw.deadline || raw.plannerDate || null;
  const durationMinutes = normalizeNumber(
    raw.durationMinutes ?? raw.duration ?? raw.estimatedMinutes,
    normalizeNumber(cfg?.defaultTaskMinutes, 60)
  );
  const importance = normalizeNumber(raw.importance ?? raw.priority, 5);
  const urgency = normalizeNumber(raw.urgency, computeUrgencyFromDeadline(deadline));
  const base = {
    user,
    name,
    text: raw.text || name,
    createdAt,
    deadline,
    plannerDate: raw.plannerDate || null,
    startTime: raw.startTime || null,
    durationMinutes,
    importance: Math.max(1, Math.min(10, importance || 1)),
    urgency: Math.max(1, Math.min(10, urgency || 1)),
    dependency: raw.dependency || raw.dependsOn || null,
    completed: Boolean(raw.completed || raw.isCompleted),
    completedAt: raw.completedAt || null,
    achievementScore: normalizeNumber(raw.achievementScore, 0),
    isFixed: raw.isFixed ?? false,
    source: raw.source || raw.originalTool || 'manual',
    originalTool: raw.originalTool || raw.source || 'manual',
  };
  const hash = raw.hash || raw.id || generateHash(base);
  const task = {
    ...base,
    hash,
    id: raw.id || hash,
  };
  if (task.completed && !task.completedAt) {
    task.completedAt = new Date().toISOString();
  }
  const merged = { ...task, ...overrides };
  if (!merged.achievementScore && merged.completed) {
    merged.achievementScore = computeAchievementScore(merged);
  }
  return merged;
}

function updateTask(task, updates) {
  return createTask({ ...task, ...updates, createdAt: task.createdAt || new Date().toISOString(), hash: task.hash, id: task.id }, {});
}

function markTaskCompleted(task, completedAt = new Date().toISOString()) {
  const updated = updateTask(task, { completed: true, completedAt });
  return { ...updated, achievementScore: computeAchievementScore(updated) };
}

if (typeof window !== 'undefined') {
  window.TaskModel = {
    createTask,
    updateTask,
    markTaskCompleted,
    computeUrgencyFromDeadline,
    computeAchievementScore,
    DEFAULT_USER,
  };
}

export default {
  createTask,
  updateTask,
  markTaskCompleted,
  computeUrgencyFromDeadline,
  computeAchievementScore,
  DEFAULT_USER,
};
