import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const calendarToolCode = readFileSync('features/calendar/calendar-tool.js', 'utf8');

function loadCalendarTool() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'dangerously', url: 'http://localhost' });
  const win = dom.window;
  const upserts = new Map();
  win.TextEncoder = TextEncoder; // browsers have it; jsdom does not
  win.TaskModel = { DEFAULT_USER: 'default' };
  win.TaskStore = {
    upsertTaskByHash: (hash, task) => upserts.set(hash, task),
    getTaskByHash: (hash) => upserts.get(hash) || null,
  };
  win.console.error = () => {};
  win.eval(calendarToolCode);
  return { win, upserts };
}

describe('Calendar copies of events with non-Latin-1 titles', () => {
  it('ingests emoji and typographic characters without throwing (btoa Latin-1 error)', () => {
    const { win, upserts } = loadCalendarTool();
    const count = win.CalendarTool.ingestExternalEvents([
      { title: '🎂 Anniversaire', start: '2026-11-17T10:00', end: '2026-11-17T11:00' },
      { title: 'Cœur “réunion”', start: '2026-11-17T12:00', end: '2026-11-17T13:00' },
    ]);
    assert.equal(count, 2);
    assert.equal(upserts.size, 2);
    const names = [...upserts.values()].map(t => t.name).sort();
    assert.deepEqual(names, ['Cœur “réunion”', '🎂 Anniversaire'].sort());
  });

  it('keeps the old id for Latin-1 titles, so existing copies are not duplicated', () => {
    const { win, upserts } = loadCalendarTool();
    win.CalendarTool.ingestExternalEvents([
      { title: 'Réunion équipe', start: '2026-11-17T10:00', end: '2026-11-17T11:00' },
    ]);
    const oldId = `task-${win.btoa('Réunion équipe-2026-11-17T10:00-2026-11-17T11:00').replace(/=/g, '')}`;
    assert.deepEqual([...upserts.keys()], [oldId]);
  });
});
