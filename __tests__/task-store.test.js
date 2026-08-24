import TaskStore from '../core/task-store.js';
import { createTask } from '../core/task-model.js';

describe('TaskStore', () => {
    beforeEach(() => {
        let store = {};
        global.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => { store[key] = value.toString(); },
            clear: () => { store = {}; }
        };
        TaskStore.saveTasks([]);
    });

    it('adds and retrieves a task', () => {
        const task = TaskStore.addTask({ name: 'Buy milk' });
        expect(task.name).toBe('Buy milk');

        const retrieved = TaskStore.getTaskByHash(task.hash);
        expect(retrieved).toBeDefined();
        expect(retrieved.name).toBe('Buy milk');
    });

    it('updates a task', () => {
        const task = TaskStore.addTask({ name: 'Buy milk' });
        const updated = TaskStore.updateTaskByHash(task.hash, { name: 'Buy almond milk' });
        expect(updated.name).toBe('Buy almond milk');

        const retrieved = TaskStore.getTaskByHash(task.hash);
        expect(retrieved.name).toBe('Buy almond milk');
    });

    it('marks a task complete', () => {
        const task = TaskStore.addTask({ name: 'Buy milk' });
        TaskStore.markComplete(task.hash);

        const retrieved = TaskStore.getTaskByHash(task.hash);
        expect(retrieved.completed).toBe(true);
        expect(retrieved.completedAt).toBeDefined();
    });
});
