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
    enableUnifiedScheduler: document.getElementById('setting-unified-scheduler'),
    includeCalendarInSchedule: document.getElementById('setting-include-calendar'),
    routineAutoRunDefault: document.getElementById('setting-routine-auto-run'),

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
    if (fields.enableUnifiedScheduler) fields.enableUnifiedScheduler.checked = values.enableUnifiedScheduler;
    if (fields.includeCalendarInSchedule) fields.includeCalendarInSchedule.checked = values.includeCalendarInSchedule;
    if (fields.routineAutoRunDefault) fields.routineAutoRunDefault.checked = values.routineAutoRunDefault;

    // Populate focus session duration if the field exists
    if (fields.focusDefaultMinutes) fields.focusDefaultMinutes.value = values.focusDefaultMinutes ?? window.ConfigManager.DEFAULT_CONFIG.focusDefaultMinutes;
  }

  populateFields(config);

  const form = document.getElementById('settings-form');
  const status = document.getElementById('settings-status');

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
        enableUnifiedScheduler: fields.enableUnifiedScheduler?.checked || false,
        includeCalendarInSchedule: fields.includeCalendarInSchedule?.checked || false,
        routineAutoRunDefault: fields.routineAutoRunDefault?.checked || false,

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
});
