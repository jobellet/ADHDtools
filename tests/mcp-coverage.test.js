// Keeps the MCP server (mcp/) in step with the app. When someone adds a TaskStore method,
// a scheduler function, a task field, a storage key, a global or an assistant op, this test
// fails until mcp/coverage.js says how the AI assistant handles it (a tool, or "no: why").
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const mem = new Map();
global.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };

const coverage = await import('../mcp/coverage.js');
const { default: TaskStore } = await import('../core/task-store.js');
const { default: UnifiedScheduler } = await import('../core/scheduler.js');
const { createTask } = await import('../core/task-model.js');
const { OPS, makeOp, planOp } = await import('../core/assistant-ops.js');
const { READ_TOOLS } = await import('../mcp/tools.js');

const TOOLS = new Set([...Object.keys(READ_TOOLS), ...Object.keys(OPS)]);
const HOW = 'Add it to mcp/coverage.js: "tool:<name>" if the assistant can use it, else "no: <reason>". See mcp/AGENTS.md.';

function checkValues(table, allowed) {
  const bad = Object.entries(table).filter(([, v]) => {
    if (allowed.includes(v)) return false;
    if (v.startsWith('tool:')) return !TOOLS.has(v.slice(5));
    return !/^no: \S+ \S+ \S+/.test(v);
  });
  assert.deepEqual(bad, [], 'values must be a real "tool:<name>", or "no: <reason of 3+ words>"');
}

function sameKeys(actual, listed, what) {
  const missing = actual.filter(k => !(k in listed));
  const stale = Object.keys(listed).filter(k => !actual.includes(k));
  assert.deepEqual(missing, [], `new ${what} not covered by the MCP server. ${HOW}`);
  assert.deepEqual(stale, [], `${what} listed in mcp/coverage.js no longer exist: remove them`);
}

// One realistic input per op; a new op needs one here (and so a decision on its fields).
const parent = { hash: 'p1', id: 'p1', name: 'Big', durationMinutes: 120, importance: 5, urgency: 5, deadline: '2099-01-01', user: 'main' };
const SAMPLES = {
  add_task: { name: 'A', minutes: 15, importance: 5, urgency: 5, deadline: '2099-01-01', start: '2099-01-01T10:00', notes: 'n', location: 'l' },
  update_task: { id: 'p1', name: 'B', minutes: 20, importance: 6, urgency: 6, deadline: null, start: '2099-01-01T11:00', notes: 'n', location: 'l' },
  schedule_task: { id: 'p1', start: '2099-01-01T12:00' },
  complete_task: { id: 'p1' },
  delete_task: { id: 'p1' },
  break_down_task: { id: 'p1', steps: [{ name: 'a', minutes: 15 }, { name: 'b', minutes: 15 }] },
};

describe('MCP coverage (mcp/coverage.js)', () => {
  test('every TaskStore method is covered', () => {
    sameKeys(Object.keys(TaskStore), coverage.taskStore, 'TaskStore methods');
    checkValues(coverage.taskStore, []);
  });

  test('every UnifiedScheduler function is covered', () => {
    sameKeys(Object.keys(UnifiedScheduler), coverage.scheduler, 'UnifiedScheduler functions');
    checkValues(coverage.scheduler, []);
  });

  test('every assistant op has a sample input here and its fields are covered', () => {
    assert.deepEqual(Object.keys(OPS).filter(k => !SAMPLES[k]), [], 'add a sample input for the new op to SAMPLES in this test');
    const ctx = { tasks: [parent], onConflict: 'refuse', findConflicts: () => [], findNextFreeSlot: () => 0 };
    const written = new Set();
    for (const [tool, input] of Object.entries(SAMPLES)) {
      const { op, error } = makeOp(tool, input);
      assert.equal(error, undefined, `${tool}: ${error}`);
      const plan = planOp(op, ctx);
      assert.equal(plan.error, undefined, `${tool}: ${plan.error}`);
      plan.effects.forEach(e => Object.keys(e.add || e.changes || {}).forEach(k => written.add(k)));
    }
    const fields = [...new Set([...Object.keys(createTask({ name: 'x' })), ...written])];
    const missing = fields.filter(k => !(k in coverage.taskFields));
    assert.deepEqual(missing, [], `new task fields: decide in mcp/coverage.js taskFields ("read", "write" or "no: …"). ${HOW}`);
    const stale = Object.keys(coverage.taskFields).filter(k => !fields.includes(k) && !read('mcp/tools.js').includes(`t.${k}`));
    assert.deepEqual(stale, [], 'task fields listed in mcp/coverage.js that nothing uses any more');
    checkValues(coverage.taskFields, ['read', 'write']);
  });

  test('every storage key the app uses is covered', () => {
    const walk = dir => readdirSync(join(ROOT, dir)).flatMap(n => (statSync(join(ROOT, dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
    const files = ['core', 'shell', 'services', 'features'].flatMap(walk).filter(f => f.endsWith('.js'));
    const keys = new Set();
    files.forEach(f => [...read(f).matchAll(/['"`](adhd-[a-z0-9-]+)['"`]/g)].forEach(m => keys.add(m[1])));
    ['core/assistant-ops.js'].forEach(f => [...read(f).matchAll(/APPLIED_KEY = '([^']+)'/g)].forEach(m => keys.add(m[1])));
    sameKeys([...keys], coverage.storageKeys, 'localStorage keys');
    checkValues(coverage.storageKeys, ['read']);
  });

  test('every global in AGENTS.md is covered', () => {
    const rows = [...read('AGENTS.md').matchAll(/^\| `(\w+)` \| `([^`]+)` \|/gm)].map(m => m[1]);
    sameKeys(rows, coverage.globals, 'globals (AGENTS.md table)');
    checkValues(coverage.globals, []);
  });

  test('every tool is documented and tested', () => {
    const guide = read('docs/mcp.md');
    const agents = read('mcp/AGENTS.md');
    const tests = read('tests/mcp.test.js') + read('tests/assistant-ops.test.js');
    for (const tool of TOOLS) {
      assert.ok(guide.includes(`\`${tool}\``), `docs/mcp.md: describe the tool \`${tool}\``);
      assert.ok(agents.includes(`\`${tool}\``), `mcp/AGENTS.md: list the tool \`${tool}\``);
      assert.ok(tests.includes(`'${tool}'`), `tests: call the tool '${tool}' at least once`);
    }
  });

  test('the MCP server and the app use the same Drive file names', async () => {
    const { BACKUP_FILENAME } = await import('../mcp/store.js');
    assert.ok(read('services/drive-sync.js').includes(`'${BACKUP_FILENAME}'`));
  });
});
