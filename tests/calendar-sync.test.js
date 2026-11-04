// Calendar tool: events deleted in Google Calendar leave the app (CalendarTool.ingestExternalEvents with a scope).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync('features/calendar/calendar-tool.js', 'utf8');

function setup(storedEvents = []) {
  const store = new Map([['adhd-calendar-events', JSON.stringify(storedEvents)]]);
  const tasks = new Map();
  const deleted = [];
  const sandbox = {
    console, Date, JSON, Set, Map, isNaN, btoa, unescape, encodeURIComponent,
    document: { addEventListener: () => {}, getElementById: () => null },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    Event: class { constructor(type) { this.type = type; } },
    dispatchEvent: () => {},
    addEventListener: () => {},
    EventBus: { dispatchEvent: () => {} },
    TaskModel: { DEFAULT_USER: 'default' },
    TaskStore: {
      getTaskByHash: hash => tasks.get(hash) || null,
      upsertTaskByHash: (hash, task) => tasks.set(hash, { ...task, hash }),
      deleteTasks: hashes => { hashes.forEach(h => { tasks.delete(h); deleted.push(h); }); },
    },
  };
  sandbox.window = sandbox;
  runInNewContext(code, sandbox);
  const events = () => JSON.parse(store.get('adhd-calendar-events'));
  const removed = () => JSON.parse(store.get('adhd-calendar-removed') || '[]');
  return { cal: sandbox.CalendarTool, events, removed, tasks, deleted };
}

const gcal = (uid, title, start, end) => ({ uid, title, start, end, source: 'gcal', isCalendarEvent: true });
const scope = { source: 'gcal', from: new Date(2026, 10, 1).toISOString(), to: new Date(2026, 11, 1).toISOString() };

describe('Calendar: events deleted in Google leave the app', () => {
  it('removes a Google event missing from the fresh list, with its task copy', () => {
    const { cal, events, removed, tasks } = setup();
    const a = gcal('a@google.com', 'Dentist', '2026-11-04T15:00:00', '2026-11-04T16:00:00');
    const b = gcal('b@google.com', 'Meeting', '2026-11-04T13:00:00', '2026-11-04T14:00:00');
    cal.ingestExternalEvents([a, b], scope);
    assert.equal(tasks.size, 2);
    cal.ingestExternalEvents([a], scope);
    assert.deepEqual(events().map(e => e.title), ['Dentist']);
    assert.deepEqual([...tasks.values()].map(t => t.name), ['Dentist']);
    assert.deepEqual(removed().map(t => t.id), ['b@google.com:2026-11-04T13:00:00']);
  });

  it('an empty list removes every Google event of the range (last event deleted)', () => {
    const { cal, events } = setup();
    cal.ingestExternalEvents([gcal('a@google.com', 'Dentist', '2026-11-04T15:00:00', '2026-11-04T16:00:00')], scope);
    cal.ingestExternalEvents([], scope);
    assert.deepEqual(events(), []);
  });

  it('keeps events outside the synced range, local events and other sources', () => {
    const { cal, events } = setup([
      { id: 'local-1', title: 'My own event', start: '2026-11-05T10:00:00', end: '2026-11-05T11:00:00' },
      { uid: 'ics-1@example.org', title: 'From .ics', start: '2026-11-06T10:00:00', end: '2026-11-06T11:00:00' },
      { uid: 'old@google.com', title: 'Last year', start: '2025-11-04T10:00:00', end: '2025-11-04T11:00:00', source: 'gcal' },
    ]);
    cal.ingestExternalEvents([], scope);
    assert.deepEqual(events().map(e => e.title).sort(), ['From .ics', 'Last year', 'My own event']);
  });

  it('removes Google events saved before events had a source (uid …@google.com)', () => {
    const { cal, events } = setup([
      { uid: 'legacy@google.com', title: 'Old sync', start: '2026-11-04T09:00:00', end: '2026-11-04T10:00:00' },
    ]);
    cal.ingestExternalEvents([gcal('a@google.com', 'Dentist', '2026-11-04T15:00:00', '2026-11-04T16:00:00')], scope);
    assert.deepEqual(events().map(e => e.title), ['Dentist']);
  });

  it('removes a locally moved event once it is deleted in Google, keeps it while it exists', () => {
    const moved = {
      uid: 'm@google.com', title: 'Moved', start: '2026-11-04T17:00:00', end: '2026-11-04T18:00:00',
      instanceStart: '2026-11-04T09:00:00', calendarInstanceId: 'm@google.com:2026-11-04T09:00:00',
      localOverride: true, updatedAt: new Date().toISOString(), source: 'gcal',
    };
    const { cal, events } = setup([moved]);
    cal.ingestExternalEvents([gcal('m@google.com', 'Moved', '2026-11-04T09:00:00', '2026-11-04T10:00:00')], scope);
    assert.deepEqual(events().map(e => e.start), ['2026-11-04T17:00:00']);
    cal.ingestExternalEvents([], scope);
    assert.deepEqual(events(), []);
  });

  it('without a scope nothing is removed (.ics import, older callers)', () => {
    const { cal, events } = setup();
    cal.ingestExternalEvents([gcal('a@google.com', 'Dentist', '2026-11-04T15:00:00', '2026-11-04T16:00:00')]);
    cal.ingestExternalEvents([gcal('b@google.com', 'Other', '2026-11-04T13:00:00', '2026-11-04T14:00:00')]);
    assert.equal(events().length, 2);
  });

  it('a title outside Latin-1 (emoji) does not break the sync', () => {
    const { cal, tasks } = setup();
    assert.doesNotThrow(() => cal.ingestExternalEvents([gcal('e@google.com', 'Gym 💪', '2026-11-04T18:00:00', '2026-11-04T19:00:00')], scope));
    assert.equal(tasks.size, 1);
  });
});
