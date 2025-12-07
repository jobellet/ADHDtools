import TaskStore from './task-store.js';
import { computeUrgencyFromDeadline } from './task-model.js';

const DEFAULT_CONFIG = {
  dayStart: '07:00',
  dayEnd: '22:00',
};

function parseTimeToMinutes(timeStr, fallback = 0) {
  if (typeof timeStr === 'number' && Number.isFinite(timeStr)) return timeStr;
  if (typeof timeStr !== 'string') return fallback;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Math.min(Math.max(parseInt(match[1], 10), 0), 23);
  const minutes = Math.min(Math.max(parseInt(match[2], 10), 0), 59);
  return hours * 60 + minutes;
}

function getDurationMinutes(task) {
  const candidates = [task.durationMinutes, task.duration, task.estimatedMinutes];
  for (const val of candidates) {
    const num = Number(val);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 60;
}

function deriveStartMinutes(task) {
  if (task.startTime) return parseTimeToMinutes(task.startTime, null);
  if (task.deadline && task.deadline.includes('T')) {
    return parseTimeToMinutes(task.deadline.slice(11, 16), null);
  }
  if (task.plannerDate) return parseTimeToMinutes(task.plannerDate.slice(11, 16), null);
  return null;
}

function isDependencyBlocked(task, taskMap) {
  if (!task.dependency) return false;
  const dep = taskMap.get(task.dependency);
  return dep ? !dep.completed : false;
}

function computePriority(task) {
  const importance = Number(task.importance ?? 5);
  const urgency = Number(task.urgency ?? computeUrgencyFromDeadline(task.deadline));
  return (Number.isFinite(importance) ? importance : 5) * (Number.isFinite(urgency) ? urgency : 5);
}

function buildDailySchedule(tasks, config) {
  const dayStart = parseTimeToMinutes(config.dayStart, 0);
  const dayEnd = parseTimeToMinutes(config.dayEnd, 24 * 60);
  const fixed = [];
  const flexible = [];

  tasks.forEach(task => {
    const startMinutes = deriveStartMinutes(task);
    if (task.isFixed || (task.name || '').includes('[FIX]')) {
      if (Number.isFinite(startMinutes)) {
        fixed.push({ task, startMinutes, endMinutes: startMinutes + getDurationMinutes(task) });
        return;
      }
    }
    if (Number.isFinite(startMinutes) && startMinutes >= dayStart && startMinutes < dayEnd) {
      fixed.push({ task, startMinutes, endMinutes: startMinutes + getDurationMinutes(task) });
      return;
    }
    flexible.push(task);
  });

  fixed.sort((a, b) => a.startMinutes - b.startMinutes);
  flexible.sort((a, b) => computePriority(b) - computePriority(a));

  const schedule = [];
  let cursor = dayStart;

  fixed.forEach(slot => {
    const gapEnd = Math.max(dayStart, Math.min(slot.startMinutes, dayEnd));
    while (flexible.length && cursor + getDurationMinutes(flexible[0]) <= gapEnd) {
      const task = flexible.shift();
      const duration = getDurationMinutes(task);
      schedule.push({ task, startMinutes: cursor, endMinutes: cursor + duration });
      cursor += duration;
    }
    const start = Math.max(cursor, slot.startMinutes);
    const end = Math.min(dayEnd, Math.max(slot.endMinutes, start));
    schedule.push({ task: slot.task, startMinutes: start, endMinutes: end });
    cursor = end;
  });

  while (flexible.length && cursor < dayEnd) {
    const task = flexible.shift();
    const duration = getDurationMinutes(task);
    if (cursor + duration > dayEnd) break;
    schedule.push({ task, startMinutes: cursor, endMinutes: cursor + duration });
    cursor += duration;
  }
  return schedule;
}

export function getTodaySchedule(now = new Date(), overrides = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...(overrides.config || {}), ...(window.ConfigManager?.getConfig?.() || {}) };
  const allTasks = TaskStore.getPendingTasks();
  const taskMap = new Map(allTasks.map(t => [t.hash, t]));
  const filtered = allTasks.filter(t => !isDependencyBlocked(t, taskMap) && (t.urgency || computeUrgencyFromDeadline(t.deadline)) >= 1);
  const schedule = buildDailySchedule(filtered, cfg);
  const todayStr = now.toISOString().slice(0, 10);
  return schedule.map(slot => {
    const startTime = new Date(`${todayStr}T00:00:00Z`);
    startTime.setMinutes(slot.startMinutes);
    const endTime = new Date(`${todayStr}T00:00:00Z`);
    endTime.setMinutes(slot.endMinutes);
    return { ...slot, startTime, endTime };
  });
}

export function getCurrentTask(now = new Date(), overrides = {}) {
  const schedule = getTodaySchedule(now, overrides);
  return schedule.find(slot => now >= slot.startTime && now < slot.endTime) || null;
}

const UnifiedScheduler = { getTodaySchedule, getCurrentTask };

if (typeof window !== 'undefined') {
  window.UnifiedScheduler = UnifiedScheduler;
  window.TaskScheduler = UnifiedScheduler;
}

export default UnifiedScheduler;
