// core/context-engine.js - decides what the user should see *right now*.
// Implements Step 1 of transition_plan.md: map time of day, routines, and the
// unified schedule to a single suggested context. Pure logic + a tiny amount
// of state; rendering lives in assistant-dashboard.js.

(() => {
  const ROUTINE_STORAGE_KEY = 'adhd-tool-routines';
  const DISMISS_KEY = 'adhd-context-dismissed'; // sessionStorage: context ids dismissed today

  function parseTimeToMinutes(hhmm, fallback = null) {
    if (typeof hhmm !== 'string') return fallback;
    const match = hhmm.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) return fallback;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  function getConfig() {
    return window.ConfigManager?.getConfig?.() || { dayStart: '07:00', dayEnd: '22:00' };
  }

  function loadRoutines() {
    try {
      const raw = localStorage.getItem(ROUTINE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function routineDurationMinutes(routine) {
    const total = (routine.tasks || []).reduce((sum, task) => sum + (parseInt(task.duration, 10) || 0), 0);
    return Math.max(total, 15);
  }

  // A routine is "active" when today is one of its weekdays and we are inside
  // [startTime, startTime + duration + 15min grace].
  function findActiveRoutine(now) {
    const day = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const candidates = loadRoutines().filter(r => Array.isArray(r.weekDays) && r.weekDays.includes(day) && (r.tasks || []).length);
    for (const routine of candidates) {
      const start = parseTimeToMinutes(routine.startTime);
      if (start === null) continue;
      const end = start + routineDurationMinutes(routine) + 15;
      if (nowMinutes >= start && nowMinutes < end) {
        return { routine, startMinutes: start, endMinutes: end };
      }
    }
    return null;
  }

  function getCurrentSlot(now) {
    try {
      const scheduler = window.UnifiedScheduler || window.TaskScheduler;
      return scheduler?.getCurrentTask ? scheduler.getCurrentTask(now) : null;
    } catch (err) {
      return null;
    }
  }

  function countPendingToday() {
    const activeUser = window.UserContext?.getActiveUser?.();
    const pending = window.TaskStore?.getPendingTasks?.() || [];
    return (activeUser ? pending.filter(t => t.user === activeUser) : pending).length;
  }

  // Returns { id, type, title, message, action: {label, tool} } or null-action contexts.
  function getContext(now = new Date()) {
    const cfg = getConfig();
    const dayStart = parseTimeToMinutes(cfg.dayStart, 7 * 60);
    const dayEnd = parseTimeToMinutes(cfg.dayEnd, 22 * 60);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const dateStr = now.toISOString().slice(0, 10);

    const activeRoutine = findActiveRoutine(now);
    if (activeRoutine) {
      return {
        id: `routine-${activeRoutine.routine.id}-${dateStr}`,
        type: 'routine',
        icon: 'fa-tasks-alt',
        title: `Routine time: ${activeRoutine.routine.name}`,
        message: 'This routine window is open right now. One thing at a time — the player will guide you.',
        action: { label: 'Start routine', tool: 'routine', routineId: activeRoutine.routine.id },
      };
    }

    const slot = getCurrentSlot(now);
    if (slot?.task) {
      const name = slot.task.name || slot.task.text || 'your scheduled task';
      return {
        id: `task-${slot.task.hash}-${dateStr}`,
        type: 'task',
        icon: 'fa-bullseye',
        title: `Now: ${name}`,
        message: 'This is the scheduled block for right now. Everything else can wait.',
        action: { label: 'Start focus session', tool: 'focus', taskSlot: slot },
      };
    }

    // Morning planning window: first hour of the day with no active schedule.
    if (nowMinutes >= dayStart && nowMinutes < dayStart + 60) {
      return {
        id: `plan-${dateStr}`,
        type: 'plan',
        icon: 'fa-sun',
        title: 'Good morning — plan your day',
        message: countPendingToday()
          ? 'Generate today\'s schedule so the app can tell you what to do, when.'
          : 'Capture what matters today, then generate a schedule.',
        action: { label: 'Open Day Planner', tool: 'planner' },
      };
    }

    // Evening review window: last 90 minutes of the day.
    if (nowMinutes >= dayEnd - 90 && nowMinutes < dayEnd) {
      return {
        id: `review-${dateStr}`,
        type: 'review',
        icon: 'fa-moon',
        title: 'Evening review',
        message: 'Check what you completed today and let tomorrow\'s plan build itself.',
        action: { label: 'See rewards & achievements', tool: 'rewards' },
      };
    }

    if (countPendingToday()) {
      return {
        id: `idle-${dateStr}`,
        type: 'idle',
        icon: 'fa-compass',
        title: 'Nothing scheduled right now',
        message: 'You have pending tasks. Generate a schedule and the app will pick the next one for you.',
        action: { label: 'Generate schedule', tool: 'planner', generate: true },
      };
    }

    return {
      id: `empty-${dateStr}`,
      type: 'empty',
      icon: 'fa-feather',
      title: 'All clear',
      message: 'No pending tasks. Add one below — type or speak it naturally.',
      action: null,
    };
  }

  function isDismissed(contextId) {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) && list.includes(contextId);
    } catch (err) {
      return false;
    }
  }

  function dismiss(contextId) {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!list.includes(contextId)) list.push(contextId);
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(list));
    } catch (err) { /* session storage unavailable */ }
  }

  window.ContextEngine = { getContext, isDismissed, dismiss, findActiveRoutine };
})();
