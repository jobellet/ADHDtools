// Browser tests: Settings → App updates (features/settings/update-check.js).
// The website never shows it nor asks GitHub; a desktop app (faked with window.__TAURI__ and a
// build-info.json stamp) asks GitHub only after a click, or a minute after opening with the daily check on.
// Run: npm run test:ui   (see tests/AGENTS.md)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openApp } from './harness.js';

const TIME = '2026-11-04T10:00:00';
const BUILD = { commit: 'a'.repeat(40), date: '2026-10-31T07:00:00+01:00', app: 'desktop' };
const MAIN = { sha: 'b'.repeat(40), commit: { committer: { date: '2026-11-03T10:00:00Z' } } };
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

const fakeDesktop = () => {
  window.__TAURI__ = { core: { invoke: async () => null }, event: { listen: async () => () => {} } };
};

// Routes: the build stamp next to index.html, and a fake GitHub API that counts the requests.
function nativeRoutes(github, latest = MAIN) {
  return [
    [url => url.pathname.endsWith('/build-info.json'), route => route.fulfill({ json: BUILD })],
    [url => url.hostname === 'api.github.com', route => {
      const href = route.request().url();
      github.push(href);
      if (href.includes('/compare/')) return route.fulfill({ json: { status: 'behind', ahead_by: 3, behind_by: 0 } });
      return route.fulfill({ json: [latest] });
    }],
  ];
}

const openSettings = async page => {
  await page.evaluate(() => window.switchTool('settings'));
  await page.waitForTimeout(100);
};

const panelState = page => page.evaluate(() => {
  const panel = document.getElementById('settings-updates-panel');
  return {
    hidden: !panel || panel.hidden || getComputedStyle(panel).display === 'none',
    buttonVisible: Boolean(document.getElementById('update-check-btn')?.offsetParent),
    stampFetched: performance.getEntriesByType('resource').some(e => e.name.includes('build-info.json')),
    pageWidth: document.documentElement.scrollWidth,
    windowWidth: window.innerWidth,
  };
});

for (const device of ['phone', 'desktop']) {
  test(`website: no App updates panel, no stamp fetched, nothing sent (${device})`, async () => {
    const { page, context, errors, external } = await openApp(browser, server.url, {
      device, time: TIME, storage: { 'adhd-tools-config': { showAllOptions: true } },
    });
    try {
      await openSettings(page);
      const state = await panelState(page);
      assert.ok(state.hidden, 'panel is hidden on the website, even with "Show all options"');
      assert.equal(state.buttonVisible, false);
      assert.equal(state.stampFetched, false, 'build-info.json must not be fetched on the website');
      await page.clock.runFor(2 * 60 * 1000);
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });

  test(`desktop app: Check for updates shows the new version and how to update (${device})`, async () => {
    const github = [];
    const { page, context, errors, external } = await openApp(browser, server.url, {
      device, time: TIME, init: fakeDesktop, routes: nativeRoutes(github),
    });
    try {
      assert.deepEqual(github, [], 'no GitHub request while loading');
      await openSettings(page);
      await page.click('#settings-updates-panel summary');
      const state = await panelState(page);
      assert.equal(state.hidden, false);
      assert.ok(state.buttonVisible);
      assert.match(await page.textContent('#update-build-line'), /aaaaaaa/);
      assert.deepEqual(github, [], 'opening Settings asks nothing');

      await page.click('#update-check-btn');
      await page.waitForSelector('#update-check-result[data-status="update"]');
      const text = await page.textContent('#update-check-result');
      assert.match(text, /3 changes/);
      assert.match(text, /git pull/);
      assert.match(text, /npm run desktop:install/);
      assert.equal(github.length, 2, 'latest commit + compare');
      const after = await panelState(page);
      assert.ok(after.pageWidth <= after.windowWidth + 1, 'page scrolls sideways');
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
}

test('desktop app: up to date, in French', async () => {
  const github = [];
  const { page, context, errors } = await openApp(browser, server.url, {
    time: TIME, init: fakeDesktop, routes: nativeRoutes(github, { ...MAIN, sha: BUILD.commit }),
    storage: { 'adhd-lang': 'fr' },
  });
  try {
    await openSettings(page);
    await page.click('#settings-updates-panel summary');
    await page.click('#update-check-btn');
    await page.waitForSelector('#update-check-result[data-status="current"]');
    assert.match(await page.textContent('#update-check-result'), /à jour/);
    assert.equal(github.length, 1);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('desktop app: the daily check waits a minute after opening, then tells the user', async () => {
  const github = [];
  const { page, context, errors } = await openApp(browser, server.url, {
    time: TIME, init: fakeDesktop, routes: nativeRoutes(github),
    storage: { 'adhd-update-check': { daily: true, lastCheck: 0 } },
  });
  try {
    assert.deepEqual(github, [], 'no GitHub request while loading');
    await page.clock.runFor(30 * 1000);
    assert.deepEqual(github, [], 'still nothing after 30 s');
    await page.clock.runFor(40 * 1000);
    await page.waitForSelector('#update-check-result[data-status="update"]', { state: 'attached' });
    assert.equal(github.length, 2);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('adhd-update-check')));
    assert.ok(saved.daily && saved.lastCheck > 0, 'remembers the check, so the next one is a day later');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
