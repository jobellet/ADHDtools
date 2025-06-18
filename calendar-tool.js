// calendar-tool.js
// Simple Calendar tool with ICS import

(function() {
  const STORAGE_KEY = 'adhd-calendar-events';

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
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  // Render simple list of events
  function render(events) {
    const list = document.getElementById('calendar-events');
    if (!list) return;
    list.innerHTML = '';
    events.sort((a,b) => new Date(a.start) - new Date(b.start));
    events.forEach(ev => {
      const div = document.createElement('div');
      div.className = 'calendar-event';
      const time = ev.start ? new Date(ev.start).toLocaleString() : '';
      div.textContent = `${time} - ${ev.title}`;

      // button to send as task
      if (window.CrossTool && window.CrossTool.sendTaskToTool) {
        const btn = document.createElement('button');
        btn.textContent = 'Send to Task Manager';
        btn.addEventListener('click', () => {
          const duration = ev.start && ev.end ? Math.round((new Date(ev.end) - new Date(ev.start))/60000) : 0;
          const task = {
            id: window.CrossTool.generateId(),
            text: ev.title,
            originalTool: 'Calendar',
            dueDate: ev.start ? ev.start.split('T')[0] : '',
            duration,
            notes: ev.description || ''
          };
          window.CrossTool.sendTaskToTool(task, 'TaskManager');
        });
        div.appendChild(btn);
      }

      list.appendChild(div);
    });
  }

  function handleICSFile(file, events) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseICS(e.target.result);
        parsed.forEach(ev => ev.id = window.CrossTool ? window.CrossTool.generateId() : 'ev-' + Date.now());
        events = events.concat(parsed);
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

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.calendar-container');
    if (!container) return;

    let events = loadEvents();
    render(events);

    const fileInput = document.getElementById('ics-file-input');
    const importBtn = document.getElementById('import-ics-btn');

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => handleICSFile(e.target.files[0], events));
    }
  });
})();
