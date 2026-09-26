// mcp/: the MCP server speaks the protocol, reads the app backup and writes only the inbox.
// Uses a local folder instead of Google Drive (ADHD_MCP_DATA_DIR). See mcp/AGENTS.md.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const SERVER = new URL('../mcp/server.js', import.meta.url).pathname;
const today = new Date();
const pad = n => String(n).padStart(2, '0');
const DAY = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

function writeBackup(dir, extra = {}) {
  const backup = {
    'adhd-unified-tasks': [
      { hash: 'big', id: 'big', user: 'main', name: 'Tax report', durationMinutes: 120, importance: 8, urgency: 6, deadline: '2099-01-01' },
      { hash: 'gone', id: 'gone', user: 'main', name: 'Deleted one', durationMinutes: 10 },
    ],
    'adhd-deleted-tasks': [{ id: 'gone', deletedAt: '2026-01-01T00:00:00Z' }],
    'adhd-tool-routines': [{ id: 'r1', name: 'Morning routine', startTime: '07:00', weekDays: [0, 1, 2, 3, 4, 5, 6],
      tasks: [{ name: 'Shower', duration: 20 }, { name: 'Breakfast', duration: 10 }] }],
    'adhd-calendar-events': [{ id: 'e1', title: 'Lab meeting', start: `${DAY}T23:00`, end: `${DAY}T23:30`, isFixed: true }],
    'adhd-ai-settings': { apiKey: 'secret' },
    metadata: { app: 'ADHD Tools Hub', exportedAt: new Date().toISOString() },
    ...extra,
  };
  writeFileSync(join(dir, 'adhd-tools-hub-backup.json'), JSON.stringify(backup));
  return backup;
}

// Talk to the server over stdio.
function startServer(env) {
  const child = spawn(process.execPath, [SERVER], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map();
  const extraLines = [];
  createInterface({ input: child.stdout }).on('line', line => {
    const msg = JSON.parse(line);
    if (waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } else extraLines.push(msg);
  });
  let next = 1;
  const request = (method, params) => new Promise(resolve => {
    const id = next++;
    waiting.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  const call = async (name, args = {}) => {
    const { result } = await request('tools/call', { name, arguments: args });
    return { isError: result.isError, text: result.content[0].text, data: result.isError ? null : JSON.parse(result.content[0].text) };
  };
  return { child, request, call, extraLines, stop: () => child.kill() };
}

describe('MCP server (stdio, local folder)', () => {
  let dir;
  let server;
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'adhd-mcp-'));
    writeBackup(dir);
    server = startServer({ ADHD_MCP_DATA_DIR: dir });
  });
  after(() => {
    server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  test('initialize, notifications and ping follow the protocol', async () => {
    const init = await server.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.ok(init.result.capabilities.tools);
    assert.match(init.result.instructions, /get_overview/);
    server.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    assert.deepEqual((await server.request('ping')).result, {});
    assert.equal((await server.request('nope/nothing')).error.code, -32601);
    assert.deepEqual(server.extraLines, [], 'notifications get no answer');
  });

  test('tools/list gives valid tools', async () => {
    const { result } = await server.request('tools/list');
    const names = result.tools.map(t => t.name);
    for (const name of ['get_overview', 'list_tasks', 'get_schedule', 'find_free_slots', 'list_routines',
      'add_task', 'update_task', 'schedule_task', 'complete_task', 'delete_task', 'break_down_task']) {
      assert.ok(names.includes(name), name);
    }
    result.tools.forEach(t => {
      assert.match(t.name, /^[a-z_]+$/);
      assert.equal(t.inputSchema.type, 'object');
      assert.ok(t.description.length > 20);
    });
  });

  test('reads the backup: tasks, routines, schedule; hides deleted tasks and secrets', async () => {
    const overview = await server.call('get_overview');
    assert.equal(overview.isError, false);
    assert.equal(overview.data.counts.pending, 1);
    const tasks = await server.call('list_tasks', { filter: 'all' });
    assert.deepEqual(tasks.data.tasks.map(t => t.id), ['big']);
    const routines = await server.call('list_routines');
    assert.equal(routines.data.routines[0].bookedMinutes, 33, 'routine books steps + 10 %');
    const day = await server.call('get_schedule', { date: DAY });
    assert.ok(day.data.items.some(i => i.name === 'Morning routine' && i.start === '07:00' && i.end === '07:33'));
    assert.doesNotMatch(JSON.stringify([overview, tasks, routines, day]), /secret/);
  });

  test('writes go to the inbox only, never to the backup', async () => {
    const before = readFileSync(join(dir, 'adhd-tools-hub-backup.json'), 'utf8');
    const added = await server.call('add_task', { name: 'Buy milk', minutes: 15 });
    assert.equal(added.isError, false, added.text);
    const split = await server.call('break_down_task', { id: 'big', steps: [{ name: 'Collect receipts', minutes: 20 }, { name: 'Fill form', minutes: 30 }] });
    assert.equal(split.isError, false, split.text);
    assert.equal(readFileSync(join(dir, 'adhd-tools-hub-backup.json'), 'utf8'), before);
    const inbox = JSON.parse(readFileSync(join(dir, 'adhd-tools-assistant-inbox.json'), 'utf8'));
    assert.deepEqual(inbox.ops.map(o => o.tool), ['add_task', 'break_down_task']);
    // The AI sees its own waiting changes.
    const overview = await server.call('get_overview');
    assert.equal(overview.data.waitingForApp.length, 2);
    const tasks = await server.call('list_tasks');
    assert.ok(tasks.data.tasks.some(t => t.name === 'Buy milk'));
    assert.ok(!tasks.data.tasks.some(t => t.id === 'big'), 'the split task is archived');
  });

  test('a busy time is refused with the next free time', async () => {
    const r = await server.call('add_task', { name: 'Call bank', minutes: 15, start: `${DAY}T07:10` });
    assert.equal(r.isError, true);
    assert.match(r.text, /Morning routine/);
    assert.match(r.text, /07:35/);
  });

  test('bad input and unknown tools are errors, not crashes', async () => {
    assert.match((await server.call('add_task', { minutes: 5 })).text, /name is required/);
    assert.match((await server.call('update_task', { id: 'nope', name: 'x' })).text, /No task/);
    assert.match((await server.call('rm_rf')).text, /Unknown tool/);
  });

  test('ops the app already applied leave the inbox', async () => {
    const inbox = JSON.parse(readFileSync(join(dir, 'adhd-tools-assistant-inbox.json'), 'utf8'));
    writeBackup(dir, { 'adhd-assistant-applied': inbox.ops.map(o => ({ id: o.id, ok: true })) });
    await server.call('add_task', { name: 'Water plants', minutes: 5 });
    const after = JSON.parse(readFileSync(join(dir, 'adhd-tools-assistant-inbox.json'), 'utf8'));
    assert.deepEqual(after.ops.map(o => o.input.name), ['Water plants']);
  });
});

describe('MCP server without Google sign-in', () => {
  test('lists tools and explains how to connect instead of crashing', async () => {
    const home = mkdtempSync(join(tmpdir(), 'adhd-mcp-home-'));
    const server = startServer({ ADHD_MCP_DATA_DIR: '', ADHD_MCP_CREDENTIALS: join(home, 'none.json'), GOOGLE_REFRESH_TOKEN: '' });
    try {
      assert.ok((await server.request('tools/list')).result.tools.length > 5);
      const r = await server.call('get_overview');
      assert.equal(r.isError, true);
      assert.match(r.text, /mcp:auth/);
      assert.ok(!existsSync(join(home, 'none.json')));
    } finally {
      server.stop();
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('MCP server over HTTP', () => {
  test('needs the secret token; answers JSON-RPC', async () => {
    const { createHttpServer } = await import('../mcp/server.js');
    assert.throws(() => createHttpServer({ token: 'short' }), /ADHD_MCP_TOKEN/);
    const token = 'x'.repeat(32);
    const http = createHttpServer({ token, store: async () => { throw new Error('no store in this test'); } });
    await new Promise(r => http.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${http.address().port}`;
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    try {
      assert.equal((await fetch(`${base}/mcp`, { method: 'POST', body })).status, 401);
      assert.equal((await fetch(`${base}/mcp/wrong`, { method: 'POST', body })).status, 401);
      const ok = await fetch(`${base}/mcp`, { method: 'POST', body, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      assert.equal(ok.status, 200);
      assert.ok((await ok.json()).result.tools.length > 5);
      const viaPath = await fetch(`${base}/mcp/${token}`, { method: 'POST', body });
      assert.equal(viaPath.status, 200);
      const note = await fetch(`${base}/mcp/${token}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
      assert.equal(note.status, 202);
      assert.equal((await fetch(`${base}/mcp/${token}`)).status, 405);
    } finally {
      http.close();
    }
  });
});
