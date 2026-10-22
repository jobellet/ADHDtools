// Guards against the classic "date string is UTC" bugs: habit streaks, calendar
// day cells and export filenames must use the user's local date, never UTC.
// A user in America/New_York at 8pm has a different UTC date than their local date.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const pad = n => String(n).padStart(2, '0');
const localDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseLocalDate = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Same logic as features/habits/habit-tracker.js (after the fix).
function calculateStreak(habitLogs, currentDate) {
  if (!habitLogs) return 0;
  let currentStreak = 0;
  let checkDate = new Date(currentDate);
  const todayStr = localDateStr(checkDate);
  if (!habitLogs[todayStr]) checkDate.setDate(checkDate.getDate() - 1);
  while (true) {
    const dateStr = localDateStr(checkDate);
    if (habitLogs[dateStr]) currentStreak += 1;
    else break;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return currentStreak;
}

function calculateLongestStreak(habitLogs) {
  if (!habitLogs) return 0;
  const dates = Object.keys(habitLogs).sort();
  let longest = 0;
  let current = 0;
  let prevDate = null;
  dates.forEach(dateStr => {
    const date = parseLocalDate(dateStr);
    if (prevDate) {
      const diff = Math.round((date - prevDate) / (1000 * 60 * 60 * 24));
      current = diff === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    if (current > longest) longest = current;
    prevDate = date;
  });
  return longest;
}

function completionRateForMonth(habitLogs, habitId, currentMonth, currentYear) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const completedDays = Object.keys(habitLogs[habitId] || {}).filter(dateStr => {
    const [y, m] = dateStr.split('-').map(Number);
    return m - 1 === currentMonth && y === currentYear;
  }).length;
  return Math.round((completedDays / daysInMonth) * 100);
}

describe('Local date handling (timezone safety)', () => {
  it('streak uses local date, not UTC (user behind UTC in the evening)', () => {
    // 2025-01-15 20:00 in America/New_York = 2025-01-16 01:00 UTC.
    // toISOString() would give "2025-01-16" — the wrong day for the user.
    const now = new Date(2025, 0, 15, 20, 0, 0); // local 8pm
    const logs = { '2025-01-15': true, '2025-01-14': true, '2025-01-13': true };
    assert.equal(calculateStreak(logs, now), 3);
  });

  it('streak counts yesterday when today is not yet logged', () => {
    const now = new Date(2025, 0, 15, 9, 0, 0);
    const logs = { '2025-01-14': true, '2025-01-13': true };
    assert.equal(calculateStreak(logs, now), 2);
  });

  it('longest streak counts consecutive local dates (robust across DST)', () => {
    // DST starts 2025-03-09 in the US: that day is only 23 hours long.
    // Comparing with Math.round keeps it a 1-day gap.
    const logs = { '2025-03-08': true, '2025-03-09': true, '2025-03-10': true };
    assert.equal(calculateLongestStreak(logs), 3);
  });

  it('completion rate matches the stored month, not the UTC-shifted one', () => {
    // new Date('2025-01-01') in UTC-5 is Dec 31 2024 local — getMonth() would be 11.
    // Parsing the string components avoids that trap.
    const logs = { habit1: { '2025-01-01': true, '2025-01-02': true } };
    const rate = completionRateForMonth(logs, 'habit1', 0, 2025); // January 2025
    assert.equal(rate, Math.round((2 / 31) * 100));
  });

  it('localDateStr never drifts across midnight UTC', () => {
    const lateEvening = new Date(2025, 5, 30, 23, 30, 0);
    assert.equal(localDateStr(lateEvening), '2025-06-30');
    const earlyMorning = new Date(2025, 0, 1, 0, 30, 0);
    assert.equal(localDateStr(earlyMorning), '2025-01-01');
  });
});
