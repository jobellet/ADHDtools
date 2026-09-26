import TaskStore from './task-store.js';
import { computeUrgencyFromDeadline } from './task-model.js';
import UrgencyHelpers from './urgency-helpers.js';

const DEFAULT_CONFIG = {
  dayStart: '07:00',
  dayEnd: '22:00',
  fixedTag: '[FIX]',
  flexibleTag: '[FLEX]',
  bufferDurationMinutes: 5,
  // Routines book their time in the schedule with this extra margin (percent),
  // so a 30 min routine blocks 33 min and nothing else can be put there.
  routineBufferPercent: 10,
  includeCalendarInSchedule: true,
};

const ROUTINE_STORAGE_KEY = 'adhd-tool-routines';
const ROUTINE_RUNS_KEY = 'adhd-routine-runs'; // { [routineId]: 'YYYY-MM-DD' of last completed run }

function readJSON(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

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
  // A deadline is when the task must be done, not when it starts: only the
  // planner date pins a task to a time.
  if (task.plannerDate && task.plannerDate.length >= 16) return parseTimeToMinutes(task.plannerDate.slice(11, 16), null);
  return null;
}

function isDependencyBlocked(task, taskMap) {
  if (!task.dependency) return false;
  const dep = taskMap.get(task.dependency);
  return dep ? !dep.completed : false;
}

function computePriority(task) {
  const importance = Number(task.importance ?? 5);
  const baseUrgency = Number.isFinite(task.urgency) ? task.urgency : computeUrgencyFromDeadline(task.deadline);
  const urgency = UrgencyHelpers?.computeSmoothedUrgency?.({ ...task, urgency: baseUrgency }) ?? baseUrgency;
  return (Number.isFinite(importance) ? importance : 5) * (Number.isFinite(urgency) ? urgency : 5);
}

export function routineStepsMinutes(routine) {
  return (routine?.tasks || []).reduce((sum, step) => sum + (parseInt(step.duration, 10) || 0), 0);
}

// Minutes a routine books in the schedule: its steps plus the buffer margin.
export function routineBookedMinutes(routine, bufferPercent = DEFAULT_CONFIG.routineBufferPercent) {
  const steps = routineStepsMinutes(routine);
  if (steps <= 0) return 0;
  const pct = Math.max(0, Number(bufferPercent) || 0);
  return Math.max(5, Math.ceil(steps * (1 + pct / 100)));
}

function loadRoutines(config) {
  if (Array.isArray(config?.routines)) return config.routines;
  const routines = readJSON(ROUTINE_STORAGE_KEY, []);
  return Array.isArray(routines) ? routines : [];
}

function routineDoneOn(routineId, dateStr, config) {
  const runs = config?.routineRuns || readJSON(ROUTINE_RUNS_KEY, {});
  return runs?.[routineId] === dateStr;
}

function dateFromString(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Routine blocks booked for a given day (weekday matches and a start time is set).
export function getRoutineBlocks(dateStr, config = {}, { includeDone = false } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const weekday = dateFromString(dateStr).getDay();
  return loadRoutines(cfg)
    .filter(r => Array.isArray(r.weekDays) && r.weekDays.map(Number).includes(weekday))
    .filter(r => includeDone || !routineDoneOn(r.id, dateStr, cfg))
    .map(routine => {
      const startMinutes = parseTimeToMinutes(routine.startTime, null);
      const duration = routineBookedMinutes(routine, cfg.routineBufferPercent);
      if (!Number.isFinite(startMinutes) || duration <= 0) return null;
      const name = routine.name || 'Routine';
      return {
        task: {
          name,
          text: name,
          isFixed: true,
          source: 'routine',
          routineId: routine.id,
          steps: (routine.tasks || []).map(step => ({ name: step.name, duration: parseInt(step.duration, 10) || 0 })),
          stepsMinutes: routineStepsMinutes(routine),
          hash: `routine:${routine.id}:${dateStr}`,
          startTime: routine.startTime,
          durationMinutes: duration,
        },
        startMinutes,
        endMinutes: startMinutes + duration,
      };
    })
    .filter(Boolean);
}

function loadCalendarBlocks(todayStr, config) {
  try {
    const events = JSON.parse((typeof localStorage !== "undefined" ? localStorage.getItem.bind(localStorage) : () => null)('adhd-calendar-events')) || [];
    const fixedTag = config?.fixedTag || '[FIX]';
    return events
      .filter(ev => ev.start && ev.start.startsWith(todayStr))
      .map(ev => {
        const startMinutes = deriveStartMinutes({ startTime: ev.start.slice(11, 16) });
        const endMinutes = ev.end ? deriveStartMinutes({ startTime: ev.end.slice(11, 16) }) : null;
        const duration = Number.isFinite(endMinutes) ? endMinutes - startMinutes : getDurationMinutes(ev);
        const name = ev.title || ev.rawTitle || 'Calendar Block';
        const isFixed = (ev.isFixed ?? true) || name.includes(fixedTag);
        return {
          task: {
            name,
            text: name,
            isFixed,
            source: 'calendar',
            hash: ev.calendarInstanceId || ev.id || `cal-${ev.start}`,
            location: ev.location || '',
            startTime: ev.start?.slice(11, 16) || null,
            durationMinutes: duration,
            deadline: ev.end || null,
          },
          startMinutes: startMinutes ?? 0,
          endMinutes: (startMinutes ?? 0) + duration,
        };
      })
      .filter(slot => slot.task.startTime && slot.task.isFixed);
  } catch (err) {
    console.warn('Failed to load calendar blocks for scheduler', err);
    return [];
  }
}

function buildDailySchedule(tasks, config, todayStr = localDateString(new Date()), nowMinutes = null, nowDate = null) {
  const dayStart = parseTimeToMinutes(config.dayStart, 0);
  const dayEnd = parseTimeToMinutes(config.dayEnd, 24 * 60);
  const buffer = Number(config.bufferDurationMinutes ?? 5);
  const fixed = [];
  const flexible = [];

  tasks.forEach(task => {
    const isFlexTagged = (task.name || '').includes(config.flexibleTag || '[FLEX]');
    let startMinutes = isFlexTagged ? null : deriveStartMinutes(task);
    // A task the Now view pinned when it started, but that was not finished in
    // its slot, goes back into the queue instead of staying stuck in the past.
    if (task.autoPinned && !task.isFixed && Number.isFinite(startMinutes) && nowMinutes !== null
      && startMinutes + getDurationMinutes(task) <= nowMinutes) {
      flexible.push(task);
      return;
    }
    if (task.isFixed || (task.name || '').includes(config.fixedTag || '[FIX]')) {
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

  if (config.includeCalendarInSchedule !== false) fixed.push(...loadCalendarBlocks(todayStr, config));
  fixed.push(...getRoutineBlocks(todayStr, config));

  fixed.sort((a, b) => a.startMinutes - b.startMinutes);
  flexible.sort((a, b) => computePriority(b) - computePriority(a));

  // Snoozed ("later") tasks can't start before their snooze ends.
  const notBefore = task => {
    if (!task.snoozedUntil || !nowDate) return -Infinity;
    const until = new Date(task.snoozedUntil);
    if (Number.isNaN(until.getTime()) || until <= nowDate) return -Infinity;
    if (localDateString(until) !== todayStr) return Infinity;
    return until.getHours() * 60 + until.getMinutes();
  };
  // Next task in priority order that may start at `at` (null if the best one
  // does not fit before `limit`: keep priority order, don't skip ahead).
  const takeNext = (at, limit) => {
    const idx = flexible.findIndex(task => notBefore(task) <= at);
    if (idx === -1 || at + getDurationMinutes(flexible[idx]) > limit) return null;
    return flexible.splice(idx, 1)[0];
  };

  // Fill flexible tasks starting from "now" (never in the past) so the current
  // slot reflects what the user should actually be doing at this moment.
  const startCursor = nowMinutes === null
    ? dayStart
    : Math.max(dayStart, Math.min(nowMinutes, dayEnd));
  let cursor = startCursor;
  // End of the last placed item, without the pause: fixed items only move
  // when they really overlap something, never because of the pause.
  let busyUntil = startCursor;

  // Fixed blocks that already ended keep their original times instead of being
  // squeezed against the cursor.
  const pastFixed = fixed.filter(slot => slot.endMinutes <= startCursor);
  const upcomingFixed = fixed.filter(slot => slot.endMinutes > startCursor);

  const schedule = [...pastFixed];

  upcomingFixed.forEach(slot => {
    const gapEnd = Math.max(dayStart, Math.min(slot.startMinutes, dayEnd));
    for (let task = takeNext(cursor, gapEnd - buffer); task; task = takeNext(cursor, gapEnd - buffer)) {
      const duration = getDurationMinutes(task);
      schedule.push({ task, startMinutes: cursor, endMinutes: cursor + duration });
      busyUntil = cursor + duration;
      cursor += duration + buffer;
    }
    // A fixed block already in progress keeps its real start time.
    const inProgress = slot.startMinutes < startCursor && cursor <= startCursor;
    const start = inProgress ? slot.startMinutes : Math.max(busyUntil, slot.startMinutes);
    // Keep the item's length when it has to move.
    const end = Math.max(start, Math.min(Math.max(dayEnd, slot.endMinutes), start + (slot.endMinutes - slot.startMinutes)));
    schedule.push({ task: slot.task, startMinutes: start, endMinutes: end });
    busyUntil = end;
    cursor = end + buffer;
  });

  while (flexible.length && cursor < dayEnd) {
    const task = takeNext(cursor, dayEnd);
    if (!task) {
      // Only snoozed tasks are left: wait for the earliest snooze to end.
      const wake = Math.min(...flexible.map(notBefore));
      if (!Number.isFinite(wake) || wake <= cursor) break;
      cursor = wake;
      continue;
    }
    const duration = getDurationMinutes(task);
    schedule.push({ task, startMinutes: cursor, endMinutes: cursor + duration });
    cursor += duration + buffer;
  }
  return schedule;
}

export function localDateString(date) {
  const pad = num => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildSchedule({ tasks, now = new Date(), config = {} } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...((typeof window !== "undefined" ? window.ConfigManager : null)?.getConfig?.() || {}), ...(config || {}) };
  const todayStr = localDateString(now);
  const activeUser = (typeof window !== "undefined" ? window.UserContext : null)?.getActiveUser?.();
  const baseTasks = tasks || TaskStore.getPendingTasks();
  const taskList = activeUser ? baseTasks.filter(t => t.user === activeUser) : baseTasks;
  const taskMap = new Map(taskList.map(t => [t.hash, t]));
  const filtered = taskList.filter(t => {
    if (t.completed) return false;
    if (isDependencyBlocked(t, taskMap)) return false;
    const plannerDateStr = typeof t.plannerDate === 'string' ? t.plannerDate.slice(0, 10) : null;
    // Respect rescheduled tasks: only schedule items for today or unscheduled ones.
    if (plannerDateStr && plannerDateStr !== todayStr) return false;
    return true;
  });
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return buildDailySchedule(filtered, cfg, todayStr, nowMinutes, now).map(slot => ({
    ...slot,
    scheduledStart: slot.startMinutes,
    scheduledEnd: slot.endMinutes,
  }));
}

export function getTodaySchedule(now = new Date(), overrides = {}) {
  const schedule = buildSchedule({ now, config: overrides.config });
  return schedule.map(slot => {
    // Slot times are minutes-of-day in *local* time.
    const startTime = new Date(now);
    startTime.setHours(0, 0, 0, 0);
    startTime.setMinutes(slot.scheduledStart);
    const endTime = new Date(now);
    endTime.setHours(0, 0, 0, 0);
    endTime.setMinutes(slot.scheduledEnd);
    return { ...slot, startTime, endTime };
  });
}

export function getCurrentTask(now = new Date(), overrides = {}) {
  const schedule = getTodaySchedule(now, overrides);
  return schedule.find(slot => now >= slot.startTime && now < slot.endTime) || null;
}

function getConfig(overrides = {}) {
  return { ...DEFAULT_CONFIG, ...((typeof window !== 'undefined' ? window.ConfigManager : null)?.getConfig?.() || {}), ...(overrides || {}) };
}

function taskDurationForBusy(task) {
  return getDurationMinutes(task);
}

// Everything that already holds time on `dateStr`: routines (with buffer),
// fixed calendar events and tasks pinned to a time.
export function getBusyBlocks(dateStr, overrides = {}) {
  const cfg = getConfig(overrides);
  const blocks = [];
  getRoutineBlocks(dateStr, cfg).forEach(slot => blocks.push({
    kind: 'routine', id: slot.task.routineId, name: slot.task.name,
    location: slot.task.location || '',
    start: slot.startMinutes, end: slot.endMinutes,
  }));
  if (cfg.includeCalendarInSchedule !== false) {
    loadCalendarBlocks(dateStr, cfg).forEach(slot => blocks.push({
      kind: 'event', id: slot.task.hash, name: slot.task.name,
      location: slot.task.location || '',
      start: slot.startMinutes, end: slot.endMinutes,
    }));
  }
  const tasks = Array.isArray(cfg.tasks) ? cfg.tasks : (TaskStore.getPendingTasks?.() || []);
  tasks
    .filter(t => !t.completed && typeof t.plannerDate === 'string' && t.plannerDate.startsWith(dateStr) && t.plannerDate.length >= 16)
    .forEach(t => {
      const start = parseTimeToMinutes(t.plannerDate.slice(11, 16), null);
      if (!Number.isFinite(start)) return;
      blocks.push({ kind: 'task', id: t.hash || t.id, name: t.name || t.text || 'Task', location: t.location || '', start, end: start + taskDurationForBusy(t) });
    });
  return blocks.sort((a, b) => a.start - b.start);
}

// Blocks that overlap [startMinutes, startMinutes + durationMinutes) on dateStr.
// `ignore` skips the item being edited (task hash or routine id).
export function findConflicts({ dateStr, startMinutes, durationMinutes, ignore = [], overrides = {} }) {
  const skip = new Set((Array.isArray(ignore) ? ignore : [ignore]).filter(Boolean));
  const end = startMinutes + Math.max(1, durationMinutes);
  return getBusyBlocks(dateStr, overrides)
    .filter(b => !skip.has(b.id))
    .filter(b => startMinutes < b.end && end > b.start);
}

// First start time >= fromMinutes where `durationMinutes` fits without conflicts.
export function findNextFreeSlot({ dateStr, fromMinutes, durationMinutes, ignore = [], overrides = {} }) {
  const cfg = getConfig(overrides);
  const dayEnd = parseTimeToMinutes(cfg.dayEnd, 24 * 60) || 24 * 60;
  let cursor = Math.ceil(fromMinutes / 5) * 5;
  const blocks = getBusyBlocks(dateStr, overrides)
    .filter(b => !(Array.isArray(ignore) ? ignore : [ignore]).includes(b.id));
  for (let guard = 0; guard < 500; guard += 1) {
    const clash = blocks.find(b => cursor < b.end && cursor + durationMinutes > b.start);
    if (!clash) return cursor + durationMinutes <= Math.max(dayEnd, 24 * 60) ? cursor : null;
    cursor = Math.ceil(clash.end / 5) * 5;
  }
  return null;
}

// Routines that share a weekday with `routine` and overlap its booked time.
export function findRoutineConflicts(routine, routines, bufferPercent = DEFAULT_CONFIG.routineBufferPercent) {
  const start = parseTimeToMinutes(routine.startTime, null);
  if (!Number.isFinite(start)) return [];
  const end = start + routineBookedMinutes(routine, bufferPercent);
  const days = (routine.weekDays || []).map(Number);
  return (routines || []).filter(other => {
    if (!other || other.id === routine.id) return false;
    if (!(other.weekDays || []).map(Number).some(d => days.includes(d))) return false;
    const oStart = parseTimeToMinutes(other.startTime, null);
    if (!Number.isFinite(oStart)) return false;
    const oEnd = oStart + routineBookedMinutes(other, bufferPercent);
    return start < oEnd && end > oStart;
  });
}

const UnifiedScheduler = {
  getTodaySchedule,
  getCurrentTask,
  buildSchedule,
  getRoutineBlocks,
  getBusyBlocks,
  findConflicts,
  findNextFreeSlot,
  findRoutineConflicts,
  routineBookedMinutes,
  localDateString,
};

if (typeof window !== 'undefined') {
  window.UnifiedScheduler = UnifiedScheduler;
  window.TaskScheduler = UnifiedScheduler;
  window.dispatchEvent(new Event('schedulerReady'));
}

export default UnifiedScheduler;
