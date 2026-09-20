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
