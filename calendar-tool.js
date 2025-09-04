// calendar-tool.js
// Simple Calendar tool with ICS import

(function() {
  const STORAGE_KEY = 'adhd-calendar-events';
  const ICS_URL_KEY = 'adhd-calendar-ics-url';
  const VOICE_ENABLED_KEY = 'adhd-calendar-voice-enabled';
  const VOICE_EARLY_KEY = 'adhd-calendar-voice-early';
  let currentView = 'day';
  let referenceDate = new Date();
  let events = [];
  let icsUrl = '';
  let voiceEnabled = false;
  let voiceEarly = 0; // minutes before event
  const announcedEarly = new Set();
  const announcedStart = new Set();

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

    const ev = {
      id: window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now(),
      title,
      start: start.toISOString().slice(0,16),
      end: end.toISOString().slice(0,16)
    };
    events.push(ev);
    saveEvents(events);
    render(events);
  }

  function updateEventDate(ev, newDate) {
    if (ev.start) {
      const start = new Date(ev.start);
      start.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
      ev.start = start.toISOString().slice(0,16);
    }
    if (ev.end) {
      const end = new Date(ev.end);
      end.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
      ev.end = end.toISOString().slice(0,16);
    }
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
      render(events);
    }
  }

  function editEvent(id) {
    const ev = events.find(ev => ev.id === id);
    if (!ev) return;
    const newTitle = prompt('Event title:', ev.title) || ev.title;
    const newStart = prompt('Start (YYYY-MM-DDTHH:MM):', ev.start.slice(0,16)) || ev.start.slice(0,16);
    const newEnd = prompt('End (YYYY-MM-DDTHH:MM):', ev.end ? ev.end.slice(0,16) : '') || (ev.end ? ev.end.slice(0,16) : '');
    ev.title = newTitle;
    ev.start = newStart;
    ev.end = newEnd;
    saveEvents(events);
    render(events);
  }

  function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    events = events.filter(ev => ev.id !== id);
    saveEvents(events);
    render(events);
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
    const [ , y,m,d, , hh,mm,ss ] = match;
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
      return removeDuplicateEvents(stored);
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

  function loadVoiceSettings() {
    try {
      voiceEnabled = localStorage.getItem(VOICE_ENABLED_KEY) === 'true';
      voiceEarly = parseInt(localStorage.getItem(VOICE_EARLY_KEY) || '0', 10);
      if (isNaN(voiceEarly)) voiceEarly = 0;
    } catch {
      voiceEnabled = false;
      voiceEarly = 0;
    }
  }

  function saveVoiceSettings() {
    localStorage.setItem(VOICE_ENABLED_KEY, voiceEnabled);
    localStorage.setItem(VOICE_EARLY_KEY, voiceEarly);
  }

  function saveIcsUrl(url) {
    localStorage.setItem(ICS_URL_KEY, url);
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function removeDuplicateEvents(evts) {
    const seen = new Set();
    return evts.filter(ev => {
      const key = ev.uid || `${ev.title}|${ev.start}|${ev.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function speak(text) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = document.documentElement.lang || 'en';
    window.speechSynthesis.speak(utter);
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

  function render(events) {
    const container = document.getElementById('calendar-view');
    if (!container) return;
    container.innerHTML = '';
    events.sort((a,b) => new Date(a.start) - new Date(b.start));
    switch (currentView) {
      case 'week':
        renderWeek(events, container);
        break;
      case 'month':
        renderMonth(events, container);
        break;
      default:
        renderDay(events, container);
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


  function renderDay(events, container) {
    const dayStr = referenceDate.toISOString().split('T')[0];
    const dayEvents = events.filter(ev => ev.start && ev.start.startsWith(dayStr));
    const table = document.createElement('table');
    table.className = 'calendar-table';
    table.innerHTML = '<thead><tr><th>Time</th><th>Event</th></tr></thead>';
    const tbody = document.createElement('tbody');
    dayEvents.forEach(ev => {
      const tr = document.createElement('tr');
      const timeCell = document.createElement('td');
      if (ev.start) {
        const startT = new Date(ev.start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        const endT = ev.end ? new Date(ev.end).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
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
    for (let i=0;i<7;i++) {
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      const th = document.createElement('th');
      th.textContent = d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
      headerRow.appendChild(th);
    }
    const table = document.createElement('table');
    table.className = 'calendar-table';
    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    for (let i=0;i<7;i++) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate()+i);
      const cell = document.createElement('td');
      const dayStr = cellDate.toISOString().split('T')[0];
      cell.dataset.date = dayStr;
      if (dayStr === new Date().toISOString().split('T')[0]) cell.classList.add('today');
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
    for (let i=0;i<7;i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - startOffset + i);
      const th = document.createElement('th');
      th.textContent = d.toLocaleDateString(undefined, {weekday:'short'});
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    let current = 1 - startOffset;
    for (let r=0;r<6;r++) {
      const tr = document.createElement('tr');
      for (let c=0;c<7;c++) {
        const cellDate = new Date(year, month, current);
        const cell = document.createElement('td');
        if (current >= 1 && current <= daysInMonth) {
          const dayStr = cellDate.toISOString().split('T')[0];
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
          if (dayStr === new Date().toISOString().split('T')[0]) cell.classList.add('today');
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
        parsed.forEach(ev => ev.id = window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now());
        events = removeDuplicateEvents(events.concat(parsed));
        saveEvents(events);
        render(events);
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
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const parsed = parseICS(text);
      parsed.forEach(ev => ev.id = window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now());
      events = removeDuplicateEvents(events.concat(parsed));
      saveEvents(events);
      render(events);
    } catch (err) {
      console.error('ICS fetch failed', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.calendar-container');
    if (!container) return;

    events = loadEvents();
    icsUrl = loadIcsUrl();
    loadVoiceSettings();
    render(events);

    const defaultBtn = container.querySelector('.calendar-view-btn[data-view="' + currentView + '"]');
    if (defaultBtn) defaultBtn.classList.add('active');

    container.querySelectorAll('.calendar-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = btn.dataset.view;
        container.querySelectorAll('.calendar-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render(events);
      });
    });

    const prevBtn = document.getElementById('calendar-prev-btn');
    const nextBtn = document.getElementById('calendar-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { shiftReferenceDate(-1); render(events); });
    if (nextBtn) nextBtn.addEventListener('click', () => { shiftReferenceDate(1); render(events); });

    const fileInput = document.getElementById('ics-file-input');
    const importBtn = document.getElementById('import-ics-btn');
    const urlInput = document.getElementById('ics-url');
    const loadUrlBtn = document.getElementById('load-ics-url-btn');

    if (urlInput) urlInput.value = icsUrl;

    if (loadUrlBtn && urlInput) {
      loadUrlBtn.addEventListener('click', () => {
        icsUrl = urlInput.value.trim();
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

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => handleICSFile(e.target.files[0]));
    }

    if (icsUrl) {
      handleICSUrl(icsUrl);
      setInterval(() => {
        handleICSUrl(icsUrl);
      }, 30000);
    }

    setInterval(checkVoiceAnnouncements, 60000);
  });
})();
