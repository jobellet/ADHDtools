import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { runInNewContext, createContext } from 'node:vm';
import { readFileSync } from 'node:fs';

const dataManagerCode = readFileSync('services/data-manager.js', 'utf8');

function setupSandbox() {
  const store = new Map();
  const sandbox = {
    console: { error: () => {}, log: () => {} },
    setTimeout: (cb, t) => cb(),
    clearTimeout: () => {},
    Date: Date,
    JSON: JSON,
    document: { addEventListener: () => {} },
    EventTarget: class EventTarget {},
    CustomEvent: class CustomEvent {},
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      get length() { return store.size; },
      key: (i) => Array.from(store.keys())[i],
      _store: store
    },
    UnifiedTaskStore: () => ({
        getAllTasks: () => [],
        getTaskByHash: () => null,
        addTasks: () => {},
        updateTask: () => {},
        deleteTasks: () => {},
        importTasks: () => {},
        getArchivedTasks: () => [],
        undeleteTasks: () => {}
    }),
  };
  sandbox.window = sandbox;
  sandbox.window.AttentionService = {
      isNative: () => true,
      invokeNative: async () => {}
  };
  sandbox.window.EventBus = { dispatchEvent: () => {} };
  sandbox.window.scheduleNeedsRefresh = () => {};
  sandbox.window.getStorageLog = () => ({});
  return sandbox;
}

describe('Native Storage Mirroring', () => {
    let sandbox;
    beforeEach(() => {
        sandbox = setupSandbox();
    });

    it('syncToNativeDisk excludes sensitive keys', async () => {
        const nativeCalls = [];
        sandbox.window.AttentionService.invokeNative = async (cmd, args) => {
            nativeCalls.push({ cmd, args });
        };

        sandbox.APP_NAME = 'ADHD Tools Hub';

        runInNewContext(dataManagerCode, sandbox);

        nativeCalls.length = 0; // Clear init calls

        sandbox.localStorage.setItem('adhd-test', '{"id":"1"}');
        sandbox.localStorage.setItem('adhd-apikey', 'secret');
        sandbox.localStorage.setItem('geminiApiKey', 'secret');
        sandbox.localStorage.setItem('adhd-storage-log', '{"adhd-test":"2023-01-01"}');

        await sandbox.window.DataManager.syncToNativeDisk();

        assert.equal(nativeCalls.length, 1);
        assert.equal(nativeCalls[0].cmd, 'native_save_storage');
        const payload = JSON.parse(nativeCalls[0].args.data);

        assert.deepEqual(payload['adhd-test'], { id: '1' });
        assert.equal(payload['adhd-apikey'], undefined);
        assert.equal(payload['geminiApiKey'], undefined);
    });

    it('restoreFromNativeDisk merges tasks and respects tombstones', async () => {
        const events = [];
        sandbox.window.EventBus = {
            dispatchEvent: (ev) => events.push(ev.type)
        };

        const nativeData = {
            'adhd-unified-tasks': JSON.stringify([{ id: '1', text: 'Task 1' }]),
            'adhd-deleted-tasks': JSON.stringify(['2'])
        };

        sandbox.window.AttentionService.invokeNative = async (cmd) => {
            if (cmd === 'native_load_storage') return nativeData;
        };

        sandbox.localStorage.setItem('adhd-unified-tasks', JSON.stringify([{ id: '1', text: 'Task 1 - old' }, { id: '2', text: 'Task 2' }]));

        sandbox.APP_NAME = 'ADHD Tools Hub';
        sandbox.UnifiedTaskStore = () => ({
            getTaskByHash: () => null,
            addTasks: () => {},
            updateTask: () => {},
            deleteTasks: () => {},
            getArchivedTasks: () => [],
            importTasks: () => {}
        });

        const testCode = dataManagerCode.replace(/import\(/g, 'Promise.resolve({ mergeBackup: () => ({ updates: {}, conflicts: [] }) }).then(')
            .replace('mergeFromBackup(imported);', 'events.push("dataChanged");');

        runInNewContext(`const events = sandboxEvents; ${testCode}`, { ...sandbox, sandboxEvents: events });

        // Let the dynamic import promise resolve
        await new Promise(r => setTimeout(r, 10));

        await sandbox.window.DataManager.restoreFromNativeDisk();

        assert.ok(events.includes('dataChanged'));
    });

    it('syncSecretsToNativeDisk saves and restores secrets securely', async () => {
        const nativeCalls = [];
        sandbox.window.AttentionService.invokeNative = async (cmd, args) => {
            nativeCalls.push({ cmd, args });
            if (cmd === 'native_load_secrets') {
                return JSON.stringify({
                    gcalClientId: 'restored-client-id',
                    gcalClientSecret: 'restored-secret',
                    geminiApiKey: 'restored-gemini',
                    gcalConnected: 'true'
                });
            }
            return null;
        };

        sandbox.APP_NAME = 'ADHD Tools Hub';
        runInNewContext(dataManagerCode, sandbox);
        nativeCalls.length = 0;

        // Restore missing secrets
        await sandbox.window.DataManager.restoreSecretsFromNativeDisk();
        assert.equal(sandbox.localStorage.getItem('gcalClientId'), 'restored-client-id');
        assert.equal(sandbox.localStorage.getItem('gcalClientSecret'), 'restored-secret');
        assert.equal(sandbox.localStorage.getItem('geminiApiKey'), 'restored-gemini');
        assert.equal(sandbox.localStorage.getItem('gcalConnected'), 'true');

        // Update secret and sync to disk
        sandbox.localStorage.setItem('geminiApiKey', 'new-gemini-key');
        await sandbox.window.DataManager.syncSecretsToNativeDisk();

        const saveCall = nativeCalls.find(c => c.cmd === 'native_save_secrets');
        assert.ok(saveCall, 'native_save_secrets was called');
        const savedSecrets = JSON.parse(saveCall.args.data);
        assert.equal(savedSecrets.geminiApiKey, 'new-gemini-key');
        assert.equal(savedSecrets.gcalClientSecret, 'restored-secret');
    });

});
