// check.js — "npm run mcp:check": tests the whole chain, step by step, and prints the fix link
// for the first thing that fails. Node → Google sign-in → Drive backup → the tools → the AI
// app's config file → starting the server exactly like the AI app does → the AI app's log.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, help } from './store.js';

const SERVER = fileURLToPath(new URL('./server.js', import.meta.url));
let failed = 0;
const ok = msg => console.log(`  ✓ ${msg}`);
const warn = (msg, anchor) => console.log(`  ! ${msg}${anchor ? `\n    ${help(anchor)}` : ''}`);
const bad = (msg, anchor) => { failed += 1; console.log(`  ✗ ${msg}${anchor ? `\n    ${help(anchor)}` : ''}`); };

// Where desktop AI apps keep their MCP config (Claude Desktop; others use the same "mcpServers" shape).
export function clientConfigs(env = process.env, platform = process.platform) {
  const home = env.HOME || homedir();
  const claude = platform === 'darwin'
    ? join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    : platform === 'win32'
      ? join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
      : join(env.XDG_CONFIG_HOME || join(home, '.config'), 'Claude', 'claude_desktop_config.json');
  const logs = platform === 'darwin' ? join(home, 'Library', 'Logs', 'Claude')
    : platform === 'win32' ? join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'Claude', 'logs')
      : join(env.XDG_CONFIG_HOME || join(home, '.config'), 'Claude', 'logs');
  return [{ app: 'Claude Desktop', config: claude, logs }];
}

// Start the server like the AI app does and ask for its tools.
function tryStart(command, args, env) {
  return new Promise(resolve => {
    let out = '';
    let err = '';
    let child;
    try {
      child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ error: e.message });
      return;
    }
    const timer = setTimeout(() => { child.kill(); resolve({ error: `no answer after 15 s. ${err.slice(-300)}` }); }, 15_000);
    child.on('error', e => { clearTimeout(timer); resolve({ error: e.message }); });
    child.stderr.on('data', d => { err += d; });
    child.stdout.on('data', d => {
      out += d;
      const line = out.split('\n').find(l => l.includes('"id":2'));
      if (!line) return;
      clearTimeout(timer);
      child.kill();
      try { resolve({ tools: JSON.parse(line).result.tools.map(t => t.name) }); } catch { resolve({ error: `unexpected answer: ${line.slice(0, 200)}` }); }
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check', version: '1' } } })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
  });
}

export async function runCheck(env = process.env) {
  console.log('ADHD Tools MCP — checking your setup\n');

  console.log('1. Node.js');
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) ok(`Node ${process.versions.node}`);
  else bad(`Node ${process.versions.node} is too old (18 or newer needed)`, 'node-version');

  console.log('\n2. Google Drive');
  let store = null;
  try {
    store = await createStore(env);
    ok(`signed in (${store.describe()})`);
  } catch (err) {
    bad(err.message.replace(/\s*Fix: \S+/, ''), 'not-connected');
  }
  if (store) {
    try {
      const { callTool } = await import('./tools.js');
      const { result, error } = await callTool(store, 'get_overview', {});
      if (error) throw new Error(error);
      if (!result.lastAppBackup) warn('no app backup found yet: back up once in the app', 'no-backup');
      else {
        const hours = Math.round((Date.now() - Date.parse(result.lastAppBackup)) / 36e5);
        ok(`app backup found, made ${hours <= 1 ? 'within the last hour' : `${hours} hours ago`}`);
        if (hours > 48) warn('the backup is old: open the app and tap Back up now', 'assistant-sees-old-data');
      }
      ok(`today: ${result.counts.scheduledToday} planned items, ${result.counts.pending} pending tasks, ${result.upcoming.length} upcoming events/fixed tasks`);
      if (result.waitingForApp.length) warn(`${result.waitingForApp.length} change(s) wait for the app: open it`, 'changes-not-showing');
    } catch (err) {
      bad(err.message.replace(/\s*Fix: \S+/, ''), /sign-in|invalid_grant/i.test(err.message) ? 'invalid-grant' : 'drive-error');
    }
  }

  console.log('\n3. Your AI app');
  let found = false;
  for (const { app, config, logs } of clientConfigs(env)) {
    if (!existsSync(config)) continue;
    let servers = {};
    try {
      servers = JSON.parse(readFileSync(config, 'utf8')).mcpServers || {};
    } catch (err) {
      bad(`${app}: the config file is not valid JSON (${err.message})\n    ${config}`, 'server-not-listed');
      continue;
    }
    const entry = Object.entries(servers).find(([, s]) => (s.args || []).some(a => String(a).endsWith('server.js') && String(a).includes('mcp')));
    if (!entry) { warn(`${app}: no ADHD Tools server in ${config}`, 'server-not-listed'); continue; }
    found = true;
    const [name, server] = entry;
    ok(`${app}: server "${name}" found in the config`);
    if (/npm/.test(server.command || '')) bad('the command is npm: use node instead', 'npm-in-config');
    else if (server.command?.includes('/') && !existsSync(server.command)) bad(`"${server.command}" does not exist (node moved or updated?)`, 'server-not-listed');
    const script = (server.args || []).find(a => String(a).endsWith('server.js'));
    if (!existsSync(script)) bad(`"${script}" does not exist`, 'server-not-listed');
    else if (script !== SERVER) warn(`the config starts ${script}, not this copy (${SERVER}): make sure that copy is up to date (git pull)`);
    const started = await tryStart(server.command, server.args || [], server.env || {});
    if (started.error) bad(`${app} can't start the server: ${started.error}`, 'server-not-listed');
    else ok(`${app} can start the server: ${started.tools.length} tools (${started.tools.slice(0, 3).join(', ')}, …)`);
    const log = join(logs, `mcp-server-${name}.log`);
    if (existsSync(log)) {
      const lines = readFileSync(log, 'utf8').trim().split('\n').slice(-8);
      console.log(`    last lines of ${app}'s log (${log}):`);
      lines.forEach(l => console.log(`      ${l.slice(0, 180)}`));
    }
  }
  if (!found) warn('no desktop AI app config with this server found (fine if you use another app)', 'server-not-listed');

  console.log(failed
    ? `\n${failed} problem(s) found. Follow the "Fix:" link under each ✗.`
    : '\nAll good. In your AI app: quit it completely, open it again, start a new TEXT chat (not voice),\nand ask: "Use the adhd-tools tool get_overview."');
  if (!failed) console.log(`If the AI still can't use the tools:\n  ${help('ai-cant-see-tools')}`);
  return failed;
}
