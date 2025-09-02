(() => {
  const STORAGE_KEY = 'adhd-hub-data';
  const EventBus = new EventTarget();
  window.EventBus = EventBus;

  // Default data structure
  const defaults = {
    tasks: [],
    projects: [],
    habits: [],
    pomodoroSessions: [],
    // Add other data types here as needed
  };

  // The single source of truth for our application's data
  let dataStore = {};

  // Load data from localStorage, merging with defaults
  function loadData() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY);
      const parsedData = rawData ? JSON.parse(rawData) : {};
      // Merge with defaults to ensure all keys exist
      dataStore = { ...defaults, ...parsedData };
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      dataStore = { ...defaults };
    }
  }

  // Save the entire data store to localStorage
  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataStore));
      // Announce that data has changed
      EventBus.dispatchEvent(new CustomEvent('dataChanged'));
    } catch (error) {
      console.error("Failed to save data to localStorage:", error);
    }
  }

  // --- ID Generation ---
  function generateId() {
    return crypto && crypto.randomUUID 
      ? crypto.randomUUID() 
      : 'item-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  // --- Global DataManager API ---
  const DataManager = {
    // --- Task Management ---
    getTasks: () => [...dataStore.tasks], // Return a copy
    
    getTask: (id) => dataStore.tasks.find(t => t.id === id),

    addTask: (taskData) => {
      if (!taskData.text) {
        console.error("Task must have text.");
        return null;
      }
      const newTask = {
        id: generateId(),
        text: taskData.text,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        // Add other properties from the standardized model
        originalTool: taskData.originalTool || 'unknown',
        priority: taskData.priority || 'medium',
        category: taskData.category || 'other',
        dueDate: taskData.dueDate || null,
        duration: taskData.duration || null,
        notes: taskData.notes || '',
        subTasks: taskData.subTasks || [],
        // Properties for tool association
        plannerDate: taskData.plannerDate || null,
        eisenhowerQuadrant: taskData.eisenhowerQuadrant || null,
        projectId: taskData.projectId || null,
      };
      dataStore.tasks.push(newTask);
      saveData();
      return newTask;
    },

    updateTask: (id, updates) => {
      const taskIndex = dataStore.tasks.findIndex(t => t.id === id);
      if (taskIndex === -1) {
        console.error("Task not found:", id);
        return false;
      }
      dataStore.tasks[taskIndex] = { ...dataStore.tasks[taskIndex], ...updates };
      saveData();
      return true;
    },

    deleteTask: (id) => {
      const initialLength = dataStore.tasks.length;
      dataStore.tasks = dataStore.tasks.filter(t => t.id !== id);
      if (dataStore.tasks.length < initialLength) {
        saveData();
        return true;
      }
      return false;
    },

    // --- Project Management (Example) ---
    getProjects: () => [...dataStore.projects],

    // --- Utility Functions ---
    generateId: generateId,
    
    openTool: (toolName) => {
        if (!toolName) return;
        const sections = document.querySelectorAll('.tool-section');
        const navLinks = document.querySelectorAll('nav a[data-tool]');
        sections.forEach(sec => sec.classList.remove('active'));
        const target = document.getElementById(toolName);
        if (target) {
            target.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.tool === toolName));
    },

    // --- Direct access to EventBus ---
    EventBus,
  };

  // Initial load
  loadData();

  // Expose the DataManager to the window
  window.DataManager = DataManager;

})();

