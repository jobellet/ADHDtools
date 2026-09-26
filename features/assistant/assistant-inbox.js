// assistant-inbox.js — applies the changes an AI assistant queued through the MCP server (mcp/).
// The MCP server writes them to a private Drive file (the "inbox"); this script reads it while the
// app is open (on start, when the user comes back, every 2 minutes), applies each new change once
// through TaskStore, remembers it in `adhd-assistant-applied`, and backs up to Drive so the
// assistant sees the result. Change rules live in core/assistant-ops.js (shared with the MCP server).
(function () {
  const CHECK_EVERY_MS = 2 * 60 * 1000;
  const LEDGER_MAX = 500;
  let running = null;

  const t = (key, vars, fallback) => window.I18n?.t(key, vars, fallback) ?? fallback;

  function readLedger(key) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  // Run one effect through the app's own API (tombstones, events, learning…).
  function runEffect(e) {
    const store = window.TaskStore;
    if (e.add) store.addTask(e.add);
    else if (e.update) store.updateTaskByHash(e.update, e.changes);
    else if (e.complete) store.markComplete(e.complete);
    else if (e.delete) store.deleteTasks([e.delete]);
  }

  // Apply the waiting ops of `inbox`. Returns { applied, failed }.
  async function applyInbox(inbox, now = new Date()) {
    const ops = await import('../../core/assistant-ops.js');
    const scheduler = window.UnifiedScheduler;
    if (!window.TaskStore || !scheduler) return { applied: 0, failed: 0 };
    const ledger = readLedger(ops.APPLIED_KEY);
    const waiting = ops.pendingOps(inbox, ledger, now);
    let applied = 0;
    let failed = 0;
    waiting.forEach(op => {
      const plan = ops.planOp(op, {
        tasks: window.TaskStore.getAllTasks(),
        user: window.UserContext?.getActiveUser?.() || null,
        onConflict: 'move', // the day may have changed since the assistant looked: never double-book
        defaultMinutes: Number(window.ConfigManager?.getConfig?.().defaultTaskMinutes) || 25,
        findConflicts: args => scheduler.findConflicts(args),
        findNextFreeSlot: args => scheduler.findNextFreeSlot(args),
      });
      if (plan.error) failed += 1;
      else {
        plan.effects.forEach(runEffect);
        applied += 1;
      }
      ledger.push({ id: op.id, at: now.toISOString(), ok: !plan.error, message: plan.error || plan.message });
    });
    if (!waiting.length) return { applied, failed };
    localStorage.setItem(ops.APPLIED_KEY, JSON.stringify(ledger.slice(-LEDGER_MAX)));
    if (applied) {
      window.EventBus?.dispatchEvent(new CustomEvent('dataChanged'));
      window.dispatchEvent(new Event('scheduleNeedsRefresh'));
      window.DataManager?.showNotification(t('assistant.applied', { n: applied }, `Your assistant made ${applied} change(s).`), 'success');
    }
    if (failed) {
      window.DataManager?.showNotification(t('assistant.failed', { n: failed }, `${failed} assistant change(s) could not be applied.`), 'error');
    }
    return { applied, failed };
  }

  // Read the inbox from Drive and apply it. Never opens a Google popup by itself.
  async function check({ interactive = false } = {}) {
    if (running) return running;
    running = (async () => {
      try {
        const sync = window.DriveSync;
        if (!sync?.isAutoSyncOn?.() && !interactive) return null;
        const ops = await import('../../core/assistant-ops.js');
        const inbox = await sync.readAppFile(ops.INBOX_FILENAME, { interactive });
        if (!inbox) return null;
        const result = await applyInbox(inbox);
        // Back up at once, so the assistant sees what was applied.
        if (result.applied || result.failed) await sync.backupToDrive({ silent: true, skipInbox: true });
        return result;
      } catch (err) {
        console.warn('Assistant inbox skipped:', err.message);
        return null;
      } finally {
        running = null;
      }
    })();
    return running;
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => check(), 1500); // after the startup pull (services/drive-sync.js)
    setInterval(() => { if (document.visibilityState === 'visible') check(); }, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  });

  window.AssistantInbox = { check, applyInbox };
})();
