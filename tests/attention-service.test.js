import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceCode = fs.readFileSync(path.join(__dirname, '../services/attention-service.js'), 'utf-8');

test('AttentionService', async (t) => {
  let invokedCommands = [];
  let eventsDispatched = [];

  function setupWindow() {
    invokedCommands = [];
    eventsDispatched = [];

    global.window = {
      dispatchEvent: (ev) => eventsDispatched.push(ev),
      addEventListener: () => {},
      ConfigManager: { getConfig: () => ({ desktopNotifications: true, keepScreenAwake: true, titleBarCountdown: true }) }
    };
    global.document = {
      title: 'ADHD Tools Hub',
      visibilityState: 'visible',
      addEventListener: () => {}
    };

    // Node.js globals object might freeze navigator or not have it, let's redefine it
    Object.defineProperty(global, 'navigator', {
      value: {
        wakeLock: {
          request: async (type) => ({
            type,
            release: async () => {},
            addEventListener: () => {}
          })
        }
      },
      writable: true,
      configurable: true
    });

    // Evaluate the IIFE in the current context
    new Function(serviceCode)();
  }

  await t.test('setCountdownStatus and clearCountdownStatus updating document.title', async () => {
    setupWindow();
    const service = window.AttentionService;

    assert.strictEqual(document.title, 'ADHD Tools Hub');

    service.setCountdownStatus({ source: 'timer', label: 'Work', remainingSeconds: 65, isRunning: true });
    assert.strictEqual(document.title, '01:05 — Work · ADHD Tools');

    service.clearCountdownStatus('timer');
    assert.strictEqual(document.title, 'ADHD Tools Hub');
  });

  await t.test('acquireWakeLock / releaseWakeLock reference counting with mocked navigator.wakeLock', async () => {
    setupWindow();
    let lockRequested = 0;
    let lockReleased = 0;

    global.navigator.wakeLock = {
      request: async (type) => {
        lockRequested++;
        return {
          type,
          release: async () => {
            lockReleased++;
          },
          addEventListener: () => {}
        };
      }
    };
    const service = window.AttentionService;

    // Initial state: nothing
    assert.strictEqual(lockRequested, 0);

    // Acquire first lock
    service.acquireWakeLock('pomo1');
    // We must wait a tick because updateWakeLock contains an await
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(lockRequested, 1);

    // Acquire second lock
    service.acquireWakeLock('pomo2');
    await new Promise(r => setTimeout(r, 0));
    // Lock should not be requested again, only reference count increases
    assert.strictEqual(lockRequested, 1);

    // Release first lock
    service.releaseWakeLock('pomo1');
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(lockReleased, 0); // Still active

    // Release second lock
    service.releaseWakeLock('pomo2');
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(lockReleased, 1); // Sentinel released
  });

  await t.test('notify and invokeNative with mocked Notification and __TAURI_INTERNALS__', async () => {
    setupWindow();

    // Mock native
    global.window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        invokedCommands.push({ cmd, args });
        return true;
      }
    };

    // Re-evaluate to capture the new window properties if necessary,
    // though our `isNative` checks `window.__TAURI_INTERNALS__` dynamically

    const service = window.AttentionService;

    assert.strictEqual(service.isNative(), true);

    service.notify('Test Title', 'Test Body', { sound: 'ding' });
    assert.deepStrictEqual(invokedCommands[0], { cmd: 'native_notify', args: { title: 'Test Title', body: 'Test Body', sound: 'ding' } });

    invokedCommands = [];

    // Remove native mock, test web notification
    delete global.window.__TAURI_INTERNALS__;
    assert.strictEqual(service.isNative(), false);

    let notificationArgs = null;
    global.Notification = class {
      constructor(title, options) {
        notificationArgs = { title, options };
      }
      static get permission() { return 'granted'; }
    };

    service.notify('Web Title', 'Web Body');
    assert.deepStrictEqual(notificationArgs, {
      title: 'Web Title',
      options: { body: 'Web Body', icon: 'icons/home.svg', tag: 'adhd-timer', renotify: true }
    });
  });

});
