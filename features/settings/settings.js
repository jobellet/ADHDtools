document.addEventListener('DOMContentLoaded', () => {
  if (!window.ConfigManager) return;

  const config = window.ConfigManager.getConfig();

  const fields = {
    dayStart: document.getElementById('setting-day-start'),
    dayEnd: document.getElementById('setting-day-end'),
    icsRefreshSeconds: document.getElementById('setting-ics-refresh'),
    fixedTag: document.getElementById('setting-fixed-tag'),
    flexibleTag: document.getElementById('setting-flexible-tag'),
    defaultTaskMinutes: document.getElementById('setting-default-task-minutes'),
    routineBufferPercent: document.getElementById('setting-routine-buffer'),
    bufferDurationMinutes: document.getElementById('setting-task-buffer'),
    breakWindowMinutes: document.getElementById('setting-break-window'),
    showAllOptions: document.getElementById('setting-show-all-options'),
    includeCalendarInSchedule: document.getElementById('setting-include-calendar'),
    routineAutoRunDefault: document.getElementById('setting-routine-auto-run'),
    contextAutoSwitch: document.getElementById('setting-context-autoswitch'),

    // Default focus session duration in minutes. Defined in the Settings panel as
    // "focus-duration-setting". This mirrors ConfigManager.focusDefaultMinutes.
    focusDefaultMinutes: document.getElementById('focus-duration-setting'),
  };

  function populateFields(values) {
    if (fields.dayStart) fields.dayStart.value = values.dayStart;
    if (fields.dayEnd) fields.dayEnd.value = values.dayEnd;
    if (fields.icsRefreshSeconds) fields.icsRefreshSeconds.value = values.icsRefreshSeconds;
    if (fields.fixedTag) fields.fixedTag.value = values.fixedTag;
    if (fields.flexibleTag) fields.flexibleTag.value = values.flexibleTag;
    if (fields.defaultTaskMinutes) fields.defaultTaskMinutes.value = values.defaultTaskMinutes;
    if (fields.routineBufferPercent) fields.routineBufferPercent.value = values.routineBufferPercent ?? 10;
    if (fields.bufferDurationMinutes) fields.bufferDurationMinutes.value = values.bufferDurationMinutes ?? 5;
    if (fields.breakWindowMinutes) fields.breakWindowMinutes.value = values.breakWindowMinutes ?? 15;
    if (fields.showAllOptions) fields.showAllOptions.checked = Boolean(values.showAllOptions);
    if (fields.includeCalendarInSchedule) fields.includeCalendarInSchedule.checked = values.includeCalendarInSchedule;
    if (fields.routineAutoRunDefault) fields.routineAutoRunDefault.checked = values.routineAutoRunDefault;
    if (fields.contextAutoSwitch) fields.contextAutoSwitch.checked = values.contextAutoSwitch;

    // Populate focus session duration if the field exists
    if (fields.focusDefaultMinutes) fields.focusDefaultMinutes.value = values.focusDefaultMinutes ?? window.ConfigManager.DEFAULT_CONFIG.focusDefaultMinutes;
  }

  populateFields(config);

  // 0 is a valid value for buffers, so don't use `|| default` for these.
  function numberOr(value, fallback) {
    const num = Number(value);
    return value !== '' && Number.isFinite(num) && num >= 0 ? num : fallback;
  }

  // "Show all options" applies right away, without pressing Save.
  fields.showAllOptions?.addEventListener('change', () => {
    window.ConfigManager.updateConfig({ showAllOptions: fields.showAllOptions.checked });
  });

  const form = document.getElementById('settings-form');
  const status = document.getElementById('settings-status');
  const tasksTableBody = document.querySelector('#settings-task-table tbody');

  function renderTasksTable() {
    if (!tasksTableBody || !window.DataManager) return;
    const tasks = window.DataManager.getTasks();
    tasksTableBody.innerHTML = '';
    tasks.forEach(task => {
      const tr = document.createElement('tr');
      const dependsOnTask = task.dependsOn ? tasks.find(t => t.id === task.dependsOn) : null;
      const cells = [
        task.text || '',
        task.priority || 'medium',
        task.category || 'other',
        task.importance ?? '',
        task.urgency ?? '',
        dependsOnTask ? dependsOnTask.text : (task.dependsOn ? 'Unknown task' : ''),
        task.plannerDate ? task.plannerDate.replace('T', ' ') : '',
      ];
      cells.forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      const actionsTd = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (confirm('Delete this task?')) {
          window.DataManager.deleteTask(task.id);
          renderTasksTable();
        }
      });
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);
      tasksTableBody.appendChild(tr);
    });
  }

  renderTasksTable();

  function showStatus(message) {
    if (!status) return;
    status.textContent = message;
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 2500);
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const updates = {
        dayStart: fields.dayStart?.value || window.ConfigManager.DEFAULT_CONFIG.dayStart,
        dayEnd: fields.dayEnd?.value || window.ConfigManager.DEFAULT_CONFIG.dayEnd,
        icsRefreshSeconds: Number(fields.icsRefreshSeconds?.value) || window.ConfigManager.DEFAULT_CONFIG.icsRefreshSeconds,
        fixedTag: fields.fixedTag?.value || window.ConfigManager.DEFAULT_CONFIG.fixedTag,
        flexibleTag: fields.flexibleTag?.value || window.ConfigManager.DEFAULT_CONFIG.flexibleTag,
        defaultTaskMinutes: Number(fields.defaultTaskMinutes?.value) || window.ConfigManager.DEFAULT_CONFIG.defaultTaskMinutes,
        routineBufferPercent: numberOr(fields.routineBufferPercent?.value, 10),
        bufferDurationMinutes: numberOr(fields.bufferDurationMinutes?.value, 5),
        breakWindowMinutes: numberOr(fields.breakWindowMinutes?.value, 15),
        showAllOptions: fields.showAllOptions?.checked || false,
        includeCalendarInSchedule: fields.includeCalendarInSchedule?.checked || false,
        routineAutoRunDefault: fields.routineAutoRunDefault?.checked || false,
        contextAutoSwitch: fields.contextAutoSwitch?.checked || false,

        // Persist the default focus session duration from the Settings panel
        focusDefaultMinutes: Number(fields.focusDefaultMinutes?.value) || window.ConfigManager.DEFAULT_CONFIG.focusDefaultMinutes,
      };

      const updated = window.ConfigManager.updateConfig(updates);
      populateFields(updated);
      showStatus('Settings saved');
    });
  }

  window.addEventListener('configUpdated', (event) => {
    if (!event.detail) return;
    populateFields(event.detail);
  });

  if (window.DataManager?.EventBus) {
    window.DataManager.EventBus.addEventListener('dataChanged', renderTasksTable);
  }
});
