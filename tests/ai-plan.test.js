// tests/ai-plan.test.js — the Day Planner "AI Plan" flow with simulated model
// outputs. No network: window.AIAssistant.complete is stubbed with fake LLM
// responses (well-formed, sloppy, fenced, wrapped, malformed, malicious) to
// prove the prompt/normalizer/validator produce a safe plan in every case.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanPrompt, normalizePlanItems, validatePlan, parseDurationMinutes } from '../features/planner/ai-plan.js';

const TASKS = [
    { id: 'a', name: 'Write report', minutes: 60 },
    { id: 'b', name: 'Call dentist', minutes: 15 },
    { id: 'c', name: 'Grocery shopping', minutes: 45 },
];
const BUSY = [
    { kind: 'event', id: 'cal-1', name: 'Team meeting', start: 10 * 60, end: 11 * 60 },
    { kind: 'task', id: 't1', name: 'Lunch with Sam', start: 13 * 60, end: 14 * 60 },
];
const OPTS = {
    tasks: TASKS,
    windowStartMinutes: 8 * 60,
    dayEndMinutes: 22 * 60,
    defaultDurationMinutes: 25,
    busyBlocks: BUSY,
};

const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const noOverlaps = (accepted, busy) => {
    const ranges = [...accepted.map(a => ({ start: a.start, end: a.start + a.duration })), ...(busy || [])];
    return ranges.every((r, i) => ranges.every((o, j) => i === j || !(r.start < o.end && r.end > o.start)));
};

describe('buildPlanPrompt', () => {
    test('contains date, window, busy blocks, tasks and strict output rules', () => {
        const prompt = buildPlanPrompt({
            dateStr: '2026-02-14', weekday: 'Saturday',
            windowStartMinutes: 8 * 60, dayEndMinutes: 22 * 60,
            tasks: TASKS, busyBlocks: BUSY,
        });
        assert.match(prompt, /2026-02-14/);
        assert.match(prompt, /08:00/);
        assert.match(prompt, /Team meeting/);
        assert.match(prompt, /Write report/);
        assert.match(prompt, /JSON array/);
        assert.match(prompt, /EXACTLY/);
        assert.ok(!prompt.includes('undefined'));
    });
});

describe('parseDurationMinutes', () => {
    test('accepts numbers, strings, h/min words', () => {
        assert.strictEqual(parseDurationMinutes(45), 45);
        assert.strictEqual(parseDurationMinutes('45'), 45);
        assert.strictEqual(parseDurationMinutes('45 minutes'), 45);
        assert.strictEqual(parseDurationMinutes('1h30'), 90);
        assert.strictEqual(parseDurationMinutes('1.5 hours'), 90);
        assert.strictEqual(parseDurationMinutes('90 min'), 90);
        assert.strictEqual(parseDurationMinutes('nonsense', 25), 25);
    });
});

describe('normalizePlanItems', () => {
    test('parses a clean JSON array', () => {
        const raw = [
            { time: '09:00', text: 'Write report', duration: 60 },
            { time: '11:30', text: 'Call dentist', duration: 15 },
        ];
        const { items } = normalizePlanItems(raw);
        assert.strictEqual(items.length, 2);
        assert.strictEqual(items[0].time, 9 * 60);
        assert.strictEqual(items[1].time, 11 * 60 + 30);
    });

    test('parses sloppy times (12h clock, ISO, numeric)', () => {
        const raw = [
            { time: '9:00 AM', text: 'A' },
            { time: '2026-02-14T14:30', text: 'B' },
            { time: 930, text: 'C' },
            { time: '2:15 pm', text: 'D' },
        ];
        const { items } = normalizePlanItems(raw);
        assert.deepEqual(items.map(i => i.time), [9 * 60, 14 * 60 + 30, 9 * 60 + 30, 14 * 60 + 15]);
    });

    test('accepts alternate field names and wrapped payloads', () => {
        const raw = { plan: [{ startTime: '09:00', name: 'Write report', minutes: 60 }] };
        const { items } = normalizePlanItems(raw);
        assert.strictEqual(items.length, 1);
        assert.strictEqual(items[0].text, 'Write report');
        assert.strictEqual(items[0].duration, 60);
    });

    test('accepts duration words from a weak model', () => {
        const raw = [{ time: '09:00', text: 'Write report', duration: '1h' }];
        const { items } = normalizePlanItems(raw);
        assert.strictEqual(items[0].duration, 60);
    });

    test('salvages items from broken fenced JSON', () => {
        const rawText = 'Sure! Here is your plan:\n```json\n[{ "time": "09:00", "text": "Write report", "duration": 60, }, { "time": "10:00", "text": "Call dentist", "duration": 15 }\n```';
        const { items, salvaged } = normalizePlanItems(null, rawText);
        assert.ok(salvaged);
        assert.strictEqual(items.length, 1); // trailing-comma object is skipped, the clean one survives
        assert.strictEqual(items[0].text, 'Call dentist');
    });

    test('ignores entries without time or text', () => {
        const raw = [{ time: '09:00' }, { text: 'No time' }, null, 'string'];
        const { items } = normalizePlanItems(raw);
        assert.strictEqual(items.length, 0);
    });
});

describe('validatePlan', () => {
    test('accepts a clean plan untouched', () => {
        const items = [
            { time: 8 * 60, text: 'Write report', duration: 60 },
            { time: 11 * 60, text: 'Call dentist', duration: 15 },
            { time: 15 * 60, text: 'Grocery shopping', duration: 45 },
        ];
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted.length, 3);
        assert.strictEqual(report.moved.length, 0);
        assert.ok(noOverlaps(report.accepted, BUSY));
    });

    test('moves a task that collides with a busy block', () => {
        const items = [{ time: 10 * 60 + 30, text: 'Write report', duration: 60 }];
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted.length, 1);
        assert.strictEqual(report.moved.length, 1);
        assert.notStrictEqual(report.accepted[0].start, 10 * 60 + 30);
        assert.ok(noOverlaps(report.accepted, BUSY));
    });

    test('never lets two model tasks overlap each other', () => {
        const items = [
            { time: 8 * 60, text: 'Write report', duration: 60 },
            { time: 8 * 60 + 30, text: 'Call dentist', duration: 15 }, // dumb model: overlapping
        ];
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted.length, 2);
        assert.ok(noOverlaps(report.accepted));
    });

    test('rejects unknown (invented) tasks', () => {
        const items = [
            { time: 8 * 60, text: 'Write report', duration: 60 },
            { time: 9 * 60, text: 'Take over the world', duration: 60 },
        ];
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted.length, 1);
        assert.deepEqual(report.unknown, ['Take over the world']);
    });

    test('rejects duplicate scheduling of the same task', () => {
        const items = [
            { time: 8 * 60, text: 'Write report', duration: 60 },
            { time: 12 * 60, text: 'Write report', duration: 60 },
        ];
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted.length, 1);
        assert.strictEqual(report.duplicates.length, 1);
    });

    test('moves a task scheduled in the past or outside the window', () => {
        const items = [
            { time: 6 * 60, text: 'Write report', duration: 60 }, // before window start (08:00)
            { time: 21 * 60 + 30, text: 'Grocery shopping', duration: 45 }, // would end after 22:00
        ];
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted.length, 2);
        report.accepted.forEach(a => {
            assert.ok(a.start >= OPTS.windowStartMinutes);
            assert.ok(a.start + a.duration <= OPTS.dayEndMinutes);
        });
        assert.strictEqual(report.moved.length, 2);
    });

    test('drops a task when the day has no room left', () => {
        const opts = { ...OPTS, dayEndMinutes: 9 * 60 + 30 };
        const items = [{ time: 8 * 60, text: 'Write report', duration: 90 }];
        const report = validatePlan(items, opts);
        assert.strictEqual(report.accepted.length, 1);
        assert.ok(report.accepted[0].start + report.accepted[0].duration <= 9 * 60 + 30);
    });

    test('falls back to the task\'s own duration when the model omits it', () => {
        const items = [{ time: 8 * 60, text: 'Call dentist', duration: 0 }];
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted[0].duration, 15);
    });

    test('a model plan that stacks every task at the same minute still comes out valid', () => {
        const items = TASKS.map(t => ({ time: 8 * 60, text: t.name, duration: 0 }));
        const report = validatePlan(items, OPTS);
        assert.strictEqual(report.accepted.length, 3);
        assert.ok(noOverlaps(report.accepted, BUSY));
        const starts = report.accepted.map(a => a.start);
        assert.strictEqual(new Set(starts).size, 3);
    });
});

describe('planDayWithAI (integration, stubbed AIAssistant)', () => {
    const storage = new Map();
    const listeners = {};
    const savedTasks = [];

    beforeEach(() => {
        storage.clear();
        savedTasks.length = 0;
        Object.keys(listeners).forEach(k => delete listeners[k]);
    });

    function setupWindow(fakeResponse) {
        global.window = {
            AIAssistant: {
                isEnabled: () => true,
                complete: async () => fakeResponse.text,
                extractJSON: (text) => {
                    try {
                        const m = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
                        const candidate = m ? m[1] : String(text);
                        const first = candidate.search(/[[{]/);
                        if (first === -1) return null;
                        return JSON.parse(candidate.slice(first, candidate.lastIndexOf('}') + 1) || candidate.slice(first, candidate.lastIndexOf(']') + 1));
                    } catch { return null; }
                },
            },
            TaskStore: {
                getPendingTasks: () => [
                    { hash: 'a', name: 'Write report', durationMinutes: 60, completed: false, plannerDate: null },
                    { hash: 'b', name: 'Call dentist', durationMinutes: 15, completed: false, plannerDate: null },
                    { hash: 'x', name: 'Already planned', durationMinutes: 30, completed: false, plannerDate: '2026-02-14T07:00' },
                    { hash: 'd', name: 'Done thing', durationMinutes: 30, completed: true, plannerDate: null },
                ],
            },
            UnifiedScheduler: {
                getBusyBlocks: () => [{ kind: 'event', id: 'cal-1', name: 'Team meeting', start: 10 * 60, end: 11 * 60 }],
            },
            DataManager: {
                addTask: (raw) => { savedTasks.push(raw); return { ...raw }; },
            },
            EventBus: { dispatchEvent: (e) => { (listeners[e.type] ||= []).push(e); } },
            dispatchEvent: () => {},
        };
    }

    const date = new Date(2026, 1, 14, 9, 0); // 2026-02-14 09:00, a Saturday
    const baseOpts = { tr: (k) => k, dayStartMinutes: 8 * 60, dayEndMinutes: 22 * 60, defaultDurationMinutes: 25 };

    test('happy path: clean model response is saved as planned tasks', async () => {
        setupWindow({
            text: '[{"time":"09:00","text":"Write report","duration":60},{"time":"11:30","text":"Call dentist","duration":15}]',
        });
        const { planDayWithAI } = await import('../features/planner/ai-plan.js');
        const result = await planDayWithAI(date, baseOpts);
        assert.ok(result.ok, JSON.stringify(result));
        assert.strictEqual(result.planned, 2);
        assert.strictEqual(savedTasks.length, 2);
        assert.strictEqual(savedTasks[0].text, 'Write report');
        assert.strictEqual(savedTasks[0].plannerDate, '2026-02-14T09:00');
        assert.strictEqual(savedTasks[0].isFixed, true);
        assert.strictEqual(savedTasks[0].originalTool, 'AI');
        assert.ok(listeners.dataChanged);
    });

    test('dumb model: fenced prose, wrapped object, wrong field names, overlaps', async () => {
        setupWindow({
            text: 'Here is your plan for today!\n```json\n{"schedule":[{"startTime":"10:30 AM","task":"Write report","minutes":"1h"},{"start":"10:45","title":"Call dentist"},{"time":"10:00","text":"Call dentist"}]}\n```\nHope this helps!',
        });
        const { planDayWithAI } = await import('../features/planner/ai-plan.js');
        const result = await planDayWithAI(date, baseOpts);
        assert.ok(result.ok, JSON.stringify(result));
        assert.strictEqual(result.planned, 2);
        assert.strictEqual(result.duplicates, 1);
        assert.ok(result.moved >= 1);
        const ranges = savedTasks.map(t => {
            const start = Number(t.plannerDate.slice(11, 13)) * 60 + Number(t.plannerDate.slice(14, 16));
            return { start, end: start + t.duration };
        });
        ranges.push({ start: 10 * 60, end: 11 * 60 }); // busy block
        assert.ok(ranges.every((r, i) => ranges.every((o, j) => i === j || !(r.start < o.end && r.end > o.start))));
        ranges.forEach(r => { assert.ok(r.start >= 8 * 60); });
    });

    test('malformed model response fails gracefully', async () => {
        setupWindow({ text: 'I am sorry, I cannot do that.' });
        const { planDayWithAI } = await import('../features/planner/ai-plan.js');
        const result = await planDayWithAI(date, baseOpts);
        assert.ok(!result.ok);
        assert.strictEqual(result.reason, 'unparsable');
        assert.strictEqual(savedTasks.length, 0);
    });

    test('network/provider failure is reported, nothing saved', async () => {
        setupWindow({ text: '' });
        global.window.AIAssistant.complete = async () => { throw new Error('rate limited'); };
        const { planDayWithAI } = await import('../features/planner/ai-plan.js');
        const result = await planDayWithAI(date, baseOpts);
        assert.ok(!result.ok);
        assert.strictEqual(result.reason, 'requestFailed');
        assert.strictEqual(savedTasks.length, 0);
    });

    test('no unscheduled tasks -> noTasks', async () => {
        setupWindow({ text: '[]' });
        global.window.TaskStore.getPendingTasks = () => [];
        const { planDayWithAI } = await import('../features/planner/ai-plan.js');
        const result = await planDayWithAI(date, baseOpts);
        assert.ok(!result.ok);
        assert.strictEqual(result.reason, 'noTasks');
    });

    test('no provider configured -> noProvider, no call', async () => {
        setupWindow({ text: '[]' });
        let called = false;
        global.window.AIAssistant.complete = async () => { called = true; return '[]'; };
        global.window.AIAssistant.isEnabled = () => false;
        const { planDayWithAI } = await import('../features/planner/ai-plan.js');
        const result = await planDayWithAI(date, baseOpts);
        assert.ok(!result.ok);
        assert.strictEqual(result.reason, 'noProvider');
        assert.strictEqual(called, false);
    });

    test('model output is exactly today: no other-day times survive', async () => {
        setupWindow({
            text: '[{"time":"2026-02-15T08:00","text":"Write report","duration":60},{"time":"2026-02-14T23:30","text":"Call dentist","duration":15}]',
        });
        const { planDayWithAI } = await import('../features/planner/ai-plan.js');
        const result = await planDayWithAI(date, baseOpts);
        assert.ok(result.ok);
        savedTasks.forEach(t => {
            assert.ok(t.plannerDate.startsWith('2026-02-14T'));
            const mins = Number(t.plannerDate.slice(11, 13)) * 60 + Number(t.plannerDate.slice(14, 16));
            assert.ok(mins >= 8 * 60 && mins + t.duration <= 22 * 60, t.plannerDate);
        });
    });
});
