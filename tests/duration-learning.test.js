import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock localStorage
let store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; }
};

import { recordTaskDuration, getEstimatedDuration } from '../core/duration-learning.js';

describe('Duration Learning', () => {
  test('records initial task duration', () => {
    store = {}; // reset
    const duration = recordTaskDuration('Write tests', 45);
    
    assert.strictEqual(duration, 45);
    assert.strictEqual(getEstimatedDuration('Write tests'), 45);
  });

  test('updates estimated duration with smoothing', () => {
    store = {}; // reset
    recordTaskDuration('Read', 60);
    // second time it should apply smoothing: (60 * 0.7) + (30 * 0.3) = 42 + 9 = 51
    const smoothed = recordTaskDuration('Read', 30);
    
    assert.strictEqual(smoothed, 51);
    assert.strictEqual(getEstimatedDuration('Read'), 51);
  });

  test('ignores invalid inputs', () => {
    store = {}; // reset
    recordTaskDuration('Task', 30);
    
    // Missing duration
    assert.strictEqual(recordTaskDuration('Task', null), null);
    
    // Missing name
    assert.strictEqual(recordTaskDuration('', 45), null);
    
    // Negative duration
    assert.strictEqual(recordTaskDuration('Task', -10), null);
    
    // Estimate shouldn't have changed
    assert.strictEqual(getEstimatedDuration('Task'), 30);
  });

  test('normalizes task names', () => {
    store = {}; // reset
    recordTaskDuration(' Do chores ', 20);
    
    assert.strictEqual(getEstimatedDuration('do chores'), 20);
    assert.strictEqual(getEstimatedDuration('DO CHORES'), 20);
  });
});
