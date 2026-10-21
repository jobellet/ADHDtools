import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mergeArrayKey, mergeBackup } from '../core/sync-merge.js';

const iso = (d) => new Date(d).toISOString();

describe('mergeArrayKey — level 1: identical items are skipped silently', () => {
  test('identical items produce no conflict, no update', () => {
    const task = { id: 't1', text: 'Call mom', updatedAt: iso('2026-09-19T10:00:00Z') };
    const result = mergeArrayKey('adhd-hub-data', [task], [task]);
    assert.strictEqual(result.added, 0);
    assert.strictEqual(result.updated, 0);
    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(result.merged.length, 1);
  });

  test('same item with fields in different key order is still identical', () => {
    const a = { id: 't1', text: 'Call mom', done: true };
    const b = { done: true, text: 'Call mom', id: 't1' };
    const result = mergeArrayKey('adhd-hub-data', [b], [a]);
    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(result.updated, 0);
  });

  test('new item (absent locally) is added', () => {
    const existing = [{ id: 't1', text: 'A' }];
    const imported = [
      { id: 't1', text: 'A' },
      { id: 't2', text: 'B', updatedAt: iso('2026-09-19T12:00:00Z') },
    ];
    const result = mergeArrayKey('adhd-hub-data', imported, existing);
    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.merged.find(t => t.id === 't2')?.text, 'B');
  });

  test('habit strings: identical string skipped, new string added', () => {
    const result = mergeArrayKey('adhd-habits', ['Méditation', 'Sport'], ['Méditation']);
    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.conflicts.length, 0);
    assert.deepStrictEqual(result.merged, ['Méditation', 'Sport']);
  });
});

describe('mergeArrayKey — level 2: newest updatedAt wins automatically', () => {
  test('imported newer → imported replaces existing', () => {
    const existing = { id: 't1', text: 'Old name', updatedAt: iso('2026-09-19T10:00:00Z') };
    const imported = { id: 't1', text: 'New name', updatedAt: iso('2026-09-19T18:00:00Z') };
    const result = mergeArrayKey('adhd-hub-data', [imported], [existing]);
    assert.strictEqual(result.updated, 1);
    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(result.merged[0].text, 'New name');
  });

  test('existing newer → existing kept, no conflict', () => {
    const existing = { id: 't1', text: 'Local edit', updatedAt: iso('2026-09-19T18:00:00Z') };
    const imported = { id: 't1', text: 'Older edit', updatedAt: iso('2026-09-19T10:00:00Z') };
    const result = mergeArrayKey('adhd-hub-data', [imported], [existing]);
    assert.strictEqual(result.updated, 0);
    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(result.merged[0].text, 'Local edit');
  });

  test('completedAt counts as a timestamp', () => {
    const existing = { id: 't1', text: 'Task', completedAt: iso('2026-09-19T10:00:00Z') };
    const imported = { id: 't1', text: 'Task', completedAt: iso('2026-09-19T20:00:00Z') };
    const result = mergeArrayKey('adhd-hub-data', [imported], [existing]);
    assert.strictEqual(result.updated, 1);
    assert.strictEqual(result.merged[0].completedAt, imported.completedAt);
  });
});

describe('mergeArrayKey — level 3: true conflicts go to manual resolution', () => {
  test('both changed with no usable timestamps → conflict', () => {
    const existing = { id: 't1', text: 'Edited on laptop' };
    const imported = { id: 't1', text: 'Edited on phone' };
    const result = mergeArrayKey('adhd-hub-data', [imported], [existing]);
    assert.strictEqual(result.conflicts.length, 1);
    assert.strictEqual(result.conflicts[0].type, 'array-item');
    assert.strictEqual(result.merged[0].text, 'Edited on laptop');
  });

  test('equal updatedAt but different content → conflict (do not guess)', () => {
    const existing = { id: 't1', text: 'Laptop version', updatedAt: iso('2026-09-19T10:00:00Z') };
    const imported = { id: 't1', text: 'Phone version', updatedAt: iso('2026-09-19T10:00:00Z') };
    const result = mergeArrayKey('adhd-hub-data', [imported], [existing]);
    assert.strictEqual(result.conflicts.length, 1);
    assert.strictEqual(result.updated, 0);
  });
});

describe('mergeBackup — full backup merge', () => {
  test('empty local storage → everything added', () => {
    const imported = {
      metadata: { app: 'ADHD Tools Hub', version: '1.0', exportedAt: iso('2026-09-20T09:00:00Z') },
      'adhd-habits': ['Méditation'],
      'adhd-hub-data': { tasks: [{ id: 't1', text: 'A' }] },
    };
    const result = mergeBackup(imported, {});
    assert.strictEqual(Object.keys(result.updates).length, 2);
    assert.strictEqual(result.conflicts.length, 0);
  });

  test('sensitive keys are skipped when isSensitiveKey is provided', () => {
    const imported = { 'gcalClientId': 'abc', 'adhd-habits': ['X'] };
    const result = mergeBackup(imported, {}, { isSensitiveKey: k => k === 'gcalClientId' });
    assert.strictEqual(result.updates['gcalClientId'], undefined);
    assert.ok(Array.isArray(result.updates['adhd-habits']));
  });

  test('primitive key identical → ignored', () => {
    const imported = { 'pomodoro-duration': 25 };
    const result = mergeBackup(imported, { 'pomodoro-duration': '25' });
    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(result.updated, 0);
  });
});

describe('mergeBackup — deleted tasks stay deleted', () => {
  const task = (id, name) => ({ id, hash: id, name });

  test('a task deleted locally is not brought back by the backup', () => {
    const imported = { metadata: { app: 'ADHD Tools Hub' }, 'adhd-unified-tasks': [task('a', 'A'), task('b', 'B')] };
    const existingRaw = {
      'adhd-unified-tasks': JSON.stringify([task('b', 'B')]),
      'adhd-deleted-tasks': JSON.stringify([{ id: 'a', deletedAt: '2026-09-26T07:00:00Z' }]),
    };
    const { updates } = mergeBackup(imported, existingRaw);
    assert.deepStrictEqual((updates['adhd-unified-tasks'] || []).map(t => t.id), ['b']);
  });

  test('a task deleted on the other device is removed here', () => {
    const imported = {
      metadata: { app: 'ADHD Tools Hub' },
      'adhd-unified-tasks': [task('b', 'B')],
      'adhd-deleted-tasks': [{ id: 'a', deletedAt: '2026-09-26T07:00:00Z' }],
    };
    const existingRaw = { 'adhd-unified-tasks': JSON.stringify([task('a', 'A'), task('b', 'B')]) };
    const { updates } = mergeBackup(imported, existingRaw);
    assert.deepStrictEqual(updates['adhd-unified-tasks'].map(t => t.id), ['b']);
    assert.deepStrictEqual(updates['adhd-deleted-tasks'].map(x => x.id), ['a']);
  });
});

describe('mergeBackup — continuous full-state sync (breakdowns, routines, active runs, habits)', () => {
  test('newer remote breakdown tree replaces local breakdown tree (including edits and deletions)', () => {
    const imported = {
      metadata: { app: 'ADHD Tools Hub', exportedAt: iso('2026-09-20T12:05:00Z') },
      'adhd-breakdown-tasks': [{ text: 'Write paper', completed: false, duration: 15, subtasks: [{ text: 'Outline', completed: true, duration: 15, subtasks: [] }] }],
      'adhd-storage-log': { 'adhd-breakdown-tasks': iso('2026-09-20T12:04:00Z') },
    };
    const existingRaw = {
      'adhd-breakdown-tasks': JSON.stringify([
        { text: 'Write paper', completed: false, duration: 10, subtasks: [] },
        { text: 'Deleted project', completed: false, duration: 5, subtasks: [] },
      ]),
      'adhd-storage-log': JSON.stringify({ 'adhd-breakdown-tasks': iso('2026-09-20T11:00:00Z') }),
    };
    const { updates, conflicts } = mergeBackup(imported, existingRaw);
    assert.strictEqual(conflicts.length, 0);
    assert.strictEqual(updates['adhd-breakdown-tasks'].length, 1);
    assert.strictEqual(updates['adhd-breakdown-tasks'][0].subtasks.length, 1);
    assert.strictEqual(updates['adhd-breakdown-tasks'][0].subtasks[0].completed, true);
  });

  test('active routine started on laptop syncs to phone via adhd-routine-runs._active', () => {
    const stepEnd = Date.now() + 180000;
    const imported = {
      metadata: { app: 'ADHD Tools Hub', exportedAt: iso('2026-09-20T08:05:00Z') },
      'adhd-routine-runs': {
        _active: {
          routineId: 'r-morning',
          name: 'Morning Launch',
          currentTaskIndex: 1,
          stepEndTimeMs: stepEnd,
          activeTaskTotalDurationSeconds: 180,
          tasks: [{ name: 'Drink water', duration: 2 }, { name: 'Medications', duration: 3 }],
          updatedAt: iso('2026-09-20T08:04:50Z'),
        },
      },
      'adhd-storage-log': { 'adhd-routine-runs': iso('2026-09-20T08:04:50Z') },
    };
    const existingRaw = {
      'adhd-routine-runs': JSON.stringify({ 'r-evening': '2026-09-19' }),
      'adhd-storage-log': JSON.stringify({ 'adhd-routine-runs': iso('2026-09-19T21:00:00Z') }),
    };
    const { updates, conflicts } = mergeBackup(imported, existingRaw);
    assert.strictEqual(conflicts.length, 0);
    assert.strictEqual(updates['adhd-routine-runs']['r-evening'], '2026-09-19');
    assert.strictEqual(updates['adhd-routine-runs']._active.routineId, 'r-morning');
    assert.strictEqual(updates['adhd-routine-runs']._active.currentTaskIndex, 1);
  });

  test('device-local keys (adhd-device-id, driveLastBackupAt) are never overwritten by remote backup', () => {
    const imported = {
      metadata: { app: 'ADHD Tools Hub' },
      'adhd-device-id': 'laptop-id',
      'driveLastBackupAt': '999999999',
      'adhd-habits': [{ id: 'h1', name: 'Walk' }],
    };
    const existingRaw = {
      'adhd-device-id': 'phone-id',
      'driveLastBackupAt': '111111111',
    };
    const { updates } = mergeBackup(imported, existingRaw);
    assert.strictEqual(updates['adhd-device-id'], undefined);
    assert.strictEqual(updates['driveLastBackupAt'], undefined);
    assert.strictEqual(updates['adhd-habits'].length, 1);
  });

  test('calendar event marked "notATask" on laptop syncs to phone even when random ev.id differs', () => {
    const laptopEvent = {
      id: 'ev-laptop-111',
      uid: 'gcal-marie-uid',
      calendarUid: 'gcal-marie-uid',
      calendarInstanceId: 'gcal-marie-uid:2026-10-21T09:30:00',
      instanceStart: '2026-10-21T09:30:00',
      title: 'Marie',
      start: '2026-10-21T09:30:00',
      end: '2026-10-21T11:00:00',
      isFixed: false,
      notATask: true,
      localOverride: true,
      updatedAt: iso('2026-10-21T09:53:00Z'),
    };
    const phoneEvent = {
      id: 'ev-phone-222',
      uid: 'gcal-marie-uid',
      calendarUid: 'gcal-marie-uid',
      calendarInstanceId: 'gcal-marie-uid:2026-10-21T09:30:00',
      instanceStart: '2026-10-21T09:30:00',
      title: 'Marie',
      start: '2026-10-21T09:30:00',
      end: '2026-10-21T11:00:00',
      localOverride: false,
    };
    const imported = {
      metadata: { app: 'ADHD Tools Hub' },
      'adhd-calendar-events': [laptopEvent],
      'adhd-storage-log': { 'adhd-calendar-events': iso('2026-10-21T09:53:00Z') },
    };
    const existingRaw = {
      'adhd-calendar-events': JSON.stringify([phoneEvent]),
      'adhd-storage-log': JSON.stringify({ 'adhd-calendar-events': iso('2026-10-21T09:54:00Z') }),
    };
    const { updates, conflicts } = mergeBackup(imported, existingRaw);
    assert.strictEqual(conflicts.length, 0);
    assert.strictEqual(updates['adhd-calendar-events'].length, 1);
    assert.strictEqual(updates['adhd-calendar-events'][0].notATask, true);
    assert.strictEqual(updates['adhd-calendar-events'][0].localOverride, true);
  });
});
