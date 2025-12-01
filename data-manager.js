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
      if (window.switchTool) {
        window.switchTool(toolName);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
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

  // ----- Data Export / Import UI -----
  const APP_NAME = 'ADHD Tools Hub';
  const APP_VERSION = '1.0';

  function showNotification(message, type = 'success') {
    let container = document.getElementById('data-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'data-notification-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '10000';
      document.body.appendChild(container);
    }
    const note = document.createElement('div');
    note.textContent = message;
    note.style.marginBottom = '0.5rem';
    note.style.padding = '1rem';
    note.style.borderRadius = '4px';
    note.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    note.style.backgroundColor = type === 'error' ? '#fdecea' : '#e8f5e9';
    container.appendChild(note);
    setTimeout(() => note.remove(), 4000);
  }

  function collectAllData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
    data.metadata = {
      app: APP_NAME,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
    };
    return data;
  }

  function exportDataToFile() {
    const data = collectAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_NAME.toLowerCase().replace(/\s+/g, '-')}-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Data exported successfully.', 'success');
  }

  function importDataFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported.metadata || imported.metadata.app !== APP_NAME) {
          throw new Error('Invalid data file');
        }
        if (localStorage.length && !confirm('This will overwrite existing data. Continue?')) {
          return;
        }
        localStorage.clear();
        Object.keys(imported).forEach(key => {
          if (key !== 'metadata') {
            localStorage.setItem(key, JSON.stringify(imported[key]));
          }
        });
        showNotification('Data imported successfully. Reloading...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        console.error(err);
        showNotification(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  function createDataManagementUI() {
    const container = document.createElement('div');
    container.className = 'data-management-container';
    container.innerHTML = `
      <h3>Data Management</h3>
      <button id="export-data-btn" class="btn btn-primary">
        <i class="fas fa-download"></i> Export Data
      </button>
      <button id="import-data-btn" class="btn btn-secondary">
        <i class="fas fa-upload"></i> Import Data
      </button>
      <button id="email-data-btn" class="btn btn-secondary">
        <i class="fas fa-envelope"></i> Email Data
      </button>
      <input type="file" id="import-data-file" accept=".json" style="display:none" />
    `;
    const aboutSection = document.getElementById('about') || document.querySelector('main .container');
    if (!aboutSection) return;
    aboutSection.appendChild(container);

    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const emailBtn = document.getElementById('email-data-btn');
    const fileInput = document.getElementById('import-data-file');

    exportBtn.addEventListener('click', exportDataToFile);
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => importDataFromFile(e.target.files[0]));

    emailBtn.addEventListener('click', () => {
      exportDataToFile();
      setTimeout(() => {
        const subject = encodeURIComponent(`${APP_NAME} Data Export`);
        const body = encodeURIComponent(
          'Please find your data export attached as a JSON file. ' +
          'After exporting, attach the downloaded file to this email and send it to yourself.'
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }, 500);
    });
  }

  document.addEventListener('DOMContentLoaded', createDataManagementUI);

  // Expose helpers
  DataManager.exportDataToFile = exportDataToFile;
  DataManager.importDataFromFile = importDataFromFile;

  // Initial load
  loadData();

  // Expose the DataManager to the window
  window.DataManager = DataManager;

})();

