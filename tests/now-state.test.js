import { test, describe } from 'node:test';
import assert from 'node:assert';

global.window = global.window || {};
await import('../core/now-state.js');

const { computeNowState, alarmPlan, defaultToolFor, formatDuration } = global.window.NowState;

function slot(name, start, end) {
  return { task: { name }, startTime: new Date(2024, 0, 8, ...start), endTime: new Date(2024, 0, 8, ...end) };
}

describe('Now state', () => {
  const schedule = [
    slot('Morning routine', [7, 0], [7, 33]),
    slot('Emails', [7, 40], [8, 10]),
    slot('Meeting', [9, 0], [10, 0]),
  ];

  test('doing: shows the running item with its time left', () => {
    const state = computeNowState({ schedule, now: new Date(2024, 0, 8, 7, 10) });
    assert.strictEqual(state.mode, 'doing');
    assert.strictEqual(state.current.task.name, 'Morning routine');
    assert.strictEqual(state.secondsLeft, 23 * 60);
    assert.strictEqual(state.totalSeconds, 33 * 60);
    assert.strictEqual(state.next.task.name, 'Emails');
    assert.strictEqual(defaultToolFor(state), 'home');
  });

  test('break: next item starts soon', () => {
    const state = computeNowState({ schedule, now: new Date(2024, 0, 8, 8, 50), breakWindowMinutes: 15 });
    assert.strictEqual(state.mode, 'break');
    assert.strictEqual(state.current, null);
    assert.strictEqual(state.next.task.name, 'Meeting');
    assert.strictEqual(state.secondsUntilNext, 10 * 60);
    assert.strictEqual(defaultToolFor(state), 'home');
  });

  test('free: nothing now or soon -> day planner is the default', () => {
    const gap = computeNowState({ schedule, now: new Date(2024, 0, 8, 8, 20), breakWindowMinutes: 15 });
    assert.strictEqual(gap.mode, 'free');
    assert.strictEqual(defaultToolFor(gap), 'planner');

    const empty = computeNowState({ schedule: [], now: new Date(2024, 0, 8, 12, 0) });
    assert.strictEqual(empty.mode, 'free');
    assert.strictEqual(empty.next, null);
    assert.strictEqual(defaultToolFor(null), 'planner');
  });

  test('upcoming lists what follows the current item', () => {
    const state = computeNowState({ schedule, now: new Date(2024, 0, 8, 7, 0) });
    assert.deepStrictEqual(state.upcoming.map(s => s.task.name), ['Emails', 'Meeting']);
  });

  test('formats durations', () => {
    assert.strictEqual(formatDuration(65), '1:05');
    assert.strictEqual(formatDuration(3725), '1:02:05');
    assert.strictEqual(formatDuration(-3), '0:00');
  });

  test('alarm plan: rings when an item starts, and when it ends with nothing right after', () => {
    const back = [
      slot('Morning routine', [7, 0], [7, 30]),
      slot('Emails', [7, 30], [8, 0]),
      slot('Meeting', [9, 0], [10, 0]),
    ];
    const plan = alarmPlan({ slots: back, now: new Date(2024, 0, 8, 7, 10) });
    const at = (h, m) => new Date(2024, 0, 8, h, m).getTime();
    assert.deepStrictEqual(plan.map(a => [a.kind, a.slot.task.name, a.at]), [
      ['start', 'Emails', at(7, 30)],
      ['end', 'Emails', at(8, 0)],
      ['start', 'Meeting', at(9, 0)],
      ['end', 'Meeting', at(10, 0)],
    ]);
    assert.ok(plan.every(a => a.id.includes(String(a.at))), 'ids change when the time changes');
  });

  test('alarm plan: nothing in the past or beyond the horizon', () => {
    const plan = alarmPlan({ slots: schedule, now: new Date(2024, 0, 8, 9, 30), horizonHours: 0.25 });
    assert.deepStrictEqual(plan, []);
    assert.deepStrictEqual(alarmPlan({ slots: [{ task: {}, startTime: 'x', endTime: 'y' }] }), []);
  });
});
