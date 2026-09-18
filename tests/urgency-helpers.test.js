import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock localStorage
let store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; }
};

import UrgencyHelpers from '../core/urgency-helpers.js';

describe('Urgency Helpers', () => {
  test('increments and gets skip count', () => {
    store = {}; // reset
    const hash = 'task-123';
    
    assert.strictEqual(UrgencyHelpers.getSkipCount(hash), 0);
    assert.strictEqual(UrgencyHelpers.incrementSkipCount(hash), 1);
    assert.strictEqual(UrgencyHelpers.getSkipCount(hash), 1);
    assert.strictEqual(UrgencyHelpers.incrementSkipCount(hash), 2);
    assert.strictEqual(UrgencyHelpers.getSkipCount(hash), 2);
  });

  test('computes smoothed urgency for task without deadline or skips', () => {
    store = {};
    const urgency = UrgencyHelpers.computeSmoothedUrgency({
      hash: 'task-123',
      urgency: 5
    });
    
    assert.strictEqual(urgency, 5);
  });

  test('computes smoothed urgency for task far in the future', () => {
    store = {};
    const now = new Date();
    const farFuture = new Date(now);
    farFuture.setDate(now.getDate() + 10); // 10 days out
    
    const task = {
      hash: 'task-123',
      deadline: farFuture.toISOString(),
      urgency: 5
    };
    
    const urgency = UrgencyHelpers.computeSmoothedUrgency(task);
    // Because it's > 48 hours away, it applies `5 + (urgency - 5) * 0.6`
    // Since base urgency is 5 (from task.urgency or computeUrgencyFromDeadline),
    // delta = 5 - 5 = 0. So it remains 5. Let's make urgency higher explicitly.
    const task2 = { ...task, urgency: 10 };
    const urgency2 = UrgencyHelpers.computeSmoothedUrgency(task2);
    // Delta = 5. 5 * 0.6 = 3. 5 + 3 = 8.
    assert.strictEqual(urgency2, 8);
  });

  test('increases urgency based on skips', () => {
    store = {};
    const task = { hash: 'skip-task', urgency: 5 };
    
    UrgencyHelpers.incrementSkipCount(task.hash); // skips = 1
    const u1 = UrgencyHelpers.computeSmoothedUrgency(task);
    // Math.max(1, Math.round(1 * 0.75)) = 1
    // 5 + 1 = 6
    assert.strictEqual(u1, 6);
    
    UrgencyHelpers.incrementSkipCount(task.hash); // skips = 2
    UrgencyHelpers.incrementSkipCount(task.hash); // skips = 3
    
    const u3 = UrgencyHelpers.computeSmoothedUrgency(task);
    // Math.max(1, Math.round(3 * 0.75)) = 2
    // 5 + 2 = 7
    assert.strictEqual(u3, 7);
  });

  test('caps urgency at 10', () => {
    store = {};
    const task = { hash: 'max-task', urgency: 9 };
    
    // Simulate many skips
    for (let i = 0; i < 10; i++) {
      UrgencyHelpers.incrementSkipCount(task.hash);
    }
    
    const urgency = UrgencyHelpers.computeSmoothedUrgency(task);
    assert.strictEqual(urgency, 10);
  });
  test('resolveRelativeTimestamp resolves basic exact values', () => {
    // Tomorrow and tonight
    // Since these return toISOString(), they return UTC string, so local time is shifted.
    // e.g. T20:00 EST is T01:00 UTC. So we check that they return properly formatted strings, but not the specific hour since it depends on the testing timezone.
    const tomorrowStr = UrgencyHelpers.resolveRelativeTimestamp('tomorrow');
    const tonightStr = UrgencyHelpers.resolveRelativeTimestamp('tonight');

    assert.ok(tomorrowStr.includes('Z'));
    assert.ok(tonightStr.includes('Z'));

    // +Xm and +Xh
    const now = new Date();

    const plus15m = UrgencyHelpers.resolveRelativeTimestamp('+15m');
    const expected15m = new Date(now);
    expected15m.setMinutes(expected15m.getMinutes() + 15);
    // Might occasionally fail around minute boundaries, but usually fine for simple assert check.
    assert.ok(plus15m.startsWith(expected15m.toISOString().slice(0, 15)));

    const plus2h = UrgencyHelpers.resolveRelativeTimestamp('+2h');
    const expected2h = new Date(now);
    expected2h.setHours(expected2h.getHours() + 2);
    assert.ok(plus2h.startsWith(expected2h.toISOString().slice(0, 15)));

    // Regular strings should just be returned as is
    assert.strictEqual(UrgencyHelpers.resolveRelativeTimestamp('2023-11-01T12:00'), '2023-11-01T12:00');
  });
});
