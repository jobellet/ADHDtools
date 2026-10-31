import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import UnifiedScheduler, { getRoutineBlocks } from '../core/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routineCode = readFileSync(path.join(__dirname, '../features/routine/routine.js'), 'utf8');
const stringsCode = readFileSync(path.join(__dirname, '../features/routine/strings.js'), 'utf8');

function setupRoutineEnv(initialRoutines = []) {
  const storage = new Map([
    ['adhd-tool-routines', JSON.stringify(initialRoutines)],
    ['adhd-routine-runs', '{}'],
  ]);

  const elements = new Map();
  function makeEl(id = '') {
    const el = {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      checked: false,
      style: {},
      dataset: {},
      children: [],
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, v) { if (v !== undefined ? v : !this._classes.has(c)) this._classes.add(c); else this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      appendChild(child) {
        el.children.push(child);
        return child;
      },
      cloneNode: () => makeEl(id),
      parentNode: { replaceChild: () => {} },
      parentElement: { querySelectorAll: () => [] },
      querySelector: (sel) => makeEl(sel),
      querySelectorAll: () => [],
      focus: () => {},
    };
    return el;
  }

  const docListeners = {};
  const sandbox = {
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      ConfigManager: {
        getConfig: () => ({
          routineBufferPercent: 10,
          plannerShowRoutineTasks: true,
          routineTasksDays: [1, 2, 3, 4, 5],
        }),
      },
      I18n: {
        t: (k, v) => k,
        register: () => {},
        getLang: () => 'fr',
      },
      AIAssistant: {
        isEnabled: () => false,
        completeJSON: async () => null,
      },
      AttentionService: {
        isNative: () => false,
      },
      SpeechRecognition: null,
      webkitSpeechRecognition: null,
    },
    document: {
      getElementById(id) {
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
    },
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    Array: Array,
    Object: Object,
    crypto: globalThis.crypto || { randomUUID: () => 'uuid-' + Math.random() },
    console,
    setTimeout: (fn) => fn(),
    setInterval: () => 1,
    clearInterval: () => {},
    CustomEvent: class CustomEvent { constructor(name, d) { this.type = name; this.detail = d?.detail; } },
    Event: class Event { constructor(name) { this.type = name; } },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.I18n = sandbox.window.I18n;
  sandbox.ConfigManager = sandbox.window.ConfigManager;

  vm.createContext(sandbox);
  vm.runInContext(stringsCode, sandbox);
  vm.runInContext(routineCode, sandbox);
  sandbox.document.dispatchEvent({ type: 'DOMContentLoaded' });

  return { sandbox, elements, storage };
}

describe('Routine AI & Microphone Editing — Offline Fallback Parser', () => {
  test('parses new routine with time, weekdays (Mon-Fri) and multiple steps', () => {
    const { sandbox } = setupRoutineEnv();
    const parse = sandbox.window.RoutinePlayer.parseRoutineOffline;

    const input = "Routine du matin à 07:30 du lundi au vendredi: Méditation 10m, Douche 15m, Café 10m";
    const routine = parse(input);

    assert.equal(routine.startTime, '07:30', 'parses start time 07:30');
    assert.deepEqual([...routine.weekDays], [1, 2, 3, 4, 5], 'parses weekdays Mon-Fri');
    assert.equal(routine.name, 'Routine du matin', 'parses routine name');
    assert.equal(routine.tasks.length, 3, 'extracts 3 steps');
    assert.equal(routine.tasks[0].name, 'Méditation');
    assert.equal(routine.tasks[0].duration, 10);
    assert.equal(routine.tasks[1].name, 'Douche');
    assert.equal(routine.tasks[1].duration, 15);
    assert.equal(routine.tasks[2].name, 'Café');
    assert.equal(routine.tasks[2].duration, 10);
  });

  test('parses English input with 12h clock time and weekdays', () => {
    const { sandbox } = setupRoutineEnv();
    const parse = sandbox.window.RoutinePlayer.parseRoutineOffline;

    const input = "Morning routine at 8:00 on weekdays: Stretch 15 min, Shower 20 min, Breakfast 25 min";
    const routine = parse(input);

    assert.equal(routine.startTime, '08:00');
    assert.deepEqual([...routine.weekDays], [1, 2, 3, 4, 5]);
    assert.equal(routine.tasks.length, 3);
    assert.equal(routine.tasks[0].name, 'Stretch');
    assert.equal(routine.tasks[0].duration, 15);
    assert.equal(routine.tasks[1].name, 'Shower');
    assert.equal(routine.tasks[1].duration, 20);
    assert.equal(routine.tasks[2].name, 'Breakfast');
    assert.equal(routine.tasks[2].duration, 25);
  });

  test('modifies existing routine: adds a step', () => {
    const { sandbox } = setupRoutineEnv();
    const parse = sandbox.window.RoutinePlayer.parseRoutineOffline;

    const current = {
      id: 'r1',
      name: 'Matin',
      startTime: '07:00',
      weekDays: [1, 2, 3, 4, 5],
      tasks: [{ id: 's1', name: 'Douche', duration: 15 }],
    };

    const updated = parse("Ajoute étirements 10 min", current);

    assert.equal(updated.name, 'Matin');
    assert.equal(updated.startTime, '07:00');
    assert.equal(updated.tasks.length, 2, 'adds the new step to existing steps');
    assert.equal(updated.tasks[0].name, 'Douche');
    assert.equal(updated.tasks[1].name, 'Étirements');
    assert.equal(updated.tasks[1].duration, 10);
  });

  test('modifies existing routine: removes a step', () => {
    const { sandbox } = setupRoutineEnv();
    const parse = sandbox.window.RoutinePlayer.parseRoutineOffline;

    const current = {
      id: 'r1',
      name: 'Matin',
      startTime: '07:00',
      weekDays: [1, 2, 3, 4, 5],
      tasks: [
        { id: 's1', name: 'Douche', duration: 15 },
        { id: 's2', name: 'Méditation', duration: 10 },
      ],
    };

    const updated = parse("Supprime douche", current);

    assert.equal(updated.tasks.length, 1);
    assert.equal(updated.tasks[0].name, 'Méditation');
  });

  test('modifies existing routine: updates time and days to weekend', () => {
    const { sandbox } = setupRoutineEnv();
    const parse = sandbox.window.RoutinePlayer.parseRoutineOffline;

    const current = {
      id: 'r1',
      name: 'Weekend chill',
      startTime: '08:00',
      weekDays: [1, 2, 3, 4, 5],
      tasks: [{ id: 's1', name: 'Brunch', duration: 30 }],
    };

    const updated = parse("Change l'heure à 09:30 le weekend", current);

    assert.equal(updated.startTime, '09:30');
    assert.deepEqual([...updated.weekDays], [0, 6], 'switches to weekend [0, 6]');
    assert.equal(updated.tasks.length, 1);
  });
});

describe('Routine AI & Microphone Editing — Online AIAssistant Integration', () => {
  test('delegates to AIAssistant.completeJSON when AI is enabled', async () => {
    const { sandbox } = setupRoutineEnv();

    let receivedPrompt = '';
    sandbox.window.AIAssistant = {
      isEnabled: () => true,
      completeJSON: async (prompt) => {
        receivedPrompt = prompt;
        return {
          name: "Routine du Soir",
          startTime: "21:30",
          weekDays: [0, 1, 2, 3, 4, 5, 6],
          tasks: [
            { name: "Tisane", duration: 10 },
            { name: "Lecture", duration: 25 },
          ],
          showTasksInDayView: true,
        };
      },
    };

    const apply = sandbox.window.RoutinePlayer.applyRoutineAI;
    const res = await apply("Routine du soir à 21h30 tous les jours avec tisane 10m et lecture 25m");

    assert.ok(receivedPrompt.includes('21h30'), 'passes user instruction to AI model');
    assert.equal(res.name, 'Routine du Soir');
    assert.equal(res.startTime, '21:30');
    assert.deepEqual(res.weekDays, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(res.tasks.length, 2);
    assert.equal(res.tasks[0].name, 'Tisane');
    assert.equal(res.tasks[0].duration, 10);
  });
});

describe('Routine Steps in Day View — Pre-Selected Days (Mon–Fri)', () => {
  test('routine blocks include steps and showTasksInDayView by default', () => {
    const routines = [
      {
        id: 'r_morn',
        name: 'Morning Routine',
        startTime: '07:00',
        weekDays: [1, 2, 3, 4, 5], // Mon-Fri
        tasks: [
          { id: 's1', name: 'Stretch', duration: 10 },
          { id: 's2', name: 'Shower', duration: 15 },
        ],
        showTasksInDayView: true,
      },
    ];

    // Monday (day 1): 2026-10-26 is a Monday
    const blocksMon = getRoutineBlocks('2026-10-26', { routines });
    assert.equal(blocksMon.length, 1, 'books routine block on Monday');
    assert.equal(blocksMon[0].task.name, 'Morning Routine');
    assert.equal(blocksMon[0].task.showTasksInDayView, true);
    assert.equal(blocksMon[0].task.steps.length, 2);
    assert.equal(blocksMon[0].task.steps[0].name, 'Stretch');
    assert.equal(blocksMon[0].task.steps[0].duration, 10);
    assert.equal(blocksMon[0].task.steps[1].name, 'Shower');
    assert.equal(blocksMon[0].task.steps[1].duration, 15);

    // Saturday (day 6): 2026-10-31 is Saturday -> not in routine's weekDays
    const blocksSat = getRoutineBlocks('2026-10-31', { routines });
    assert.equal(blocksSat.length, 0, 'does not book on Saturday since Mon-Fri only');
  });

  test('pre-selected weekdays configuration defaults to [1, 2, 3, 4, 5]', () => {
    const { sandbox } = setupRoutineEnv();
    const cfg = sandbox.window.ConfigManager.getConfig();

    assert.equal(cfg.plannerShowRoutineTasks, true, 'plannerShowRoutineTasks is true by default');
    assert.deepEqual(cfg.routineTasksDays, [1, 2, 3, 4, 5], 'routineTasksDays is Mon-Fri by default');
  });
});
