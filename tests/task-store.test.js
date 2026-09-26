import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// In-memory localStorage so the store can persist.
const store = new Map();
global.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const { default: TaskStore } = await import('../core/task-store.js');

describe('TaskStore delete / overdue', () => {
  beforeEach(() => TaskStore.saveTasks([]));

  test('getOverdueTasks lists pending tasks past their deadline', () => {
    const now = new Date(2026, 8, 26, 9, 0);
    TaskStore.addTask({ hash: 'late', name: 'Late', deadline: '2026-08-19T09:30' });
    TaskStore.addTask({ hash: 'done', name: 'Done', deadline: '2026-08-19T09:30', completed: true });
    TaskStore.addTask({ hash: 'soon', name: 'Soon', deadline: '2026-10-01T09:00' });
    TaskStore.addTask({ hash: 'none', name: 'No deadline' });
    TaskStore.addTask({ hash: 'other', name: 'Other user', user: 'kid', deadline: '2026-08-01T09:00' });
    assert.deepStrictEqual(TaskStore.getOverdueTasks(now).map(t => t.hash).sort(), ['late', 'other']);
    assert.deepStrictEqual(TaskStore.getOverdueTasks(now, 'main').map(t => t.hash), ['late']);
  });

  test('calendar copies and all-day events are never overdue', () => {
    const now = new Date(2026, 8, 26, 9, 0);
    TaskStore.addTask({ hash: 'bday', name: 'Birthday', plannerDate: '2026-09-20', deadline: '2026-09-20', isAllDay: true, isCalendarEvent: true });
    TaskStore.addTask({ hash: 'mtg', name: 'Meeting', deadline: '2026-09-20T10:00', isCalendarEvent: true, isActionable: false });
    TaskStore.addTask({ hash: 'late', name: 'Late', deadline: '2026-09-20T10:00' });
    assert.deepStrictEqual(TaskStore.getOverdueTasks(now).map(t => t.hash), ['late']);
  });

  test('deleteTasks removes tasks and undeleteTasks puts them back', () => {
    TaskStore.addTask({ hash: 'a', name: 'A' });
    TaskStore.addTask({ hash: 'b', name: 'B' });
    const removed = TaskStore.deleteTasks(['a']);
    assert.deepStrictEqual(removed.map(t => t.hash), ['a']);
    assert.deepStrictEqual(TaskStore.getAllTasks().map(t => t.hash), ['b']);
    assert.ok(JSON.parse(store.get('adhd-unified-tasks')).every(t => t.hash !== 'a'), 'deletion is saved');
    assert.strictEqual(TaskStore.undeleteTasks(removed), 1);
    assert.deepStrictEqual(TaskStore.getAllTasks().map(t => t.hash).sort(), ['a', 'b']);
    assert.strictEqual(TaskStore.undeleteTasks(removed), 0, 'no duplicates');
  });
});

describe('TaskStore tombstones', () => {
  test('deleting records the id; undo removes it', () => {
    TaskStore.saveTasks([]);
    store.delete('adhd-deleted-tasks');
    TaskStore.addTask({ hash: 'x', id: 'x', name: 'X' });
    const removed = TaskStore.deleteTasks(['x']);
    assert.deepStrictEqual(JSON.parse(store.get('adhd-deleted-tasks')).map(t => t.id), ['x']);
    TaskStore.undeleteTasks(removed);
    assert.deepStrictEqual(JSON.parse(store.get('adhd-deleted-tasks')), []);
  });
});
