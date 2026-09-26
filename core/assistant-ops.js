// assistant-ops.js — the changes an outside AI assistant may make to the user's data.
// One definition per change ("op"): its input schema (shown to the AI as an MCP tool)
// and what it does to the tasks. Used by BOTH sides so they never disagree:
//   - mcp/server.js       checks the op, previews it, and writes it to the Drive inbox file
//   - services/assistant-inbox.js (the app) applies it for real through TaskStore
// Pure: no DOM, no storage. Time checks come in through `ctx` (UnifiedScheduler functions).
import { createTask, updateTask, markTaskCompleted } from './task-model.js';

export const INBOX_FILENAME = 'adhd-tools-assistant-inbox.json';
export const APPLIED_KEY = 'adhd-assistant-applied'; // ledger of applied op ids (app side)
export const INBOX_KIND = 'assistant-inbox';
export const OP_MAX_AGE_DAYS = 30; // older ops are dropped, never applied
const MAX_STEPS = 20;

const START_RE = '^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}';
const DATE_RE = '^\\d{4}-\\d{2}-\\d{2}';

// Task fields an op may write, shared by add_task and update_task.
const TASK_INPUT = {
  name: { type: 'string', minLength: 1, maxLength: 200, description: 'What to do, short (e.g. "Call the dentist").' },
  minutes: { type: 'integer', minimum: 5, maximum: 720, description: 'How long it takes, in minutes.' },
  importance: { type: 'integer', minimum: 1, maximum: 10, description: '1 (not important) to 10 (very important).' },
  urgency: { type: 'integer', minimum: 1, maximum: 10, description: '1 (can wait) to 10 (very urgent). Leave out to derive it from the deadline.' },
  deadline: { type: ['string', 'null'], pattern: DATE_RE, description: 'Due date "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM". A start time is NOT a deadline. null = no deadline.' },
  start: { type: ['string', 'null'], pattern: START_RE, description: 'Fixed start "YYYY-MM-DDTHH:MM" (local time). Leave out to let the app place the task in a free slot. null = unfix.' },
  notes: { type: 'string', maxLength: 2000, description: 'Extra details.' },
  location: { type: 'string', maxLength: 200, description: 'Where it happens.' },
};
const ID = { type: 'string', minLength: 1, description: 'Task id (from list_tasks or get_schedule).' };

// ---- time helpers ---------------------------------------------------------------------------
const pad = n => String(n).padStart(2, '0');
export const clock = minutes => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
export const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const normStart = s => s.replace(' ', 'T').slice(0, 16);
const startParts = start => ({ dateStr: start.slice(0, 10), minutes: Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16)) });

function newId(prefix = 'a') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function findTask(tasks, id) {
  return tasks.find(t => t && (t.hash === id || t.id === id)) || null;
}

// Map op input fields to task fields.
function toTaskFields(input) {
  const out = {};
  if ('name' in input) { out.name = input.name.trim(); out.text = out.name; }
  if ('minutes' in input) out.durationMinutes = input.minutes;
  if ('importance' in input) out.importance = input.importance;
  if ('urgency' in input) out.urgency = input.urgency;
  if ('deadline' in input) out.deadline = input.deadline === null ? null : (input.deadline.length > 10 ? normStart(input.deadline) : input.deadline.slice(0, 10));
  if ('notes' in input) out.notes = input.notes;
  if ('location' in input) out.location = input.location;
  if ('start' in input) {
    out.plannerDate = input.start === null ? null : normStart(input.start);
    out.isFixed = input.start !== null;
  }
  return out;
}

// Check a fixed start against the day. Returns { start } (maybe moved) or { error }.
function placeStart(start, minutes, ignore, ctx) {
  const { dateStr, minutes: startMinutes } = startParts(start);
  if (!Number.isFinite(startMinutes) || startMinutes >= 24 * 60) return { error: `Invalid start time "${start}".` };
  const clash = ctx.findConflicts({ dateStr, startMinutes, durationMinutes: minutes, ignore });
  if (!clash.length) return { start };
  const next = ctx.findNextFreeSlot({ dateStr, fromMinutes: startMinutes, durationMinutes: minutes, ignore });
  const names = clash.map(b => `"${b.name}" ${clock(b.start)}–${clock(b.end)}`).join(', ');
  if (ctx.onConflict === 'move' && next !== null) {
    return { start: `${dateStr}T${clock(next)}`, note: `${start.slice(11)} was taken by ${names}; moved to ${clock(next)}.` };
  }
  const hint = next === null ? 'No free slot left that day.' : `Next free time for ${minutes} min: ${dateStr}T${clock(next)}.`;
  return { error: `That time is taken by ${names}. Nothing is ever booked on top of something else. ${hint}` };
}

// ---- the ops ------------------------------------------------------------------------------
// plan(input, op, ctx) → { effects, message } or { error }.
// Effects: { add: rawTask } | { update: id, changes } | { complete: id } | { delete: id }
export const OPS = {
  add_task: {
    description: 'Add a task. Without "start" the app places it in the next free slot by importance and urgency. With "start" it gets that fixed time (refused if the time is taken).',
    input: { type: 'object', properties: TASK_INPUT, required: ['name'] },
    assignIds: () => ({ task: newId('a') }),
    plan(input, op, ctx) {
      const fields = { deadline: null, ...toTaskFields(input) };
      const minutes = fields.durationMinutes || ctx.defaultMinutes || 25;
      let note = '';
      if (fields.plannerDate) {
        const placed = placeStart(fields.plannerDate, minutes, [], ctx);
        if (placed.error) return { error: placed.error };
        fields.plannerDate = placed.start;
        note = placed.note || '';
      }
      const id = op.ids.task;
      return {
        effects: [{ add: { ...fields, durationMinutes: minutes, hash: id, id, ...(ctx.user ? { user: ctx.user } : {}), source: 'assistant', originalTool: 'assistant' } }],
        message: `Added "${fields.name}"${fields.plannerDate ? ` at ${fields.plannerDate.replace('T', ' ')}` : ''}. ${note}`.trim(),
        taskId: id,
      };
    },
  },

  update_task: {
    description: 'Change a task: name, length, importance, urgency, deadline, fixed start, notes or location. Only the fields you send change.',
    input: { type: 'object', properties: { id: ID, ...TASK_INPUT }, required: ['id'] },
    plan(input, op, ctx) {
      const task = findTask(ctx.tasks, input.id);
      if (!task) return { error: `No task with id "${input.id}".` };
      const { id, ...rest } = input;
      const changes = toTaskFields(rest);
      if (!Object.keys(changes).length) return { error: 'Nothing to change.' };
      let note = '';
      const start = 'plannerDate' in changes ? changes.plannerDate : (task.isFixed ? task.plannerDate : null);
      if (start && start.length >= 16 && ('plannerDate' in changes || 'durationMinutes' in changes)) {
        const placed = placeStart(start, changes.durationMinutes || task.durationMinutes || 25, [task.hash, task.id], ctx);
        if (placed.error) return { error: placed.error };
        changes.plannerDate = placed.start;
        changes.isFixed = true;
        note = placed.note || '';
      }
      return { effects: [{ update: task.hash, changes }], message: `Updated "${changes.name || task.name}". ${note}`.trim(), taskId: task.hash };
    },
  },

  schedule_task: {
    description: 'Give a task a fixed start time. Refused if the time is taken (the answer says the next free time). Use find_free_slots first.',
    input: { type: 'object', properties: { id: ID, start: { ...TASK_INPUT.start, type: 'string' } }, required: ['id', 'start'] },
    plan(input, op, ctx) {
      return OPS.update_task.plan({ id: input.id, start: input.start }, op, ctx);
    },
  },

  complete_task: {
    description: 'Mark a task as done (only when the user says they finished it).',
    input: { type: 'object', properties: { id: ID }, required: ['id'] },
    plan(input, op, ctx) {
      const task = findTask(ctx.tasks, input.id);
      if (!task) return { error: `No task with id "${input.id}".` };
      if (task.completed) return { effects: [], message: `"${task.name}" was already done.`, taskId: task.hash };
      return { effects: [{ complete: task.hash }], message: `Marked "${task.name}" as done.`, taskId: task.hash };
    },
  },

  delete_task: {
    description: 'Delete a task for good (it stays deleted on every device). Ask the user first.',
    input: { type: 'object', properties: { id: ID }, required: ['id'] },
    plan(input, op, ctx) {
      const task = findTask(ctx.tasks, input.id);
      if (!task) return { error: `No task with id "${input.id}".` };
      return { effects: [{ delete: task.hash }], message: `Deleted "${task.name}".`, taskId: task.hash };
    },
  },

  break_down_task: {
    description: 'Split a big task into small steps (15–30 min each is best for ADHD). The steps become tasks in this order (each waits for the one before) and keep the deadline and importance; the big task is archived.',
    input: {
      type: 'object',
      properties: {
        id: ID,
        steps: {
          type: 'array', minItems: 2, maxItems: MAX_STEPS,
          items: {
            type: 'object',
            properties: { name: TASK_INPUT.name, minutes: TASK_INPUT.minutes },
            required: ['name', 'minutes'],
          },
          description: 'The steps, in order.',
        },
      },
      required: ['id', 'steps'],
    },
    assignIds: input => ({ steps: (input.steps || []).map(() => newId('s')) }),
    plan(input, op, ctx) {
      const parent = findTask(ctx.tasks, input.id);
      if (!parent) return { error: `No task with id "${input.id}".` };
      if (parent.completed) return { error: `"${parent.name}" is already done.` };
      const effects = input.steps.map((step, i) => {
        const id = op.ids.steps[i];
        return {
          add: {
            hash: id, id, name: step.name.trim(), text: step.name.trim(), durationMinutes: step.minutes,
            importance: parent.importance, urgency: parent.urgency, deadline: parent.deadline ?? null,
            dependency: i === 0 ? (parent.dependency || null) : op.ids.steps[i - 1],
            parentId: parent.hash, user: parent.user,
            notes: `Step ${i + 1}/${input.steps.length} of "${parent.name}"`,
            source: 'assistant', originalTool: 'assistant',
          },
        };
      });
      effects.push({ update: parent.hash, changes: { isArchived: true, archivedReason: 'split' } });
      return { effects, message: `Split "${parent.name}" into ${input.steps.length} steps.`, taskId: parent.hash, stepIds: op.ids.steps };
    },
  },
};

// ---- validation ----------------------------------------------------------------------------
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

// Small JSON-schema check (the subset used above). Returns a list of problems.
export function validate(value, schema, path = 'input') {
  const types = [].concat(schema.type || []);
  const t = typeOf(value);
  if (types.length && !types.includes(t) && !(t === 'integer' && types.includes('number'))) {
    return [`${path} must be ${types.join(' or ')}`];
  }
  const errors = [];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(', ')}`);
  if (t === 'string') {
    if (schema.minLength && value.trim().length < schema.minLength) errors.push(`${path} is empty`);
    if (schema.maxLength && value.length > schema.maxLength) errors.push(`${path} is too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} has the wrong format`);
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be ≥ ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be ≤ ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} items`);
    if (schema.maxItems && value.length > schema.maxItems) errors.push(`${path} has more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => errors.push(...validate(v, schema.items, `${path}[${i}]`)));
  }
  if (t === 'object' && schema.properties) {
    (schema.required || []).forEach(k => { if (!(k in value)) errors.push(`${path}.${k} is required`); });
    Object.keys(value).forEach(k => {
      if (!(k in schema.properties)) errors.push(`${path}.${k} is not a known field`);
      else errors.push(...validate(value[k], schema.properties[k], `${path}.${k}`));
    });
  }
  return errors;
}

// Build a new op (MCP side): check the input and give new tasks their ids now,
// so later ops can point to them before the app has applied anything.
export function makeOp(tool, input, now = new Date()) {
  const def = OPS[tool];
  if (!def) return { error: `Unknown change "${tool}".` };
  const problems = validate(input ?? {}, def.input);
  if (problems.length) return { error: problems.join('; ') };
  return { op: { id: newId('op'), tool, createdAt: now.toISOString(), input, ids: def.assignIds?.(input) || {} } };
}

// Plan one op against the current tasks. ctx: { tasks, user (active profile), findConflicts, findNextFreeSlot,
// onConflict: 'refuse' (MCP) | 'move' (app: the day may have changed since), defaultMinutes }.
export function planOp(op, ctx) {
  const def = OPS[op?.tool];
  if (!def) return { error: `Unknown change "${op?.tool}".` };
  const problems = validate(op.input ?? {}, def.input);
  if (problems.length) return { error: problems.join('; ') };
  return def.plan(op.input, { ...op, ids: op.ids || {} }, ctx);
}

// Apply effects to plain arrays (MCP preview and tests). The app applies the same
// effects through TaskStore instead (services/assistant-inbox.js).
export function applyEffects({ tasks, tombstones = [] }, effects, now = new Date()) {
  let list = [...tasks];
  let dead = [...tombstones];
  effects.forEach(e => {
    if (e.add) list.push(createTask(e.add, e.add));
    else if (e.update) list = list.map(t => (t.hash === e.update ? updateTask(t, e.changes) : t));
    else if (e.complete) list = list.map(t => (t.hash === e.complete ? markTaskCompleted(t, now.toISOString()) : t));
    else if (e.delete) {
      list = list.filter(t => t.hash !== e.delete && t.id !== e.delete);
      dead = [...dead.filter(x => x.id !== e.delete), { id: e.delete, deletedAt: now.toISOString() }];
    }
  });
  return { tasks: list, tombstones: dead };
}

// Ops still waiting: not applied yet by the app and not too old.
export function pendingOps(inbox, appliedLedger = [], now = new Date()) {
  const applied = new Set((Array.isArray(appliedLedger) ? appliedLedger : []).map(x => x?.id));
  const minTime = now.getTime() - OP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return (inbox?.ops || []).filter(op => op && op.id && !applied.has(op.id) && Date.parse(op.createdAt) >= minTime);
}

export function emptyInbox() {
  return { kind: INBOX_KIND, version: 1, ops: [] };
}
