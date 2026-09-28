// Browser tests: an event created in the Calendar tool must also appear in the
// day planner, at the exact time the user typed. Stored times are local naive
// "YYYY-MM-DDTHH:MM" like everywhere else — the planner matches on that string.
// Run: npm run test:ui   (see tests/AGENTS.md)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openApp } from './harness.js';

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

test('an event added in the calendar shows in the planning at the same time', async () => {
  const { page, context, errors } = await openApp(browser, server.url, {
    device: 'desktop', time: `${DAY}T13:00:00`,
  });
  try {
    const answers = ['Dentist', '14:00', '15:00'];
    let i = 0;
    page.on('dialog', d => { d.accept(answers[i]); i += 1; });
    await page.evaluate(() => window.switchTool('calendar'));
    await page.evaluate(() => {
      document.getElementById('calendar-view').querySelector('table')
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.clock.runFor(300);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('adhd-calendar-events')).map(e => e.start));
    assert.equal(stored[0], `${DAY}T14:00`, 'stored times are local naive strings');
    await page.evaluate(() => window.switchTool('planner'));
    await page.clock.runFor(300);
    const block = await page.evaluate(() => {
      const el = [...document.querySelectorAll('#time-blocks .timeline-lane .event')]
        .find(el => el.dataset.title === 'Dentist');
      return el ? { start: Number(el.dataset.start), end: Number(el.dataset.end) } : null;
    });
    assert.ok(block, '"Dentist" missing from the planning timeline');
    assert.equal(block.start, 14 * 60, `planning shows ${block.start}, expected 14:00`);
    assert.equal(block.end, 15 * 60, `planning shows end ${block.end}, expected 15:00`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
