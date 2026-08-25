import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildSchedule } from '../core/scheduler.js';

describe('Scheduler', () => {
  const config = {
    dayStart: '09:00',
    dayEnd: '17:00',
    fixedTag: '[FIX]',
    flexibleTag: '[FLEX]'
  };
  
  const now = new Date(2023, 9, 15, 9, 0); // 9:00 AM

  test('schedules fixed tasks first', () => {
    const tasks = [
      { id: '1', hash: '1', name: 'Flexible Task', durationMinutes: 60, importance: 1, urgency: 1, completed: false },
      { id: '2', hash: '2', name: 'Meeting [FIX]', startTime: '10:00', durationMinutes: 60, isFixed: true, completed: false }
    ];

    const schedule = buildSchedule({ tasks, now, config });
    
    // There should be 2 tasks scheduled
    assert.strictEqual(schedule.length, 2);
    
    // The flexible task should take the 09:00 - 10:00 slot
    assert.strictEqual(schedule[0].task.name, 'Flexible Task');
    assert.strictEqual(schedule[0].scheduledStart, 9 * 60);
    assert.strictEqual(schedule[0].scheduledEnd, 10 * 60);

    // The fixed task is at 10:00
    assert.strictEqual(schedule[1].task.name, 'Meeting [FIX]');
    assert.strictEqual(schedule[1].scheduledStart, 10 * 60);
  });

  test('sorts flexible tasks by priority', () => {
    const tasks = [
      { id: '1', hash: '1', name: 'Low Priority', durationMinutes: 60, importance: 2, urgency: 2, completed: false },
      { id: '2', hash: '2', name: 'High Priority', durationMinutes: 60, importance: 10, urgency: 10, completed: false }
    ];

    const schedule = buildSchedule({ tasks, now, config });
    assert.strictEqual(schedule.length, 2);
    
    // High Priority first
    assert.strictEqual(schedule[0].task.name, 'High Priority');
    assert.strictEqual(schedule[0].scheduledStart, 9 * 60);

    assert.strictEqual(schedule[1].task.name, 'Low Priority');
    assert.strictEqual(schedule[1].scheduledStart, 10 * 60);
  });

  test('respects dependency blocks', () => {
    const tasks = [
      { id: '1', hash: '1', name: 'Step 2', dependency: '2', durationMinutes: 60, importance: 10, urgency: 10, completed: false },
      { id: '2', hash: '2', name: 'Step 1', durationMinutes: 60, importance: 5, urgency: 5, completed: false }
    ];

    const schedule = buildSchedule({ tasks, now, config });
    
    // Step 2 should be blocked because Step 1 is not completed
    assert.strictEqual(schedule.length, 1);
    assert.strictEqual(schedule[0].task.name, 'Step 1');
  });

  test('does not schedule past tasks', () => {
    const tasks = [
      { id: '1', hash: '1', name: 'Task', durationMinutes: 60, importance: 5, urgency: 5, completed: false }
    ];

    // Current time is 11:00 AM
    const lateNow = new Date(2023, 9, 15, 11, 0); 
    const schedule = buildSchedule({ tasks, now: lateNow, config });
    
    assert.strictEqual(schedule.length, 1);
    assert.strictEqual(schedule[0].scheduledStart, 11 * 60); // Starts at 11:00 AM
  });
});
