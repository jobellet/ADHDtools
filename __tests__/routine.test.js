// Basic test for routine task presence in TaskStore (the integration itself)
import TaskStore from '../core/task-store.js';

describe('Routine Integration', () => {
    beforeEach(() => {
        let store = {};
        global.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => { store[key] = value.toString(); },
            clear: () => { store = {}; }
        };
        TaskStore.saveTasks([]);
    });

    it('syncs routine tasks correctly to TaskStore', () => {
        // Simulating the saveRoutines() logic in routine.js
        const hashSeed = `routine-test-task-1`;
        const hash = `task-${Buffer.from(hashSeed).toString('base64').replace(/=/g, '')}`;
        TaskStore.upsertTaskByHash(hash, {
            name: 'Morning - Wake up',
            durationMinutes: 10,
            isFixed: true
        });

        const tasks = TaskStore.getAllTasks();
        expect(tasks.length).toBe(1);
        expect(tasks[0].name).toBe('Morning - Wake up');
        expect(tasks[0].durationMinutes).toBe(10);
    });
});
