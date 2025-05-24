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

  // The 'store' object provides a centralized snapshot of common data types
  // (tasks, projects, habits, pomodoro sessions) primarily loaded from localStorage
  // and updated via specific events.
  // It is NOT an exhaustive real-time reflection of ALL application data.
  // Tool-specific data, like Day Planner events or detailed Routine structures,
  // is managed directly by those tools within their respective localStorage keys
  // and may not be fully represented here. This EventBus and CrossTool API
  // primarily facilitate communication and basic data sharing, with each tool
  // often remaining the ultimate source of truth for its own complex data.
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
    getStore: () => JSON.parse(JSON.stringify(store)),

    /**
     * Standardized Task Object Structure:
     * {
     *   id: string, // Unique identifier (generate if needed)
     *   text: string, // Primary name/description of the task
     *   originalTool: string, // e.g., 'TaskManager', 'DayPlanner', 'RoutineTask'
     *   priority: string, // Optional, e.g., 'low', 'medium', 'high'
     *   category: string, // Optional, e.g., 'work', 'personal', 'other'
     *   dueDate: string, // Optional, ISO date format YYYY-MM-DD
     *   duration: number, // Optional, in minutes
     *   isCompleted: boolean, // Optional
     *   notes: string, // Optional, for additional details
     *   subTasks: Array<StandardizedTask> // Optional, for hierarchical tasks
     * }
     */

    /**
     * Generates a unique ID.
     * @returns {string} A UUID or a time-based fallback.
     */
    generateId: function() {
      return crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    },

    /**
     * Sends a task object to a specified target tool via a custom event.
     * @param {object} taskObject - The task object, ideally adhering to StandardizedTask structure.
     * @param {string} targetTool - The identifier of the target tool (e.g., 'DayPlanner').
     */
    sendTaskToTool: function(taskObject, targetTool) {
      if (!taskObject || typeof taskObject !== 'object') {
        console.error('CrossTool.sendTaskToTool: taskObject is invalid.', taskObject);
        return;
      }
      if (!targetTool || typeof targetTool !== 'string' || targetTool.trim() === '') {
        console.error('CrossTool.sendTaskToTool: targetTool is invalid.', targetTool);
        return;
      }

      const eventName = `ef-receiveTaskFor-${targetTool}`;
      console.log(`CrossTool: Dispatching event '${eventName}' with task:`, taskObject);
      this.bus.dispatchEvent(new CustomEvent(eventName, { detail: taskObject }));
    }
  };
})();
