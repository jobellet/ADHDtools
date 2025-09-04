// eisenhower.js

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on the Eisenhower Matrix page
  const matrixSection = document.getElementById('eisenhower');
  if (!matrixSection) return;

  // DOM elements
  const taskInput = document.getElementById('task-input');
  const addTaskButton = document.getElementById('add-task');

  // Create and insert import dropdown (from Task Manager & Task Breakdown)
  if (!document.getElementById('import-task-eisenhower')) {
    const importSelect = document.createElement('select');
    importSelect.id = 'import-task-eisenhower';
    importSelect.style.margin = '0 0.5rem';
    importSelect.innerHTML = `<option value="">--Import Task--</option>`;
    addTaskButton.parentNode.insertBefore(importSelect, addTaskButton);

    // Populate import options on open
    function populateImportOptions() {
      importSelect.innerHTML = `<option value="">--Import Task--</option>`;
      // Task Manager tasks
      const manager = JSON.parse(localStorage.getItem('adhd-tasks')) || [];
      manager.forEach(t => {
        const opt = document.createElement('option');
        opt.value = `task:${t.id}`;
        opt.textContent = `[Task] ${t.text}`;
        importSelect.appendChild(opt);
      });
      // Task Breakdown subtasks
      const projects = JSON.parse(localStorage.getItem('adhd-breakdown-tasks')) || [];
      projects.forEach((proj, pIdx) => {
        proj.subtasks.forEach(sub => {
          const opt = document.createElement('option');
          opt.value = `subtask:${pIdx}:${sub.id}`;
          opt.textContent = `[Step] ${sub.text}`;
          importSelect.appendChild(opt);
        });
      });
    }
    // Re-populate whenever the user focuses the import select
    importSelect.addEventListener('focus', populateImportOptions);
  }

  // Create and insert quadrant selector
  if (!document.getElementById('quadrant-select')) {
    const quadrantSelect = document.createElement('select');
    quadrantSelect.id = 'quadrant-select';
    quadrantSelect.style.marginRight = '0.5rem';
    quadrantSelect.innerHTML = `
      <option value="q1">Do First (Important & Urgent)</option>
      <option value="q2">Schedule (Important & Not Urgent)</option>
      <option value="q3">Delegate (Not Important & Urgent)</option>
      <option value="q4">Eliminate (Not Important & Not Urgent)</option>
    `;
    addTaskButton.parentNode.insertBefore(quadrantSelect, addTaskButton);
  }

  const quadrantSelect = document.getElementById('quadrant-select');
  const importSelect = document.getElementById('import-task-eisenhower');

  // Quadrant containers
  const quadrants = {
    q1: document.getElementById('important-urgent'),
    q2: document.getElementById('important-not-urgent'),
    q3: document.getElementById('not-important-urgent'),
    q4: document.getElementById('not-important-not-urgent')
  };

  const STORAGE_KEY = 'eisenhowerTasks';
  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!tasks || typeof tasks !== 'object') {
    tasks = { q1: [], q2: [], q3: [], q4: [] };
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function renderTasks() {
    Object.keys(quadrants).forEach(q => {
      const container = quadrants[q];
      container.innerHTML = '';
      tasks[q].forEach(task => {
        const div = document.createElement('div');
        div.className = 'matrix-task';
        div.draggable = true;
        div.dataset.id = task.id;
        div.dataset.quadrant = q;

        const span = document.createElement('span');
        span.textContent = task.text;
        if (task.completed) {
          span.style.textDecoration = 'line-through';
          span.style.opacity = '0.6';
        }
        span.addEventListener('click', e => {
          e.stopPropagation();
          div.draggable = false;
          const input = document.createElement('input');
          input.type = 'text';
          input.value = task.text;
          div.replaceChild(input, span);
          input.focus();
          function finish(save) {
            const newText = input.value.trim();
            if (save && newText) {
              task.text = newText;
              saveTasks();
            }
            div.draggable = true;
            renderTasks();
          }
          input.addEventListener('blur', () => finish(true));
          input.addEventListener('keydown', e2 => {
            if (e2.key === 'Enter') finish(true);
            else if (e2.key === 'Escape') finish(false);
          });
        });
        div.appendChild(span);

        const actions = document.createElement('div');
        actions.className = 'task-actions';
        const doneBtn = document.createElement('button');
        doneBtn.innerHTML = task.completed ? '↺' : '✓';
        doneBtn.title = task.completed ? 'Mark Incomplete' : 'Mark Complete';
        doneBtn.addEventListener('click', e => {
          e.stopPropagation();
          toggleComplete(task.id, q);
        });
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          deleteTask(task.id, q);
        });
        actions.append(doneBtn, delBtn);
        div.appendChild(actions);

        // Drag handlers
        div.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ id: task.id, from: q }));
          div.classList.add('dragging');
        });
        div.addEventListener('dragend', () => div.classList.remove('dragging'));

        container.appendChild(div);
      });
    });
  }

  function resolveImport() {
    const val = importSelect.value;
    if (!val) return null;
    const [type, a, b] = val.split(':');
    if (type === 'task') {
      const all = JSON.parse(localStorage.getItem('adhd-tasks')) || [];
      const found = all.find(t => t.id === a);
      return found ? found.text : null;
    } else if (type === 'subtask') {
      const projs = JSON.parse(localStorage.getItem('adhd-breakdown-tasks')) || [];
      const pIdx = parseInt(a, 10);
      if (projs[pIdx]) {
        const sub = projs[pIdx].subtasks.find(st => st.id === b);
        return sub ? sub.text : null;
      }
    }
    return null;
  }

  function addNewTask() {
    let text = taskInput.value.trim();
    const imported = resolveImport();
    if (imported) {
      text = imported;
    }
    if (!text) return;
    const quadrant = quadrantSelect.value;
    const id = window.crypto?.randomUUID?.() || 't-' + Date.now();
    tasks[quadrant].push({ id, text, completed: false, createdAt: new Date().toISOString() });
    saveTasks();
    renderTasks();
    taskInput.value = '';
    importSelect.value = '';
    taskInput.focus();
    // Notify cross-tool bus
    window.EventBus?.dispatchEvent(new CustomEvent('eisenhowerTaskAdded', {
      detail: { id, text, quadrant }
    }));
  }

  function toggleComplete(id, q) {
    const t = tasks[q].find(x => x.id === id);
    if (t) {
      t.completed = !t.completed;
      saveTasks();
      renderTasks();
      window.EventBus?.dispatchEvent(new CustomEvent('taskCompleted', { detail: t }));
    }
  }

  function deleteTask(id, q) {
    tasks[q] = tasks[q].filter(x => x.id !== id);
    saveTasks();
    renderTasks();
  }

  // Setup drop zones
  Object.entries(quadrants).forEach(([q, container]) => {
    container.addEventListener('dragover', e => {
      e.preventDefault();
      container.classList.add('drag-over');
    });
    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });
    container.addEventListener('drop', e => {
      e.preventDefault();
      container.classList.remove('drag-over');
      try {
        const { id, from } = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (from !== q) {
          const idx = tasks[from].findIndex(x => x.id === id);
          const [moved] = tasks[from].splice(idx, 1);
          tasks[q].push(moved);
          saveTasks();
          renderTasks();
          window.EventBus?.dispatchEvent(new CustomEvent('taskMoved', {
            detail: { id, from, to: q }
          }));
        }
      } catch (err) {
        console.error('Drop parsing error', err);
      }
    });
  });

  // Bind add and Enter
  addTaskButton.addEventListener('click', addNewTask);
  taskInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') addNewTask();
  });
  importSelect.addEventListener('change', () => {
    if (importSelect.value) addNewTask();
  });

  // Initial render
  renderTasks();
});
