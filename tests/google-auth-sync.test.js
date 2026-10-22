import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const googleAuthCode = readFileSync('services/google-auth.js', 'utf8');
const credsSyncCode = readFileSync('services/credentials-sync.js', 'utf8');
const calSettingsCode = readFileSync('features/calendar/calendar-settings.js', 'utf8');

function setupSandbox(isNative = true, mcpClient = null) {
  const store = new Map();
  const session = new Map();
  const listeners = new Map();
  const sandbox = {
    console: { error: () => {}, log: () => {}, warn: () => {} },
    setTimeout: (cb, t) => cb(),
    clearTimeout: () => {},
    Date,
    JSON,
    document: {
      addEventListener: (evt, fn) => {
        listeners.set(evt, fn);
      },
      getElementById: () => null,
      head: { appendChild: () => {} },
      createElement: () => ({ src: '', onload: () => {}, onerror: () => {} }),
    },
    EventTarget: class EventTarget {},
    CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } },
    addEventListener: (evt, fn) => {
      listeners.set(evt, fn);
    },
    dispatchEvent: () => {},
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      get length() { return store.size; },
      key: (i) => Array.from(store.keys())[i],
      _store: store,
    },
    sessionStorage: {
      getItem: (k) => session.get(k) || null,
      setItem: (k, v) => session.set(k, String(v)),
      removeItem: (k) => session.delete(k),
      get length() { return session.size; },
      key: (i) => Array.from(session.keys())[i],
    },
    crypto: {
      getRandomValues: (arr) => arr,
      subtle: {
        digest: async () => new Uint8Array(32),
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.window.AttentionService = {
    isNative: () => isNative,
    invokeNative: async (cmd) => {
      if (cmd === 'native_read_mcp_client') return mcpClient;
      if (cmd === 'native_oauth_listen') return 8422;
      return null;
    },
  };
  return sandbox;
}

describe('GoogleAuth & CredentialsSync', () => {
  it('falls back to mcpClient on native when localStorage is empty', async () => {
    const sandbox = setupSandbox(true, {
      clientId: '534266942252-test.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-testSecret',
    });
    runInNewContext(googleAuthCode, sandbox);

    // Trigger restoration listener
    sandbox.dispatchEvent(new sandbox.CustomEvent('nativeSecretsRestored'));

    // Wait microtask for async loadMcpClient
    await new Promise((r) => setImmediate(r));

    assert.equal(sandbox.window.GoogleAuth.getClientId(), '534266942252-test.apps.googleusercontent.com');
    assert.equal(sandbox.window.GoogleAuth.getClientSecret(), 'GOCSPX-testSecret');
  });

  it('prefers saved localStorage credentials when present', async () => {
    const sandbox = setupSandbox(true, {
      clientId: 'mcp-client-id.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-mcpSecret',
    });
    sandbox.localStorage.setItem('gcalClientId', 'saved-client-id.apps.googleusercontent.com');
    sandbox.localStorage.setItem('gcalClientSecret', 'GOCSPX-savedSecret');

    runInNewContext(googleAuthCode, sandbox);
    await new Promise((r) => setImmediate(r));

    assert.equal(sandbox.window.GoogleAuth.getClientId(), 'saved-client-id.apps.googleusercontent.com');
    assert.equal(sandbox.window.GoogleAuth.getClientSecret(), 'GOCSPX-savedSecret');
  });

  it('collectCredentials in CredentialsSync bundles GoogleAuth credentials when localStorage is empty', async () => {
    const sandbox = setupSandbox(true, {
      clientId: '534266942252-export.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-exportSecret',
    });
    runInNewContext(googleAuthCode, sandbox);
    await new Promise((r) => setImmediate(r));

    runInNewContext(credsSyncCode, sandbox);

    assert.ok(sandbox.window.CredentialsSync, 'CredentialsSync is defined');
    const creds = sandbox.window.CredentialsSync.collectCredentials();
    assert.equal(creds.gcalClientId, '534266942252-export.apps.googleusercontent.com');
    assert.equal(creds.gcalClientSecret, 'GOCSPX-exportSecret');
  });
});

describe('Calendar Settings UI & Smart Extraction', () => {
  it('extracts client ID and secret from raw JSON or markdown codeblock paste', () => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body><div id="gcal-settings-container"></div></body></html>
    `, { runScripts: 'dangerously', url: 'http://localhost' });

    const win = dom.window;
    win.AttentionService = { isNative: () => true };
    win.eval(calSettingsCode);

    // Trigger DOMContentLoaded
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

    const clientInput = win.document.querySelector('#gcal-client-id-input');
    const secretInput = win.document.querySelector('#gcal-client-secret-input');
    const saveBtn = win.document.querySelector('#save-gcal-keys');
    const status = win.document.querySelector('#gcal-key-status');

    // Simulate pasting markdown wrapped JSON with whitespace
    const markdownPaste = '```json\n{\n  "client_id": "534266942252-abc.apps.googleusercontent.com",\n  "client_secret": "GOCSPX-xyz123"\n}\n```';
    clientInput.value = markdownPaste;
    saveBtn.click();

    assert.equal(win.localStorage.getItem('gcalClientId'), '534266942252-abc.apps.googleusercontent.com');
    assert.equal(win.localStorage.getItem('gcalClientSecret'), 'GOCSPX-xyz123');
    // Field should NOT be wiped out
    assert.equal(clientInput.value, '534266942252-abc.apps.googleusercontent.com');
    assert.ok(status.textContent.includes('✓'));
  });

  it('rejects invalid client ID format and gives helpful feedback', () => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body><div id="gcal-settings-container"></div></body></html>
    `, { runScripts: 'dangerously', url: 'http://localhost' });

    const win = dom.window;
    win.AttentionService = { isNative: () => true };
    win.eval(calSettingsCode);
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

    const clientInput = win.document.querySelector('#gcal-client-id-input');
    const saveBtn = win.document.querySelector('#save-gcal-keys');
    const status = win.document.querySelector('#gcal-key-status');

    clientInput.value = 'invalid-client-id-without-domain';
    saveBtn.click();

    assert.equal(win.localStorage.getItem('gcalClientId'), null);
    assert.ok(status.textContent.includes('Invalid Client ID'));
  });
});
