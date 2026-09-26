#!/usr/bin/env node
// ADHD Tools Hub — MCP server. Lets an AI assistant (Mistral, Claude, any MCP client) read your
// day and add/plan/split tasks. Data goes through your own Google Drive; no server of ours.
//
//   node mcp/server.js            stdio transport (desktop AI apps start it themselves)
//   node mcp/server.js http       HTTP transport for web AI apps (needs ADHD_MCP_TOKEN)
//   node mcp/server.js auth       one-time Google sign-in (saves a refresh token locally)
//
// Setup guide: docs/mcp.md. Only JSON-RPC goes to stdout; logs go to stderr.
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createStore } from './store.js';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const log = (...args) => console.error('[adhd-tools-mcp]', ...args);

if (process.env.ADHD_TZ) process.env.TZ = process.env.ADHD_TZ; // the user's time zone, if the server runs elsewhere

export const INSTRUCTIONS = `You help a person with ADHD plan their day in the ADHD Tools Hub app.
- Call get_overview first: it gives today's date, the time now and what is waiting.
- Keep mental load low: few questions, short answers, one next step.
- Big or vague tasks: use break_down_task with steps of 15–30 minutes, in the order they are done.
- Only give a fixed time ("start") when the user asks for a time. Otherwise leave it out: the app places tasks in free time by importance and urgency.
- Nothing may be booked on top of something else. If a time is taken, the tool says so and gives the next free time: offer it.
- A start time is not a deadline. Only set "deadline" for real due dates.
- Ask before delete_task.
- Your changes appear in the app after it syncs (when it is open, within about 2 minutes).`;

let toolsModule = null;
const tools = async () => (toolsModule ||= await import('./tools.js'));

// ---- JSON-RPC ----------------------------------------------------------------------------
export async function handle(message, store) {
  const { id, method, params = {} } = message || {};
  const isNotification = id === undefined || id === null;
  const reply = result => (isNotification ? null : { jsonrpc: '2.0', id, result });
  const fail = (code, msg) => (isNotification ? null : { jsonrpc: '2.0', id, error: { code, message: msg } });

  if (!message || message.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid request');
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'adhd-tools', title: 'ADHD Tools Hub', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: (await tools()).listTools() });
    case 'tools/call': {
      try {
        const out = await (await tools()).callTool(await store(), params.name, params.arguments || {});
        if (out.error) return reply({ content: [{ type: 'text', text: out.error }], isError: true });
        return reply({ content: [{ type: 'text', text: JSON.stringify(out.result, null, 2) }], isError: false });
      } catch (err) {
        log('tool failed:', err.message);
        return reply({ content: [{ type: 'text', text: `Could not reach your data: ${err.message}` }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

async function handleBody(body, store) {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => handle(m, store)))).filter(Boolean);
    return out.length ? out : null;
  }
  return handle(body, store);
}

// The store is made on first use, so the client can connect (and list tools) before sign-in.
function lazyStore() {
  let made = null;
  return () => (made ||= createStore().catch(err => { made = null; throw err; }));
}

// ---- stdio ---------------------------------------------------------------------------------
function runStdio() {
  const store = lazyStore();
  const rl = createInterface({ input: process.stdin });
  const inFlight = new Set();
  rl.on('line', line => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      return;
    }
    const job = handleBody(msg, store)
      .then(out => { if (out) process.stdout.write(`${JSON.stringify(out)}\n`); })
      .catch(err => log('failed:', err.message))
      .finally(() => inFlight.delete(job));
    inFlight.add(job);
  });
  // Client closed stdin: finish the answers still running, then stop.
  rl.on('close', () => Promise.allSettled([...inFlight]).then(() => process.exit(0)));
  log('ready (stdio)');
}

// ---- HTTP (Streamable HTTP, JSON responses, stateless) ------------------------------------
function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createHttpServer({ token, store = lazyStore() }) {
  if (!token || token.length < 24) throw new Error('Set ADHD_MCP_TOKEN to a long random secret (24+ characters), e.g. `openssl rand -hex 24`.');
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
    const pathToken = url.pathname.startsWith('/mcp/') ? url.pathname.slice(5) : null;
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const allowed = (url.pathname === '/mcp' && sameSecret(bearer, token)) || (pathToken && sameSecret(pathToken, token));
    if (!allowed) { res.writeHead(url.pathname.startsWith('/mcp') ? 401 : 404).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1_000_000) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }
    const out = await handleBody(body, store);
    if (!out) { res.writeHead(202).end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
  });
}

// ---- entry ---------------------------------------------------------------------------------
const isMain = Boolean(process.argv[1]) && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const command = process.argv[2] || 'stdio';
  if (command === 'auth') {
    const { runAuth } = await import('./auth.js');
    await runAuth(process.argv.slice(3));
  } else if (command === 'http') {
    const port = Number(process.env.PORT || 8787);
    const host = process.env.HOST || '127.0.0.1';
    try {
      createHttpServer({ token: process.env.ADHD_MCP_TOKEN }).listen(port, host, () => log(`ready on http://${host}:${port}/mcp`));
    } catch (err) {
      console.error(err.message);
      process.exit(2);
    }
  } else if (command === 'stdio') {
    runStdio();
  } else {
    console.error('Usage: node mcp/server.js [stdio|http|auth]');
    process.exit(2);
  }
}
