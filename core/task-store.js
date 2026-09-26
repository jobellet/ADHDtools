import { createTask, updateTask, markTaskCompleted, computeAchievementScore, computeUrgencyFromDeadline, isPassiveOrAllDay } from './task-model.js';
import UrgencyHelpers from './urgency-helpers.js';
import { recordTaskDuration } from './duration-learning.js';

const STORAGE_KEY = 'adhd-unified-tasks';
const URGENCY_REFRESH_KEY = 'adhd-urgency-refresh-date';
// Deleted task ids, so a sync merge does not bring deleted tasks back.
export const DELETED_TASKS_KEY = 'adhd-deleted-tasks';
const MAX_TOMBSTONES = 1000;

function readTombstones() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(DELETED_TASKS_KEY) : null;
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeTombstones(list) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(list.slice(-MAX_TOMBSTONES)));
    }
  } catch (err) {
    console.warn('Failed to save deleted-task list', err);
  }
}

function readLegacyTasks() {
  try {
    const raw = (typeof localStorage !== "undefined" ? localStorage.getItem.bind(localStorage) : () => null)('adhd-hub-data');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  } catch (err) {
    console.warn('Failed to read legacy tasks', err);
    return [];
  }
}

function loadTasks() {
  try {
    const stored = (typeof localStorage !== "undefined" ? localStorage.getItem.bind(localStorage) : () => null)(STORAGE_KEY);
    if (!stored) {
      return readLegacyTasks().map(t => createTask(t, { hash: t.id || t.hash }));
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(t => createTask(t, t)) : [];
  } catch (err) {
    console.error('Failed to load unified tasks', err);
    return [];
  }
}

let tasks = loadTasks();

function refreshUrgencyIfStale() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const lastRun = (typeof localStorage !== "undefined" ? localStorage.getItem.bind(localStorage) : () => null)(URGENCY_REFRESH_KEY);
    if (lastRun === today) return;
    let updated = false;
    tasks = tasks.map(task => {
      if (!task.deadline) return task;
      const nextUrgency = UrgencyHelpers?.computeSmoothedUrgency?.({ ...task, urgency: computeUrgencyFromDeadline(task.deadline) })
        ?? computeUrgencyFromDeadline(task.deadline);
      if (nextUrgency !== task.urgency) {
        updated = true;
        return { ...task, urgency: nextUrgency };
      }
      return task;
    });
    if (updated) persist();
    (typeof localStorage !== "undefined" ? localStorage.setItem.bind(localStorage) : () => {})(URGENCY_REFRESH_KEY, today);
  } catch (err) {
    console.warn('Failed to refresh urgency', err);
  }
}

refreshUrgencyIfStale();

function persist() {
  try {
    (typeof localStorage !== "undefined" ? localStorage.setItem.bind(localStorage) : () => {})(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save unified tasks', err);
  }
}

function getAllTasks() {
  return tasks.filter(t => !t.isArchived);
}

function getTasksByUser(user) {
  return tasks.filter(t => t.user === user && !t.isArchived);
}

function getTaskByHash(hash) {
  return tasks.find(t => t.hash === hash || t.id === hash) || null;
}

function getPendingTasks() {
  return tasks.filter(t => !t.completed && !t.isArchived);
}

function getActiveTasks() {
  return tasks.filter(t => !t.isArchived);
}

function getArchivedTasks() {
  return tasks.filter(t => t.isArchived);
}

function addTask(rawTask) {
  const task = createTask(rawTask, rawTask);
  tasks.push(task);
  persist();
  return task;
}

function updateTaskByHash(hash, updates) {
  const idx = tasks.findIndex(t => t.hash === hash || t.id === hash);
  if (idx === -1) return null;
  const updated = updateTask(tasks[idx], updates);
  tasks[idx] = updated;
  persist();
  return updated;
}

function upsertTaskByHash(hash, rawTask) {
  const existing = getTaskByHash(hash);
  if (!existing) return addTask({ ...rawTask, hash });
  return updateTaskByHash(existing.hash, rawTask);
}

function saveTasks(nextTasks) {
  tasks = nextTasks.map(t => createTask(t, t));
  persist();
}

// Remove tasks for good. Returns the removed tasks (keep them to undo).
function deleteTasks(hashes) {
  const drop = new Set(hashes);
  const removed = tasks.filter(t => drop.has(t.hash) || drop.has(t.id));
  if (!removed.length) return [];
  tasks = tasks.filter(t => !removed.includes(t));
  persist();
  const deletedAt = new Date().toISOString();
  const ids = new Set(removed.flatMap(t => [t.hash, t.id]).filter(Boolean));
  writeTombstones([...readTombstones().filter(x => !ids.has(x.id)), ...[...ids].map(id => ({ id, deletedAt }))]);
  return removed;
}

// Put back tasks returned by deleteTasks (undo).
function undeleteTasks(removed) {
  const existing = new Set(tasks.map(t => t.hash));
  const back = (removed || []).filter(t => !existing.has(t.hash));
  if (!back.length) return 0;
  tasks = [...tasks, ...back];
  persist();
  const ids = new Set(back.flatMap(t => [t.hash, t.id]).filter(Boolean));
  writeTombstones(readTombstones().filter(x => !ids.has(x.id)));
  return back.length;
}

// Pending tasks whose deadline has passed (optionally for one user).
function getOverdueTasks(now = new Date(), user = null) {
  // Calendar copies and all-day items are appointments, not deadlines.
  return tasks.filter(t => !t.completed && !t.isArchived && t.deadline && !isPassiveOrAllDay(t)
    && (!user || t.user === user)
    && !Number.isNaN(new Date(t.deadline).getTime())
    && new Date(t.deadline) < now);
}

function restoreTask(hash) {
  return updateTaskByHash(hash, { isArchived: false, archivedReason: null });
}

function archiveStaleTasks(daysThreshold = 7) {
  let updated = false;
  const now = new Date();

  tasks = tasks.map(task => {
    if (task.completed || task.isArchived) return task;

    // We compare against updatedAt if it exists, otherwise createdAt
    const timestamp = task.updatedAt || task.createdAt;
    if (!timestamp) return task;

    const taskDate = new Date(timestamp);
    if (isNaN(taskDate.getTime())) return task;

    const diffDays = (now - taskDate) / (1000 * 60 * 60 * 24);
    if (diffDays > daysThreshold) {
      updated = true;
      return { ...task, isArchived: true, archivedReason: 'stale' };
    }
    return task;
  });

  if (updated) {
    persist();
  }
}

function markComplete(hash, completedAt = new Date().toISOString()) {
  const task = getTaskByHash(hash);
  if (!task) return null;
  const updated = markTaskCompleted(task, completedAt);
  if (task.name && task.durationMinutes) {
    const learned = recordTaskDuration(task.name, task.durationMinutes);
    if (learned) {
      updated.durationMinutes = learned;
    }
  }
  return updateTaskByHash(hash, updated);
}

function getTaskScoreTotals(user) {
  const totals = tasks.reduce((acc, task) => {
    if (user && task.user !== user) return acc;
    const name = task.name || 'Task';
    if (!acc[name]) {
      acc[name] = { name, count: 0, score: 0 };
    }
    const score = task.completed ? (task.achievementScore || computeAchievementScore(task) || 0) : 0;
    acc[name].count += task.completed ? 1 : 0;
    acc[name].score += score;
    return acc;
  }, {});
  const groups = Object.values(totals).map(group => ({ ...group, score: Number(group.score.toFixed(2)) }));
  const totalScore = groups.reduce((sum, g) => sum + g.score, 0);
  return { groups, totalScore: Number(totalScore.toFixed(2)) };
}

function getCategoryStats({ user = null } = {}) {
  const totals = tasks.reduce((acc, task) => {
    if (user && task.user !== user) return acc;
    if (!task.completed) return acc;
    const name = task.name || 'Task';
    if (!acc[name]) {
      acc[name] = { name, count: 0, score: 0, minutes: 0 };
    }
    const score = task.achievementScore || computeAchievementScore(task) || 0;
    acc[name].count += 1;
    acc[name].score += score;
    const minutes = Number(task.durationMinutes || task.duration || 0);
    acc[name].minutes += Number.isFinite(minutes) ? minutes : 0;
    return acc;
  }, {});
  return Object.values(totals).map(cat => ({
    ...cat,
    score: Number(cat.score.toFixed(2)),
    minutes: Math.round(cat.minutes),
  }));
}

const TaskStore = {
  getAllTasks,
  getActiveTasks,
  getArchivedTasks,
  getTasksByUser,
  getTaskByHash,
  getPendingTasks,
  addTask,
  updateTaskByHash,
  restoreTask,
  deleteTasks,
  undeleteTasks,
  getOverdueTasks,
  archiveStaleTasks,
  upsertTaskByHash,
  saveTasks,
  markComplete,
  getTaskScoreTotals,
  getCategoryStats,
  getActiveUser: () => ((typeof window !== "undefined" ? window.UserContext : null)?.getActiveUser?.() || null),
};

if (typeof window !== 'undefined') {
  if (typeof window !== "undefined") window.TaskStore = TaskStore;
}

export default TaskStore;
