(() => {
  const CONFIG_STORAGE_KEY = 'adhd-tools-config';

  const DEFAULT_CONFIG = {
    dayStart: "07:00",
    dayEnd: "22:00",
    icsRefreshSeconds: 30,
    fixedTag: "[FIX]",
    flexibleTag: "[FLEX]",
    defaultTaskMinutes: 25,
    enableUnifiedScheduler: true,
    includeCalendarInSchedule: true,

    // Default duration for focus sessions (in minutes). Used by the focus-mode
    // module. Users can set this via the Settings panel. When launching a new
    // focus mode session, the app will use this duration unless the user
    // specifies otherwise.
    focusDefaultMinutes: 25,

    // Determines whether the routine player auto-runs tasks by default. This setting is
    // exposed in the Settings panel and used by routine.js to initialize the auto-run
    // checkbox. Users can override it per-session in the routine player itself.
    routineAutoRunDefault: false,
  };

  function getConfig() {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!stored) {
        return { ...DEFAULT_CONFIG };
      }
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (error) {
      console.error('Failed to read config from localStorage', error);
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(config) {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }

  function updateConfig(partial) {
    const current = getConfig();
    const updated = { ...current, ...partial };
    saveConfig(updated);
    window.dispatchEvent(new CustomEvent('configUpdated', { detail: updated }));
    return updated;
  }

  window.ConfigManager = {
    DEFAULT_CONFIG,
    getConfig,
    updateConfig,
  };
})();
