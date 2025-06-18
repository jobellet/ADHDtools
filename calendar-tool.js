// calendar-tool.js
// Simple Calendar tool with ICS import

(function() {
  const STORAGE_KEY = 'adhd-calendar-events';
  let currentView = 'day';
  let referenceDate = new Date();
  let events = [];

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

  function render() {
    const container = document.getElementById('calendar-view');
    if (!container) return;
    container.innerHTML = '';
    if (events.length === 0) {
      container.textContent = 'No events';
      return;
    }
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

  function createTaskButton(ev) {
    if (!(window.CrossTool && window.CrossTool.sendTaskToTool)) return null;
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
    return btn;
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
      timeCell.textContent = ev.start ? new Date(ev.start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
      const titleCell = document.createElement('td');
      titleCell.textContent = ev.title;
      const btn = createTaskButton(ev);
      if (btn) titleCell.appendChild(btn);
      tr.appendChild(timeCell);
      tr.appendChild(titleCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
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
      if (dayStr === new Date().toISOString().split('T')[0]) cell.classList.add('today');
      const list = document.createElement('ul');
      events.filter(ev => ev.start && ev.start.startsWith(dayStr)).forEach(ev => {
        const li = document.createElement('li');
        const time = ev.start ? new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + ' ' : '';
        li.textContent = time + ev.title;
        const btn = createTaskButton(ev);
        if (btn) li.appendChild(btn);
        list.appendChild(li);
      });
      cell.appendChild(list);
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
          const num = document.createElement('div');
          num.textContent = cellDate.getDate();
          cell.appendChild(num);
          const list = document.createElement('ul');
          events.filter(ev => ev.start && ev.start.startsWith(dayStr)).forEach(ev => {
            const li = document.createElement('li');
            li.textContent = ev.title;
            const btn = createTaskButton(ev);
            if (btn) li.appendChild(btn);
            list.appendChild(li);
          });
          cell.appendChild(list);
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
        events = events.concat(parsed);
        saveEvents(events);
        render();
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

    events = loadEvents();
    render();

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

    const fileInput = document.getElementById('ics-file-input');
    const importBtn = document.getElementById('import-ics-btn');

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => handleICSFile(e.target.files[0]));
    }
  });
})();
