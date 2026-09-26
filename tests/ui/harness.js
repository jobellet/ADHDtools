// Browser test harness: serves the app like GitHub Pages and opens it in
// headless Chromium (Playwright). Used by tests/ui/*.test.js — see tests/AGENTS.md.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VIEWPORTS = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 900 },
};

// External hosts the page may contact while loading (icon font only).
const ALLOWED_EXTERNAL = [/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\//];

export async function startServer() {
  const port = 9100 + Math.floor(Math.random() * 800);
  const child = spawn(process.execPath, [join(ROOT, '.claude/static-server.cjs')], {
    cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
  });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return { url, stop: () => child.kill() };
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  child.kill();
  throw new Error('static server did not start');
}

export async function launch() {
  return chromium.launch();
}

// Open the app with seeded localStorage and a fixed clock.
// Returns { page, context, errors, external } — errors = page errors + console errors,
// external = requests to hosts other than the app (all are blocked).
// `session` seeds sessionStorage; `routes` = [[urlMatcher, handler]] answer outside requests
// (e.g. a fake Google Drive) instead of blocking them.
export async function openApp(browser, baseUrl, { device = 'desktop', path = '/', time, storage = {}, session = {}, routes = [] } = {}) {
  const { isMobile, hasTouch, ...viewport } = VIEWPORTS[device];
  const context = await browser.newContext({ viewport, isMobile: Boolean(isMobile), hasTouch: Boolean(hasTouch) });
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  await page.route(url => !url.href.startsWith(baseUrl), route => {
    const href = route.request().url();
    if (!ALLOWED_EXTERNAL.some(re => re.test(href))) external.push(href);
    return route.abort();
  });
  for (const [matcher, handler] of routes) await page.route(matcher, handler); // registered last = tried first
  if (time) await page.clock.install({ time: new Date(time) });
  await page.addInitScript(seed => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, storage);
  await page.addInitScript(seed => {
    Object.entries(seed).forEach(([k, v]) => sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, session);
  await page.goto(baseUrl + path, { waitUntil: 'load' });
  if (time) await page.clock.runFor(1500);
  else await page.waitForTimeout(800);
  return { page, context, errors, external };
}

// A realistic day: routine, fixed and auto-placed tasks, calendar events,
// an all-day event and the task copies the Calendar tool makes of events.
export function sampleDay(date = '2026-09-26') {
  return {
    'adhd-tool-routines': [{ id: 'r1', name: 'Morning routine', startTime: '07:00', weekDays: [0, 1, 2, 3, 4, 5, 6],
      tasks: [{ id: 's1', name: 'Shower', duration: 20 }, { id: 's2', name: 'Breakfast', duration: 10 }] }],
    'adhd-unified-tasks': [
      { hash: 'fix1', id: 'fix1', user: 'main', name: 'Dress the kids', plannerDate: `${date}T09:30`, durationMinutes: 25, isFixed: true },
      { hash: 'flex1', id: 'flex1', user: 'main', name: 'Groceries', durationMinutes: 60, importance: 6, urgency: 5 },
      { hash: 'flex2', id: 'flex2', user: 'main', name: 'Read a chapter', durationMinutes: 30, importance: 3, urgency: 3 },
      // Calendar tool copies: must never book time or appear as work
      { hash: 'calcopy1', id: 'calcopy1', user: 'main', name: 'Birthday', plannerDate: date, deadline: date, durationMinutes: 1440, isFixed: true, isCalendarEvent: true, isActionable: false, isAllDay: true },
      { hash: 'calcopy2', id: 'calcopy2', user: 'main', name: 'Lab meeting', plannerDate: `${date}T15:00`, durationMinutes: 60, isFixed: true, isCalendarEvent: true, isActionable: false },
    ],
    'adhd-calendar-events': [
      { id: 'e1', uid: 'e1', title: 'Lab meeting', start: `${date}T15:00`, end: `${date}T16:00`, isFixed: true, isCalendarEvent: true },
      { id: 'e2', uid: 'e2', title: 'Birthday', start: date, end: date, isAllDay: true, isCalendarEvent: true },
    ],
  };
}
