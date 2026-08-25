import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  createTask,
  updateTask,
  markTaskCompleted,
  computeUrgencyFromDeadline,
  computeAchievementScore,
  DEFAULT_USER
} from '../core/task-model.js';

describe('Task Model', () => {
  test('createTask sets default values correctly', () => {
    const task = createTask({ text: 'My task' });
    assert.strictEqual(task.text, 'My task');
    assert.strictEqual(task.name, 'My task');
    assert.strictEqual(task.user, DEFAULT_USER);
    assert.strictEqual(task.completed, false);
    assert.ok(task.createdAt);
    assert.ok(task.hash);
    assert.strictEqual(task.id, task.hash);
    assert.strictEqual(task.importance, 5); // default
  });

  test('computeUrgencyFromDeadline', () => {
    const now = new Date();
    // No deadline -> 5
    assert.strictEqual(computeUrgencyFromDeadline(null), 5);
    
    // Past or today -> 10
    const today = new Date(now);
    assert.strictEqual(computeUrgencyFromDeadline(today.toISOString()), 10);
    
    // Tomorrow -> 9
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.strictEqual(computeUrgencyFromDeadline(tomorrow.toISOString()), 9);
    
    // +2 days -> 8
    const day2 = new Date(now);
    day2.setDate(day2.getDate() + 2);
    assert.strictEqual(computeUrgencyFromDeadline(day2.toISOString()), 8);
    
    // +6 days -> 6
    const day6 = new Date(now);
    day6.setDate(day6.getDate() + 6);
    assert.strictEqual(computeUrgencyFromDeadline(day6.toISOString()), 6);
    
    // +10 days -> 5
    const day10 = new Date(now);
    day10.setDate(day10.getDate() + 10);
    assert.strictEqual(computeUrgencyFromDeadline(day10.toISOString()), 5);
  });

  test('updateTask updates specified properties', () => {
    const task = createTask({ name: 'Old Name' });
    const updated = updateTask(task, { name: 'New Name', importance: 8 });
    assert.strictEqual(updated.name, 'New Name');
    assert.strictEqual(updated.importance, 8);
    assert.strictEqual(updated.hash, task.hash); // Hash shouldn't change on update
  });

  test('markTaskCompleted sets completed and completion time', () => {
    const task = createTask({ name: 'Finish project', durationMinutes: 60, importance: 10 });
    const now = new Date().toISOString();
    const completed = markTaskCompleted(task, now);
    
    assert.strictEqual(completed.completed, true);
    assert.strictEqual(completed.completedAt, now);
    // Achievement score: 10 (importance) * (60/60) (duration in hours) = 10
    assert.strictEqual(completed.achievementScore, 10);
  });

  test('computeAchievementScore calculates correctly', () => {
    const task = { durationMinutes: 120, importance: 8 }; // 2 hours * 8 = 16
    assert.strictEqual(computeAchievementScore(task), 16);
    
    const task2 = { durationMinutes: 30, importance: 5 }; // 0.5 hours * 5 = 2.5
    assert.strictEqual(computeAchievementScore(task2), 2.5);
  });

  test('stable hash generation', () => {
    const task1 = createTask({ name: 'Test', user: 'main', createdAt: '2023-01-01T00:00:00.000Z' });
    const task2 = createTask({ name: 'Test', user: 'main', createdAt: '2023-01-01T00:00:00.000Z' });
    
    // Should produce the same hash if core properties are identical
    assert.strictEqual(task1.hash, task2.hash);
  });
});
