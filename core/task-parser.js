// core/task-parser.js - natural-language task capture.
// parse(text) is a fully offline heuristic parser ("Call mom tomorrow at 5pm
// for 20 min !8"). parseSmart(text) upgrades to the configured AI provider when
// one is available and silently falls back to the heuristic otherwise, so the
// no-LLM experience always works.

(() => {
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  // The app persists planner/deadline values as local "YYYY-MM-DDTHH:MM" strings.
  function toLocalStamp(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function nextWeekday(from, dayIndex) {
    const date = new Date(from);
    let diff = (dayIndex - date.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // "friday" said on a Friday means next week
    date.setDate(date.getDate() + diff);
    return date;
  }

  function cleanName(name) {
    return name
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s,;.-]+$/g, '')
      .replace(/^[\s,;.-]+/g, '')
      .trim();
  }

  function parse(text, { now = new Date() } = {}) {
    let working = String(text || '').trim();
    const matched = [];
    if (!working) return null;

    const result = {
      name: '',
      deadline: null,
      plannerDate: null,
      durationMinutes: null,
      importance: null,
      isFixed: /\[FIX\]/i.test(working),
      source: 'heuristic',
    };

    // Importance: "!7" or "importance 7" (1-10).
    working = working.replace(/(?:^|\s)!(10|[1-9])\b/, (m, val) => {
      result.importance = parseInt(val, 10);
      matched.push('importance');
      return ' ';
    });
    working = working.replace(/\bimportance\s*[:=]?\s*(10|[1-9])\b/i, (m, val) => {
      result.importance = parseInt(val, 10);
      matched.push('importance');
      return ' ';
    });

    // Duration: "for 30 min", "~45m", "30 minutes", "1.5h", "for 2 hours".
    working = working.replace(/(?:\bfor\s+|~\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i, (m, val) => {
      result.durationMinutes = Math.round(parseFloat(val) * 60);
      matched.push('duration');
      return ' ';
    });
    if (result.durationMinutes === null) {
      working = working.replace(/(?:\bfor\s+|~\s*)?(\d+)\s*(?:minutes?|mins?|m)\b(?!\w)/i, (m, val) => {
        result.durationMinutes = parseInt(val, 10);
        matched.push('duration');
        return ' ';
      });
    }

    // Time of day: "at 5pm", "at 17:30", bare "5pm".
    let timeParts = null;
    working = working.replace(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m, h, min, mer) => {
      let hours = parseInt(h, 10) % 12;
      if (mer.toLowerCase() === 'pm') hours += 12;
      timeParts = { hours, minutes: min ? parseInt(min, 10) : 0 };
      matched.push('time');
      return ' ';
    });
    if (!timeParts) {
      working = working.replace(/\bat\s+([01]?\d|2[0-3]):([0-5]\d)\b/, (m, h, min) => {
        timeParts = { hours: parseInt(h, 10), minutes: parseInt(min, 10) };
        matched.push('time');
        return ' ';
      });
    }

    // Deadline vs. schedule intent: "by/before/due <when>" sets a deadline,
    // a plain date/time schedules the task (plannerDate).
    let isDeadline = false;
    let targetDate = null;

    working = working.replace(/\b(by|before|due(?:\s+on)?|until)\s+/i, () => {
      isDeadline = true;
      matched.push('deadline-word');
      return ' ';
    });

    // Explicit ISO date.
    working = working.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m, y, mo, d) => {
      targetDate = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
      matched.push('date');
      return ' ';
    });

    // Relative day words.
    if (!targetDate) {
      working = working.replace(/\btomorrow\b/i, () => {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 1);
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      working = working.replace(/\btonight\b/i, () => {
        targetDate = new Date(now);
        if (!timeParts) timeParts = { hours: 20, minutes: 0 };
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      working = working.replace(/\btoday\b/i, () => {
        targetDate = new Date(now);
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      working = working.replace(/\bnext\s+week\b/i, () => {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 7);
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      const dayPattern = new RegExp(`\\b(?:next\\s+|on\\s+)?(${WEEKDAYS.join('|')})\\b`, 'i');
      working = working.replace(dayPattern, (m, day) => {
        targetDate = nextWeekday(now, WEEKDAYS.indexOf(day.toLowerCase()));
        matched.push('date');
        return ' ';
      });
    }

    // A bare time ("at 5pm") with no date means today (or tomorrow if past).
    if (!targetDate && timeParts) {
      targetDate = new Date(now);
      const candidate = new Date(now);
      candidate.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      if (candidate <= now) targetDate.setDate(targetDate.getDate() + 1);
    }

    if (targetDate) {
      if (timeParts) {
        targetDate.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      } else {
        // Deadlines default to end of working day, schedules to 09:00.
        targetDate.setHours(isDeadline ? 18 : 9, 0, 0, 0);
      }
      const stamp = toLocalStamp(targetDate);
      if (isDeadline) {
        result.deadline = stamp;
      } else {
        result.plannerDate = stamp;
        result.deadline = stamp;
      }
      // A concrete scheduled time behaves like a fixed block.
      if (!isDeadline && timeParts) result.isFixed = true;
    }

    result.name = cleanName(working) || cleanName(String(text));
    result.matched = matched;
    return result;
  }

  async function parseSmart(text, { now = new Date() } = {}) {
    const heuristic = parse(text, { now });
    if (!window.AIAssistant?.isEnabled?.()) return heuristic;

    try {
      const prompt = [
        `Current local datetime: ${toLocalStamp(now)} (${WEEKDAYS[now.getDay()]}).`,
        `Convert this spoken/typed todo into a task object: "${text}"`,
        'Return JSON with keys:',
        'name (short imperative label, no dates in it),',
        'deadline (local "YYYY-MM-DDTHH:MM" or null; when the user says by/before/due),',
        'plannerDate (local "YYYY-MM-DDTHH:MM" or null; when the user names a specific slot to do it),',
        'durationMinutes (number or null),',
        'importance (1-10 or null; only if the user implies priority),',
        'isFixed (true only for appointment-like items at a specific time).',
      ].join('\n');
      const parsed = await window.AIAssistant.completeJSON(prompt, { maxTokens: 300 });
      if (!parsed || typeof parsed !== 'object' || !parsed.name) return heuristic;

      const stampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
      const importance = Number(parsed.importance);
      const duration = Number(parsed.durationMinutes);
      return {
        name: cleanName(String(parsed.name)),
        deadline: stampPattern.test(parsed.deadline || '') ? parsed.deadline.slice(0, 16) : heuristic.deadline,
        plannerDate: stampPattern.test(parsed.plannerDate || '') ? parsed.plannerDate.slice(0, 16) : heuristic.plannerDate,
        durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : heuristic.durationMinutes,
        importance: Number.isFinite(importance) ? Math.max(1, Math.min(10, Math.round(importance))) : heuristic.importance,
        isFixed: typeof parsed.isFixed === 'boolean' ? parsed.isFixed : heuristic.isFixed,
        source: 'ai',
        matched: heuristic.matched,
      };
    } catch (err) {
      console.warn('AI task parsing failed, using offline parser:', err.message);
      return heuristic;
    }
  }

  window.TaskParser = { parse, parseSmart, toLocalStamp };
})();
