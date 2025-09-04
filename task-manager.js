// task-manager.js

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on Task Manager page
  const container = document.querySelector('.task-manager-container');
  if (!container) return;

  // DOM Elements
  const inputEl = document.getElementById('task-manager-input');
  const addBtn = document.getElementById('add-task-btn');
  const listEl = document.getElementById('task-list');
  const priorityFilterEl = document.getElementById('priority-filter');
  const categoryFilterEl = document.getElementById('category-filter');
  const showCompletedEl = document.getElementById('show-completed');
  const totalEl = document.getElementById('total-tasks');
  const completedEl = document.getElementById('completed-tasks');
  const remainingEl = document.getElementById('remaining-tasks');
  const prioritySelectEl = document.getElementById('task-priority');
  const categorySelectEl = document.getElementById('task-category');
  const importSelect = document.getElementById('task-import-select');

  const DataManager = window.DataManager;

  // Local cache of tasks from DataManager
  let tasks = DataManager ? DataManager.getTasks() : [];

  function refreshTasks() {
    tasks = DataManager.getTasks();
  }

  // Render task list according to filters
  function renderTasks() {
    refreshTasks();
    listEl.innerHTML = '';

    const showCompleted = showCompletedEl.checked;
    const priorityFilter = priorityFilterEl.value;
    const categoryFilter = categoryFilterEl.value;

    const filtered = tasks.filter(task => {
      if (!showCompleted && task.isCompleted) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      return true;
    });

    filtered.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.isCompleted ? ' completed' : '');
      li.dataset.id = task.id;

      // Checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.isCompleted;
      checkbox.addEventListener('change', () => {
        DataManager.updateTask(task.id, { isCompleted: checkbox.checked });
        window.EventBus.dispatchEvent(new CustomEvent('taskCompleted', { detail: { id: task.id, isCompleted: checkbox.checked } }));
        renderTasks();
      });

      // Text
      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      // Meta container
      const meta = document.createElement('div');
      meta.className = 'task-meta';
      const prio = document.createElement('span');
      prio.className = 'task-priority';
      prio.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
      const cat = document.createElement('span');
      cat.className = 'task-category';
      cat.textContent = task.category.charAt(0).toUpperCase() + task.category.slice(1);
      // Add a separator so the priority and category don't run together
      meta.append(prio, document.createTextNode(' | '), cat);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'task-edit';
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.addEventListener('click', () => {
        // Create editing UI
        const editContainer = document.createElement('div');
        editContainer.className = 'edit-task-container';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = task.text;
        textInput.className = 'edit-task-text-input';

        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'edit-task-priority-select';
        const priorities = ['low', 'medium', 'high'];
        priorities.forEach(prio => {
          const option = document.createElement('option');
          option.value = prio;
          option.textContent = prio.charAt(0).toUpperCase() + prio.slice(1);
          if (prio === task.priority) option.selected = true;
          prioritySelect.appendChild(option);
        });

        const categorySelect = document.createElement('select');
        categorySelect.className = 'edit-task-category-select';
        const categories = ['work', 'personal', 'study', 'other'];
        categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
          if (cat === task.category) option.selected = true;
          categorySelect.appendChild(option);
        });

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'edit-task-save-btn';
        saveBtn.addEventListener('click', () => {
          const newText = textInput.value.trim();
          if (newText) {
            task.text = newText;
            task.priority = prioritySelect.value;
            task.category = categorySelect.value;
            DataManager.updateTask(task.id, {
              text: newText,
              priority: prioritySelect.value,
              category: categorySelect.value
            });
            renderTasks(); // This will re-render the entire list
          } else {
            // Handle empty text - maybe show an error or just re-render original
            renderTasks(); // Re-render to show original task if text is empty
          }
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'edit-task-cancel-btn';
        cancelBtn.addEventListener('click', () => {
          renderTasks(); // Re-render to show original task
        });

        editContainer.append(textInput, prioritySelect, categorySelect, saveBtn, cancelBtn);

        // Replace task item content with editing UI
        const listItem = editBtn.closest('li');
        // Temporarily remove all children. We'll restore them on save/cancel by re-rendering.
        while (listItem.firstChild) {
          listItem.removeChild(listItem.firstChild);
        }
        listItem.appendChild(editContainer);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-delete';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.addEventListener('click', () => {
        if (confirm('Delete this task?')) {
          DataManager.deleteTask(task.id);
          renderTasks();
        }
      });

      // "Send to" buttons
      const sendToPlannerBtn = document.createElement('button');
      sendToPlannerBtn.textContent = 'To Planner';
      sendToPlannerBtn.className = 'send-to-planner-btn task-action-btn';
      sendToPlannerBtn.addEventListener('click', () => {
        const standardizedTask = {
          id: task.id,
          text: task.text,
          originalTool: 'TaskManager',
          priority: task.priority,
          category: task.category,
          isCompleted: task.isCompleted,
          // Optional fields not directly available in TaskManager task object
          dueDate: null, 
          duration: null, 
          notes: null,
          subTasks: [] 
        };
        window.CrossTool.sendTaskToTool(standardizedTask, 'DayPlanner');
        alert(`Task "${task.text}" sent to Day Planner.`);
      });

      const sendToBreakdownBtn = document.createElement('button');
      sendToBreakdownBtn.textContent = 'To Breakdown';
      sendToBreakdownBtn.className = 'send-to-breakdown-btn task-action-btn';
      sendToBreakdownBtn.addEventListener('click', () => {
        const standardizedTask = {
          id: task.id,
          text: task.text,
          originalTool: 'TaskManager',
          priority: task.priority,
          category: task.category,
          isCompleted: task.isCompleted,
          dueDate: null,
          duration: null,
          notes: null,
          subTasks: []
        };
        window.CrossTool.sendTaskToTool(standardizedTask, 'TaskBreakdown');
        alert(`Task "${task.text}" sent to Task Breakdown.`);
      });

      const sendToRoutineBtn = document.createElement('button');
      sendToRoutineBtn.textContent = 'To Routine';
      sendToRoutineBtn.className = 'send-to-routine-btn task-action-btn';
      sendToRoutineBtn.addEventListener('click', () => {
        const standardizedTask = {
          id: task.id,
          text: task.text,
          originalTool: 'TaskManager',
          priority: task.priority,
          category: task.category,
          isCompleted: task.isCompleted,
          // For routine, duration might be relevant, but TaskManager tasks don't have it.
          // The routine tool will likely need to prompt for duration if it receives a task without one.
          duration: null, // TaskManager tasks don't have duration
          dueDate: null,
          notes: null,
          subTasks: []
        };
        window.CrossTool.sendTaskToTool(standardizedTask, 'Routine');
        alert(`Task "${task.text}" sent to Routine.`);
      });

      actions.append(editBtn, deleteBtn, sendToPlannerBtn, sendToBreakdownBtn, sendToRoutineBtn);

      li.append(checkbox, text, meta, actions);
      listEl.appendChild(li);
    });

    // Update counts
    const total = tasks.length;
    const completedCount = tasks.filter(t => t.isCompleted).length;
    const remaining = total - completedCount;
    if (totalEl) totalEl.textContent = total;
    if (completedEl) completedEl.textContent = completedCount;
    if (remainingEl) remainingEl.textContent = remaining;
  }

  function populateImportOptions() {
    if (!importSelect) return;
    importSelect.innerHTML = `<option value="">--Import Task--</option>`;
    const breakdown = JSON.parse(localStorage.getItem('adhd-breakdown-tasks')) || [];
    breakdown.forEach((proj, idx) => {
      const opt = document.createElement('option');
      opt.value = `breakdown:${idx}`;
      opt.textContent = `[Breakdown] ${proj.text}`;
      importSelect.appendChild(opt);
    });
    const eisenhower = JSON.parse(localStorage.getItem('eisenhowerTasks')) || {};
    Object.keys(eisenhower).forEach(q => {
      (eisenhower[q] || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = `eisenhower:${q}:${t.id}`;
        opt.textContent = `[Matrix] ${t.text}`;
        importSelect.appendChild(opt);
      });
    });
  }

  function handleImportSelection() {
    if (!importSelect) return;
    const val = importSelect.value;
    if (!val) return;
    let text = '';
    const [type, a, b] = val.split(':');
    if (type === 'breakdown') {
      const breakdown = JSON.parse(localStorage.getItem('adhd-breakdown-tasks')) || [];
      const proj = breakdown[parseInt(a, 10)];
      if (proj) text = proj.text;
    } else if (type === 'eisenhower') {
      const eis = JSON.parse(localStorage.getItem('eisenhowerTasks')) || {};
      const arr = eis[a] || [];
      const found = arr.find(t => t.id === b);
      if (found) text = found.text;
    }
    if (text) {
      const newTask = DataManager.addTask({ text, originalTool: type === 'breakdown' ? 'TaskBreakdown' : 'EisenhowerMatrix' });
      window.EventBus.dispatchEvent(new CustomEvent('taskAdded', { detail: newTask }));
      renderTasks();
      alert(`Imported task "${text}"`);
    }
    importSelect.value = '';
  }

  if (importSelect) {
    importSelect.addEventListener('focus', populateImportOptions);
    importSelect.addEventListener('change', handleImportSelection);
  }

  // Receive tasks from other tools
  window.EventBus.addEventListener('ef-receiveTaskFor-TaskManager', event => {
    const t = event.detail;
    if (!t || !t.text) {
      console.warn('Task Manager received invalid task:', t);
      return;
    }
    const newTask = DataManager.addTask({
      text: t.text,
      originalTool: t.originalTool || 'unknown',
      priority: t.priority || 'medium',
      category: t.category || 'other',
      dueDate: t.dueDate || null,
      duration: t.duration || null,
      notes: t.notes || '',
      subTasks: t.subTasks || []
    });
    window.EventBus.dispatchEvent(new CustomEvent('taskAdded', { detail: newTask }));
    renderTasks();
    alert(`Task '${t.text}' added to Task Manager.`);
  });

  // Add new task
  function addTask() {
    const text = inputEl.value.trim();
    if (!text) return;

    const newTask = DataManager.addTask({
      text,
      originalTool: 'TaskManager',
      priority: prioritySelectEl.value || 'medium',
      category: categorySelectEl.value || 'other'
    });
    window.EventBus.dispatchEvent(new CustomEvent('taskAdded', { detail: newTask }));
    inputEl.value = '';
    prioritySelectEl.value = 'medium';
    categorySelectEl.value = 'other';
    renderTasks();
  }

  // Event listeners
  addBtn.addEventListener('click', addTask);
  inputEl.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });
  priorityFilterEl.addEventListener('change', renderTasks);
  categoryFilterEl.addEventListener('change', renderTasks);
  showCompletedEl.addEventListener('change', renderTasks);

  // Initial render
  renderTasks();
});
