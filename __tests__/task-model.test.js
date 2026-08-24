import { createTask } from '../core/task-model.js';

describe('TaskModel', () => {
    it('creates a task with defaults', () => {
        const task = createTask({ name: 'Test' });
        expect(task.name).toBe('Test');
        expect(task.importance).toBe(5);
        expect(task.urgency).toBe(5);
        expect(task.completed).toBe(false);
    });
});
