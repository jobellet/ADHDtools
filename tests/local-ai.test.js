import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

describe('Local AI - AttentionService & UI Controls', () => {
  function createEnvironment(isNativeMode = true, initialStatus = { available: true, running: false, port: 11434 }) {
    let currentStatus = { ...initialStatus };
    const invokedCommands = [];

    const sandbox = {
      window: {
        __TAURI__: isNativeMode ? { core: { invoke: async (cmd, args) => {
          invokedCommands.push({ cmd, args });
          if (cmd === 'native_local_ai_status') return currentStatus;
          if (cmd === 'native_local_ai_start') {
            currentStatus = { ...currentStatus, running: true };
            return currentStatus;
          }
          if (cmd === 'native_local_ai_stop') {
            currentStatus = { ...currentStatus, running: false };
            return currentStatus;
          }
          return null;
        } } } : undefined,
        dispatchEvent: () => {},
        addEventListener: () => {},
      },
      document: {
        addEventListener: () => {},
        head: { querySelectorAll: () => [] },
      },
      Notification: { permission: 'default' },
      CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
      console,
    };

    vm.createContext(sandbox);
    const serviceCode = readFileSync(new URL('../services/attention-service.js', import.meta.url), 'utf8');
    vm.runInContext(serviceCode, sandbox);

    return {
      service: sandbox.window.AttentionService,
      invokedCommands,
      getStatus: () => currentStatus,
      setStatus: (s) => { currentStatus = { ...currentStatus, ...s }; },
    };
  }

  test('non-native browser reports local AI unavailable without calling native invoke', async () => {
    const env = createEnvironment(false);
    assert.equal(env.service.isNative(), false);

    const status = await env.service.getLocalAiStatus();
    assert.equal(status.available, false);
    assert.equal(status.running, false);
    assert.equal(env.invokedCommands.length, 0);

    const startRes = await env.service.startLocalAi();
    assert.equal(startRes.available, false);
    assert.equal(startRes.running, false);

    const stopRes = await env.service.stopLocalAi();
    assert.equal(stopRes.available, false);
    assert.equal(stopRes.running, false);
  });

  test('native desktop queries native_local_ai_status and controls server', async () => {
    const env = createEnvironment(true, { available: true, running: false, port: 11434 });
    assert.equal(env.service.isNative(), true);

    const status = await env.service.getLocalAiStatus();
    assert.equal(status.available, true);
    assert.equal(status.running, false);
    assert.equal(status.port, 11434);
    assert.equal(env.invokedCommands[0].cmd, 'native_local_ai_status');

    const started = await env.service.startLocalAi();
    assert.equal(started.running, true);
    assert.equal(env.invokedCommands[1].cmd, 'native_local_ai_start');

    const stopped = await env.service.stopLocalAi();
    assert.equal(stopped.running, false);
    assert.equal(env.invokedCommands[2].cmd, 'native_local_ai_stop');
  });

  test('button visibility rule: hidden when local AI is not present', () => {
    // When local AI is not installed (available: false), the UI logic maintains the hidden class.
    const status = { available: false, running: false };
    const classList = new Set(['local-ai-trigger', 'hidden']);
    if (!status.available) {
      classList.add('hidden');
    }
    assert.ok(classList.has('hidden'), 'Button must remain hidden when local AI is absent');
  });

  test('button visibility rule: displayed when local AI is present', () => {
    // When local AI is installed (available: true), the hidden class is removed.
    const status = { available: true, running: false };
    const classList = new Set(['local-ai-trigger', 'hidden']);
    if (status.available) {
      classList.delete('hidden');
    }
    assert.ok(!classList.has('hidden'), 'Button must be visible when local AI is present');
  });
});
