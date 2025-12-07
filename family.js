(() => {
  const STORAGE_KEY = 'adhd-family-view';
  const DEFAULT_START = '06:00';
  const DEFAULT_END = '12:00';

  const state = {
    prefs: { taskImages: {}, userPrefs: {} },
    initialized: false,
  };

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { taskImages: {}, userPrefs: {} };
      const parsed = JSON.parse(raw);
      return {
        taskImages: parsed.taskImages || {},
        userPrefs: parsed.userPrefs || {},
      };
    } catch (err) {
      console.warn('Failed to load family view preferences', err);
      return { taskImages: {}, userPrefs: {} };
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prefs));
    } catch (err) {
      console.warn('Failed to save family view preferences', err);
    }
  }

  function unique(values = []) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function getAllTasks() {
    try {
      if (window.TaskStore?.getAllTasks) return window.TaskStore.getAllTasks();
      if (window.DataManager?.getTasks) return window.DataManager.getTasks();
    } catch (err) {
      console.warn('Family view failed to read tasks', err);
    }
    return [];
  }

  function getKnownUsers() {
    const users = window.UserContext?.getKnownUsers?.() || [];
    const tasks = getAllTasks();
    const taskUsers = tasks.map(t => t.user);
    return unique([...users, ...taskUsers, window.UserContext?.getActiveUser?.()]);
  }

  function ensureWindowInputs() {
    const startInput = document.getElementById('family-window-start');
    const endInput = document.getElementById('family-window-end');
    if (startInput && !startInput.value) startInput.value = DEFAULT_START;
    if (endInput && !endInput.value) endInput.value = DEFAULT_END;
  }

  function parseTimeString(value, fallback) {
    if (typeof value === 'string' && value.match(/^\d{1,2}:\d{2}$/)) return value;
    return fallback;
  }

  function buildDateFromTime(baseDate, timeStr) {
    const date = new Date(baseDate);
    const [hours, minutes] = timeStr.split(':').map(v => parseInt(v, 10));
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }

  function getWindowBounds() {
    ensureWindowInputs();
    const now = new Date();
    const startInput = document.getElementById('family-window-start');
    const endInput = document.getElementById('family-window-end');
    const startStr = parseTimeString(startInput?.value, DEFAULT_START);
    const endStr = parseTimeString(endInput?.value, DEFAULT_END);
    const start = buildDateFromTime(now, startStr);
    let end = buildDateFromTime(now, endStr);
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    return { start, end, startStr, endStr };
  }

  function getTaskTimeString(task) {
    if (task.startTime) return task.startTime;
    if (typeof task.plannerDate === 'string' && task.plannerDate.includes('T')) {
      return task.plannerDate.slice(11, 16);
    }
    if (typeof task.deadline === 'string' && task.deadline.includes('T')) {
      return task.deadline.slice(11, 16);
    }
    return null;
  }

  function getTaskStartDate(task, windowStart) {
    const timeStr = getTaskTimeString(task);
    if (!timeStr) return null;
    const startDate = buildDateFromTime(windowStart, timeStr);
    if (startDate < windowStart) {
      startDate.setDate(startDate.getDate() + 1);
    }
    return startDate;
  }

  function formatTime(date) {
    return date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
  }

  function isDependencyBlocked(task, taskMap) {
    if (!task.dependency) return false;
    const dep = taskMap.get(task.dependency);
    return dep ? !dep.completed : false;
  }

  function classifyTask(task) {
    const classes = [];
    const name = task.name || '';
    if (task.isFixed || name.includes('[FIX]')) classes.push('family-task-fix');
    if (!task.isFixed && name.includes('[FLEX]')) classes.push('family-task-flex');
    return classes;
  }

  function renderUserPrefs(users) {
    const container = document.getElementById('family-user-prefs');
    if (!container) return;
    container.innerHTML = '';
    users.forEach(user => {
      const pref = state.prefs.userPrefs[user] ?? { canRead: true };
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = pref.canRead !== false;
      checkbox.dataset.user = user;
      checkbox.className = 'family-can-read-toggle';
      checkbox.addEventListener('change', () => {
        state.prefs.userPrefs[user] = { canRead: checkbox.checked };
        savePrefs();
        renderFamilyView();
      });
      label.appendChild(checkbox);
      const span = document.createElement('span');
      span.textContent = ` ${user} can read?`;
      label.appendChild(span);
      container.appendChild(label);
    });
  }

  function renderImageMappingList() {
    const listEl = document.getElementById('family-image-mapping-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const entries = Object.entries(state.prefs.taskImages || {});
    if (!entries.length) return;
    entries.forEach(([taskName, src]) => {
      const row = document.createElement('div');
      row.className = 'family-image-row';
      const img = document.createElement('img');
      img.src = src;
      img.alt = taskName;
      img.className = 'family-task-image';
      const label = document.createElement('span');
      label.textContent = taskName;
      const del = document.createElement('button');
      del.className = 'btn btn-outline btn-compact';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        delete state.prefs.taskImages[taskName];
        savePrefs();
        renderImageMappingList();
        renderFamilyView();
      });
      row.append(img, label, del);
      listEl.appendChild(row);
    });
  }

  function populateTaskNameDatalist() {
    const datalist = document.getElementById('family-task-name-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    const names = unique(getAllTasks().map(t => t.name));
    names.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      datalist.appendChild(option);
    });
  }

  function handleImageMappingSave() {
    const nameInput = document.getElementById('family-task-name-input');
    const fileInput = document.getElementById('family-task-image-input');
    if (!nameInput || !fileInput) return;
    const taskName = (nameInput.value || '').trim();
    const file = fileInput.files?.[0];
    if (!taskName || !file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.prefs.taskImages[taskName] = reader.result;
      savePrefs();
      renderImageMappingList();
      renderFamilyView();
    };
    reader.readAsDataURL(file);
  }

  function applyDisplayMode(isActive) {
    const body = document.body;
    if (!body) return;
    body.classList.toggle('family-display-mode-active', Boolean(isActive));
  }

  function renderFamilyView() {
    const container = document.getElementById('family-view-container');
    if (!container) return;
    const { start, end } = getWindowBounds();
    const tasks = getAllTasks().filter(t => !t.completed);
    const taskMap = new Map(tasks.map(t => [t.hash || t.id, t]));
    const users = getKnownUsers();
    const tasksByUser = new Map();

    tasks.forEach(task => {
      const startDate = getTaskStartDate(task, start);
      if (!startDate) return;
      if (startDate < start || startDate > end) return;
      const entry = { task, startDate };
      const userKey = task.user || 'main';
      if (!tasksByUser.has(userKey)) tasksByUser.set(userKey, []);
      tasksByUser.get(userKey).push(entry);
    });

    const allWindowTasks = Array.from(tasksByUser.values()).flat();
    const t0 = allWindowTasks.length
      ? allWindowTasks.reduce((min, item) => (item.startDate < min ? item.startDate : min), allWindowTasks[0].startDate)
      : start;
    const tMax = allWindowTasks.length
      ? allWindowTasks.reduce((max, item) => (item.startDate > max ? item.startDate : max), allWindowTasks[0].startDate)
      : end;
    const rangeMs = Math.max(1, tMax - t0);

    container.innerHTML = '';
    users.forEach(user => {
      const column = document.createElement('div');
      column.className = 'family-column';

      const header = document.createElement('div');
      header.className = 'family-column-header';
      header.textContent = user || 'Unassigned';
      column.appendChild(header);

      const timeline = document.createElement('div');
      timeline.className = 'family-timeline';

      const label = document.createElement('div');
      label.className = 'family-timeline-label';
      label.textContent = `${formatTime(start)} → ${formatTime(end)}`;
      timeline.appendChild(label);

      const entries = (tasksByUser.get(user) || []).sort((a, b) => a.startDate - b.startDate);
      if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'family-timeline-label';
        empty.textContent = window.i18n?.t?.('family-no-tasks-message') || 'No tasks in this window';
        timeline.appendChild(empty);
      } else {
        const height = timeline.clientHeight || 320;
        entries.forEach(({ task, startDate }) => {
          const ratio = Math.min(1, Math.max(0, (startDate - t0) / rangeMs));
          const top = ratio * height;
          const el = document.createElement('div');
          el.className = 'family-task';
          classifyTask(task).forEach(cls => el.classList.add(cls));
          if (isDependencyBlocked(task, taskMap)) {
            el.classList.add('family-task-blocked');
          }
          el.style.top = `${top}px`;

          const timeEl = document.createElement('div');
          timeEl.className = 'family-task-time';
          timeEl.textContent = formatTime(startDate);
          el.appendChild(timeEl);

          const imageSrc = state.prefs.taskImages?.[task.name];
          const canRead = state.prefs.userPrefs?.[user]?.canRead !== false;
          if (imageSrc) {
            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = task.name;
            img.className = 'family-task-image';
            el.appendChild(img);
          }

          const labelEl = document.createElement('div');
          labelEl.className = 'family-task-label';
          labelEl.textContent = task.name || 'Task';
          if (state.prefs.taskImages?.[task.name] && state.prefs.userPrefs?.[user]?.canRead === false) {
            labelEl.style.display = 'none';
          }
          el.appendChild(labelEl);

          timeline.appendChild(el);
        });
      }

      column.appendChild(timeline);
      container.appendChild(column);
    });

    renderUserPrefs(users);
    populateTaskNameDatalist();
  }

  function bindEvents() {
    const refreshBtn = document.getElementById('family-refresh');
    refreshBtn?.addEventListener('click', renderFamilyView);

    const displayToggle = document.getElementById('family-display-mode-toggle');
    if (displayToggle) {
      displayToggle.addEventListener('change', () => {
        applyDisplayMode(displayToggle.checked);
      });
    }

    const saveBtn = document.getElementById('family-save-image-mapping');
    saveBtn?.addEventListener('click', handleImageMappingSave);
  }

  function initFamilyView() {
    if (state.initialized) return;
    state.prefs = loadPrefs();
    state.initialized = true;
    const section = document.getElementById('family');
    if (section) section.style.display = '';
    ensureWindowInputs();
    bindEvents();
    renderImageMappingList();
    renderFamilyView();
  }

  window.FamilyView = { init: initFamilyView, render: renderFamilyView };

  document.addEventListener('DOMContentLoaded', initFamilyView);
})();
