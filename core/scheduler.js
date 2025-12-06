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

function toFixedTask(task, dayStart, dayEnd) {
  const startMinutes = parseTimeToMinutes(task.startTime ?? task.plannerDate?.slice(11, 16), null);
  if (!Number.isFinite(startMinutes)) return null;
  const duration = getDurationMinutes(task);
  const boundedStart = Math.max(dayStart, Math.min(startMinutes, dayEnd));
  const boundedEnd = Math.min(dayEnd, boundedStart + duration);
  return {
    ...task,
    startMinutes: boundedStart,
    endMinutes: boundedEnd,
  };
}

function scoreTask(task) {
  const importance = Number(task.importance ?? task.priority ?? 5);
  const urgency = Number(task.urgency ?? 5);
  const safeImportance = Number.isFinite(importance) ? importance : 5;
  const safeUrgency = Number.isFinite(urgency) ? urgency : 5;
  return safeImportance * 2 + safeUrgency;
}

function scheduleFlexibleTasks(flexibleTasks, schedule, startMinutes, endMinutes) {
  let cursor = startMinutes;
  const remaining = [...flexibleTasks];
  while (remaining.length && cursor < endMinutes) {
    const task = remaining.shift();
    const duration = getDurationMinutes(task);
    if (cursor + duration > endMinutes) break;
    schedule.push({ task, scheduledStart: cursor, scheduledEnd: cursor + duration });
    cursor += duration;
  }
  return { remaining, cursor };
}

export function buildSchedule({ tasks = [], now = new Date(), config = {} }) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...(config || {}) };
  const dayStart = parseTimeToMinutes(mergedConfig.dayStart, 0);
  const dayEnd = parseTimeToMinutes(mergedConfig.dayEnd, 24 * 60);

  const fixedTasks = [];
  const flexibleTasks = [];

  tasks.forEach((task) => {
    const fixed = toFixedTask(task, dayStart, dayEnd);
    if (fixed) {
      fixedTasks.push(fixed);
      return;
    }
    flexibleTasks.push(task);
  });

  fixedTasks.sort((a, b) => a.startMinutes - b.startMinutes);
  flexibleTasks.sort((a, b) => scoreTask(b) - scoreTask(a));

  const schedule = [];
  let cursor = dayStart;

  fixedTasks.forEach((task) => {
    const gapEnd = task.startMinutes;
    if (cursor < gapEnd && flexibleTasks.length) {
      const res = scheduleFlexibleTasks(flexibleTasks, schedule, cursor, gapEnd);
      cursor = res.cursor;
      flexibleTasks.length = 0;
      flexibleTasks.push(...res.remaining);
    }

    const start = Math.max(cursor, task.startMinutes);
    const end = Math.min(dayEnd, Math.max(task.endMinutes, start));
    schedule.push({ task, scheduledStart: start, scheduledEnd: end });
    cursor = end;
  });

  if (cursor < dayEnd && flexibleTasks.length) {
    scheduleFlexibleTasks(flexibleTasks, schedule, cursor, dayEnd);
  }

  return schedule;
}

if (typeof window !== 'undefined') {
  window.UnifiedScheduler = { buildSchedule };
}

export default { buildSchedule };
