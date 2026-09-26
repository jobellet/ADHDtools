// core/assistant-ops.js: the changes an AI assistant may make (shared by mcp/ and the app).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OPS, makeOp, planOp, applyEffects, pendingOps, validate } from '../core/assistant-ops.js';

// A day with one busy block 15:00–16:00 on 2026-09-26.
function ctx(tasks, onConflict = 'refuse') {
  const busy = { name: 'Lab meeting', start: 15 * 60, end: 16 * 60, id: 'e1' };
  return {
    tasks,
    onConflict,
    findConflicts: ({ startMinutes, durationMinutes, ignore = [] }) =>
      (startMinutes < busy.end && startMinutes + durationMinutes > busy.start && !ignore.includes(busy.id) ? [busy] : []),
    findNextFreeSlot: ({ fromMinutes, durationMinutes }) =>
      (fromMinutes < busy.end && fromMinutes + durationMinutes > busy.start ? busy.end : fromMinutes),
  };
}
const now = new Date(2026, 8, 26, 10, 0);
const run = (tool, input, tasks = [], mode) => {
  const { op, error } = makeOp(tool, input, now);
  if (error) return { error };
  return { op, ...planOp(op, ctx(tasks, mode)) };
};

describe('assistant ops', () => {
  test('add_task without a time lets the app place it, with no deadline', () => {
    const r = run('add_task', { name: 'Buy milk', minutes: 15 });
    const [{ add }] = r.effects;
    assert.equal(add.name, 'Buy milk');
    assert.equal(add.deadline, null);
    assert.equal(add.plannerDate, undefined);
    assert.equal(add.hash, r.op.ids.task, 'the id is chosen when the op is made');
  });

  test('a taken time is refused on the MCP side and moved on the app side', () => {
    const refused = run('add_task', { name: 'Call', minutes: 15, start: '2026-09-26T15:10' });
    assert.match(refused.error, /Lab meeting/);
    assert.match(refused.error, /16:00/);
    const moved = run('add_task', { name: 'Call', minutes: 15, start: '2026-09-26T15:10' }, [], 'move');
    assert.equal(moved.effects[0].add.plannerDate, '2026-09-26T16:00');
    assert.equal(moved.effects[0].add.isFixed, true);
  });

  test('bad input is refused with a clear reason', () => {
    assert.match(run('add_task', { minutes: 15 }).error, /name is required/);
    assert.match(run('add_task', { name: 'x', minutes: 2 }).error, /≥ 5/);
    assert.match(run('add_task', { name: 'x', colour: 'red' }).error, /not a known field/);
    assert.match(run('add_task', { name: 'x', start: 'tomorrow' }).error, /wrong format/);
    assert.match(makeOp('drop_database', {}).error, /Unknown/);
  });

  test('break_down_task makes ordered steps that keep the deadline and archives the big task', () => {
    const big = { hash: 'big', name: 'Tax report', durationMinutes: 120, importance: 8, urgency: 6, deadline: '2026-09-30', user: 'main' };
    const r = run('break_down_task', { id: 'big', steps: [{ name: 'Collect receipts', minutes: 20 }, { name: 'Fill form', minutes: 30 }] }, [big]);
    const [a, b, archive] = r.effects;
    assert.equal(a.add.deadline, '2026-09-30');
    assert.equal(a.add.importance, 8);
    assert.equal(b.add.dependency, a.add.hash, 'step 2 waits for step 1');
    assert.deepEqual(archive, { update: 'big', changes: { isArchived: true, archivedReason: 'split' } });
    const after = applyEffects({ tasks: [big] }, r.effects, now);
    assert.equal(after.tasks.length, 3);
    assert.equal(after.tasks.find(t => t.hash === 'big').isArchived, true);
  });

  test('update, complete and delete find the task; delete writes a tombstone', () => {
    const task = { hash: 't1', name: 'Old', durationMinutes: 30 };
    assert.match(run('update_task', { id: 'nope', name: 'x' }, [task]).error, /No task/);
    const up = run('update_task', { id: 't1', name: 'New', deadline: null }, [task]);
    let state = applyEffects({ tasks: [task] }, up.effects, now);
    assert.equal(state.tasks[0].name, 'New');
    assert.equal(state.tasks[0].deadline, null);
    state = applyEffects(state, run('complete_task', { id: 't1' }, state.tasks).effects, now);
    assert.equal(state.tasks[0].completed, true);
    state = applyEffects(state, run('delete_task', { id: 't1' }, state.tasks).effects, now);
    assert.deepEqual(state.tasks, []);
    assert.equal(state.tombstones[0].id, 't1');
  });

  test('schedule_task refuses a busy time and accepts a free one', () => {
    const task = { hash: 't1', name: 'Read', durationMinutes: 30 };
    assert.match(run('schedule_task', { id: 't1', start: '2026-09-26T15:30' }, [task]).error, /taken/);
    const ok = run('schedule_task', { id: 't1', start: '2026-09-26T16:00' }, [task]);
    assert.deepEqual(ok.effects[0].changes, { plannerDate: '2026-09-26T16:00', isFixed: true });
  });

  test('pendingOps skips applied and very old ops', () => {
    const inbox = { ops: [
      { id: 'a', createdAt: now.toISOString() },
      { id: 'b', createdAt: now.toISOString() },
      { id: 'old', createdAt: '2020-01-01T00:00:00Z' },
    ] };
    assert.deepEqual(pendingOps(inbox, [{ id: 'a' }], now).map(o => o.id), ['b']);
  });

  test('every op has a description, an object schema and a plan', () => {
    for (const [name, def] of Object.entries(OPS)) {
      assert.ok(def.description.length > 20, name);
      assert.equal(def.input.type, 'object', name);
      assert.equal(typeof def.plan, 'function', name);
      assert.deepEqual(validate({}, { type: 'object', properties: def.input.properties }), [], name);
    }
  });
});
