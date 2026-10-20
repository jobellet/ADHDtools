// core/task-parser.js - natural-language task & event capture (EN, FR, DE, ES).
// parse(text) is a fully offline heuristic parser ("Call mom tomorrow at 5pm
// for 20 min !8" or "Mettre la brosse à dents à 12h50 pendant 15 min").
// parseSmart(text) upgrades to the configured AI provider when one is available
// and silently falls back to the heuristic otherwise, so the no-LLM experience
// always works.

(() => {
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const WEEKDAY_ALIASES = {
    sunday: 0, dimanche: 0, sonntag: 0, domingo: 0,
    monday: 1, lundi: 1, montag: 1, lunes: 1,
    tuesday: 2, mardi: 2, dienstag: 2, martes: 2,
    wednesday: 3, mercredi: 3, mittwoch: 3, miércoles: 3, miercoles: 3,
    thursday: 4, jeudi: 4, donnerstag: 4, jueves: 4,
    friday: 5, vendredi: 5, freitag: 5, viernes: 5,
    saturday: 6, samedi: 6, samstag: 6, sábado: 6, sabado: 6,
  };

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  // The app persists planner/deadline values as local "YYYY-MM-DDTHH:MM" strings.
  function toLocalStamp(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function toLocalDateStr(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function nextWeekday(from, dayIndex) {
    const date = new Date(from);
    let diff = (dayIndex - date.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // "friday" said on a Friday means next week
    date.setDate(date.getDate() + diff);
    return date;
  }

  function cleanName(name) {
    return String(name || '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s,;.-]+$/g, '')
      .replace(/^[\s,;.-]+/g, '')
      .replace(/^(?:de|d'|que|qu'|pour|à|a)\s+/i, '')
      .trim();
  }

  // Normalizes AI or user date/time strings ("2026-10-20T12:50", "2026-10-20 12:50", "12:50", "12h50")
  // into a local "YYYY-MM-DDTHH:MM" stamp.
  function normalizeDateTime(val, now = new Date()) {
    if (!val || typeof val !== 'string') return null;
    const s = val.trim();
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2})[:h](\d{2})/i);
    if (iso) {
      return `${iso[1]}T${pad(parseInt(iso[2], 10))}:${iso[3]}`;
    }
    const dateOnly = s.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateOnly) {
      return `${dateOnly[1]}T09:00`;
    }
    const timeOnly = s.match(/^(\d{1,2})(?:[:h]|\s*heures?\s*)(\d{2})?(?:\s*(am|pm))?$/i);
    if (timeOnly) {
      let h = parseInt(timeOnly[1], 10);
      const m = timeOnly[2] ? parseInt(timeOnly[2], 10) : 0;
      const mer = (timeOnly[3] || '').toLowerCase();
      if (mer === 'pm' && h < 12) h += 12;
      if (mer === 'am' && h === 12) h = 0;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${toLocalDateStr(now)}T${pad(h)}:${pad(m)}`;
      }
    }
    return null;
  }

  // Gather candidate tasks/events on the current day to support "après <nom>" / "after <name>".
  function getExistingItems(now = new Date()) {
    if (typeof window === 'undefined') return [];
    const items = [];
    const todayStr = toLocalDateStr(now);
    const tasks = window.TaskStore?.getPendingTasks?.() || [];
    tasks.forEach(t => {
      const name = (t.name || t.text || '').replace(/\[(FIX|FLEX)\]\s*/gi, '').trim();
      if (!name) return;
      let startMin = null;
      let endMin = null;
      if (t.plannerDate && t.plannerDate.length >= 16) {
        const [h, m] = t.plannerDate.slice(11, 16).split(':').map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
          startMin = h * 60 + m;
          endMin = startMin + (Number(t.durationMinutes || t.duration) || 30);
        }
      }
      items.push({
        hash: t.hash || t.id,
        name,
        dateStr: t.plannerDate ? t.plannerDate.slice(0, 10) : todayStr,
        startMin,
        endMin,
        isTask: true,
      });
    });
    try {
      const cal = JSON.parse(localStorage.getItem('adhd-calendar-events') || '[]');
      cal.filter(ev => ev.start && ev.start.startsWith(todayStr)).forEach(ev => {
        const name = (ev.title || '').trim();
        if (!name) return;
        const [sh, sm] = ev.start.slice(11, 16).split(':').map(Number);
        const [eh, em] = (ev.end ? ev.end.slice(11, 16) : '').split(':').map(Number);
        const startMin = Number.isFinite(sh) && Number.isFinite(sm) ? sh * 60 + sm : null;
        const endMin = Number.isFinite(eh) && Number.isFinite(em) ? eh * 60 + em : (startMin !== null ? startMin + 60 : null);
        items.push({ hash: null, name, dateStr: todayStr, startMin, endMin, isTask: false });
      });
    } catch { /* ignore */ }
    return items;
  }

  function findMatchingItem(query, items) {
    const q = String(query || '').toLowerCase().trim();
    if (!q || q.length < 2) return null;
    for (const item of items) {
      const n = item.name.toLowerCase();
      if (n === q || n.includes(q) || q.includes(n)) return item;
    }
    const qWords = q.split(/\s+/).filter(w => w.length > 2);
    if (!qWords.length) return null;
    let best = null;
    let bestScore = 0;
    for (const item of items) {
      const n = item.name.toLowerCase();
      const score = qWords.filter(w => n.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return bestScore > 0 ? best : null;
  }

  function parse(text, { now = new Date(), existingItems = null } = {}) {
    let working = String(text || '').trim();
    const matched = [];
    if (!working) return null;

    const result = {
      name: '',
      deadline: null,
      plannerDate: null,
      durationMinutes: null,
      importance: null,
      urgency: null,
      isFixed: /\[FIX\]/i.test(working),
      isEvent: false,
      recurrence: null,
      dependency: null,
      location: null,
      travelMode: null,
      source: 'heuristic',
    };

    // Strip conversational prefixes in FR/EN/DE/ES ("ajoute une tâche", "créer un événement", "add a task to", etc.)
    working = working.replace(/^(?:(?:ajoute(?:r)?|crée(?:r)?|planifie(?:r)?|mets?|mettre\s+une\s+tâche|add|create|schedule|plan)\s+(?:une?\s+|la\s+|le\s+|a\s+|an\s+)?(?:tâche|tache|événement|evenement|event|task|rendez-vous|rdv)\s*(?:pour|de|d'|que|qu'|to|for|:)?\s*)/i, () => {
      matched.push('prefix');
      return '';
    });

    // Explicit type hints: event vs task
    if (/\b(?:c'est\s+un\s+événement|comme\s+événement|type\s+événement|as\s+an?\s+event)\b/i.test(working)) {
      result.isEvent = true;
      result.isFixed = true;
      working = working.replace(/\b(?:,?\s*(?:et\s+)?(?:c'est\s+un\s+événement|comme\s+événement|type\s+événement|as\s+an?\s+event))\b/gi, ' ');
      matched.push('type');
    } else if (/\b(?:c'est\s+une\s+tâche|comme\s+tâche|type\s+tâche|as\s+a\s+task)\b/i.test(working)) {
      result.isEvent = false;
      working = working.replace(/\b(?:,?\s*(?:et\s+)?(?:c'est\s+une\s+tâche|comme\s+tâche|type\s+tâche|as\s+a\s+task))\b/gi, ' ');
      matched.push('type');
    } else if (/^(?:rendez-vous|rdv|réunion|événement|appointment|meeting)\b/i.test(working)) {
      result.isEvent = true;
      result.isFixed = true;
    }

    // Recurrence: daily, weekdays, weekly (EN, FR, DE, ES)
    if (/\b(?:tous\s+les\s+jours\s+ouvrés|en\s+semaine|du\s+lundi\s+au\s+vendredi|every\s+weekday|weekdays|werktags|entre\s+semana)\b/i.test(working)) {
      result.recurrence = 'weekdays';
      working = working.replace(/\b(?:tous\s+les\s+jours\s+ouvrés|en\s+semaine|du\s+lundi\s+au\s+vendredi|every\s+weekday|weekdays|werktags|entre\s+semana)\b/gi, ' ');
      matched.push('recurrence');
    } else if (/\b(?:tous\s+les\s+jours|chaque\s+jour|quotidien(?:nement)?|every\s+day|daily|jeden\s+tag|täglich|todos\s+los\s+d[ií]as|diario)\b/i.test(working)) {
      result.recurrence = 'daily';
      working = working.replace(/\b(?:tous\s+les\s+jours|chaque\s+jour|quotidien(?:nement)?|every\s+day|daily|jeden\s+tag|täglich|todos\s+los\s+d[ií]as|diario)\b/gi, ' ');
      matched.push('recurrence');
    } else if (/\b(?:toutes\s+les\s+semaines|chaque\s+semaine|hebdomadaire|chaque\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)|every\s+week|weekly|every\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|jede\s+woche|wöchentlich|cada\s+semana)\b/i.test(working)) {
      result.recurrence = 'weekly';
      working = working.replace(/\b(?:toutes\s+les\s+semaines|chaque\s+semaine|hebdomadaire|every\s+week|weekly|jede\s+woche|wöchentlich|cada\s+semana)\b/gi, ' ');
      matched.push('recurrence');
    }

    // Travel mode: walk, bike, car
    if (/\b(?:à\s+pied|a\s+pied|en\s+marchant|on\s+foot|walking|zu\s+fuß|a\s+pie)\b/i.test(working)) {
      result.travelMode = 'walk';
      working = working.replace(/\b(?:à\s+pied|a\s+pied|en\s+marchant|on\s+foot|walking|zu\s+fuß|a\s+pie)\b/gi, ' ');
      matched.push('travelMode');
    } else if (/\b(?:à\s+vélo|a\s+velo|en\s+vélo|by\s+bike|cycling|mit\s+dem\s+fahrrad|en\s+bici)\b/i.test(working)) {
      result.travelMode = 'bike';
      working = working.replace(/\b(?:à\s+vélo|a\s+velo|en\s+vélo|by\s+bike|cycling|mit\s+dem\s+fahrrad|en\s+bici)\b/gi, ' ');
      matched.push('travelMode');
    } else if (/\b(?:en\s+voiture|by\s+car|driving|mit\s+dem\s+auto|en\s+coche)\b/i.test(working)) {
      result.travelMode = 'car';
      working = working.replace(/\b(?:en\s+voiture|by\s+car|driving|mit\s+dem\s+auto|en\s+coche)\b/gi, ' ');
      matched.push('travelMode');
    }

    // Importance & urgency: "!7", "importance 7", "très important", "urgent"
    working = working.replace(/(?:^|\s)!(10|[1-9])\b/, (m, val) => {
      result.importance = parseInt(val, 10);
      matched.push('importance');
      return ' ';
    });
    working = working.replace(/\b(?:importance|wichtigkeit|importancia)\s*[:=]?\s*(10|[1-9])\b/i, (m, val) => {
      result.importance = parseInt(val, 10);
      matched.push('importance');
      return ' ';
    });
    working = working.replace(/\b(?:urgence|urgency|dringlichkeit|urgencia)\s*[:=]?\s*(10|[1-9])\b/i, (m, val) => {
      result.urgency = parseInt(val, 10);
      matched.push('urgency');
      return ' ';
    });
    if (result.importance === null && /\b(?:très\s+important|very\s+important|sehr\s+wichtig|muy\s+importante)\b/i.test(working)) {
      result.importance = 9;
      working = working.replace(/\b(?:,?\s*c'est\s+)?(?:très\s+important|very\s+important|sehr\s+wichtig|muy\s+importante)\b/gi, ' ');
      matched.push('importance');
    }
    if (result.urgency === null && /\b(?:très\s+urgent|urgent|very\s+urgent|dringend|urgente)\b/i.test(working)) {
      result.urgency = 9;
      working = working.replace(/\b(?:,?\s*c'est\s+)?(?:très\s+urgent|very\s+urgent)\b/gi, ' ');
      matched.push('urgency');
    }

    // Dependency: "après <task>" / "after <task>" / "à faire après <task>"
    let dependencyEndTimeParts = null;
    const candidates = existingItems || getExistingItems(now);
    if (candidates.length > 0) {
      const afterRe = /\b(?:(?:à\s+faire|a\s+faire|do\s+(?:this|it))\s+)?(?:juste\s+|right\s+)?(?:après|apres|after|nach|despu[eé]s\s+de)\s+(?:l['’]?\s*(?:événement|evenement|tâche|tache)\s+)?([^,.;!?]+?)(?=\s+(?:à|a|at|pendant|pour|for|demain|tomorrow|aujourd'hui|today|!\d|$)|[,.;!?]|$)/i;
      const afterMatch = working.match(afterRe);
      if (afterMatch) {
        const found = findMatchingItem(afterMatch[1], candidates);
        if (found) {
          if (found.hash) result.dependency = found.hash;
          if (Number.isFinite(found.endMin)) {
            dependencyEndTimeParts = {
              hours: Math.floor(found.endMin / 60) % 24,
              minutes: found.endMin % 60,
            };
          }
          working = working.replace(afterMatch[0], ' ');
          matched.push('dependency');
        }
      }
    }

    // Deadline vs. schedule intent: "by/before/due/avant/d'ici/pour le <when>" sets a deadline,
    // a plain date/time schedules the task (plannerDate).
    let isDeadline = false;
    let targetDate = null;
    let hasExactTime = false;
    let timeParts = null;

    working = working.replace(/\b(by|before|due(?:\s+on)?|until|avant(?:\s+le)?|d['’]ici(?:\s+le)?|échéance|echeance|bis(?:\s+zum)?|antes\s+de)\s+/i, () => {
      isDeadline = true;
      matched.push('deadline-word');
      return ' ';
    });

    // "maintenant" / "start now" / "tout de suite" / "right now"
    if (/\b(?:(?:ça|ca|et\s+ça)\s+commence\s+maintenant|commence(?:r)?\s+maintenant|dès\s+maintenant|tout\s+de\s+suite|maintenant|start(?:s|ing)?\s+now|right\s+now|ab\s+sofort|jetzt\s+starten|empezar\s+ahora|ahora\s+mismo)\b/i.test(working)) {
      targetDate = new Date(now);
      timeParts = { hours: now.getHours(), minutes: now.getMinutes() };
      hasExactTime = true;
      result.isFixed = true;
      working = working.replace(/\b(?:(?:,?\s*(?:et\s+)?(?:ça|ca)\s+commence\s+maintenant)|commence(?:r)?\s+maintenant|dès\s+maintenant|tout\s+de\s+suite|maintenant|start(?:s|ing)?\s+now|right\s+now|ab\s+sofort|jetzt\s+starten|empezar\s+ahora|ahora\s+mismo)\b/gi, ' ');
      matched.push('time');
    }

    // Time range: "de 12h50 à 13h20", "from 12:50 to 13:20", "entre 14h et 15h30"
    const rangeRe = /\b(?:de|entre|from|between|von)\s+([01]?\d|2[0-3])\s*(?:[:h]|\s*heures?\s*)([0-5]\d)?\s*(?:à|a|et|to|and|bis|-|–)\s*([01]?\d|2[0-3])\s*(?:[:h]|\s*heures?\s*)([0-5]\d)?\b/i;
    const rangeMatch = working.match(rangeRe);
    if (rangeMatch) {
      const sh = parseInt(rangeMatch[1], 10);
      const sm = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
      const eh = parseInt(rangeMatch[3], 10);
      const em = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      if (endMins > startMins) {
        timeParts = { hours: sh, minutes: sm };
        result.durationMinutes = endMins - startMins;
        matched.push('time', 'duration');
        working = working.replace(rangeMatch[0], ' ');
      }
    }

    // Relative precise offset: "+15m", "+2h", "dans 15 minutes", "in 20 min"
    working = working.replace(/(?:^|\s)\+(\d+)([mh])\b/i, (m, val, unit) => {
      targetDate = new Date(now);
      const amount = parseInt(val, 10);
      if (unit.toLowerCase() === 'h') {
        targetDate.setHours(targetDate.getHours() + amount);
      } else {
        targetDate.setMinutes(targetDate.getMinutes() + amount);
      }
      hasExactTime = true;
      matched.push('date');
      return ' ';
    });
    working = working.replace(/\b(?:dans|in)\s+(\d+)\s*(minutes?|mins?|heures?|hours?|hrs?|h)\b/i, (m, val, unit) => {
      targetDate = new Date(now);
      const amount = parseInt(val, 10);
      if (/^h/i.test(unit)) {
        targetDate.setHours(targetDate.getHours() + amount);
      } else {
        targetDate.setMinutes(targetDate.getMinutes() + amount);
      }
      hasExactTime = true;
      matched.push('date');
      return ' ';
    });

    // Spoken special durations: "une demi-heure" (30), "une heure et demie" (90), "un quart d'heure" (15)
    if (result.durationMinutes === null) {
      if (/\b(?:pendant\s+|pour\s+|durée\s+|d['’])?(?:une\s+heure\s+et\s+demie|1\s*h\s*30\s*min)\b/i.test(working)) {
        result.durationMinutes = 90;
        working = working.replace(/\b(?:pendant\s+|pour\s+|durée\s+|d['’])?(?:une\s+heure\s+et\s+demie|1\s*h\s*30\s*min)\b/i, ' ');
        matched.push('duration');
      } else if (/\b(?:pendant\s+|pour\s+|durée\s+|d['’])?(?:une\s+)?demi[- ]heure\b/i.test(working)) {
        result.durationMinutes = 30;
        working = working.replace(/\b(?:pendant\s+|pour\s+|durée\s+|d['’])?(?:une\s+)?demi[- ]heure\b/i, ' ');
        matched.push('duration');
      } else if (/\b(?:pendant\s+|pour\s+|durée\s+|d['’])?(?:un\s+)?quart\s+d['’]heure\b/i.test(working)) {
        result.durationMinutes = 15;
        working = working.replace(/\b(?:pendant\s+|pour\s+|durée\s+|d['’])?(?:un\s+)?quart\s+d['’]heure\b/i, ' ');
        matched.push('duration');
      } else if (/\b(?:pendant\s+|pour\s+|durée\s+|for\s+|für\s+|por\s+|durante\s+)(?:une\s+heure|an?\s+hour|eine\s+stunde|una\s+hora)\b/i.test(working)) {
        result.durationMinutes = 60;
        working = working.replace(/\b(?:pendant\s+|pour\s+|durée\s+|for\s+|für\s+|por\s+|durante\s+)(?:une\s+heure|an?\s+hour|eine\s+stunde|una\s+hora)\b/i, ' ');
        matched.push('duration');
      }
    }

    // Explicit duration with preposition ("pendant 30 min", "pour 20 minutes", "for 2 hours", "durée 45 min")
    if (result.durationMinutes === null) {
      working = working.replace(/\b(?:pendant|pour|durée(?:\s+de)?|for|für|por|durante)\s+(\d+)\s*(?:heures?|hours?|hrs?|h)\s*(\d{1,2})?\s*(?:minutes?|mins?|m)?\b/i, (m, h, min) => {
        result.durationMinutes = parseInt(h, 10) * 60 + (min ? parseInt(min, 10) : 0);
        matched.push('duration');
        return ' ';
      });
    }
    if (result.durationMinutes === null) {
      working = working.replace(/\b(?:pendant|pour|durée(?:\s+de)?|for|für|por|durante)\s+(\d+)\s*(?:minutes?|mins?|minuten|minutos|m)\b/i, (m, val) => {
        result.durationMinutes = parseInt(val, 10);
        matched.push('duration');
        return ' ';
      });
    }

    // Time of day:
    // 1. "midi 50", "midi et demi", "midi", "minuit"
    if (!timeParts) {
      working = working.replace(/\b(?:(?:ça|ca)\s+commence\s+)?(?:à|a|vers|at)?\s*midi\s+et\s+demi(?:e)?\b/i, () => {
        timeParts = { hours: 12, minutes: 30 };
        matched.push('time');
        return ' ';
      });
    }
    if (!timeParts) {
      working = working.replace(/\b(?:(?:ça|ca)\s+commence\s+)?(?:à|a|vers|at)?\s*midi(?:\s+([0-5]?\d))?\b/i, (m, min) => {
        timeParts = { hours: 12, minutes: min ? parseInt(min, 10) : 0 };
        matched.push('time');
        return ' ';
      });
    }
    if (!timeParts) {
      working = working.replace(/\b(?:(?:ça|ca)\s+commence\s+)?(?:à|a|vers|at)?\s*minuit(?:\s+([0-5]?\d))?\b/i, (m, min) => {
        timeParts = { hours: 0, minutes: min ? parseInt(min, 10) : 0 };
        matched.push('time');
        return ' ';
      });
    }

    // 2. "at 5pm", "5:30pm"
    if (!timeParts) {
      working = working.replace(/\b(?:(?:at|à|a)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m, h, min, mer) => {
        let hours = parseInt(h, 10) % 12;
        if (mer.toLowerCase() === 'pm') hours += 12;
        timeParts = { hours, minutes: min ? parseInt(min, 10) : 0 };
        matched.push('time');
        return ' ';
      });
    }

    // 3. French/European "à 12h50", "commence à 12h50", "à 12 heures 50", "à 14h", "12h50"
    if (!timeParts) {
      working = working.replace(/\b(?:(?:et\s+)?(?:ça|ca|il|elle|la\s+tâche|l['’]événement)\s+)?(?:commence(?:nt|r)?\s+|débute(?:nt|r)?\s+|start(?:s|ing)?\s+)?(?:à|a|vers|at|um|a\s+las)\s*([01]?\d|2[0-3])\s*(?:h|heures?|uhr|:)\s*([0-5]\d)?\b/i, (m, h, min) => {
        timeParts = { hours: parseInt(h, 10), minutes: min ? parseInt(min, 10) : 0 };
        matched.push('time');
        return ' ';
      });
    }
    // Bare "12h50" or "12:50" (when minutes are present, e.g. "12h50" or "12:50")
    if (!timeParts) {
      working = working.replace(/\b([01]?\d|2[0-3])\s*(?:h|heures?|:)\s*([0-5]\d)\b/i, (m, h, min) => {
        timeParts = { hours: parseInt(h, 10), minutes: parseInt(min, 10) };
        matched.push('time');
        return ' ';
      });
    }

    // Remaining bare duration: "for 30 min", "~45m", "30 minutes", "1.5h", "2 hours", "30 min"
    if (result.durationMinutes === null) {
      working = working.replace(/(?:\bfor\s+|~\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|heures?|stunden?|horas?|h)\b/i, (m, val) => {
        result.durationMinutes = Math.round(parseFloat(val) * 60);
        matched.push('duration');
        return ' ';
      });
    }
    if (result.durationMinutes === null) {
      working = working.replace(/(?:\bfor\s+|~\s*)?(\d+)\s*(?:minutes?|mins?|minuten|minutos|m)\b(?!\w)/i, (m, val) => {
        result.durationMinutes = parseInt(val, 10);
        matched.push('duration');
        return ' ';
      });
    }

    // If no explicit time was spoken, but a dependency ("après X") was matched and X has an end time today,
    // default the start time to right after X ends!
    if (!timeParts && dependencyEndTimeParts) {
      timeParts = dependencyEndTimeParts;
      targetDate = new Date(now);
      matched.push('time-from-dependency');
    }

    // Explicit ISO date.
    if (!targetDate) {
      working = working.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m, y, mo, d) => {
        targetDate = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
        matched.push('date');
        return ' ';
      });
    }

    // Relative day words (EN, FR, DE, ES).
    if (!targetDate) {
      working = working.replace(/\b(tomorrow|demain|morgen|mañana|manana)\b/i, () => {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 1);
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      working = working.replace(/\b(tonight|ce\s+soir|heute\s+abend|esta\s+noche)\b/i, () => {
        targetDate = new Date(now);
        if (!timeParts) timeParts = { hours: 20, minutes: 0 };
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      working = working.replace(/\b(today|aujourd['’]?hui|heute|hoy)\b/i, () => {
        targetDate = new Date(now);
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      working = working.replace(/\b(next\s+week|la\s+semaine\s+prochaine|nächste\s+woche|la\s+pr[oó]xima\s+semana)\b/i, () => {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 7);
        matched.push('date');
        return ' ';
      });
    }
    if (!targetDate) {
      const dayNames = Object.keys(WEEKDAY_ALIASES).join('|');
      const dayPattern = new RegExp(`\\b(?:next\\s+|on\\s+|le\\s+|ce\\s+|am\\s+|el\\s+)?(${dayNames})(?:\\s+prochain)?\\b`, 'i');
      working = working.replace(dayPattern, (m, day) => {
        const idx = WEEKDAY_ALIASES[day.toLowerCase()];
        if (idx !== undefined) {
          targetDate = nextWeekday(now, idx);
          matched.push('date');
        }
        return ' ';
      });
    }

    // A bare time ("at 5pm" / "à 12h50") with no date means today (or tomorrow if >2h in the past).
    if (!targetDate && timeParts) {
      targetDate = new Date(now);
      const candidate = new Date(now);
      candidate.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      if (candidate.getTime() < now.getTime() - 2 * 3600 * 1000) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    if (targetDate) {
      if (timeParts) {
        targetDate.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      } else if (!hasExactTime) {
        // Deadlines default to end of working day, schedules to 09:00.
        targetDate.setHours(isDeadline ? 18 : 9, 0, 0, 0);
      }
      const stamp = toLocalStamp(targetDate);
      if (isDeadline) {
        result.deadline = stamp;
      } else {
        result.plannerDate = stamp;
        result.deadline = null;
      }
      // A concrete scheduled time behaves like a fixed block.
      if (!isDeadline && timeParts) result.isFixed = true;
    }

    result.name = cleanName(working) || cleanName(String(text));
    result.matched = matched;
    return result;
  }

  async function parseSmart(text, { now = new Date() } = {}) {
    const existingItems = getExistingItems(now);
    const heuristic = parse(text, { now, existingItems });
    if (!(typeof window !== "undefined" ? window.AIAssistant : null)?.isEnabled?.()) return heuristic;

    try {
      const currentLang = (typeof window !== "undefined" && window.I18n?.getLang?.()) || 'en';
      const contextList = existingItems.slice(0, 20).map(item => ({
        id: item.hash,
        name: item.name,
        endTime: Number.isFinite(item.endMin) ? `${pad(Math.floor(item.endMin / 60))}:${pad(item.endMin % 60)}` : null,
      }));
      const prompt = [
        `Current local datetime: ${toLocalStamp(now)} (${WEEKDAYS[now.getDay()]}).`,
        `Active user language: ${currentLang}. Auto-detect the language of the user input (French, English, German, Spanish, etc.).`,
        contextList.length ? `Existing tasks/events today (for "after X" / "après X" dependency matching): ${JSON.stringify(contextList)}` : '',
        `Convert this spoken/typed command into a structured task/event object: "${text}"`,
        'Return JSON with keys:',
        'name (short imperative label in the same language as the user input, stripped of time/duration/recurrence metadata),',
        'plannerDate (local "YYYY-MM-DDTHH:MM" or null; set when the user gives a start time like "à 12h50", "commence à 12h50", "at 2pm", "maintenant"/"start now", or if "après X" is said and X has an endTime, use X\'s endTime today),',
        'deadline (local "YYYY-MM-DDTHH:MM" or null; ONLY set when the user explicitly states a due date/deadline with words like by/before/due/avant/d\'ici/bis/para. If the user only states a start time, deadline MUST be null),',
        'durationMinutes (number; if the user specifies duration or a start-end range like "de 12h50 à 13h20", use that exact duration in minutes; otherwise estimate a realistic duration in minutes),',
        'importance (1-10 or null; only if the user implies priority),',
        'urgency (1-10 or null; only if the user implies urgency),',
        'isFixed (boolean; true when a specific start time is given or for appointments/events),',
        'isEvent (boolean; true if this is an appointment, meeting, pause/break, or calendar event rather than a todo task),',
        'recurrence ("daily" | "weekdays" | "weekly" | null; if the user says every day / tous les jours / en semaine / chaque semaine),',
        'dependency (string task id from Existing tasks/events if the user says "after X" / "après X", else null),',
        'location (string place/address if mentioned, else null),',
        'travelMode ("walk" | "bike" | "car" | null; if mentioned),',
        'needsBreakdown (boolean; true if the task is complex enough that breaking it down into smaller steps would help someone with ADHD).',
      ].filter(Boolean).join('\n');

      const parsed = await (typeof window !== "undefined" ? window.AIAssistant : null).completeJSON(prompt, { maxTokens: 350 });
      if (!parsed || typeof parsed !== 'object' || !parsed.name) return heuristic;

      const aiPlannerDate = normalizeDateTime(
        parsed.plannerDate || parsed.startTime || parsed.start || parsed.time,
        now
      ) || heuristic.plannerDate;

      let aiDeadline = normalizeDateTime(parsed.deadline, now);
      if (!aiDeadline && heuristic.deadline) aiDeadline = heuristic.deadline;
      // Never treat a scheduled start time as an overdue deadline unless a deadline word was used
      if (aiDeadline && aiPlannerDate && aiDeadline.slice(0, 16) === aiPlannerDate.slice(0, 16) && !heuristic.matched?.includes('deadline-word')) {
        aiDeadline = null;
      }

      const importance = Number(parsed.importance);
      const urgency = Number(parsed.urgency);
      const duration = Number(parsed.durationMinutes ?? parsed.duration ?? parsed.minutes);
      const validRecurrence = ['daily', 'weekdays', 'weekly'].includes(parsed.recurrence) ? parsed.recurrence : heuristic.recurrence;
      const validTravel = ['walk', 'bike', 'car'].includes(parsed.travelMode) ? parsed.travelMode : heuristic.travelMode;

      return {
        name: cleanName(String(parsed.name)) || heuristic.name,
        deadline: aiDeadline,
        plannerDate: aiPlannerDate,
        durationMinutes: (heuristic.matched?.includes('duration') && heuristic.durationMinutes)
          ? heuristic.durationMinutes
          : (Number.isFinite(duration) && duration > 0 ? Math.round(duration) : heuristic.durationMinutes),
        importance: Number.isFinite(importance) ? Math.max(1, Math.min(10, Math.round(importance))) : heuristic.importance,
        urgency: Number.isFinite(urgency) ? Math.max(1, Math.min(10, Math.round(urgency))) : heuristic.urgency,
        isFixed: typeof parsed.isFixed === 'boolean' ? (parsed.isFixed || Boolean(aiPlannerDate)) : (heuristic.isFixed || Boolean(aiPlannerDate)),
        isEvent: typeof parsed.isEvent === 'boolean' ? parsed.isEvent : heuristic.isEvent,
        recurrence: validRecurrence,
        dependency: (typeof parsed.dependency === 'string' && parsed.dependency) ? parsed.dependency : heuristic.dependency,
        location: (typeof parsed.location === 'string' && parsed.location.trim()) ? parsed.location.trim() : heuristic.location,
        travelMode: validTravel,
        needsBreakdown: typeof parsed.needsBreakdown === 'boolean' ? parsed.needsBreakdown : false,
        source: 'ai',
        matched: heuristic.matched,
      };
    } catch (err) {
      console.warn('AI task parsing failed, using offline parser:', err.message);
      return heuristic;
    }
  }

  if (typeof window !== "undefined") window.TaskParser = { parse, parseSmart, toLocalStamp, normalizeDateTime };
})();
