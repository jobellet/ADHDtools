// End to end: the AI assistant (MCP server) queues changes on "Google Drive"; the real app picks
// them up, applies them without double-booking, and backs up so the assistant sees the result.
// Google Drive is faked in the page (Playwright routes) and in the MCP server (a local folder).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launch, openApp, sampleDay } from './harness.js';

const DAY = '2026-09-26';
const NOW = new Date(`${DAY}T12:00:00`);
let server;
let browser;
let dir;
let mcp;
let store;

before(async () => {
  server = await startServer();
  browser = await launch();
  dir = mkdtempSync(join(tmpdir(), 'adhd-mcp-ui-'));
  mcp = await import('../../mcp/tools.js');
  store = (await import('../../mcp/store.js')).createFileStore(dir);
});
after(async () => {
  await browser?.close();
  server?.stop();
  rmSync(dir, { recursive: true, force: true });
});

// Let fake time and real network both move on until `check` is true in the page.
async function until(page, check, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    await page.clock.runFor(250);
    if (await page.evaluate(check)) return;
    await new Promise(r => setTimeout(r, 50));
  }
}

// A fake Drive app folder for the page: serves the inbox, keeps what the app uploads.
function fakeDrive(files) {
  const uploads = [];
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const handler = async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/drive/v3/files' && req.method() === 'GET') {
      const name = /name = '([^']+)'/.exec(url.searchParams.get('q') || '')?.[1];
      return json(route, { files: name in files ? [{ id: name, name, modifiedTime: new Date().toISOString() }] : [] });
    }
    const id = decodeURIComponent(url.pathname.split('/').pop());
    if (url.pathname.startsWith('/drive/v3/files/') && req.method() === 'GET') return json(route, files[id]);
    if (url.pathname.startsWith('/upload/drive/v3/files')) {
      const body = req.postData() || '';
      const payload = req.method() === 'PATCH' ? body : body.split('\r\n\r\n').slice(2).join('\r\n\r\n').replace(/\r\n--[^\r\n]+--$/, '');
      const data = JSON.parse(payload);
      files['adhd-tools-hub-backup.json'] = data;
      uploads.push(data);
      return json(route, { id: 'adhd-tools-hub-backup.json' });
    }
    return route.abort();
  };
  return { uploads, routes: [[/^https:\/\/www\.googleapis\.com\//, handler]] };
}

test('assistant changes reach the planner, never on top of something else, and come back to the assistant', async () => {
  // 1. The assistant sees the last backup (the app pushed it earlier) and queues changes.
  const seed = sampleDay(DAY);
  const backup = { ...seed, metadata: { app: 'ADHD Tools Hub', exportedAt: NOW.toISOString() } };
  writeFileSync(join(dir, 'adhd-tools-hub-backup.json'), JSON.stringify(backup));
  const call = async (name, args) => {
    const out = await mcp.callTool(store, name, args, NOW);
    assert.equal(out.error, undefined, `${name}: ${out.error}`);
    return out.result;
  };
  await call('add_task', { name: 'Call the bank', minutes: 15, start: `${DAY}T13:30` });
  const split = await call('break_down_task', { id: 'flex1', steps: [{ name: 'Write the list', minutes: 10 }, { name: 'Go to the shop', minutes: 40 }] });
  const inbox = JSON.parse(readFileSync(join(dir, 'adhd-tools-assistant-inbox.json'), 'utf8'));
  assert.equal(inbox.ops.length, 2);

  // 2. Meanwhile the user booked 13:30–14:30 in the app (the assistant could not know).
  const storage = {
    ...seed,
    'adhd-unified-tasks': [...seed['adhd-unified-tasks'], { hash: 'dentist', id: 'dentist', user: 'main', name: 'Dentist', plannerDate: `${DAY}T13:30`, durationMinutes: 60, isFixed: true, deadline: null }],
    gcalClientId: 'test-client.apps.googleusercontent.com',
  };
  const drive = fakeDrive({ 'adhd-tools-assistant-inbox.json': inbox });
  const session = { 'google-token:https://www.googleapis.com/auth/drive.appdata': { token: 'fake', expiresAt: NOW.getTime() + 3600_000 } };
  const { page, context, errors } = await openApp(browser, server.url, { device: 'phone', time: NOW.toISOString(), storage, session, routes: drive.routes });
  try {
    // The app checks the inbox 1.5 s after start; Drive answers arrive in real time.
    await until(page, () => window.TaskStore.getAllTasks().some(t => t.name === 'Call the bank')
      && JSON.parse(localStorage.getItem('driveLastBackupAt') || '0') > 0);
    await page.evaluate(() => window.switchTool('planner'));
    await page.clock.runFor(300);

    // 3. Applied through TaskStore: the call moved after the dentist, the big task split.
    const tasks = await page.evaluate(() => window.TaskStore.getAllTasks());
    const bank = tasks.find(t => t.name === 'Call the bank');
    assert.ok(bank, 'the new task is in the app');
    assert.equal(bank.plannerDate, `${DAY}T14:30`, 'moved to the next free time, not on top of the dentist');
    const archived = await page.evaluate(() => window.TaskStore.getArchivedTasks().map(t => [t.hash, t.archivedReason]));
    assert.deepEqual(archived, [['flex1', 'split']]);
    const steps = split.stepIds.map(id => tasks.find(t => t.hash === id));
    assert.deepEqual(steps.map(s => s?.name), ['Write the list', 'Go to the shop']);
    assert.equal(steps[1].dependency, steps[0].hash);

    const drawn = await page.$$eval('#time-blocks .timeline-lane .event', els => els.map(e => e.dataset.title));
    assert.ok(drawn.includes('Call the bank') && drawn.includes('Write the list'), `planner shows: ${drawn.join(', ')}`);
    assert.ok(!drawn.includes('Groceries'), 'the split task is gone from the day');

    // Applied once only, even when the app checks again.
    await page.evaluate(() => window.AssistantInbox.check());
    const count = await page.evaluate(() => window.TaskStore.getAllTasks().filter(t => t.name === 'Call the bank').length);
    assert.equal(count, 1);

    // 4. The app backed up; the assistant now sees everything applied and nothing waiting.
    assert.ok(drive.uploads.length >= 1, 'the app backed up after applying');
    const last = drive.uploads.at(-1);
    assert.deepEqual(last['adhd-assistant-applied'].map(x => x.id).sort(), inbox.ops.map(o => o.id).sort());
    writeFileSync(join(dir, 'adhd-tools-hub-backup.json'), JSON.stringify(last));
    const overview = await call('get_overview', {});
    assert.deepEqual(overview.waitingForApp, []);
    assert.deepEqual(overview.appliedByApp.map(x => x.ok), [true, true]);
    assert.match(overview.appliedByApp[0].result, /moved to 14:30/, 'the assistant learns the time was moved');
    const list = await call('list_tasks', { search: 'bank' });
    assert.equal(list.tasks[0].start, `${DAY}T14:30`);
    assert.ok(!JSON.stringify(last).includes('apiKey'), 'no secrets in the backup');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
