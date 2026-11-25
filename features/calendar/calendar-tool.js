// calendar-tool.js
// Simple Calendar tool with ICS import

(function () {
  const STORAGE_KEY = 'adhd-calendar-events';
  const ICS_URL_KEY = 'adhd-calendar-ics-url';
  const VOICE_ENABLED_KEY = 'adhd-calendar-voice-enabled';
  const VOICE_EARLY_KEY = 'adhd-calendar-voice-early';
  let currentView = 'day';
  let referenceDate = new Date();
  let events = [];
  let icsUrl = '';
  let voiceEnabled = true;
  let voiceEarly = 5; // minutes before event
  const announcedEarly = new Set();
  const announcedStart = new Set();
  const createTask = window.TaskModel?.createTask;
  const wrapTask = (task) => createTask ? createTask(task, task) : task;

  // Base64 id for a calendar copy. btoa() throws on characters outside Latin-1 (emoji, Œ, “…”), which
  // made the whole sync fail. Latin-1 titles keep their old id (no duplicates); others use UTF-8 bytes.
  function calendarHashBase64(seed) {
    let b64;
    try {
      b64 = btoa(seed);
    } catch {
      let bin = '';
      new TextEncoder().encode(seed).forEach(b => { bin += String.fromCharCode(b); });
      b64 = btoa(bin);
    }
    return b64.replace(/=/g, '');
  }

  const DELETED_TASKS_KEY = 'adhd-deleted-tasks';

  function readDeletedIds() {
    try {
      const list = JSON.parse(localStorage.getItem(DELETED_TASKS_KEY)) || [];
      return new Set(list.map(x => x && x.id).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  function recordDeletedIds(ids) {
    const clean = (ids || []).filter(Boolean);
    if (!clean.length) return;
    try {
      const list = JSON.parse(localStorage.getItem(DELETED_TASKS_KEY)) || [];
      const drop = new Set(clean);
      const deletedAt = new Date().toISOString();
      const next = [
        ...list.filter(x => x && x.id && !drop.has(x.id)),
        ...clean.map(id => ({ id, deletedAt })),
      ].slice(-1000);
      localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function computeCalendarTaskHash(ev, startOverride, endOverride) {
    if (!ev) return null;
    const cfg = getConfig();
    const fixedTag = cfg.fixedTag || '[FIX]';
    const flexibleTag = cfg.flexibleTag || '[FLEX]';
    const rawTitle = ev.title || ev.rawTitle || ev.summary || 'Calendar Task';
    const cleanedTitle = rawTitle.replace(fixedTag, '').replace(flexibleTag, '').trim();
    const start = startOverride ?? (ev.start || ev.instanceStart);
    if (!start) return null;
    const end = endOverride ?? (ev.end || ev.instanceEnd || '');
    const hashSeed = `${cleanedTitle}-${start}-${end || ''}`;
    return window.TaskModel?.DEFAULT_USER ? `task-${calendarHashBase64(hashSeed)}` : `task-${hashSeed}`;
  }

  function eventIdentityTokens(ev) {
    if (!ev) return [];
    const tokens = [
      ev.id,
      ev.uid,
      ev.calendarUid,
      ev.calendarInstanceId,
      ev.hash,
      ev.calendarEventHash,
      ev.calendarInstanceId ? `cal:${ev.calendarInstanceId}` : null,
      ev.calendarUid ? `cal:${ev.calendarUid}` : null,
      ev.uid ? `cal:${ev.uid}` : null,
      ev.id ? `cal:${ev.id}` : null,
      computeCalendarTaskHash(ev),
      ev.instanceStart && ev.instanceStart !== ev.start ? computeCalendarTaskHash(ev, ev.instanceStart, ev.instanceEnd || ev.end) : null,
    ];
    return [...new Set(tokens.filter(Boolean))];
  }

  function isEventDeleted(ev, deletedSet = readDeletedIds()) {
    if (!ev || !deletedSet.size) return false;
    return eventIdentityTokens(ev).some(tok => deletedSet.has(tok));
  }

  function getConfig() {
    return (window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG || {});
  }

  function getTagConfig() {
    const cfg = getConfig();
    return {
      fixedTag: cfg.fixedTag || '',
      flexibleTag: cfg.flexibleTag || '',
    };
  }

  function stripTagsFromTitle(title, tags = []) {
    let cleaned = title || '';
    tags.forEach(tag => {
      if (!tag) return;
      cleaned = cleaned.split(tag).join('');
    });
    return cleaned.trim();
  }

  function normalizeEvent(ev) {
    if (!ev) return ev;
    const { fixedTag, flexibleTag } = getTagConfig();
    ev.rawTitle = ev.rawTitle || ev.title || '';
    if (typeof ev.localOverride !== 'boolean') ev.localOverride = false;
    const hasFixedTag = fixedTag && ev.rawTitle.includes(fixedTag);
    const hasFlexibleTag = flexibleTag && ev.rawTitle.includes(flexibleTag);
    if (hasFixedTag) ev.isFixed = true;
    else if (hasFlexibleTag) ev.isFixed = false;
    ev.title = stripTagsFromTitle(ev.rawTitle, [fixedTag, flexibleTag]);

    ev.calendarUid = ev.calendarUid || ev.uid || ev.id || null;
    ev.instanceStart = ev.instanceStart || ev.start || null;
    if (!ev.calendarInstanceId && ev.calendarUid && ev.instanceStart) {
      ev.calendarInstanceId = `${ev.calendarUid}:${ev.instanceStart}`;
    }
    if (!ev.uid && ev.calendarUid) ev.uid = ev.calendarUid;
    if (!ev.id) {
      ev.id = ev.calendarInstanceId || ev.uid || (window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now());
    }
    if (!ev.calendarUid) ev.calendarUid = ev.id;
    return ev;
  }

  function getIcsRefreshIntervalMs() {
    const cfg = getConfig();
    const seconds = parseInt(cfg.icsRefreshSeconds, 10);
    const validSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 30;
    return validSeconds * 1000;
  }

  function getPlannerEvents() {
    if (!window.DataManager) return [];
    return window.DataManager
      .getTasks()
      .map(wrapTask)
      .filter(t => t.plannerDate)
      .map(t => {
        const start = t.plannerDate;
        let end = start;
        const minutes = Number(t.durationMinutes ?? t.duration);
        if (Number.isFinite(minutes) && minutes > 0) {
          const s = new Date(start);
          const e = new Date(s.getTime() + minutes * 60000);
          const pad = n => String(n).padStart(2, '0');
          end = `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}`;
        }
        return {
          id: t.id,
          title: t.text,
          start,
          end
        };
      });
  }

  function updateHeader() {
    const header = document.getElementById('calendar-header');
    if (!header) return;
    let text = '';
    switch (currentView) {
      case 'week': {
        const start = new Date(referenceDate);
        const day = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - day);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        text = `${start.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`;
        break;
      }
      case 'month':
        text = referenceDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        break;
      default:
        text = referenceDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    header.textContent = text;
  }

  function createEventAt(date) {
    const title = prompt('Event title?');
    if (!title) return;
    const startTime = prompt('Start time (HH:MM)', '09:00') || '09:00';
    const endTime = prompt('End time (HH:MM)', startTime) || startTime;

    const [sh, sm] = startTime.split(':').map(Number);
    const start = new Date(date);
    start.setHours(sh || 0, sm || 0, 0, 0);

    const [eh, em] = endTime.split(':').map(Number);
    const end = new Date(date);
    end.setHours(eh || sh || 0, em || sm || 0, 0, 0);

    const ev = normalizeEvent({
      id: window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now(),
      title,
      start: localStamp(start),
      end: localStamp(end)
    });
    events.push(ev);
    saveEvents(events);
    render();
  }

  function updateEventDate(ev, newDate) {
    if (ev.start) {
      if (!ev.instanceStart) ev.instanceStart = ev.start;
      const start = new Date(ev.start);
      start.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
      ev.start = localStamp(start);
    }
    if (ev.end) {
      const end = new Date(ev.end);
      end.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
      ev.end = localStamp(end);
    }
    ev.localOverride = true;
    ev.updatedAt = new Date().toISOString();
    normalizeEvent(ev);
  }

  // The Now view shows a running event by the hash the scheduler gives it
  // (calendarInstanceId, uid or id, in that order).
  function findEventByHash(hash) {
    if (!hash) return null;
    if (!events.length) events = loadEvents();
    const direct = events.find(ev => eventIdentityTokens(ev).includes(hash) || (ev.start && `cal-${ev.start}` === hash));
    if (direct) return direct;
    const task = window.TaskStore?.getTaskByHash?.(hash);
    if (task && (task.isCalendarEvent || task.source === 'calendar-import' || task.source === 'calendar')) {
      const title = (task.name || task.text || '').trim();
      const startPrefix = (task.plannerDate || '').slice(0, 16);
      return events.find(ev => (ev.title === title || ev.rawTitle === title) && (!startPrefix || (ev.start || '').slice(0, 16) === startPrefix || (ev.instanceStart || '').slice(0, 16) === startPrefix)) || null;
    }
    return null;
  }

  function removeEventAndRecordTombstone(idOrHash) {
    if (!idOrHash) return [];
    if (!events.length) events = loadEvents();
    const target = typeof idOrHash === 'object' ? findEventByHash(idOrHash.calendarInstanceId || idOrHash.id || idOrHash.uid) || idOrHash : findEventByHash(idOrHash);
    const matchSet = new Set([
      typeof idOrHash === 'string' ? idOrHash : null,
      ...(target ? eventIdentityTokens(target) : []),
    ].filter(Boolean));
    const removed = events.filter(ev => {
      if (ev === target) return true;
      const tokens = eventIdentityTokens(ev);
      if (tokens.some(t => matchSet.has(t))) return true;
      if (target && target.title && ev.title === target.title && (ev.start || '').slice(0, 16) === (target.start || '').slice(0, 16)) return true;
      return false;
    });
    const tombstoneIds = new Set(matchSet);
    removed.forEach(ev => {
      eventIdentityTokens(ev).forEach(tok => tombstoneIds.add(tok));
    });
    if (window.TaskStore?.getAllTasks && window.TaskStore?.deleteTasks) {
      const matchingTasks = window.TaskStore.getAllTasks().filter(t => {
        if (tombstoneIds.has(t.hash) || tombstoneIds.has(t.id)) return true;
        if (!t.isCalendarEvent && t.source !== 'calendar-import' && t.source !== 'calendar') return false;
        return removed.some(ev => {
          const sameTitle = (t.name === ev.title || t.text === ev.title || t.name === ev.rawTitle);
          const tStart = (t.plannerDate || '').slice(0, 16);
          const evStart = (ev.start || '').slice(0, 16);
          const instStart = (ev.instanceStart || '').slice(0, 16);
          return sameTitle && (!tStart || tStart === evStart || (instStart && tStart === instStart));
        });
      });
      if (matchingTasks.length) {
        const taskHashes = matchingTasks.map(t => t.hash || t.id).filter(Boolean);
        taskHashes.forEach(h => tombstoneIds.add(h));
        window.TaskStore.deleteTasks(taskHashes);
      }
    }
    recordDeletedIds([...tombstoneIds]);
    if (removed.length) {
      events = events.filter(ev => !removed.includes(ev));
      saveEvents(events);
      render();
    }
    window.EventBus?.dispatchEvent(new Event('dataChanged'));
    window.dispatchEvent(new Event('scheduleNeedsRefresh'));
    return removed;
  }

  function updateCalendarEvent(idOrHash, updates = {}) {
    if (!idOrHash) return null;
    if (!events.length) events = loadEvents();
    const ev = typeof idOrHash === 'object'
      ? (findEventByHash(idOrHash.calendarInstanceId || idOrHash.id || idOrHash.uid) || events.find(e => e.title === idOrHash.title && (e.start || '').slice(0, 16) === (idOrHash.start || '').slice(0, 16)))
      : findEventByHash(idOrHash);
    if (!ev) return null;
    const prevTitle = ev.title || ev.rawTitle || '';
    const prevStart = ev.start || '';
    const prevHash = computeCalendarTaskHash(ev);
    if (!ev.instanceStart && ev.start) ev.instanceStart = ev.start;
    if (!ev.instanceEnd && ev.end) ev.instanceEnd = ev.end;
    if (updates.title !== undefined) {
      ev.title = updates.title;
      ev.rawTitle = updates.rawTitle !== undefined ? updates.rawTitle : updates.title;
    }
    if (updates.start !== undefined) ev.start = updates.start;
    if (updates.end !== undefined) ev.end = updates.end;
    if (updates.location !== undefined) ev.location = updates.location;
    if (updates.isFixed !== undefined) ev.isFixed = updates.isFixed;
    if (updates.notATask !== undefined) ev.notATask = updates.notATask;
    ev.localOverride = true;
    ev.updatedAt = new Date().toISOString();
    normalizeEvent(ev);
    saveEvents(events);
    if (window.TaskStore?.getAllTasks && window.TaskStore?.updateTaskByHash) {
      const startDate = ev.start ? new Date(ev.start) : null;
      const endDate = ev.end ? new Date(ev.end) : null;
      const durationMinutes = startDate && endDate && !isNaN(startDate) && !isNaN(endDate)
        ? Math.max(5, Math.round((endDate - startDate) / 60000))
        : undefined;
      window.TaskStore.getAllTasks().forEach(t => {
        const isMatch = (prevHash && (t.hash === prevHash || t.id === prevHash))
          || ((t.isCalendarEvent || t.source === 'calendar-import' || t.source === 'calendar')
            && (t.name === prevTitle || t.text === prevTitle)
            && (!prevStart || (t.plannerDate || '').slice(0, 16) === prevStart.slice(0, 16)));
        if (isMatch) {
          const patch = {
            name: ev.title,
            text: ev.title,
            plannerDate: ev.start ? ev.start.slice(0, 16) : t.plannerDate,
            deadline: ev.end ? ev.end.slice(0, 16) : t.deadline,
            isFixed: ev.isFixed !== false,
            notATask: Boolean(ev.notATask),
          };
          if (durationMinutes) {
            patch.durationMinutes = durationMinutes;
            patch.duration = durationMinutes;
          }
          window.TaskStore.updateTaskByHash(t.hash || t.id, patch);
        }
      });
    }
    render();
    window.EventBus?.dispatchEvent(new Event('dataChanged'));
    window.dispatchEvent(new Event('scheduleNeedsRefresh'));
    return ev;
  }

  // Move an event to a new start (same length). Returns the event, or null
  // when it does not exist or the new time would overlap another event.
  function postponeEvent(hash, newStart) {
    const ev = findEventByHash(hash);
    if (!ev || !ev.start) return null;
    const start = new Date(newStart);
    if (isNaN(start) || start < new Date()) return null;
    const shiftMs = ms => new Date(new Date(ms).getTime() + (start - new Date(ev.start)));
    const end = ev.end ? shiftMs(ev.end) : null;
    if (end && end <= start) return null;
    const sameDay = window.UnifiedScheduler?.localDateString?.(start) === window.UnifiedScheduler?.localDateString?.(new Date(ev.start));
    if (sameDay) {
      const clashes = window.UnifiedScheduler?.findConflicts?.({
        dateStr: window.UnifiedScheduler.localDateString(start),
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        durationMinutes: Math.max(5, Math.round(((end || new Date(start.getTime() + 60 * 60000)) - start) / 60000)),
        ignore: [hash, ev.calendarInstanceId, ev.uid, ev.id].filter(Boolean),
      });
      if (clashes && clashes.length) return null;
    }
    const pad = n => String(n).padStart(2, '0');
    const naive = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (!ev.instanceStart) ev.instanceStart = ev.start;
    ev.start = naive(start);
    if (end) ev.end = naive(end);
    ev.localOverride = true;
    ev.updatedAt = new Date().toISOString();
    normalizeEvent(ev);
    saveEvents(events);
    render();
    return ev;
  }

  // "This is an event, not a task": it stops blocking time, so tasks can run
  // during it (the scheduler skips it; the calendar still shows it).
  function markEventPassive(hash) {
    const ev = findEventByHash(hash);
    if (!ev) return null;
    ev.isFixed = false;
    ev.notATask = true;
    ev.localOverride = true;
    ev.updatedAt = new Date().toISOString();
    normalizeEvent(ev);
    saveEvents(events);
    render();
    return ev;
  }

  function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
  }

  function handleDrop(e, date) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const ev = events.find(ev => ev.id === id);
    if (ev) {
      updateEventDate(ev, date);
      saveEvents(events);
      render();
    }
  }

  function editEvent(id) {
    const ev = events.find(ev => ev.id === id);
    if (!ev) return;
    const previousStart = ev.start;
    const newTitle = prompt('Event title:', ev.title) || ev.title;
    const newStart = prompt('Start (YYYY-MM-DDTHH:MM):', ev.start.slice(0, 16)) || ev.start.slice(0, 16);
    const newEnd = prompt('End (YYYY-MM-DDTHH:MM):', ev.end ? ev.end.slice(0, 16) : '') || (ev.end ? ev.end.slice(0, 16) : '');
    ev.rawTitle = newTitle;
    ev.title = newTitle;
    ev.start = newStart;
    ev.end = newEnd;
    if (!ev.instanceStart && previousStart) ev.instanceStart = previousStart;
    ev.localOverride = true;
    ev.updatedAt = new Date().toISOString();
    normalizeEvent(ev);
    saveEvents(events);
    render();
  }

  function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    removeEventAndRecordTombstone(id);
  }

  function createEventElement(ev, tag = 'div', includeTime = false) {
    const el = document.createElement(tag);
    el.className = 'calendar-event';
    el.draggable = true;
    el.dataset.id = ev.id;
    el.addEventListener('dragstart', handleDragStart);
    let time = '';
    if (includeTime && ev.start) {
      const startT = new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endT = ev.end ? new Date(ev.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      time = endT ? `${startT} - ${endT} ` : `${startT} `;
    }
    const titleSpan = document.createElement('span');
    titleSpan.textContent = time + (ev.title || '');
    el.appendChild(titleSpan);
    const editBtn = document.createElement('button');
    editBtn.className = 'event-edit-btn';
    editBtn.title = 'Edit event';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', e => { e.stopPropagation(); editEvent(ev.id); });
    const delBtn = document.createElement('button');
    delBtn.className = 'event-delete-btn';
    delBtn.title = 'Delete event';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteEvent(ev.id); });
    el.appendChild(editBtn);
    el.appendChild(delBtn);
    return el;
  }

  // Parse dates from ICS format (very simplified)
  function parseICSTime(value) {
    if (!value) return '';
    // Remove timezone specifiers like ;VALUE=DATE or Z
    value = value.replace(/^(?:DATE-TIME:|VALUE=DATE:)?/, '');
    // collapse to plain string
    const match = value.match(/(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2}))?/);
    if (!match) return '';
    const [, y, m, d, , hh, mm, ss] = match;
    if (hh !== undefined) {
      return `${y}-${m}-${d}T${hh || '00'}:${mm || '00'}:${ss || '00'}` + (value.endsWith('Z') ? 'Z' : '');
    }
    return `${y}-${m}-${d}`;
  }

  // Minimal ICS parser focusing on VEVENT blocks
  function parseICS(text) {
    // handle line continuations
    text = text.replace(/\r?\n[ \t]/g, '');
    const lines = text.split(/\r?\n/);
    const events = [];
    let current = null;
    lines.forEach(line => {
      if (line === 'BEGIN:VEVENT') {
        current = {};
      } else if (line === 'END:VEVENT') {
        if (current) events.push(current);
        current = null;
      } else if (current) {
        const idx = line.indexOf(':');
        if (idx === -1) return;
        const key = line.substring(0, idx).split(';')[0];
        const value = line.substring(idx + 1);
        switch (key) {
          case 'SUMMARY':
            current.title = value;
            break;
          case 'DESCRIPTION':
            current.description = value;
            break;
          case 'DTSTART':
            current.start = parseICSTime(value);
            break;
          case 'DTEND':
            current.end = parseICSTime(value);
            break;
          case 'LOCATION':
            current.location = value;
            break;
          case 'UID':
            current.uid = value;
            break;
        }
      }
    });
    return events;
  }

  function loadEvents() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      const deleted = readDeletedIds();
      let stampedOverride = false;
      const normalized = stored
        .map(raw => {
          const ev = normalizeEvent(raw);
          if (ev && (ev.localOverride || ev.notATask) && !ev.updatedAt) {
            ev.localOverride = true;
            ev.updatedAt = new Date().toISOString();
            stampedOverride = true;
          }
          return ev;
        })
        .filter(ev => !isEventDeleted(ev, deleted));
      const deduped = removeDuplicateEvents(normalized);
      if (stampedOverride || deduped.length !== stored.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      }
      return deduped;
    } catch {
      return [];
    }
  }

  function loadIcsUrl() {
    try {
      return localStorage.getItem(ICS_URL_KEY) || '';
    } catch {
      return '';
    }
  }

  // Voice alerts are on by default. A stored 'false' (the user turned them off) is kept.
  function loadVoiceSettings() {
    try {
      voiceEnabled = localStorage.getItem(VOICE_ENABLED_KEY) !== 'false';
      voiceEarly = parseInt(localStorage.getItem(VOICE_EARLY_KEY) || '5', 10);
      if (isNaN(voiceEarly)) voiceEarly = 5;
    } catch {
      voiceEnabled = true;
      voiceEarly = 5;
    }
  }

  function saveVoiceSettings() {
    localStorage.setItem(VOICE_ENABLED_KEY, voiceEnabled);
    localStorage.setItem(VOICE_EARLY_KEY, voiceEarly);
    document.getElementById('voice-welcome-notice')?.classList.add('hidden');
  }

  // One-time notice that voice alerts are on: a small bubble in a corner that opens a card when
  // tapped. It never blocks the app. Shown while the user has never chosen a voice setting;
  // either button saves the settings, so the notice does not come back.
  function initVoiceNotice() {
    const notice = document.getElementById('voice-welcome-notice');
    if (!notice || !voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      if (localStorage.getItem(VOICE_ENABLED_KEY) !== null || localStorage.getItem(VOICE_EARLY_KEY) !== null) return;
    } catch {
      return;
    }
    const close = () => {
      saveVoiceSettings();
      notice.classList.add('hidden');
    };
    document.getElementById('voice-disable-btn')?.addEventListener('click', () => {
      voiceEnabled = false;
      const checkbox = document.getElementById('calendar-voice-enable');
      if (checkbox) checkbox.checked = false;
      close();
    });
    document.getElementById('voice-keep-btn')?.addEventListener('click', close);

    const toggle = document.getElementById('voice-notice-toggle');
    const panel = document.getElementById('voice-notice-panel');
    const setOpen = open => {
      if (!toggle || !panel) return;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle?.addEventListener('click', () => setOpen(panel.hidden));
    notice.addEventListener('keydown', e => {
      if (e.key === 'Escape') { setOpen(false); toggle?.focus(); }
    });

    // Keep the bubble above the bottom tab bar on phones.
    const place = () => {
      const nav = document.querySelector('.app-nav');
      const rect = nav?.getBoundingClientRect();
      const navAtBottom = rect && rect.height && rect.top > window.innerHeight / 2;
      notice.style.bottom = navAtBottom ? `${Math.round(window.innerHeight - rect.top + 12)}px` : '';
    };
    window.addEventListener('resize', place);
    notice.classList.remove('hidden');
    place();
  }

  function saveIcsUrl(url) {
    localStorage.setItem(ICS_URL_KEY, url);
    window.dispatchEvent(new Event('capabilitiesChanged'));
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    if (window.EventBus) {
      window.EventBus.dispatchEvent(new Event('calendarEventsUpdated'));
    }
  }

  function removeDuplicateEvents(evts) {
    const byKey = new Map();
    evts.forEach(ev => {
      if (!ev) return;
      const key = ev.calendarInstanceId || `${ev.title}|${ev.start}|${ev.end}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, ev);
        return;
      }
      const overrideNew = Boolean(ev.localOverride || ev.notATask);
      const overrideOld = Boolean(existing.localOverride || existing.notATask);
      if (overrideNew && !overrideOld) {
        byKey.set(key, ev);
      } else if (overrideNew === overrideOld) {
        const tsNew = Date.parse(ev.updatedAt || '') || 0;
        const tsOld = Date.parse(existing.updatedAt || '') || 0;
        if (tsNew > tsOld) byKey.set(key, ev);
      }
    });
    return Array.from(byKey.values());
  }

  function mergeEventsPreserveOverrides(existing, incoming) {
    const merged = new Map();
    const getKey = (ev) => `${ev.title}|${ev.start}|${ev.end}`;
    const byIdentity = new Map();
    existing.forEach(ev => {
      merged.set(getKey(ev), ev);
      [ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id].filter(Boolean).forEach(identity => {
        if (!byIdentity.has(identity) || ev.localOverride) byIdentity.set(identity, ev);
      });
    });

    const deleted = readDeletedIds();
    incoming.forEach(ev => {
      if (isEventDeleted(ev, deleted)) return;
      const key = getKey(ev);
      const current = merged.get(key);
      if (current && current.localOverride) return;
      // A locally moved/edited event (localOverride) is the same event as the
      // incoming one (same calendar identity): the sync must not bring the
      // original time back as a duplicate.
      const mine = [ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id]
        .filter(Boolean)
        .map(id => byIdentity.get(id))
        .find(Boolean);
      if (mine && mine.localOverride) return;
      merged.set(key, ev);
    });

    return Array.from(merged.values());
  }

  function speak(text) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = document.documentElement.lang || 'en';
    window.speechSynthesis.speak(utter);
  }

  function backgroundDeduplicateEvents() {
    let changed = false;
    const deduplicated = new Map();

    events.forEach(ev => {
      const key = `${ev.title}|${ev.start}|${ev.end}`;
      const existing = deduplicated.get(key);

      if (!existing) {
        deduplicated.set(key, ev);
      } else {
        changed = true;
        // Prioritize localOverride, then presence of a UID, then fall back to the existing one.
        if (ev.localOverride && !existing.localOverride) {
          deduplicated.set(key, ev);
        } else if (ev.uid && !existing.uid && !existing.localOverride) {
          deduplicated.set(key, ev);
        }
      }
    });

    if (changed) {
      events = Array.from(deduplicated.values());
      saveEvents(events);
      render();
    }
  }

  function checkVoiceAnnouncements() {
    if (!voiceEnabled) return;
    const now = new Date();
    events.forEach(ev => {
      if (!ev.start) return;
      const start = new Date(ev.start);
      if (isNaN(start)) return;
      const diffMin = (start - now) / 60000;
      if (diffMin <= voiceEarly && diffMin > voiceEarly - 1 && !announcedEarly.has(ev.id + '-' + voiceEarly)) {
        const msg = getAnnouncement('soon', ev.title, Math.round(diffMin));
        speak(msg);
        announcedEarly.add(ev.id + '-' + voiceEarly);
      }
      if (diffMin <= 0 && diffMin > -1 && !announcedStart.has(ev.id)) {
        const msg = getAnnouncement('now', ev.title, 0);
        speak(msg);
        announcedStart.add(ev.id);
      }
    });
  }

  function getAnnouncement(type, title, minutes) {
    const lang = document.documentElement.lang || 'en';
    const dict = (window.translations && window.translations[lang]) || {};
    let template = '';
    if (type === 'soon') template = dict['calendar-announcement-soon'] || 'Event "{title}" starts in {minutes} minutes.';
    else template = dict['calendar-announcement-now'] || 'Event "{title}" is starting now.';
    return template.replace('{title}', title).replace('{minutes}', minutes);
  }

  function render() {
    const container = document.getElementById('calendar-view');
    if (!container) return;
    container.innerHTML = '';
    const plannerEvents = getPlannerEvents().map(ev => normalizeEvent({ ...ev }));
    const allEvents = removeDuplicateEvents(events.concat(plannerEvents));
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    updateHeader();
    switch (currentView) {
      case 'week':
        renderWeek(allEvents, container);
        break;
      case 'month':
        renderMonth(allEvents, container);
        break;
      default:
        renderDay(allEvents, container);
    }
  }

  function shiftReferenceDate(direction) {
    switch (currentView) {
      case 'week':
        referenceDate.setDate(referenceDate.getDate() + direction * 7);
        break;
      case 'month':
        referenceDate.setMonth(referenceDate.getMonth() + direction);
        break;
      default:
        referenceDate.setDate(referenceDate.getDate() + direction);
    }
  }


  // Local YYYY-MM-DD (never UTC: toISOString() shifts the day for timezones behind UTC)
  const pad2 = n => String(n).padStart(2, '0');
  const localDayStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const localStamp = d => `${localDayStr(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  function renderDay(events, container) {
    const dayStr = localDayStr(referenceDate);
    const dayEvents = events.filter(ev => ev.start && ev.start.startsWith(dayStr));
    const table = document.createElement('table');
    table.className = 'calendar-table';
    table.innerHTML = '<thead><tr><th>Time</th><th>Event</th></tr></thead>';
    const tbody = document.createElement('tbody');
    dayEvents.forEach(ev => {
      const tr = document.createElement('tr');
      const timeCell = document.createElement('td');
      if (ev.start) {
        const startT = new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endT = ev.end ? new Date(ev.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        timeCell.textContent = endT ? `${startT} - ${endT}` : startT;
      } else {
        timeCell.textContent = '';
      }
      const titleCell = document.createElement('td');
      titleCell.appendChild(createEventElement(ev));
      tr.appendChild(timeCell);
      tr.appendChild(titleCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    table.addEventListener('dblclick', () => createEventAt(new Date(referenceDate)));
    container.appendChild(table);
  }

  function renderWeek(events, container) {
    const start = new Date(referenceDate);
    const day = (start.getDay() + 6) % 7; // Monday=0
    start.setDate(start.getDate() - day);
    const headerRow = document.createElement('tr');
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const th = document.createElement('th');
      th.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      headerRow.appendChild(th);
    }
    const table = document.createElement('table');
    table.className = 'calendar-table';
    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + i);
      const cell = document.createElement('td');
      const dayStr = localDayStr(cellDate);
      cell.dataset.date = dayStr;
      if (dayStr === localDayStr(new Date())) cell.classList.add('today');
      const list = document.createElement('ul');
      events.filter(ev => ev.start && ev.start.startsWith(dayStr)).forEach(ev => {
        const li = createEventElement(ev, 'li', true);
        list.appendChild(li);
      });
      cell.appendChild(list);
      cell.addEventListener('dblclick', () => createEventAt(cellDate));
      cell.addEventListener('dragover', e => e.preventDefault());
      cell.addEventListener('drop', e => handleDrop(e, cellDate));
      row.appendChild(cell);
    }
    tbody.appendChild(row);
    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function renderMonth(events, container) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday index
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const table = document.createElement('table');
    table.className = 'calendar-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (let i = 0; i < 7; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - startOffset + i);
      const th = document.createElement('th');
      th.textContent = d.toLocaleDateString(undefined, { weekday: 'short' });
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    let current = 1 - startOffset;
    for (let r = 0; r < 6; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < 7; c++) {
        const cellDate = new Date(year, month, current);
        const cell = document.createElement('td');
        if (current >= 1 && current <= daysInMonth) {
          const dayStr = localDayStr(cellDate);
          cell.dataset.date = dayStr;
          const num = document.createElement('div');
          num.textContent = cellDate.getDate();
          cell.appendChild(num);
          const list = document.createElement('ul');
          events.filter(ev => ev.start && ev.start.startsWith(dayStr)).forEach(ev => {
            const li = createEventElement(ev, 'li', true);
            list.appendChild(li);
          });
          cell.appendChild(list);
          cell.addEventListener('dblclick', () => createEventAt(cellDate));
          cell.addEventListener('dragover', e => e.preventDefault());
          cell.addEventListener('drop', e => handleDrop(e, cellDate));
          if (dayStr === localDayStr(new Date())) cell.classList.add('today');
        }
        tr.appendChild(cell);
        current++;
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function handleICSFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseICS(e.target.result);
        const deleted = readDeletedIds();
        const normalized = parsed.map(ev => normalizeEvent({
          ...ev,
          id: window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now(),
          instanceStart: ev.start || ev.instanceStart,
        })).filter(ev => !isEventDeleted(ev, deleted));
        const overriddenIdentities = new Set(
          events.filter(ev => ev.localOverride).flatMap(ev => [ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id]).filter(Boolean)
        );
        events = removeDuplicateEvents(mergeEventsPreserveOverrides(events, normalized));
        saveEvents(events);
        convertEventsToTasks(normalized.filter(ev => ![ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id].some(id => id && overriddenIdentities.has(id))));
        render();
        alert(`Imported ${parsed.length} events.`);
      } catch (err) {
        console.error('ICS import failed', err);
        alert('Failed to import ICS file');
      }
    };
    reader.readAsText(file);
  }


  async function handleICSUrl(url) {
    if (!url) return;

    const proxyCandidates = [
      url,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://cors.isomorphic-git.org/${encodeURIComponent(url)}`
    ];

    for (const candidate of proxyCandidates) {
      try {
        // The first attempt uses the direct URL. If CORS blocks it (common with Google
        // Calendar ICS links), we progressively fall back to known CORS-friendly proxies.
        const resp = await fetch(candidate);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();

        const parsed = parseICS(text);
        const deleted = readDeletedIds();
        const normalized = parsed.map(ev => normalizeEvent({
          ...ev,
          id: window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now(),
          instanceStart: ev.start || ev.instanceStart,
        })).filter(ev => !isEventDeleted(ev, deleted));
        const overriddenIdentities = new Set(
          events.filter(ev => ev.localOverride).flatMap(ev => [ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id]).filter(Boolean)
        );
        events = removeDuplicateEvents(mergeEventsPreserveOverrides(events, normalized));
        saveEvents(events);
        convertEventsToTasks(normalized.filter(ev => ![ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id].some(id => id && overriddenIdentities.has(id))));
        render();
        return;
      } catch (err) {
        console.error('ICS fetch failed for', candidate, err);
      }
    }

    console.warn('Failed to load calendar. Removing invalid URL.');
    icsUrl = '';
    saveIcsUrl('');
    const urlInput = document.getElementById('ics-url');
    if (urlInput) urlInput.value = '';
  }

  function convertEventsToTasks(importedEvents) {
    if (!window.TaskStore?.upsertTaskByHash) return;
    // Copies the user deleted stay deleted, even when sync brings the event again.
    let deleted = new Set();
    try {
      deleted = new Set((JSON.parse(localStorage.getItem('adhd-deleted-tasks')) || []).map(x => x.id));
    } catch { /* no tombstones */ }
    const cfg = window.ConfigManager?.getConfig?.() || {};
    const fixedTag = cfg.fixedTag || '[FIX]';
    const flexibleTag = cfg.flexibleTag || '[FLEX]';
    let anyChanged = false;

    importedEvents.forEach(ev => {
      const start = ev.start || ev.instanceStart;
      if (!start) return;
      const end = ev.end || ev.instanceEnd;
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : null;
      const durationMinutes = endDate && !isNaN(endDate) && !isNaN(startDate)
        ? Math.max(5, Math.round((endDate - startDate) / 60000))
        : parseInt(cfg.defaultTaskMinutes || 60, 10) || 60;
      const rawTitle = ev.title || ev.rawTitle || ev.summary || 'Calendar Task';
      const isFixed = rawTitle.includes(fixedTag) || (!rawTitle.includes(flexibleTag));
      const cleanedTitle = rawTitle.replace(fixedTag, '').replace(flexibleTag, '').trim();
      const hashSeed = `${cleanedTitle}-${start}-${end || ''}`;
      const hash = window.TaskModel?.DEFAULT_USER ? `task-${calendarHashBase64(hashSeed)}` : `task-${hashSeed}`;

      const isAllDay = ev.isAllDay !== undefined ? !!ev.isAllDay : (start && start.length === 10);

      const task = {
        name: cleanedTitle || rawTitle,
        text: cleanedTitle || rawTitle,
        plannerDate: start.slice(0, 16),
        deadline: end ? end.slice(0, 16) : null,
        durationMinutes,
        isFixed,
        source: 'calendar-import',
        originalTool: 'calendar',
        hash,
        isCalendarEvent: ev.isCalendarEvent !== undefined ? ev.isCalendarEvent : true,
        isActionable: ev.isActionable !== undefined ? ev.isActionable : false,
        points: ev.points !== undefined ? ev.points : 0,
        type: ev.type || 'event',
        isAllDay
      };
      if (deleted.has(hash)) return;
      const existing = window.TaskStore.getTaskByHash?.(hash);
      if (existing
        && existing.name === task.name
        && existing.plannerDate === task.plannerDate
        && existing.deadline === task.deadline
        && existing.durationMinutes === task.durationMinutes
        && existing.isFixed === task.isFixed
        && Boolean(existing.isAllDay) === Boolean(task.isAllDay)) {
        return;
      }
      window.TaskStore.upsertTaskByHash(hash, task);
      anyChanged = true;
    });
    if (anyChanged) {
      window.EventBus?.dispatchEvent(new Event('dataChanged'));
    }
  }

  // Public API so other modules (e.g. Google Calendar OAuth sync) can feed
  // events through the same normalize/merge/task pipeline as ICS imports.
  window.CalendarTool = {
    deleteEvent(idOrHash) {
      return removeEventAndRecordTombstone(idOrHash);
    },
    updateEvent: updateCalendarEvent,
    isPassiveEvent(task) {
      return !!(task && task.isCalendarEvent && task.isActionable === false);
    },
    findEventByHash,
    postponeEvent,
    markEventPassive,
    ingestExternalEvents(rawEvents) {
      if (!Array.isArray(rawEvents) || rawEvents.length === 0) return 0;
      if (!events.length) events = loadEvents();
      const prevJson = JSON.stringify(events);
      const deleted = readDeletedIds();
      const allNormalized = rawEvents.map(ev => normalizeEvent({ ...ev }));
      const normalized = allNormalized.filter(ev => !isEventDeleted(ev, deleted));
      const overridden = new Set(
        events.filter(ev => ev.localOverride).flatMap(ev => [ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id]).filter(Boolean)
      );
      events = removeDuplicateEvents(mergeEventsPreserveOverrides(events, normalized));
      if (JSON.stringify(events) !== prevJson) {
        saveEvents(events);
      }
      // Only events that survived the merge get a TaskStore copy, so a locally
      // moved or deleted event does not come back as a copy at its original time.
      convertEventsToTasks(normalized.filter(ev => ![ev.calendarInstanceId, ev.calendarUid, ev.uid, ev.id].some(id => id && overridden.has(id))));
      render();
      return allNormalized.length;
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Guide Modal Logic
    const guideBtn = document.getElementById('show-calendar-guide-btn');
    const guideModal = document.getElementById('calendar-guide-modal');
    const guideClose = guideModal ? guideModal.querySelector('.close-button') : null;
    const guideTabs = guideModal ? guideModal.querySelectorAll('.guide-tab') : [];
    const guideContents = guideModal ? guideModal.querySelectorAll('.guide-content') : [];

    if (guideBtn && guideModal) {
      guideBtn.addEventListener('click', () => guideModal.style.display = 'block');
    }
    if (guideClose) {
      guideClose.addEventListener('click', () => guideModal.style.display = 'none');
    }
    if (guideModal) {
      window.addEventListener('click', (e) => {
        if (e.target === guideModal) guideModal.style.display = 'none';
      });
    }

    guideTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        guideTabs.forEach(t => t.classList.remove('active'));
        guideContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.dataset.target;
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });

    const container = document.getElementById('calendar'); // Main section
    if (!container) return;

    events = loadEvents();
    icsUrl = loadIcsUrl();
    loadVoiceSettings();
    render();
    if (window.DataManager && window.DataManager.EventBus) {
      window.DataManager.EventBus.addEventListener('dataChanged', render);
    }
    if (window.EventBus) {
      window.EventBus.addEventListener('calendarEventsUpdated', () => {
        events = loadEvents();
        render();
      });
    }
    window.addEventListener('cloudSyncApplied', () => {
      events = loadEvents();
      render();
    });

    window.addEventListener('configUpdated', () => {
      events = events.map(normalizeEvent);
      render();
    });

    const defaultBtn = container.querySelector('.calendar-view-btn[data-view="' + currentView + '"]');
    if (defaultBtn) defaultBtn.classList.add('active');

    container.querySelectorAll('.calendar-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = btn.dataset.view;
        container.querySelectorAll('.calendar-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });

    const prevBtn = document.getElementById('calendar-prev-btn');
    const nextBtn = document.getElementById('calendar-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { shiftReferenceDate(-1); render(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { shiftReferenceDate(1); render(); });

    const fileInput = document.getElementById('ics-file-input');
    const importBtn = document.getElementById('import-ics-btn');
    const urlInput = document.getElementById('ics-url');
    const loadUrlBtn = document.getElementById('load-ics-url-btn');

    if (urlInput) urlInput.value = icsUrl;

    // Smart input preprocessing for ICS URLs
    function preprocessICSInput(input) {
      input = input.trim();

      // 1. Handle webcal:// protocol
      if (input.startsWith('webcal://')) {
        return input.replace('webcal://', 'https://');
      }

      // 2. Handle iframe embed codes
      const iframeMatch = input.match(/src=["']([^"']+)["']/);
      if (iframeMatch) {
        input = iframeMatch[1];
      }

      // 3. Handle Google Calendar embed URLs (convert to ICS format)
      const embedMatch = input.match(/calendar\.google\.com\/calendar\/embed\?src=([^&]+)/);
      if (embedMatch) {
        const calendarId = decodeURIComponent(embedMatch[1]);
        return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
      }

      // 4. Handle email addresses (assume it's a public Google Calendar ID)
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (emailRegex.test(input) && !input.includes('http')) {
        return `https://calendar.google.com/calendar/ical/${encodeURIComponent(input)}/public/basic.ics`;
      }

      return input;
    }

    if (loadUrlBtn && urlInput) {
      loadUrlBtn.addEventListener('click', () => {
        const rawInput = urlInput.value.trim();
        icsUrl = preprocessICSInput(rawInput);
        urlInput.value = icsUrl; // Update display with processed URL
        saveIcsUrl(icsUrl);
        handleICSUrl(icsUrl);
      });
    }

    const voiceCheckbox = document.getElementById('calendar-voice-enable');
    const voiceEarlyInput = document.getElementById('calendar-voice-early');
    if (voiceCheckbox) {
      voiceCheckbox.checked = voiceEnabled;
      voiceCheckbox.addEventListener('change', () => {
        voiceEnabled = voiceCheckbox.checked;
        saveVoiceSettings();
      });
    }
    if (voiceEarlyInput) {
      voiceEarlyInput.value = voiceEarly;
      voiceEarlyInput.addEventListener('change', () => {
        const val = parseInt(voiceEarlyInput.value, 10);
        voiceEarly = isNaN(val) ? 0 : val;
        saveVoiceSettings();
      });
    }
    initVoiceNotice();

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => handleICSFile(e.target.files[0]));
    }

    if (icsUrl) {
      handleICSUrl(icsUrl);
      const refreshMs = getIcsRefreshIntervalMs();
      console.log(`Refreshing ICS feed every ${refreshMs / 1000} seconds from config`);
      setInterval(() => {
        handleICSUrl(icsUrl);
      }, refreshMs);
    }

    setInterval(checkVoiceAnnouncements, 60000);

    backgroundDeduplicateEvents();
    setInterval(backgroundDeduplicateEvents, 60000);
  });
})();
