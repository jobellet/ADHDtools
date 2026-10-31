import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setupEnvironment() {
  const store = new Map();
  const events = [];

  const sandbox = {
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: (e) => events.push(e),
      EventBus: {
        dispatchEvent: (e) => events.push(e),
      },
      I18n: {
        getLang: () => 'en',
        t: (k, vars, fb) => {
          if (vars?.n !== undefined) return `${vars.n} thoughts`;
          return fb || k;
        },
      },
      UnifiedScheduler: {
        localDateString: () => '2026-10-24',
      },
      ConfigManager: {
        getConfig: () => ({ defaultTaskMinutes: 25 }),
      },
      UserContext: {
        getActiveUser: () => 'main',
      },
      TaskStore: {
        addedTasks: [],
        addTask(data) {
          const t = { id: 'task_' + Date.now(), ...data };
          this.addedTasks.push(t);
          return t;
        },
      },
      DriveSync: {
        savedFiles: [],
        async saveTextFile(filename, content, opts) {
          this.savedFiles.push({ filename, content, opts });
          return { id: 'file_123', name: filename };
        },
        notifyLocalChange() {},
      },
      AIAssistant: {
        completeResponse: 'Default summary text',
        completeJSONResponse: null,
        async complete(prompt, opts) {
          return this.completeResponse;
        },
        async completeJSON(prompt, opts) {
          if (this.completeJSONResponse) return this.completeJSONResponse;
          throw new Error('Not configured');
        },
        isEnabled() {
          return true;
        },
      },
      CustomEvent: class {
        constructor(type, detail) {
          this.type = type;
          this.detail = detail;
        }
      },
      Event: class {
        constructor(type) {
          this.type = type;
        }
      },
    },
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      createElement: () => ({ appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } }),
    },
    console,
    Date,
    Math,
    JSON,
    Array,
    String,
    Number,
    Blob: class { constructor(content) { this.content = content; } },
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  };

  sandbox.window.window = sandbox.window;
  sandbox.Event = sandbox.window.Event;
  sandbox.CustomEvent = sandbox.window.CustomEvent;
  vm.createContext(sandbox);

  const code = readFileSync(new URL('../features/thoughts/thoughts.js', import.meta.url), 'utf8');
  vm.runInContext(code, sandbox);

  return { sandbox, store, events, QuickThoughts: sandbox.window.QuickThoughts };
}

describe('Quick Thoughts — storage and daily accumulation', () => {
  test('adds and retrieves thoughts for today', () => {
    const { QuickThoughts } = setupEnvironment();

    const t1 = QuickThoughts.addThought('First thought of the day', { time: '09:00' });
    assert.ok(t1.id);
    assert.equal(t1.text, 'First thought of the day');
    assert.equal(t1.time, '09:00');

    const t2 = QuickThoughts.addThought('Second quick idea', { time: '11:30' });

    const todayList = QuickThoughts.getThoughtsForDate('2026-10-24');
    assert.equal(todayList.length, 2);
    assert.equal(todayList[0].text, 'First thought of the day');
    assert.equal(todayList[1].text, 'Second quick idea');
  });

  test('accumulates thoughts per date independently', () => {
    const { QuickThoughts } = setupEnvironment();

    QuickThoughts.addThought('Yesterday note', { dateStr: '2026-10-23', time: '18:00' });
    QuickThoughts.addThought('Today note', { dateStr: '2026-10-24', time: '10:00' });

    const yest = QuickThoughts.getThoughtsForDate('2026-10-23');
    const today = QuickThoughts.getThoughtsForDate('2026-10-24');

    assert.equal(yest.length, 1);
    assert.equal(yest[0].text, 'Yesterday note');
    assert.equal(today.length, 1);
    assert.equal(today[0].text, 'Today note');
  });

  test('deletes a thought by id', () => {
    const { QuickThoughts } = setupEnvironment();

    const t1 = QuickThoughts.addThought('To be removed', { dateStr: '2026-10-24' });
    const t2 = QuickThoughts.addThought('Keep this', { dateStr: '2026-10-24' });

    const deleted = QuickThoughts.deleteThought(t1.id, '2026-10-24');
    assert.equal(deleted, true);

    const list = QuickThoughts.getThoughtsForDate('2026-10-24');
    assert.equal(list.length, 1);
    assert.equal(list[0].id, t2.id);
  });

  test('formats daily plain text export cleanly for Drive sync', () => {
    const { QuickThoughts } = setupEnvironment();

    QuickThoughts.addThought('Plan team meeting', { dateStr: '2026-10-24', time: '09:15' });
    QuickThoughts.addThought('Check groceries: milk, bread', { dateStr: '2026-10-24', time: '12:45' });

    const formatted = QuickThoughts.formatDayAsText('2026-10-24');
    assert.ok(formatted.includes('=== ADHD Tools — Quick Thoughts (2026-10-24) ==='));
    assert.ok(formatted.includes('[09:15] Plan team meeting'));
    assert.ok(formatted.includes('[12:45] Check groceries: milk, bread'));
  });
});

describe('Quick Thoughts — Google Drive synchronization', () => {
  test('syncs text file to Google Drive via DriveSync', async () => {
    const { QuickThoughts, sandbox } = setupEnvironment();

    QuickThoughts.addThought('Sync this note to drive', { dateStr: '2026-10-24', time: '14:00' });

    const res = await QuickThoughts.syncToDrive('2026-10-24', { interactive: true });
    assert.equal(res.name, 'ADHD-Thoughts-2026-10-24.txt');

    const drive = sandbox.window.DriveSync;
    assert.equal(drive.savedFiles.length, 1);
    assert.equal(drive.savedFiles[0].filename, 'ADHD-Thoughts-2026-10-24.txt');
    assert.ok(drive.savedFiles[0].content.includes('Sync this note to drive'));
  });
});

describe('Quick Thoughts — AI Summarization and Restructuring', () => {
  test('summarizes the day using AIAssistant', async () => {
    const { QuickThoughts, sandbox } = setupEnvironment();

    QuickThoughts.addThought('Finished bug fix early', { dateStr: '2026-10-24', time: '10:00' });
    QuickThoughts.addThought('Felt energetic after walk', { dateStr: '2026-10-24', time: '14:00' });

    sandbox.window.AIAssistant.completeResponse = '### Summary\nYou had high energy and made steady progress.';

    const summary = await QuickThoughts.summarizeDay('2026-10-24');
    assert.ok(summary.includes('You had high energy'));
  });

  test('restructures thoughts into categories and actionable tasks', async () => {
    const { QuickThoughts, sandbox } = setupEnvironment();

    QuickThoughts.addThought('Call accountant tomorrow', { dateStr: '2026-10-24', time: '11:00' });
    QuickThoughts.addThought('Idea: new blog post on habits', { dateStr: '2026-10-24', time: '15:30' });

    sandbox.window.AIAssistant.completeJSONResponse = {
      overview: 'Productive day with 1 clear action and 1 creative idea.',
      sections: [
        { title: '💡 Ideas', items: ['New blog post on habits'] }
      ],
      tasks: [
        { name: 'Call accountant', estimatedMinutes: 15, importance: 8 }
      ]
    };

    const structured = await QuickThoughts.restructureDay('2026-10-24');
    assert.equal(structured.overview, 'Productive day with 1 clear action and 1 creative idea.');
    assert.equal(structured.sections.length, 1);
    assert.equal(structured.tasks.length, 1);
    assert.equal(structured.tasks[0].name, 'Call accountant');
  });

  test('converts thought directly into a TaskStore task', () => {
    const { QuickThoughts, sandbox } = setupEnvironment();

    const thought = { text: 'Buy groceries tonight' };
    const task = QuickThoughts.convertThoughtToTask(thought);

    assert.equal(task.name, 'Buy groceries tonight');
    assert.equal(task.source, 'quick-thoughts');
    assert.equal(sandbox.window.TaskStore.addedTasks.length, 1);
  });
});
