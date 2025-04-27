// cross-tool-interaction.js

(() => {
  // EventBus for cross-tool communication
  const bus = new EventTarget();
  window.EventBus = bus;

  // LocalStorage keys
  const KEYS = {
    tasks: 'adhd-tasks',
    pomodoroSessions: 'pomodoroSessionsCompleted',
    habits: 'adhd-habits',
    projects: 'adhd-projects'
  };

  // Load data helper
  function loadData(key) {
    try {
      return JSON.parse(localStorage.getItem(KEYS[key])) || [];
    } catch {
      return [];
    }
  }

  // Save data helper
  function saveData(key, value) {
    localStorage.setItem(KEYS[key], JSON.stringify(value));
  }

  // In-memory store initialized from LocalStorage
  const store = {
    tasks: loadData('tasks'),
    pomodoroSessions: loadData('pomodoroSessions'),
    habits: loadData('habits'),
    projects: loadData('projects')
  };

  // Persist a specific store key
  function persist(key) {
    saveData(key, store[key]);
  }

  // Subscribe to task events
  bus.addEventListener('taskAdded', event => {
    store.tasks.push(event.detail);
    persist('tasks');
  });

  bus.addEventListener('taskCompleted', event => {
    // Optionally update task in store if needed
    persist('tasks');
  });

  // Subscribe to Pomodoro completion events
  bus.addEventListener('pomodoroCompleted', event => {
    store.pomodoroSessions.push(event.detail);
    persist('pomodoroSessions');
  });

  // Subscribe to habit toggle events
  bus.addEventListener('habitToggled', event => {
    const { habitId, dateStr, completed } = event.detail;
    let habit = store.habits.find(h => h.id === habitId);
    if (!habit) {
      habit = { id: habitId, dates: {} };
      store.habits.push(habit);
    }
    habit.dates = habit.dates || {};
    if (completed) habit.dates[dateStr] = true;
    else delete habit.dates[dateStr];
    persist('habits');
  });

  // Subscribe to project updates
  bus.addEventListener('projectUpdated', event => {
    const project = event.detail;
    const idx = store.projects.findIndex(p => p.id === project.id);
    if (idx >= 0) store.projects[idx] = project;
    else store.projects.push(project);
    persist('projects');
  });

  // Expose a simple API for other modules
  window.CrossTool = {
    bus,
    getStore: () => JSON.parse(JSON.stringify(store))
  };
})();
