// core/now-state.js - what should the user see right now?
// Pure logic on top of the unified schedule (core/scheduler.js). Rendering is
// in features/now/now-view.js; routing (Now view vs Day planner) is in shell/app.js.
//
// Modes:
//   'doing' - a task, routine or event is running now -> show it with a timer
//   'break' - nothing now, but the next item starts within `breakWindowMinutes`
//             -> show a countdown to it
//   'free'  - nothing now and nothing soon -> the day planner is the default view

(() => {
  const DEFAULT_BREAK_WINDOW = 15;

  function toDate(value) {
    return value instanceof Date ? value : new Date(value);
  }

  // schedule: [{ task, startTime: Date, endTime: Date }]
  function computeNowState({ schedule = [], now = new Date(), breakWindowMinutes = DEFAULT_BREAK_WINDOW, upcomingCount = 4 } = {}) {
    const slots = schedule
      .map(slot => ({ ...slot, startTime: toDate(slot.startTime), endTime: toDate(slot.endTime) }))
      .filter(slot => !Number.isNaN(slot.startTime.getTime()) && !Number.isNaN(slot.endTime.getTime()))
      .sort((a, b) => a.startTime - b.startTime);

    const current = slots.find(slot => now >= slot.startTime && now < slot.endTime) || null;
    const future = slots.filter(slot => slot.endTime > now && slot !== current && (!current || slot.startTime >= current.startTime));
    const next = future[0] || null;
    const upcoming = future.slice(0, upcomingCount);

    let mode = 'free';
    if (current) {
      mode = 'doing';
    } else if (next && (next.startTime - now) <= breakWindowMinutes * 60000) {
      mode = 'break';
    }

    return {
      mode,
      current,
      next,
      upcoming,
      secondsLeft: current ? Math.max(0, Math.round((current.endTime - now) / 1000)) : null,
      totalSeconds: current ? Math.max(1, Math.round((current.endTime - current.startTime) / 1000)) : null,
      secondsUntilNext: next ? Math.max(0, Math.round((next.startTime - now) / 1000)) : null,
    };
  }

  // Which view should open by default: the Now view while something is
  // happening (or about to), otherwise the day planner.
  function defaultToolFor(state) {
    return state && state.mode !== 'free' ? 'home' : 'planner';
  }

  function formatDuration(totalSeconds) {
    const sec = Math.max(0, Math.round(totalSeconds || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Live state from the running app (scheduler + config).
  function getState(now = new Date()) {
    const scheduler = typeof window !== 'undefined' ? window.UnifiedScheduler : null;
    if (!scheduler?.getTodaySchedule) return null;
    const cfg = (typeof window !== 'undefined' ? window.ConfigManager?.getConfig?.() : null) || {};
    const breakWindowMinutes = Number.isFinite(Number(cfg.breakWindowMinutes)) ? Number(cfg.breakWindowMinutes) : DEFAULT_BREAK_WINDOW;
    let schedule = [];
    try {
      schedule = scheduler.getTodaySchedule(now);
    } catch (err) {
      console.warn('NowState: schedule unavailable', err);
    }
    return computeNowState({ schedule, now, breakWindowMinutes });
  }

  if (typeof window !== 'undefined') {
    window.NowState = { computeNowState, defaultToolFor, formatDuration, getState };
  }
})();
