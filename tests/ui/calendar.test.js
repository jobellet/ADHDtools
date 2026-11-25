// Browser tests: voice alerts are on by default, with a one-time notice.
// Run: npm run test:ui   (see tests/AGENTS.md)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openApp } from './harness.js';

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

const readVoice = page => page.evaluate(() => ({
  notice: !document.getElementById('voice-welcome-notice')?.classList.contains('hidden'),
  open: !document.getElementById('voice-notice-panel')?.hidden,
  checkbox: document.getElementById('calendar-voice-enable')?.checked,
  early: document.getElementById('calendar-voice-early')?.value,
  stored: localStorage.getItem('adhd-calendar-voice-enabled'),
}));

for (const device of ['phone', 'desktop']) {
  test(`new user: voice alerts on, notice shown once, "Turn off" turns them off (${device})`, async () => {
    const { page, context, errors, external } = await openApp(browser, server.url, { device, storage: { 'adhd-lang': 'fr' } });
    try {
      let voice = await readVoice(page);
      assert.equal(voice.notice, true, 'notice is shown');
      assert.equal(voice.checkbox, true, 'voice alerts on by default');
      assert.equal(voice.early, '5');
      assert.equal(voice.open, false, 'starts as a small bubble');
      // Small, in a corner, above the tab bar, and the app stays usable around it.
      const layout = await page.evaluate(() => {
        const bubble = document.getElementById('voice-notice-toggle').getBoundingClientRect();
        const box = document.getElementById('voice-welcome-notice').getBoundingClientRect();
        const nav = document.querySelector('.app-nav').getBoundingClientRect();
        const tabs = [...document.querySelectorAll('.app-tab')].filter(t => t.offsetParent);
        const tabsFree = tabs.every(t => {
          const r = t.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return t.contains(hit);
        });
        const navAtBottom = nav.top > window.innerHeight / 2;
        return { w: bubble.width, h: bubble.height, boxW: box.width, boxH: box.height,
          aboveNav: !navAtBottom || bubble.bottom <= nav.top, tabsFree, inView: bubble.right <= window.innerWidth && bubble.bottom <= window.innerHeight };
      });
      assert.ok(layout.w <= 48 && layout.h <= 48, `bubble is small (${layout.w}×${layout.h})`);
      assert.ok(layout.boxW <= 60 && layout.boxH <= 60, 'closed notice takes no more room than the bubble');
      assert.ok(layout.aboveNav, 'bubble does not cover the tab bar');
      assert.ok(layout.inView, 'bubble is on screen');
      assert.ok(layout.tabsFree, 'every tab can still be clicked');
      await page.click('#voice-notice-toggle');
      assert.equal((await readVoice(page)).open, true, 'tap opens the card');
      assert.match(await page.locator('#voice-notice-panel').innerText(), /alertes vocales/i, 'card is translated');
      await page.click('#voice-notice-toggle');
      assert.equal((await readVoice(page)).open, false, 'second tap makes it small again');
      await page.click('#voice-notice-toggle');
      await page.click('#voice-disable-btn');
      voice = await readVoice(page);
      assert.equal(voice.notice, false);
      assert.equal(voice.checkbox, false);
      assert.equal(voice.stored, 'false');
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(500);
      voice = await readVoice(page);
      assert.equal(voice.notice, false, 'notice does not come back');
      assert.equal(voice.checkbox, false, 'choice is kept');
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      await context.close();
    }
  });
}

test('user who turned voice alerts off keeps them off and sees no notice', async () => {
  const { page, context, errors } = await openApp(browser, server.url, {
    storage: { 'adhd-calendar-voice-enabled': 'false', 'adhd-calendar-voice-early': '0' },
  });
  try {
    const voice = await readVoice(page);
    assert.equal(voice.notice, false);
    assert.equal(voice.checkbox, false);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
