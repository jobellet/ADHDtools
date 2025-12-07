import { createTask, updateTask, markTaskCompleted, computeAchievementScore } from './task-model.js';

const STORAGE_KEY = 'adhd-unified-tasks';

function readLegacyTasks() {
  try {
    const raw = localStorage.getItem('adhd-hub-data');
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
    const stored = localStorage.getItem(STORAGE_KEY);
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

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save unified tasks', err);
  }
}

function getAllTasks() {
  return [...tasks];
}

function getTasksByUser(user) {
  return tasks.filter(t => t.user === user);
}

function getTaskByHash(hash) {
  return tasks.find(t => t.hash === hash || t.id === hash) || null;
}

function getPendingTasks() {
  return tasks.filter(t => !t.completed);
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

function markComplete(hash, completedAt = new Date().toISOString()) {
  const task = getTaskByHash(hash);
  if (!task) return null;
  const updated = markTaskCompleted(task, completedAt);
  return updateTaskByHash(hash, updated);
}

function getTaskScoreTotals() {
  const totals = tasks.reduce((acc, task) => {
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

const TaskStore = {
  getAllTasks,
  getTasksByUser,
  getTaskByHash,
  getPendingTasks,
  addTask,
  updateTaskByHash,
  upsertTaskByHash,
  saveTasks,
  markComplete,
  getTaskScoreTotals,
};

if (typeof window !== 'undefined') {
  window.TaskStore = TaskStore;
}

export default TaskStore;
