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

  // Task storage key
  const STORAGE_KEY = 'adhd-tasks';

  // Generate a UUID for tasks
  function generateId() {
    return crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  // Load tasks from localStorage, ensuring each has an id
  let tasks = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
  tasks = tasks.map(task => {
    if (!task.id) task.id = generateId();
    return task;
  });

  // Save tasks to localStorage and re-render
  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    renderTasks();
  }

  // Render task list according to filters
  function renderTasks() {
    listEl.innerHTML = '';

    const showCompleted = showCompletedEl.checked;
    const priorityFilter = priorityFilterEl.value;
    const categoryFilter = categoryFilterEl.value;

    const filtered = tasks.filter(task => {
      if (!showCompleted && task.completed) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      return true;
    });

    filtered.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.completed ? ' completed' : '');
      li.dataset.id = task.id;

      // Checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.completed;
      checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        saveTasks();
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
      cat.textContent = task.category;
      meta.append(prio, cat);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'task-edit';
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.addEventListener('click', () => {
        const newText = prompt('Edit task:', task.text);
        if (newText !== null && newText.trim()) {
          task.text = newText.trim();
          saveTasks();
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-delete';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.addEventListener('click', () => {
        if (confirm('Delete this task?')) {
          tasks = tasks.filter(t => t.id !== task.id);
          saveTasks();
        }
      });

      actions.append(editBtn, deleteBtn);

      li.append(checkbox, text, meta, actions);
      listEl.appendChild(li);
    });

    // Update counts
    const total = tasks.length;
    const completedCount = tasks.filter(t => t.completed).length;
    const remaining = total - completedCount;
    if (totalEl) totalEl.textContent = total;
    if (completedEl) completedEl.textContent = completedCount;
    if (remainingEl) remainingEl.textContent = remaining;
  }

  // Add new task
  function addTask() {
    const text = inputEl.value.trim();
    if (!text) return;

    const newTask = {
      id: generateId(),
      text,
      priority: prioritySelectEl.value || 'medium',
      category: categorySelectEl.value || 'other',
      completed: false,
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    inputEl.value = '';
    saveTasks();
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
