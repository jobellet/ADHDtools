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
      assert.match(await page.locator('#voice-welcome-notice').innerText(), /alertes vocales/i, 'notice is translated');
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
