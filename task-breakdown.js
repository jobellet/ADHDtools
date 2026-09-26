// task-breakdown.js

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if on the task breakdown page
  const container = document.querySelector('.task-breakdown-container');
  if (!container) return;

  const selectTaskBtn = document.getElementById('select-task-btn');
  const aiBtn = document.getElementById('ai-breakdown');
  const listContainer = document.getElementById('project-list');
  const taskSelectModal = document.getElementById('task-select-modal');
  const taskSearchInput = document.getElementById('task-select-search');
  const taskSortSelect = document.getElementById('task-select-sort');
  const taskSelectList = document.getElementById('task-select-list');

  let isAiMode = false;
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-percentage');
  const STORAGE_KEY = 'adhd-breakdown-tasks';

  // Load or initialize tree
  let tree = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

  // Ensure all nodes have duration
  function normalizeTree(nodes) {
    nodes.forEach(node => {
      if (typeof node.duration === 'undefined') {
        node.duration = 5; // Default for existing nodes
      }
      if (node.subtasks && node.subtasks.length > 0) {
        normalizeTree(node.subtasks);
      }
    });
  }
  normalizeTree(tree);
  recalculateDurations(); // Initial calculation

  function saveTree() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  }

  function recalculateDurations() {
    function calc(nodes) {
      let total = 0;
      nodes.forEach(node => {
        if (node.subtasks && node.subtasks.length > 0) {
          node.duration = calc(node.subtasks);
        } else {
          // Leaf node: ensure it has a duration, default 5
          if (!node.duration) node.duration = 5;
        }
        total += parseInt(node.duration) || 0;
      });
      return total;
    }
    // We don't sum the top level for a global duration, but we update each top level node
    tree.forEach(root => {
      if (root.subtasks && root.subtasks.length > 0) {
        root.duration = calc(root.subtasks);
      } else {
        if (!root.duration) root.duration = 5;
      }
    });
  }

  function countCompletion(nodes) {
    let total = 0;
    let completed = 0;
    nodes.forEach(node => {
      total++;
      if (node.completed) completed++;
      if (node.subtasks && node.subtasks.length) {
        const child = countCompletion(node.subtasks);
        total += child.total;
        completed += child.completed;
      }
    });
    return { total, completed };
  }

  function updateProgressBar() {
    if (!progressBar || !progressText) return;
    const { total, completed } = countCompletion(tree);
    const percent = total ? Math.round((completed / total) * 100) : 0;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
  }

  // Recursive render function
  function renderNodes(nodes, parentEl, path = []) {
    nodes.forEach((node, index) => {
      const nodePath = path.concat(index);
      const isLeaf = !node.subtasks || node.subtasks.length === 0;

      // Create item container
      const item = document.createElement('div');
      item.className = path.length === 0 ? 'main-task-item' : 'subtask-item';
      item.style.marginLeft = `${path.length * 20}px`;

      // Checkbox
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = node.completed;
      cb.addEventListener('change', () => {
        node.completed = cb.checked;
        saveTree();
        renderTree();
      });
      item.appendChild(cb);

      // Content Container
      const content = document.createElement('div');
      content.className = 'task-content';

      // Text
      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = node.text;
      text.title = 'Click to edit text';
      text.addEventListener('click', () => {
        const newText = prompt('Edit this step:', node.text);
        if (newText !== null && newText.trim()) {
          node.text = newText.trim();
          saveTree();
          renderTree();
        }
      });
      if (node.completed) text.style.textDecoration = 'line-through';
      content.appendChild(text);

      // Duration Badge
      const durationBadge = document.createElement('span');
      durationBadge.className = 'task-duration-badge';
      durationBadge.textContent = `${node.duration} min`;
      durationBadge.title = isLeaf ? 'Click to edit duration' : 'Calculated from subtasks';
      if (isLeaf) {
        durationBadge.style.cursor = 'pointer';
        durationBadge.addEventListener('click', () => {
          const newDur = prompt('Enter duration in minutes:', node.duration);
          if (newDur !== null) {
            const val = parseInt(newDur);
            if (!isNaN(val) && val > 0) {
              node.duration = val;
              recalculateDurations();
              saveTree();
              renderTree();
            }
          }
        });
      } else {
        durationBadge.style.cursor = 'default';
        durationBadge.style.opacity = '0.8';
      }
      content.appendChild(durationBadge);

      item.appendChild(content);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'task-actions';

      // Import to Planner Button
      const importBtn = document.createElement('button');
      importBtn.className = 'import-btn';
      importBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> Import';
      importBtn.title = 'Import to Day Planner';
      importBtn.addEventListener('click', () => {
        importToPlanner(node);
      });
      actions.appendChild(importBtn);

      // Delete Button
      const del = document.createElement('button');
      del.className = 'action-btn';
      del.innerHTML = '<i class="fas fa-trash"></i>';
      del.title = 'Delete';
      del.addEventListener('click', () => {
        if (confirm('Delete this task?')) {
          deleteNode(nodePath);
        }
      });
      actions.appendChild(del);

      item.appendChild(actions);

      // Append this item
      parentEl.appendChild(item);

      // Render children
      if (node.subtasks && node.subtasks.length) {
        renderNodes(node.subtasks, parentEl, nodePath);
      }

      // Add Subtask form for this node
      const addForm = document.createElement('div');
      addForm.className = 'add-step-form';
      addForm.style.marginLeft = `${(path.length + 1) * 20}px`;

      const subInput = document.createElement('input');
      subInput.type = 'text';
      subInput.placeholder = 'Add subtask...';

      const subBtn = document.createElement('button');
      subBtn.textContent = 'Add';

      const handleAdd = () => {
        const val = subInput.value.trim();
        if (!val) return;
        addNode(nodePath, val);
        subInput.value = '';
      };

      subBtn.addEventListener('click', handleAdd);
      subInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAdd();
      });

      addForm.append(subInput, subBtn);
      parentEl.appendChild(addForm);
    });
  }

  function renderTree() {
    listContainer.innerHTML = '';
    renderNodes(tree, listContainer, []);
    updateProgressBar();
  }

  function addNode(path, text) {
    const target = getNodeByPath(path);
    if (!target.subtasks) target.subtasks = [];
    // New subtask gets default 5 min duration
    target.subtasks.push({ text, completed: false, subtasks: [], duration: 5 });
    recalculateDurations();
    saveTree();
    renderTree();
  }

  function deleteNode(path) {
    if (path.length === 1) {
      tree.splice(path[0], 1);
    } else {
      const parent = getNodeByPath(path.slice(0, -1));
      parent.subtasks.splice(path[path.length - 1], 1);
    }
    recalculateDurations();
    saveTree();
    renderTree();
  }

  function getNodeByPath(path) {
    return path.reduce((nodes, idx, i) => {
      return i === 0 ? tree[idx] : nodes.subtasks[idx];
    }, null);
  }


  function importToPlanner(node) {
    if (!window.CrossTool) {
      alert('CrossTool integration not available.');
      return;
    }

    const taskData = {
      text: node.text,
      duration: node.duration,
      isCompleted: node.completed,
      originalTool: 'TaskBreakdown'
    };

    window.CrossTool.sendTaskToTool(taskData, 'DayPlanner', { openTool: true });
  }

  // Task selection logic
  selectTaskBtn.addEventListener('click', () => {
    isAiMode = false;
    openTaskSelectModal();
  });

  // AI breakdown generation
  aiBtn.addEventListener('click', () => {
    if (!window.AIAssistant?.isEnabled?.()) {
      alert('AI breakdown needs an AI provider. Open Settings → AI Assistance to configure one (OpenAI, Gemini, Claude, Mistral, a local model…). You can still break tasks down manually.');
      return;
    }
    isAiMode = true;
    openTaskSelectModal();
  });

  if (taskSelectModal) {
    const closeBtn = taskSelectModal.querySelector('.close-button');
    if (closeBtn) closeBtn.addEventListener('click', () => taskSelectModal.classList.remove('active'));

    // Close modal on outside click
    taskSelectModal.addEventListener('click', (e) => {
      if (e.target === taskSelectModal) {
        taskSelectModal.classList.remove('active');
      }
    });

    taskSearchInput.addEventListener('input', renderTaskSelectList);
    taskSortSelect.addEventListener('change', renderTaskSelectList);
  }

  function openTaskSelectModal() {
    taskSearchInput.value = '';
    renderTaskSelectList();
    taskSelectModal.classList.add('active');
  }

  function renderTaskSelectList() {
    if (!taskSelectList || !window.TaskStore) return;
    taskSelectList.innerHTML = '';

    const filterText = (taskSearchInput.value || '').toLowerCase();
    const sortVal = taskSortSelect.value;

    // Fetch pending tasks from TaskStore
    let tasks = window.TaskStore.getPendingTasks();

    // Search
    if (filterText) {
      tasks = tasks.filter(t => t.text && t.text.toLowerCase().includes(filterText));
    }

    // Sort
    if (sortVal === 'deadline') {
      tasks.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (sortVal === 'duration') {
      tasks.sort((a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0));
    } else if (sortVal === 'scheduled') {
      tasks.sort((a, b) => {
        if (!a.plannerDate) return 1;
        if (!b.plannerDate) return -1;
        return new Date(a.plannerDate) - new Date(b.plannerDate);
      });
    }

    if (tasks.length === 0) {
      taskSelectList.innerHTML = '<div style="padding: 1rem; color: #666; text-align: center;">No tasks found.</div>';
      return;
    }

    tasks.forEach(task => {
      const item = document.createElement('div');
      item.className = 'task-select-item';

      const content = document.createElement('div');

      const title = document.createElement('div');
      title.className = 'task-select-item-title';
      title.textContent = task.text;

      const meta = document.createElement('div');
      meta.className = 'task-select-item-meta';
      const metaParts = [];
      if (task.durationMinutes) metaParts.push(`${task.durationMinutes} min`);
      if (task.deadline) metaParts.push(`Due: ${task.deadline}`);
      meta.textContent = metaParts.join(' • ');

      content.appendChild(title);
      content.appendChild(meta);
      item.appendChild(content);

      item.addEventListener('click', async () => {
        taskSelectModal.classList.remove('active');

        if (isAiMode) {
            aiBtn.disabled = true;
            const originalText = aiBtn.textContent;
            aiBtn.textContent = 'Generating...';
            try {
              const prompt = `Break down the task "${task.text}" into 3-8 small, concrete sub-tasks that someone with ADHD can start immediately. Return a JSON array of objects with keys "text" (short imperative step) and "duration" (estimated minutes, integer).`;
              const result = await window.AIAssistant.completeJSON(prompt, { maxTokens: 600 });
              const steps = (Array.isArray(result) ? result : [])
                .map(item => ({
                  text: String(item.text || '').trim(),
                  duration: Math.max(1, parseInt(item.duration, 10) || 5),
                }))
                .filter(item => item.text);
              if (!steps.length) throw new Error('The AI did not return any sub-tasks.');

              const newNode = {
                text: task.text,
                completed: false,
                subtasks: steps.map(s => ({ text: s.text, completed: false, subtasks: [], duration: s.duration })),
                duration: 0
              };

              tree.push(newNode);
              recalculateDurations();
              saveTree();
              renderTree();
            } catch (err) {
              alert(err.message);
            } finally {
              aiBtn.disabled = false;
              aiBtn.textContent = originalText;
            }
        } else {
            tree.push({ text: task.text, completed: false, subtasks: [], duration: task.durationMinutes || 5 });
            saveTree();
            renderTree();
        }
      });

      taskSelectList.appendChild(item);
    });
  }

  // Initial render
  renderTree();

  // --- Task Receiving Logic ---
  async function handleReceivedTaskForTaskBreakdown(event) {
    const standardizedTask = event.detail;
    if (!standardizedTask || !standardizedTask.text) {
      console.warn('TaskBreakdown received invalid task:', standardizedTask);
      return;
    }

    // Add as a new main project
    tree.push({
      text: standardizedTask.text,
      completed: !!standardizedTask.isCompleted,
      subtasks: [],
      duration: standardizedTask.duration || 5
    });

    recalculateDurations();
    saveTree();
    renderTree();

    window.switchTool?.('breakdown');
    window.DataManager?.showNotification?.(`“${standardizedTask.text}” is ready to split into small steps.`);
  }

  if (window.EventBus) {
    window.EventBus.addEventListener('ef-receiveTaskFor-TaskBreakdown', handleReceivedTaskForTaskBreakdown);
  }
});
