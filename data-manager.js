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

  function getDefaultTaskMinutes() {
    const cfg = window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG || {};
    const parsed = parseInt(cfg.defaultTaskMinutes, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
  }

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
        if (!taskData.title) {
          console.error("Task must have text.");
          return null;
        }
      }
      const title = taskData.title || taskData.text || 'New Task';
      const text = taskData.text || title;
      const defaultDuration = getDefaultTaskMinutes();
      const importance = typeof taskData.importance === 'number'
        ? taskData.importance
        : taskData.priority === 'high'
          ? 8
          : taskData.priority === 'low'
            ? 2
            : 5;
      const urgency = typeof taskData.urgency === 'number'
        ? taskData.urgency
        : taskData.priority === 'high'
          ? 8
          : taskData.priority === 'low'
            ? 2
            : 5;
      const estimatedMinutes = Number.isFinite(taskData.estimatedMinutes)
        ? taskData.estimatedMinutes
        : defaultDuration;
      const duration = Number.isFinite(taskData.duration)
        ? taskData.duration
        : Number.isFinite(taskData.durationMinutes)
          ? taskData.durationMinutes
          : estimatedMinutes;
      const newTask = {
        id: generateId(),
        text,
        title,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        // Add other properties from the standardized model
        originalTool: taskData.originalTool || taskData.source || 'unknown',
        source: taskData.source || taskData.originalTool || 'unknown',
        priority: taskData.priority || 'medium',
        importance,
        urgency,
        category: taskData.category || 'other',
        dueDate: taskData.dueDate || null,
        duration,
        estimatedMinutes,
        durationMinutes: duration,
        dependsOn: taskData.dependsOn || null,
        notes: taskData.notes || '',
        subTasks: taskData.subTasks || [],
        status: taskData.status || 'pending',
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

  // --- Collision Handling Logic ---

  function detectCollisions(importedData) {
    const collisions = [];
    const updates = {}; // Key -> New Value (for non-collisions)

    Object.keys(importedData).forEach(key => {
      if (key === 'metadata') return;

      const importedVal = importedData[key];
      const existingValStr = localStorage.getItem(key);

      if (!existingValStr) {
        // No existing data, safe to add
        updates[key] = importedVal;
        return;
      }

      let existingVal;
      try {
        existingVal = JSON.parse(existingValStr);
      } catch {
        existingVal = existingValStr;
      }

      // Array Handling (Tasks, Routines, etc.)
      if (Array.isArray(importedVal) && Array.isArray(existingVal)) {
        const newItems = [];
        importedVal.forEach(item => {
          // Identify collision based on ID or unique property
          let conflict = null;

          if (item.id) {
            conflict = existingVal.find(e => e.id === item.id);
          } else if (key === 'adhd-habits' && typeof item === 'string') {
            // Habits as simple strings
            if (existingVal.includes(item)) conflict = item;
          } else if (item.text) {
            // Fallback for items without ID but with text (e.g. breakdown root)
            conflict = existingVal.find(e => e.text === item.text && !e.id);
          }

          if (conflict) {
            collisions.push({
              key: key,
              type: 'array-item',
              id: item.id || item.text || 'unknown',
              existing: conflict,
              imported: item,
              label: item.text || item.name || item.title || item.id || 'Item'
            });
          } else {
            newItems.push(item);
          }
        });

        // If we have new items to append, we prepare the update
        // We will merge these later with resolved collisions
        if (newItems.length > 0) {
          updates[key] = [...existingVal, ...newItems];
        } else {
          updates[key] = existingVal; // Keep existing if only collisions
        }

      } else if (JSON.stringify(existingVal) !== JSON.stringify(importedVal)) {
        // Primitive or Object collision
        collisions.push({
          key: key,
          type: 'value',
          existing: existingVal,
          imported: importedVal,
          label: key
        });
      } else {
        // Values identical, ignore
      }
    });

    return { collisions, updates };
  }

  function showCollisionModal(collisions, updates, onResolve) {
    const modal = document.createElement('div');
    modal.className = 'data-import-modal';

    let html = `
      <div class="data-import-modal-content">
        <h3>Data Import Conflicts</h3>
        <p>Some items in the imported file conflict with your existing data. Please choose how to handle them.</p>
        <div class="collision-list">
    `;

    collisions.forEach((c, index) => {
      const existingDisp = typeof c.existing === 'object' ? JSON.stringify(c.existing).substring(0, 50) + '...' : c.existing;
      const importedDisp = typeof c.imported === 'object' ? JSON.stringify(c.imported).substring(0, 50) + '...' : c.imported;

      html += `
        <div class="collision-item" data-index="${index}">
          <div class="collision-header">
            <span>${c.key}: ${c.label}</span>
          </div>
          <div class="collision-details">
            <div class="collision-val">
              <label>Existing</label>
              <div>${existingDisp}</div>
            </div>
            <div class="collision-val">
              <label>Imported</label>
              <div>${importedDisp}</div>
            </div>
          </div>
          <div class="collision-actions">
            <button class="collision-btn selected" data-action="keep-existing">Keep Existing</button>
            <button class="collision-btn" data-action="overwrite">Overwrite</button>
            ${c.type === 'array-item' ? '<button class="collision-btn" data-action="keep-both">Keep Both</button>' : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
        <div class="modal-actions">
          <button id="cancel-import" class="btn btn-secondary">Cancel Import</button>
          <button id="confirm-import" class="btn btn-primary">Apply Changes</button>
        </div>
      </div>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Event Listeners
    modal.querySelectorAll('.collision-item').forEach(item => {
      item.querySelectorAll('.collision-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          item.querySelectorAll('.collision-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });
    });

    document.getElementById('cancel-import').addEventListener('click', () => {
      modal.remove();
      showNotification('Import cancelled.', 'error');
    });

    document.getElementById('confirm-import').addEventListener('click', () => {
      const resolutions = [];
      modal.querySelectorAll('.collision-item').forEach((item, index) => {
        const action = item.querySelector('.collision-btn.selected').dataset.action;
        resolutions.push({ collision: collisions[index], action });
      });
      modal.remove();
      onResolve(resolutions, updates);
    });
  }

  function applyResolutions(resolutions, updates) {
    // Clone updates to avoid mutation issues
    const finalData = { ...updates };

    // We need to re-fetch current data because 'updates' only contains non-colliding merges
    // But for array items, we need to merge resolved items into the array

    resolutions.forEach(res => {
      const { collision, action } = res;
      const key = collision.key;

      // Ensure we have the base array/value in finalData
      if (!finalData[key]) {
        const existing = localStorage.getItem(key);
        finalData[key] = existing ? JSON.parse(existing) : (Array.isArray(collision.existing) ? [] : {});
      }

      if (collision.type === 'array-item') {
        const arr = finalData[key];
        // Find if item is already in the array (it might be if we processed other collisions for same key)
        // Actually, 'arr' currently contains [existing... + newItems...].
        // The colliding item is NOT in 'newItems'. It IS in 'existing'.

        if (action === 'overwrite') {
          // Find and replace
          const idx = arr.findIndex(i => (i.id && i.id === collision.id) || i === collision.existing);
          if (idx !== -1) arr[idx] = collision.imported;
        } else if (action === 'keep-both') {
          // Append imported with new ID
          const newItem = JSON.parse(JSON.stringify(collision.imported));
          if (newItem.id) newItem.id = generateId();
          if (typeof newItem === 'string') newItem += ' (Imported)';
          else if (newItem.text) newItem.text += ' (Imported)';
          else if (newItem.name) newItem.name += ' (Imported)';

          arr.push(newItem);
        }
        // 'keep-existing' does nothing
      } else {
        // Value type
        if (action === 'overwrite') {
          finalData[key] = collision.imported;
        }
        // 'keep-existing' does nothing
      }
    });

    // Save all
    Object.keys(finalData).forEach(key => {
      const val = finalData[key];
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    });

    showNotification('Data imported successfully. Reloading...', 'success');
    setTimeout(() => location.reload(), 1500);
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

        const { collisions, updates } = detectCollisions(imported);

        if (collisions.length === 0) {
          // No collisions, just apply updates
          Object.keys(updates).forEach(key => {
            const val = updates[key];
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
          });
          showNotification('Data imported successfully. Reloading...', 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          showCollisionModal(collisions, updates, applyResolutions);
        }

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
      <p class="data-management-note">Exports include every saved item in your browser storage, including API keys and parameters.</p>
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
