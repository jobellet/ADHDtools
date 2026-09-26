// Browser tests: the day planner shows the whole day, on a phone and on a desktop.
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

// Everything the tests check, read in one go from the page.
async function readPlanner(page) {
  return page.evaluate(() => {
    const section = document.getElementById('planner');
    const box = document.getElementById('time-blocks');
    const timeline = box?.querySelector('.timeline');
    const mh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height'));
    const cfg = window.ConfigManager?.getConfig?.() || {};
    const events = [...(timeline?.querySelectorAll('.timeline-lane .event') || [])].map(el => {
      const r = el.getBoundingClientRect();
      return { title: el.dataset.title, start: Number(el.dataset.start), end: Number(el.dataset.end),
        top: el.style.top, height: r.height, className: el.className };
    });
    const boxRect = box?.getBoundingClientRect();
    return {
      active: section?.classList.contains('active'),
      mh,
      dayStart: cfg.dayStart,
      dayEnd: cfg.dayEnd,
      timelineHeight: timeline?.getBoundingClientRect().height ?? 0,
      boxHeight: boxRect?.height ?? 0,
      boxBottom: boxRect?.bottom ?? 0,
      windowHeight: window.innerHeight,
      pageWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth,
      labels: timeline?.querySelectorAll('.timeline-gutter .timeline-label').length ?? 0,
      events,
    };
  });
}

async function openPlanner(device, time) {
  const opened = await openApp(browser, server.url, { device, time, storage: sampleDay(DAY) });
  await opened.page.evaluate(() => window.switchTool('planner'));
  await opened.page.clock.runFor(300);
  return opened;
}

const toMin = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + m; };

for (const device of ['phone', 'desktop']) {
  test(`planner shows the whole day (${device})`, async () => {
    const { page, context, errors, external } = await openPlanner(device, `${DAY}T13:00:00`);
    try {
      const p = await readPlanner(page);
      assert.ok(p.active, 'planner is open');

      // The timeline is as tall as the whole day at the current zoom.
      const dayMinutes = toMin(p.dayEnd || '22:00') - toMin(p.dayStart || '00:00');
      assert.ok(Math.abs(p.timelineHeight - dayMinutes * p.mh) < 2,
        `timeline height ${p.timelineHeight} ≠ ${dayMinutes} min × ${p.mh}`);
      assert.ok(p.boxHeight > 200, `timeline view is only ${p.boxHeight}px tall`);

      // Every planned item is drawn: calendar copies and all-day events must not push work out of the day.
      const titles = p.events.map(e => e.title);
      for (const name of ['Morning routine', 'Dress the kids', 'Lab meeting', 'Groceries', 'Read a chapter']) {
        assert.ok(titles.includes(name), `"${name}" missing from the timeline; drawn: ${titles.join(', ')}`);
      }
      assert.ok(!titles.includes('Birthday'), 'an all-day event must not be drawn as a block');
      assert.equal(titles.filter(t => t === 'Lab meeting').length, 1, 'calendar event drawn twice');

      // No block is broken or covers the whole day.
      for (const e of p.events) {
        assert.ok(Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > e.start, `bad times for ${e.title}`);
        assert.ok(!/NaN/.test(e.top), `NaN position for ${e.title}`);
        assert.ok(e.height > 0, `${e.title} has no height`);
        assert.ok(e.end - e.start < 12 * 60, `${e.title} covers more than half the day`);
      }
      // Nothing overlaps (except calendar events, which the user does not control).
      const booked = p.events.filter(e => !/calendar-event/.test(e.className)).sort((a, b) => a.start - b.start);
      for (let i = 1; i < booked.length; i += 1) {
        assert.ok(booked[i].start >= booked[i - 1].end,
          `"${booked[i].title}" overlaps "${booked[i - 1].title}"`);
      }
      assert.ok(p.labels >= 3, 'time labels are missing');

      // Layout: no sideways scroll; on desktop the day fills the window.
      assert.ok(p.pageWidth <= p.windowWidth + 1, `page scrolls sideways (${p.pageWidth} > ${p.windowWidth})`);
      if (device === 'desktop') {
        assert.ok(p.boxBottom > p.windowHeight - 60, `desktop timeline ends at ${p.boxBottom}px, window is ${p.windowHeight}px`);
      }

      assert.deepEqual(errors, [], 'no page or console errors');
      assert.deepEqual(external, [], 'no third-party requests while loading');
    } finally {
      await context.close();
    }
  });
}

test('zoom (Ctrl+scroll) keeps blocks aligned with their times (desktop)', async () => {
  const { page, context, errors } = await openPlanner('desktop', `${DAY}T13:00:00`);
  try {
    const before = await readPlanner(page);
    const box = await page.locator('#time-blocks').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    for (let i = 0; i < 5; i += 1) await page.mouse.wheel(0, 100); // zoom out
    await page.keyboard.up('Control');
    await page.clock.runFor(300);
    const after = await readPlanner(page);
    assert.ok(after.mh < before.mh, `zoom out did not work (${before.mh} → ${after.mh})`);
    assert.ok(after.timelineHeight < before.timelineHeight, 'timeline did not shrink when zoomed out');
    // Blocks still sit at (start - dayStart) × minute height from the top of the timeline.
    const offsets = await page.evaluate(() => {
      const tl = document.querySelector('#time-blocks .timeline');
      const top = tl.getBoundingClientRect().top;
      const mh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height'));
      const [h, m] = (window.ConfigManager.getConfig().dayStart || '00:00').split(':').map(Number);
      return [...tl.querySelectorAll('.timeline-lane .event')].map(el =>
        Math.abs(el.getBoundingClientRect().top - top - (Number(el.dataset.start) - (h * 60 + m)) * mh));
    });
    offsets.forEach(d => assert.ok(d < 2, `block is ${d}px away from its time`));
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('add-event form refuses a taken time and offers the next free one', async () => {
  const { page, context, errors } = await openPlanner('phone', `${DAY}T06:00:00`);
  try {
    await page.click('#add-event-btn');
    await page.fill('#event-title', 'Call the bank');
    await page.fill('#event-time', '07:10'); // inside the morning routine (07:00–07:33)
    await page.click('.event-chip[data-minutes="15"]');
    await page.click('.event-save');
    await page.clock.runFor(200);
    assert.match(await page.textContent('#event-conflict'), /Morning routine/, 'conflict box names the routine in the way');
    await page.click('#event-conflict button'); // "Use HH:MM"
    await page.clock.runFor(100);
    const suggested = await page.inputValue('#event-time');
    assert.ok(suggested >= '07:33', `suggested ${suggested} is still inside the routine`);
    await page.click('.event-save');
    await page.clock.runFor(300);
    const saved = await page.evaluate(() => window.TaskStore.getAllTasks().find(t => t.name === 'Call the bank'));
    assert.ok(saved, 'event was not saved');
    assert.equal(saved.plannerDate.slice(11, 16), suggested);
    assert.equal(saved.deadline ?? null, null, 'a start time is not a deadline');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
