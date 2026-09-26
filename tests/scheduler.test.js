import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildSchedule, routineBookedMinutes, findConflicts, findNextFreeSlot, findRoutineConflicts } from '../core/scheduler.js';
import { isPassiveOrAllDay } from '../core/task-model.js';

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
    assert.strictEqual(schedule[0].task.name, 'Meeting [FIX]');
    assert.strictEqual(schedule[0].scheduledStart, 10 * 60);
    assert.strictEqual(schedule[0].scheduledEnd, 11 * 60);

    // The fixed task is at 10:00
    assert.strictEqual(schedule[1].task.name, 'Flexible Task');
    assert.strictEqual(schedule[1].scheduledStart, 11 * 60 + 5);
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
    assert.strictEqual(schedule[1].scheduledStart, 10 * 60 + 5);
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

describe('Scheduler routines and conflicts', () => {
  const config = { dayStart: '06:00', dayEnd: '22:00', bufferDurationMinutes: 5, routineBufferPercent: 10 };
  // 2023-10-16 is a Monday
  const monday = new Date(2023, 9, 16, 6, 0);
  const morning = {
    id: 'r1', name: 'Morning', startTime: '07:00', weekDays: [1, 2, 3, 4, 5],
    tasks: [{ name: 'Shower', duration: 20 }, { name: 'Breakfast', duration: 10 }],
  };

  test('books routine time with the buffer margin', () => {
    assert.strictEqual(routineBookedMinutes(morning, 10), 33);
    assert.strictEqual(routineBookedMinutes(morning, 0), 30);
    assert.strictEqual(routineBookedMinutes({ tasks: [] }, 10), 0);
  });

  test('routine blocks appear on matching weekdays only', () => {
    const schedule = buildSchedule({ tasks: [], now: monday, config: { ...config, routines: [morning] } });
    assert.strictEqual(schedule.length, 1);
    assert.strictEqual(schedule[0].task.source, 'routine');
    assert.strictEqual(schedule[0].scheduledStart, 7 * 60);
    assert.strictEqual(schedule[0].scheduledEnd, 7 * 60 + 33);

    const sunday = new Date(2023, 9, 15, 6, 0);
    assert.strictEqual(buildSchedule({ tasks: [], now: sunday, config: { ...config, routines: [morning] } }).length, 0);
  });

  test('a routine done today frees its time', () => {
    const schedule = buildSchedule({
      tasks: [], now: monday,
      config: { ...config, routines: [morning], routineRuns: { r1: '2023-10-16' } },
    });
    assert.strictEqual(schedule.length, 0);
  });

  test('flexible tasks never overlap a routine block', () => {
    const tasks = [{ hash: 'a', name: 'Write report', durationMinutes: 45, importance: 8, urgency: 8 }];
    const schedule = buildSchedule({ tasks, now: new Date(2023, 9, 16, 6, 30), config: { ...config, routines: [morning] } });
    const report = schedule.find(s => s.task.hash === 'a');
    const routine = schedule.find(s => s.task.source === 'routine');
    assert.ok(report.scheduledStart >= routine.scheduledEnd || report.scheduledEnd <= routine.scheduledStart);
    for (let i = 1; i < schedule.length; i += 1) {
      assert.ok(schedule[i].scheduledStart >= schedule[i - 1].scheduledEnd, 'slots must not overlap');
    }
  });

  test('a deadline alone does not pin a task to a time', () => {
    const tasks = [{ hash: 'd', name: 'Tax form', deadline: '2023-10-20T17:00', durationMinutes: 30 }];
    const schedule = buildSchedule({ tasks, now: new Date(2023, 9, 16, 9, 0), config });
    assert.strictEqual(schedule[0].scheduledStart, 9 * 60);
  });

  test('auto-pinned tasks that were not finished go back to the queue', () => {
    const tasks = [{ hash: 'p', name: 'Emails', plannerDate: '2023-10-16T09:00', durationMinutes: 30, autoPinned: true }];
    const schedule = buildSchedule({ tasks, now: new Date(2023, 9, 16, 10, 0), config });
    assert.strictEqual(schedule[0].scheduledStart, 10 * 60);
  });

  test('snoozed tasks wait until the snooze ends', () => {
    const tasks = [
      { hash: 'hi', name: 'Important', durationMinutes: 30, importance: 10, urgency: 10, snoozedUntil: new Date(2023, 9, 16, 10, 0).toISOString() },
      { hash: 'lo', name: 'Small', durationMinutes: 30, importance: 2, urgency: 2 },
      { hash: 'nt', name: 'Not today', durationMinutes: 30, snoozedUntil: new Date(2023, 9, 17, 9, 0).toISOString() },
    ];
    const schedule = buildSchedule({ tasks, now: new Date(2023, 9, 16, 9, 0), config });
    assert.deepStrictEqual(schedule.map(s => [s.task.hash, s.scheduledStart]), [['lo', 9 * 60], ['hi', 10 * 60]]);
  });

  test('findConflicts and findNextFreeSlot see routines and pinned tasks', () => {
    const overrides = {
      ...config,
      routines: [morning],
      tasks: [{ hash: 't1', name: 'Dentist', plannerDate: '2023-10-16T08:00', durationMinutes: 60 }],
    };
    const clash = findConflicts({ dateStr: '2023-10-16', startMinutes: 7 * 60 + 30, durationMinutes: 15, overrides });
    assert.deepStrictEqual(clash.map(c => c.kind), ['routine']);
    assert.strictEqual(findConflicts({ dateStr: '2023-10-16', startMinutes: 8 * 60, durationMinutes: 30, ignore: 't1', overrides }).length, 0);
    // 07:00-07:33 routine, 08:00-09:00 dentist -> a 30 min slot from 07:00 fits at 09:00
    assert.strictEqual(findNextFreeSlot({ dateStr: '2023-10-16', fromMinutes: 7 * 60, durationMinutes: 30, overrides }), 9 * 60);
    // a 20 min slot fits between them at 07:35
    assert.strictEqual(findNextFreeSlot({ dateStr: '2023-10-16', fromMinutes: 7 * 60, durationMinutes: 20, overrides }), 7 * 60 + 35);
  });

  test('findRoutineConflicts detects overlapping routines on shared days', () => {
    const other = { id: 'r2', name: 'Kids', startTime: '07:30', weekDays: [1], tasks: [{ name: 'Dress', duration: 10 }] };
    const weekend = { id: 'r3', name: 'Yoga', startTime: '07:10', weekDays: [0, 6], tasks: [{ name: 'Yoga', duration: 30 }] };
    assert.deepStrictEqual(findRoutineConflicts(morning, [morning, other, weekend]).map(r => r.id), ['r2']);
  });
});

describe('Scheduler in-progress blocks', () => {
  test('a fixed block that already started keeps its start time', () => {
    const tasks = [{ hash: 'm', name: 'Meeting', plannerDate: '2023-10-16T09:00', durationMinutes: 60, isFixed: true }];
    const schedule = buildSchedule({ tasks, now: new Date(2023, 9, 16, 9, 20), config: { dayStart: '06:00', dayEnd: '22:00' } });
    assert.strictEqual(schedule[0].scheduledStart, 9 * 60);
    assert.strictEqual(schedule[0].scheduledEnd, 10 * 60);
  });
});

describe('Scheduler fixed items keep their time', () => {
  test('a fixed item right after a routine is not pushed by the pause, nor shortened', () => {
    const routines = [{ id: 'r', name: 'Morning', startTime: '08:00', weekDays: [0, 1, 2, 3, 4, 5, 6], tasks: [{ name: 'Shower', duration: 30 }] }];
    const tasks = [{ hash: 'd', name: 'Dentist', plannerDate: '2023-10-16T08:35', durationMinutes: 15, isFixed: true }];
    const schedule = buildSchedule({ tasks, now: new Date(2023, 9, 16, 7, 40), config: { dayStart: '06:00', dayEnd: '22:00', bufferDurationMinutes: 5, routines } });
    const dentist = schedule.find(s => s.task.hash === 'd');
    assert.strictEqual(dentist.scheduledStart, 8 * 60 + 35);
    assert.strictEqual(dentist.scheduledEnd, 8 * 60 + 50);
  });

  test('an overlapping fixed item moves after the other one and keeps its length', () => {
    const tasks = [
      { hash: 'a', name: 'A', plannerDate: '2023-10-16T09:00', durationMinutes: 60, isFixed: true },
      { hash: 'b', name: 'B', plannerDate: '2023-10-16T09:30', durationMinutes: 30, isFixed: true },
    ];
    const schedule = buildSchedule({ tasks, now: new Date(2023, 9, 16, 8, 0), config: { dayStart: '06:00', dayEnd: '22:00' } });
    const b = schedule.find(s => s.task.hash === 'b');
    assert.deepStrictEqual([b.scheduledStart, b.scheduledEnd], [10 * 60, 10 * 60 + 30]);
  });
});

describe('Scheduler: calendar copies and too-long tasks never block the day', () => {
  const config = { dayStart: '06:00', dayEnd: '22:00', bufferDurationMinutes: 5 };
  const now = new Date(2026, 8, 26, 13, 0);
  const work = [
    { hash: 'g', name: 'Groceries', durationMinutes: 60, importance: 6, urgency: 5 },
    { hash: 'r', name: 'Read', durationMinutes: 30, importance: 3, urgency: 3 },
  ];

  test('all-day and passive calendar copies book no time', () => {
    const tasks = [
      { hash: 'bday', name: 'Birthday', plannerDate: '2026-09-26', durationMinutes: 1440, isFixed: true, isCalendarEvent: true, isAllDay: true, importance: 10, urgency: 10 },
      { hash: 'copy', name: 'Lab meeting', plannerDate: '2026-09-26T15:00', durationMinutes: 60, isFixed: true, isCalendarEvent: true, isActionable: false },
      ...work,
    ];
    const names = buildSchedule({ tasks, now, config }).map(s => s.task.name);
    assert.ok(!names.includes('Birthday'));
    assert.ok(!names.includes('Lab meeting'));
    assert.ok(names.includes('Groceries') && names.includes('Read'), names.join());
  });

  test('a flexible task longer than the rest of the day does not block the others', () => {
    const tasks = [{ hash: 'huge', name: 'Huge', durationMinutes: 1440, importance: 10, urgency: 10 }, ...work];
    const names = buildSchedule({ tasks, now, config }).map(s => s.task.name);
    assert.ok(!names.includes('Huge'));
    assert.ok(names.includes('Groceries') && names.includes('Read'), names.join());
  });

  test('isPassiveOrAllDay spots calendar copies only', () => {
    assert.strictEqual(isPassiveOrAllDay({ isAllDay: true }), true);
    assert.strictEqual(isPassiveOrAllDay({ plannerDate: '2026-09-26', durationMinutes: 1440 }), true);
    assert.strictEqual(isPassiveOrAllDay({ isCalendarEvent: true, isActionable: false }), true);
    assert.strictEqual(isPassiveOrAllDay({ name: 'Work', durationMinutes: 60 }), false);
    assert.strictEqual(isPassiveOrAllDay({ plannerDate: '2026-09-26T09:00', durationMinutes: 60 }), false);
  });
});
