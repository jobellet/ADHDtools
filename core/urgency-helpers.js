import { computeUrgencyFromDeadline } from './task-model.js';

const SKIP_LEDGER_KEY = 'adhd-task-skip-ledger';

function readLedger() {
  try {
    const raw = localStorage.getItem(SKIP_LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Failed to read skip ledger', err);
    return {};
  }
}

function writeLedger(ledger) {
  try {
    localStorage.setItem(SKIP_LEDGER_KEY, JSON.stringify(ledger));
  } catch (err) {
    console.warn('Failed to persist skip ledger', err);
  }
}

function incrementSkipCount(hash) {
  if (!hash) return 0;
  const ledger = readLedger();
  ledger[hash] = (ledger[hash] || 0) + 1;
  writeLedger(ledger);
  return ledger[hash];
}

function getSkipCount(hash) {
  if (!hash) return 0;
  const ledger = readLedger();
  return ledger[hash] || 0;
}

function computeSmoothedUrgency(task = {}) {
  const base = Number.isFinite(task.urgency)
    ? task.urgency
    : computeUrgencyFromDeadline(task.deadline);
  let urgency = Number.isFinite(base) ? base : 5;

  if (task.deadline) {
    const deadlineDate = new Date(task.deadline);
    if (!Number.isNaN(deadlineDate.getTime())) {
      const diffHours = (deadlineDate.getTime() - Date.now()) / 3_600_000;
      if (diffHours > 48) {
        const delta = urgency - 5;
        urgency = Math.max(1, Math.min(10, Math.round(5 + delta * 0.6)));
      }
    }
  }

  const skips = getSkipCount(task.hash || task.id);
  if (skips > 0) {
    urgency = Math.min(10, urgency + Math.max(1, Math.round(skips * 0.75)));
  }

  return urgency;
}

const UrgencyHelpers = {
  computeSmoothedUrgency,
  incrementSkipCount,
  getSkipCount,
};

if (typeof window !== 'undefined') {
  window.UrgencyHelpers = UrgencyHelpers;
}

export default UrgencyHelpers;
