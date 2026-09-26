// tools.js — the MCP tools: read the app's data from the Drive backup, and queue changes
// in the inbox file. Reuses the app's own code (core/) so the rules stay the same:
// same scheduler, same "never double-book" check, same task model.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { BACKUP_FILENAME } from './store.js';
import { STORAGE_READ } from './coverage.js';

// The scheduler reads calendar events from localStorage: give it an in-memory one,
// filled from the backup before each call. Set it before core/ is imported.
const memory = new Map();
globalThis.localStorage = {
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: k => memory.delete(k),
  clear: () => memory.clear(),
  key: i => [...memory.keys()][i] ?? null,
  get length() { return memory.size; },
};
const scheduler = await import('../core/scheduler.js');
const { isPassiveOrAllDay } = await import('../core/task-model.js');
const ops = await import('../core/assistant-ops.js');
const { OPS, INBOX_FILENAME, APPLIED_KEY, makeOp, planOp, applyEffects, pendingOps, emptyInbox, clock, localDate } = ops;

// The app's default settings (shell/config.js), so an unchanged setup plans the same day.
function appDefaults() {
  const sandbox = { window: {}, localStorage: { getItem: () => null, setItem() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../shell/config.js', import.meta.url), 'utf8'), sandbox);
  return { ...(sandbox.window.ConfigManager?.DEFAULT_CONFIG || {}) };
}
const DEFAULTS = appDefaults();

const toMinutes = hhmm => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const asList = v => (Array.isArray(v) ? v : []);

// ---- state: backup + changes still waiting in the inbox ------------------------------------
export async function loadState(store, now = new Date()) {
  const backup = (await store.readJson(BACKUP_FILENAME))?.data || null;
  const inbox = (await store.readJson(INBOX_FILENAME))?.data || emptyInbox();
  const data = {};
  STORAGE_READ.forEach(k => { if (backup && k in backup) data[k] = backup[k]; });

  const config = { ...DEFAULTS, ...(data['adhd-tools-config'] || {}) };
  const activeUser = typeof data['adhd-active-user'] === 'string' ? data['adhd-active-user'] : null;
  const dead = new Set(asList(data['adhd-deleted-tasks']).map(x => x?.id));
  let tasks = asList(data['adhd-unified-tasks']).filter(t => t && !dead.has(t.hash) && !dead.has(t.id));
  let tombstones = asList(data['adhd-deleted-tasks']);
  const routines = asList(data['adhd-tool-routines']);
  const routineRuns = data['adhd-routine-runs'] || {};

  memory.clear();
  memory.set('adhd-calendar-events', JSON.stringify(asList(data['adhd-calendar-events'])));

  const state = { backup, inbox, config, activeUser, routines, routineRuns, now, tasks, tombstones, pending: [] };
  // Show the AI its own changes that the app has not applied yet (as the app would apply them).
  const waiting = pendingOps(inbox, data[APPLIED_KEY], now);
  waiting.forEach(op => {
    const plan = planOp(op, context(state, 'move'));
    if (plan.error) { state.pending.push({ op, error: plan.error }); return; }
    ({ tasks: state.tasks, tombstones: state.tombstones } = applyEffects(state, plan.effects, now));
    state.pending.push({ op, message: plan.message });
  });
  return state;
}

// Like the app: archived tasks are hidden; the plan shows the active profile, but busy
// times count every profile (TaskStore.getPendingTasks is not filtered by user).
const active = state => state.tasks.filter(t => !t.isArchived);
const mine = state => active(state).filter(t => !state.activeUser || !t.user || t.user === state.activeUser);
const overrides = state => ({ ...state.config, tasks: active(state).filter(t => !t.completed), routines: state.routines, routineRuns: state.routineRuns });

function context(state, onConflict) {
  const o = overrides(state);
  return {
    tasks: active(state),
    user: state.activeUser,
    onConflict,
    defaultMinutes: Number(state.config.defaultTaskMinutes) || 25,
    findConflicts: args => scheduler.findConflicts({ ...args, overrides: o }),
    findNextFreeSlot: args => scheduler.findNextFreeSlot({ ...args, overrides: o }),
  };
}

// ---- views ---------------------------------------------------------------------------------
function taskView(t, now) {
  const overdue = !t.completed && t.deadline && !isPassiveOrAllDay(t) && new Date(t.deadline) < now;
  const view = {
    id: t.hash || t.id,
    name: t.name || t.text,
    minutes: t.durationMinutes,
    importance: t.importance,
    urgency: t.urgency,
    deadline: t.deadline || null,
    start: t.isFixed && typeof t.plannerDate === 'string' && t.plannerDate.length >= 16 ? t.plannerDate.slice(0, 16) : null,
    status: t.completed ? 'done' : (overdue ? 'overdue' : 'pending'),
  };
  if (t.notes) view.notes = t.notes;
  if (t.location) view.location = t.location;
  if (t.dependency) view.waitsFor = t.dependency;
  if (t.parentId) view.stepOf = t.parentId;
  if (isPassiveOrAllDay(t)) view.calendarCopy = true;
  return view;
}

function kindOf(task) {
  if (task.source === 'routine') return 'routine';
  if (task.source === 'calendar') return 'event';
  return task.isFixed && !task.autoPinned ? 'fixed' : 'auto-placed';
}

function schedule(state, dateStr) {
  const today = localDate(state.now);
  if (dateStr === today) {
    const pending = mine(state).filter(t => !t.completed);
    const slots = scheduler.buildSchedule({ tasks: pending, now: state.now, config: overrides(state) });
    const placed = new Set(slots.map(s => s.task.hash));
    const open = new Set(pending.map(t => t.hash));
    const notPlaced = pending
      .filter(t => !placed.has(t.hash) && !isPassiveOrAllDay(t) && !(typeof t.plannerDate === 'string' && t.plannerDate.slice(0, 10) !== today))
      .map(t => ({ id: t.hash, name: t.name, minutes: t.durationMinutes,
        why: t.dependency && open.has(t.dependency) ? `waits for ${t.dependency}` : 'no free time left today' }));
    return {
      date: dateStr,
      items: slots.map(s => ({ start: clock(s.scheduledStart), end: clock(s.scheduledEnd), name: s.task.name || s.task.text, kind: kindOf(s.task), id: s.task.hash || s.task.routineId || null })),
      notPlacedToday: notPlaced,
    };
  }
  const blocks = scheduler.getBusyBlocks(dateStr, overrides(state));
  return {
    date: dateStr,
    items: blocks.map(b => ({ start: clock(b.start), end: clock(b.end), name: b.name, kind: b.kind === 'task' ? 'fixed' : b.kind, id: b.id })),
    note: 'Only fixed items are shown for other days; flexible tasks are placed on the day itself.',
  };
}

// Next calendar events and fixed tasks in the coming days (routines left out: they repeat).
function upcoming(state, days = 7, max = 10) {
  const out = [];
  const nowMin = state.now.getHours() * 60 + state.now.getMinutes();
  for (let d = 0; d < days && out.length < max; d += 1) {
    const day = new Date(state.now.getFullYear(), state.now.getMonth(), state.now.getDate() + d);
    const dateStr = localDate(day);
    scheduler.getBusyBlocks(dateStr, overrides(state))
      .filter(b => b.kind !== 'routine' && (d > 0 || b.end > nowMin))
      .forEach(b => out.push({ start: `${dateStr}T${clock(b.start)}`, end: clock(b.end), name: b.name, kind: b.kind === 'task' ? 'fixed task' : 'event', id: b.id }));
  }
  return out.slice(0, max);
}

function freeSlots(state, dateStr, minutes) {
  const dayStart = toMinutes(state.config.dayStart) ?? 0;
  const dayEnd = toMinutes(state.config.dayEnd) ?? 24 * 60;
  const isToday = dateStr === localDate(state.now);
  const nowMin = state.now.getHours() * 60 + state.now.getMinutes();
  let cursor = Math.max(dayStart, isToday ? Math.ceil(nowMin / 5) * 5 : dayStart);
  const out = [];
  scheduler.getBusyBlocks(dateStr, overrides(state)).forEach(b => {
    if (b.start - cursor >= minutes) out.push([cursor, Math.min(b.start, dayEnd)]);
    cursor = Math.max(cursor, b.end);
  });
  if (dayEnd - cursor >= minutes) out.push([cursor, dayEnd]);
  return out.filter(([a, b]) => b - a >= minutes).map(([a, b]) => ({ start: `${dateStr}T${clock(a)}`, end: clock(b), minutes: b - a }));
}

// ---- tools ---------------------------------------------------------------------------------
const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Day "YYYY-MM-DD" (default: today).' };

export const READ_TOOLS = {
  get_overview: {
    description: 'Start here. Today\'s date and time for the user, the current and next item, the next calendar events and fixed tasks of the coming 7 days, counts, day settings, and your changes the app has not applied yet.',
    input: { type: 'object', properties: {} },
    run(state) {
      const today = localDate(state.now);
      const s = schedule(state, today);
      const nowClock = clock(state.now.getHours() * 60 + state.now.getMinutes());
      const tasks = mine(state).map(t => taskView(t, state.now));
      return {
        now: `${today}T${nowClock}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day: { start: state.config.dayStart, end: state.config.dayEnd, pauseBetweenTasksMinutes: state.config.bufferDurationMinutes, routineBufferPercent: state.config.routineBufferPercent },
        activeUser: state.activeUser || 'main',
        current: s.items.find(i => i.start <= nowClock && nowClock < i.end) || null,
        next: s.items.find(i => i.start > nowClock) || null,
        upcoming: upcoming(state),
        counts: {
          pending: tasks.filter(t => t.status !== 'done' && !t.calendarCopy).length,
          overdue: tasks.filter(t => t.status === 'overdue').length,
          scheduledToday: s.items.length,
          notPlacedToday: s.notPlacedToday.length,
        },
        lastAppBackup: state.backup?.metadata?.exportedAt || null,
        waitingForApp: state.pending.map(p => ({ change: p.op.tool, at: p.op.createdAt, result: p.error ? `will fail: ${p.error}` : p.message })),
        appliedByApp: asList(state.backup?.[APPLIED_KEY]).slice(-10).map(x => ({ at: x.at, ok: x.ok, result: x.message })),
        howChangesArrive: 'Your changes go to an inbox file on Google Drive. The app applies them when it is open (it checks every 2 minutes and when the user comes back to it), then backs up again.',
      };
    },
  },
  list_tasks: {
    description: 'List tasks. filter: pending (default), overdue, done, all. Optional search text.',
    input: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['pending', 'overdue', 'done', 'all'] },
        search: { type: 'string', maxLength: 100 },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
    },
    run(state, { filter = 'pending', search = '', limit = 50 } = {}) {
      const q = search.toLowerCase();
      const list = mine(state)
        .filter(t => !t.isArchived)
        .map(t => taskView(t, state.now))
        .filter(t => filter === 'all' || (filter === 'pending' ? t.status !== 'done' : t.status === filter))
        .filter(t => !q || String(t.name).toLowerCase().includes(q) || String(t.notes || '').toLowerCase().includes(q));
      return { count: list.length, tasks: list.slice(0, limit) };
    },
  },
  get_schedule: {
    description: 'The plan of a day: routines (with their buffer), calendar events, fixed tasks and, for today, the tasks the app places automatically.',
    input: { type: 'object', properties: { date: DATE } },
    run(state, { date } = {}) { return schedule(state, date || localDate(state.now)); },
  },
  find_free_slots: {
    description: 'Free time windows of a day that can hold `minutes` (auto-placed tasks move out of the way, so they do not count as busy).',
    input: { type: 'object', properties: { date: DATE, minutes: { type: 'integer', minimum: 5, maximum: 720 } } },
    run(state, { date, minutes = 30 } = {}) {
      const day = date || localDate(state.now);
      return { date: day, minutes, free: freeSlots(state, day, minutes) };
    },
  },
  list_routines: {
    description: 'The user\'s routines: steps, start time, weekdays and the time each one books (steps + buffer). Routines are edited in the app.',
    input: { type: 'object', properties: {} },
    run(state) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return {
        routines: state.routines.map(r => ({
          id: r.id, name: r.name, start: r.startTime || null,
          days: (r.weekDays || []).map(d => days[Number(d)]),
          steps: (r.tasks || []).map(s => ({ name: s.name, minutes: Number(s.duration) || 0 })),
          bookedMinutes: scheduler.routineBookedMinutes(r, state.config.routineBufferPercent),
        })),
      };
    },
  },
};

export function listTools() {
  const read = Object.entries(READ_TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.input, annotations: { readOnlyHint: true } }));
  const write = Object.entries(OPS).map(([name, t]) => ({
    name,
    description: `${t.description} The change reaches the app at its next sync.`,
    inputSchema: t.input,
    annotations: { readOnlyHint: false, destructiveHint: name === 'delete_task' },
  }));
  return [...read, ...write];
}

// Writes go one at a time (read inbox → add op → write inbox).
let queue = Promise.resolve();

export async function callTool(store, name, args = {}, now = new Date()) {
  if (READ_TOOLS[name]) {
    const problems = ops.validate(args, READ_TOOLS[name].input);
    if (problems.length) return { error: problems.join('; ') };
    return { result: READ_TOOLS[name].run(await loadState(store, now), args) };
  }
  if (!OPS[name]) return { error: `Unknown tool "${name}".` };
  const job = queue.then(async () => {
    const built = makeOp(name, args, now);
    if (built.error) return { error: built.error };
    const state = await loadState(store, now);
    const plan = planOp(built.op, context(state, 'refuse'));
    if (plan.error) return { error: plan.error };
    const applied = state.backup?.[APPLIED_KEY];
    const inbox = { ...emptyInbox(), ops: [...pendingOps(state.inbox, applied, now), built.op] };
    await store.writeJson(INBOX_FILENAME, inbox);
    const { message, effects, ...ids } = plan;
    return { result: { ok: true, message, ...ids, changeId: built.op.id, note: 'Queued. The app applies it at its next sync.' } };
  });
  queue = job.catch(() => {});
  return job;
}
