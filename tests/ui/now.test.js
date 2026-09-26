// Browser tests: the app opens on the right screen (Now view or planner).
// Run: npm run test:ui   (see tests/AGENTS.md)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openApp, sampleDay } from './harness.js';

const DAY = '2026-09-26';
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

const readNow = page => page.evaluate(() => ({
  tool: document.querySelector('.tool-section.active')?.id,
  mode: document.getElementById('now-view')?.dataset.mode,
  title: document.getElementById('now-title')?.textContent.trim(),
  timer: !document.getElementById('now-timer')?.hidden,
  pageWidth: document.documentElement.scrollWidth,
  windowWidth: window.innerWidth,
}));

for (const device of ['phone', 'desktop']) {
  test(`routine time → Now view with the routine and a timer (${device})`, async () => {
    const { page, context, errors, external } = await openApp(browser, server.url, {
      device, time: `${DAY}T07:10:00`, storage: sampleDay(DAY),
    });
    try {
      const now = await readNow(page);
      assert.equal(now.tool, 'home');
      assert.equal(now.mode, 'doing');
      assert.match(now.title, /Morning routine/);
      assert.ok(now.timer, 'timer is shown');
      assert.ok(now.pageWidth <= now.windowWidth + 1, 'page scrolls sideways');
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      await context.close();
    }
  });
}

test('free time with work to do → the app runs the next auto-placed task', async () => {
  const { page, context, errors } = await openApp(browser, server.url, {
    device: 'phone', time: `${DAY}T13:00:00`, storage: sampleDay(DAY),
  });
  try {
    const now = await readNow(page);
    assert.equal(now.tool, 'home');
    // An all-day calendar event must never become "the thing to do now".
    assert.notEqual(now.title, 'Birthday');
    assert.equal(now.title, 'Groceries');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('nothing planned → the app opens on the planner', async () => {
  const storage = sampleDay(DAY);
  storage['adhd-unified-tasks'] = storage['adhd-unified-tasks'].filter(t => t.isFixed); // no flexible work
  const { page, context, errors } = await openApp(browser, server.url, {
    device: 'phone', time: `${DAY}T12:00:00`, storage,
  });
  try {
    const now = await readNow(page);
    assert.equal(now.tool, 'planner', `opened on ${now.tool} (mode ${now.mode}: ${now.title})`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
