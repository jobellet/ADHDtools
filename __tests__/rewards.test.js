import TaskStore from '../core/task-store.js';

describe('Rewards Logic', () => {
    beforeEach(() => {
        let store = {};
        global.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => { store[key] = value.toString(); },
            clear: () => { store = {}; }
        };
        TaskStore.saveTasks([]);
    });

    it('calculates score for completed tasks isolated by user', () => {
        TaskStore.addTask({ name: 'Task 1', user: 'main', importance: 5, durationMinutes: 60 });
        TaskStore.addTask({ name: 'Task 2', user: 'other', importance: 10, durationMinutes: 120 });

        const tasks = TaskStore.getAllTasks();
        TaskStore.markComplete(tasks[0].hash);
        TaskStore.markComplete(tasks[1].hash);

        // Score: importance * durationHours -> 5 * 1 = 5
        const mainTotals = TaskStore.getTaskScoreTotals('main');
        expect(mainTotals.totalScore).toBe(5);

        // Score: importance * durationHours -> 10 * 2 = 20
        const otherTotals = TaskStore.getTaskScoreTotals('other');
        expect(otherTotals.totalScore).toBe(20);
    });
});
