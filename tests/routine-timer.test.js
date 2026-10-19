import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stringsCode = readFileSync(path.join(__dirname, '../features/routine/strings.js'), 'utf8');
const routineCode = readFileSync(path.join(__dirname, '../features/routine/routine.js'), 'utf8');

function createRoutineEnv(initialRoutines = []) {
  const storage = new Map([
    ['adhd-tool-routines', JSON.stringify(initialRoutines)],
    ['adhd-routine-runs', '{}'],
  ]);
  const docListeners = {};
  const winListeners = {};
  const activeIntervals = [];
  const wakeLocks = new Set();
  const notifications = [];
  const sounds = [];
  const countdowns = [];
  let nowMs = 1_700_000_000_000;

  function makeEl(id = '') {
    const el = {
      id,
      textContent: '',
      innerHTML: '',
      value: '',
      checked: false,
      width: 200,
      height: 200,
      style: {},
      dataset: {},
      children: [],
      parentNode: { replaceChild: () => {} },
      parentElement: { querySelectorAll: () => [] },
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false,
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      appendChild(child) {
        child.parentNode = el;
        el.children.push(child);
        return child;
      },
      append: () => {},
      cloneNode: () => makeEl(id),
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0 }),
      getContext: () => ({
        clearRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        moveTo: () => {},
        closePath: () => {},
      }),
    };
    return el;
  }

  const elements = new Map();
  const DynamicIds = new Set(['run-other-routine-btn', 'start-best-match-btn']);
  const document = {
    documentElement: { lang: 'en' },
    visibilityState: 'visible',
    getElementById(id) {
      if (DynamicIds.has(id) && !elements.has(id)) return null;
      if (!elements.has(id)) elements.set(id, makeEl(id));
      return elements.get(id);
    },
    querySelector: (sel) => makeEl(sel),
    querySelectorAll: () => [],
    createElement: (tag) => makeEl(tag),
    addEventListener(type, fn) {
      (docListeners[type] ||= []).push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent(ev) {
      (docListeners[ev.type] || []).forEach(fn => fn(ev));
    },
  };

  const FakeDate = class extends Date {
    constructor(...args) {
      super(...(args.length ? args : [nowMs]));
    }
    static now() {
      return nowMs;
    }
  };

  let registeredDict = null;
  const sandbox = {
    document,
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    Date: FakeDate,
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } },
    crypto: { randomUUID: () => 'uuid-' + Math.random() },
    matchMedia: () => ({ matches: false }),
    alert: () => {},
    confirm: () => false,
    console,
    setInterval(fn, ms) {
      const item = { fn, ms, cleared: false };
      activeIntervals.push(item);
      return item;
    },
    clearInterval(item) {
      if (item) item.cleared = true;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    Math: Math,
    JSON: JSON,
    Array: Array,
    String: String,
    I18n: {
      register(dict) { registeredDict = dict; },
      t(key, vars = {}) {
        let str = registeredDict?.en?.[key] || key;
        for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
        return str;
      },
    },
    ConfigManager: {
      getConfig: () => ({ routineBufferPercent: 10, routineAutoRunDefault: true }),
    },
    AttentionService: {
      requestNotificationPermission: () => {},
      acquireWakeLock: (src) => wakeLocks.add(src),
      releaseWakeLock: (src) => wakeLocks.delete(src),
      setCountdownStatus: (status) => countdowns.push(status),
      clearCountdownStatus: (src) => countdowns.push({ cleared: src }),
      notify: (title, body, opts) => notifications.push({ title, body, opts }),
      playNativeSound: (sound) => { sounds.push(sound); return true; },
    },
    addEventListener(type, fn) {
      (winListeners[type] ||= []).push(fn);
    },
    dispatchEvent(ev) {
      (winListeners[ev.type] || []).forEach(fn => fn(ev));
    },
  };

  sandbox.window = sandbox;
  sandbox.tr = sandbox.I18n.t;
  vm.runInNewContext(stringsCode, sandbox);
  vm.runInNewContext(routineCode, sandbox);
  document.dispatchEvent({ type: 'DOMContentLoaded' });

  return {
    sandbox,
    document,
    activeIntervals,
    wakeLocks,
    notifications,
    sounds,
    countdowns,
    advanceTime(ms) { nowMs += ms; },
    triggerVisibilityChange(state) {
        document.visibilityState = state;
        document.dispatchEvent({ type: 'visibilitychange' });
    }
  };
}

describe('Routine Timer', () => {

    test('Wall-clock timing catches up during backgrounding', () => {
        const env = createRoutineEnv([{
            id: 'r1',
            name: 'Morning',
            startTime: '08:00',
            weekDays: [0,1,2,3,4,5,6],
            tasks: [{ name: 'Step 1', duration: 1 }] // 1 minute = 60s
        }]);

        env.sandbox.activateRoutine('r1');

        assert.ok(env.activeIntervals.length > 0, 'Interval was created');

        env.advanceTime(1000);
        env.activeIntervals[0].fn();

        assert.ok(env.document.getElementById('current-task-time-left').textContent.includes('0:59'), 'Initial tick works');
        assert.ok(env.countdowns.find(c => c.remainingSeconds === 59), 'Countdown updated with 59s');

        // Simulate background tab (sleep for 30s)
        env.triggerVisibilityChange('hidden');
        env.advanceTime(30000);

        // Resume to foreground
        env.triggerVisibilityChange('visible');

        assert.ok(env.document.getElementById('current-task-time-left').textContent.includes('0:29'), 'Caught up missed time on visibility change');
    });

    test('Step completion invokes notifications and plays sound', () => {
        const env = createRoutineEnv([{
            id: 'r1',
            name: 'Morning',
            startTime: '08:00',
            weekDays: [0,1,2,3,4,5,6],
            tasks: [{ name: 'Step 1', duration: 1 }, { name: 'Step 2', duration: 1 }]
        }]);

        env.sandbox.activateRoutine('r1');

        // Jump time to end of first step
        env.advanceTime(61000);
        env.activeIntervals[0].fn();

        assert.ok(env.sounds.includes('chime'), 'Chime played');

        const lastNotification = env.notifications[env.notifications.length - 1];
        assert.ok(lastNotification, 'Notification sent');
        assert.ok(lastNotification.title.includes('Time\'s up'), 'Correct notification title');
        assert.ok(lastNotification.body.includes('Step 2'), 'Notification body contains next step name');
    });

    test('Routine end invokes complete notification and releases wake lock', () => {
        const env = createRoutineEnv([{
            id: 'r1',
            name: 'Morning',
            startTime: '08:00',
            weekDays: [0,1,2,3,4,5,6],
            tasks: [{ name: 'Step 1', duration: 1 }]
        }]);

        env.sandbox.activateRoutine('r1');
        assert.ok(env.wakeLocks.has('routine'), 'Wake lock acquired on start');

        // Complete the only step
        env.advanceTime(61000);
        env.activeIntervals[0].fn();

        // End routine manual advance (if auto advance is not active)
        env.sandbox.manualAdvanceTask();

        assert.ok(!env.wakeLocks.has('routine'), 'Wake lock released on end');
        assert.ok(env.countdowns.find(c => c.cleared === 'routine'), 'Countdown cleared');

        const endNotification = env.notifications.find(n => n.title.includes('Routine finished'));
        assert.ok(endNotification, 'End routine notification sent');
        assert.ok(endNotification.body.includes('Morning'), 'End routine body includes routine name');
    });
});
