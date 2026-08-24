import DurationLearning from '../core/duration-learning.js';

describe('DurationLearning', () => {
    beforeEach(() => {
        let store = {};
        global.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => { store[key] = value.toString(); },
            clear: () => { store = {}; }
        };
    });

    it('records and averages duration', () => {
        const est1 = DurationLearning.recordTaskDuration('Test Task', 30);
        expect(est1).toBe(30);

        const est2 = DurationLearning.recordTaskDuration('Test Task', 40);
        // Average should be weighted 0.7 * 30 + 0.3 * 40 = 21 + 12 = 33
        expect(est2).toBe(33);

        const retrieved = DurationLearning.getEstimatedDuration('Test Task');
        expect(retrieved).toBe(33);
    });
});
