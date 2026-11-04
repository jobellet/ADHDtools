// Browser tests: the sync button (features/sync) and events deleted in Google Calendar.
// Run: npm run test:ui   (see tests/AGENTS.md)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openApp } from './harness.js';

const DAY = '2026-11-04';
const NOW = `${DAY}T10:00:00`;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/drive.appdata';
const GOOGLE = { gcalClientId: '123-abc.apps.googleusercontent.com', gcalConnected: 'true' };
let server;
let browser;

before(async () => {
  server = await startServer();
  browser = await launch();
});
after(async () => {
  await browser?.close();
  server?.stop();
});

const readButton = page => page.evaluate(() => {
  const btn = document.getElementById('sync-status-btn');
  const r = btn.getBoundingClientRect();
  const tabs = document.querySelector('.app-tabs').getBoundingClientRect();
  return {
    hidden: btn.hidden || r.width === 0,
    state: btn.dataset.state,
    label: btn.getAttribute('aria-label'),
    overTabs: r.top < tabs.bottom && r.bottom > tabs.top && r.left < tabs.right && r.right > tabs.left,
    pageWidth: document.documentElement.scrollWidth,
    windowWidth: window.innerWidth,
  };
});

for (const device of ['phone', 'desktop']) {
  test(`no Google set up → no sync button (${device})`, async () => {
    const { page, context, errors, external } = await openApp(browser, server.url, { device, time: NOW });
    try {
      assert.equal((await readButton(page)).hidden, true);
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      await context.close();
    }
  });

  test(`Google connected but signed out → red button, no request (${device})`, async () => {
    const { page, context, errors, external } = await openApp(browser, server.url, {
      device, time: NOW, storage: { ...GOOGLE, 'adhd-lang': 'fr' },
    });
    try {
      const btn = await readButton(page);
      assert.equal(btn.hidden, false);
      assert.equal(btn.state, 'off');
      assert.match(btn.label, /Non synchronisé/);
      if (device === 'desktop') assert.equal(btn.overTabs, false, 'button covers the tabs');
      assert.ok(btn.pageWidth <= btn.windowWidth + 1, 'page scrolls sideways');
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      await context.close();
    }
  });
}

test('tap the sync button → an event deleted in Google leaves the app, button turns green', async () => {
  const local = s => `${DAY}T${s}:00`;
  const gEvent = (uid, title, start, end) => ({
    iCalUID: uid, summary: title, updated: new Date(`${DAY}T08:00:00`).toISOString(),
    start: { dateTime: new Date(local(start)).toISOString() }, end: { dateTime: new Date(local(end)).toISOString() },
  });
  let googleEvents = [gEvent('kept@google.com', 'Dentist', '15:00', '16:00'), gEvent('gone@google.com', 'Cancelled meeting', '13:00', '14:00')];
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const handler = route => {
    const url = route.request().url();
    if (url.includes('/calendarList')) return json(route, { items: [{ id: 'me', primary: true, summary: 'Me' }] });
    if (url.includes('/events')) return json(route, { items: googleEvents });
    if (url.includes('/upload/drive/')) return json(route, { id: 'backup-1', modifiedTime: new Date().toISOString() });
    if (url.includes('/drive/v3/files')) return json(route, { files: [] });
    return route.abort();
  };
  const session = { [`google-token:${SCOPES}`]: { token: 'fake', expiresAt: Date.parse(NOW) + 3600e3 } };
  const { page, context, errors } = await openApp(browser, server.url, {
    device: 'phone', time: NOW, storage: GOOGLE, session, routes: [[/^https:\/\/www\.googleapis\.com\//, handler]],
  });
  try {
    const titles = () => page.evaluate(() => JSON.parse(localStorage.getItem('adhd-calendar-events') || '[]').map(e => e.title).sort());
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('adhd-calendar-events') || '[]')).length === 2);
    assert.deepEqual(await titles(), ['Cancelled meeting', 'Dentist']);
    assert.equal((await readButton(page)).state, 'on');

    googleEvents = googleEvents.slice(0, 1); // deleted in Google
    await page.click('#sync-status-btn');
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('adhd-calendar-events') || '[]')).length === 1);
    await page.waitForFunction(() => document.getElementById('sync-status-btn').dataset.state === 'on');
    assert.deepEqual(await titles(), ['Dentist']);
    const copies = await page.evaluate(() => window.TaskStore.getAllTasks().filter(t => t.isCalendarEvent).map(t => t.name));
    assert.deepEqual(copies, ['Dentist']);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
