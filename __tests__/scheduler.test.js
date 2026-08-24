import UnifiedScheduler from '../core/scheduler.js';
import TaskStore from '../core/task-store.js';

describe('UnifiedScheduler', () => {
    beforeEach(() => {
        let store = {};
        global.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => { store[key] = value.toString(); },
            clear: () => { store = {}; }
        };
        TaskStore.saveTasks([]);
    });

    it('builds a schedule with flexible tasks', () => {
        TaskStore.addTask({ name: '[FLEX] Read', durationMinutes: 30 });
        const schedule = UnifiedScheduler.buildSchedule();
        expect(schedule.length).toBe(1);
        expect(schedule[0].task.name).toBe('[FLEX] Read');
    });

    it('builds a schedule with fixed tasks', () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        TaskStore.addTask({ name: '[FIX] Standup', startTime: '10:00', durationMinutes: 30, isFixed: true, plannerDate: `${todayStr}T10:00` });
        const schedule = UnifiedScheduler.buildSchedule();
        expect(schedule.length).toBe(1);
        expect(schedule[0].task.name).toBe('[FIX] Standup');
    });
});
