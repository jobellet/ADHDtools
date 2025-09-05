// task-breakdown.js

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if on the task breakdown page
  const container = document.querySelector('.task-breakdown-container');
  if (!container) return;

  const mainInput = document.getElementById('project-input');
  const addMainBtn = document.getElementById('add-project');
  const aiBtn = document.getElementById('ai-breakdown');
  const listContainer = document.getElementById('project-list');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-percentage');
  const STORAGE_KEY = 'adhd-breakdown-tasks';

  // Load or initialize tree
  let tree = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

  function saveTree() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
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

      // Text
      const text = document.createElement('span');
      text.textContent = node.text;
      // Allow inline editing on click
      text.style.cursor = 'pointer';
      text.title = 'Click to edit';
      text.addEventListener('click', () => {
        const newText = prompt('Edit this step:', node.text);
        if (newText !== null && newText.trim()) {
          node.text = newText.trim();
          saveTree();
          renderTree();
        }
      });
      text.style.margin = '0 8px';
      if (node.completed) text.style.textDecoration = 'line-through';
      item.appendChild(text);

      // Delete
      const del = document.createElement('button');
      del.innerHTML = '&times;';
      del.title = 'Delete';
      del.addEventListener('click', () => {
        deleteNode(nodePath);
      });
      item.appendChild(del);

      // Append this item
      parentEl.appendChild(item);

      // Render children
      if (node.subtasks && node.subtasks.length) {
        renderNodes(node.subtasks, parentEl, nodePath);
      }

      // Add Subtask form for this node
      const addForm = document.createElement('div');
      addForm.style.marginLeft = `${(path.length + 1) * 20}px`;
      const subInput = document.createElement('input');
      subInput.type = 'text';
      subInput.placeholder = 'New step...';
      const subBtn = document.createElement('button');
      subBtn.textContent = 'Add Step';
      subBtn.addEventListener('click', () => {
        const val = subInput.value.trim();
        if (!val) return;
        addNode(nodePath, val);
        subInput.value = '';
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
    target.subtasks.push({ text, completed: false, subtasks: [] });
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
    saveTree();
    renderTree();
  }

  function getNodeByPath(path) {
    return path.reduce((nodes, idx, i) => {
      return i === 0 ? tree[idx] : nodes.subtasks[idx];
    }, null);
  }

  function addMain() {
    const val = mainInput.value.trim();
    if (!val) return;
    tree.push({ text: val, completed: false, subtasks: [] });
    mainInput.value = '';
    saveTree();
    renderTree();
  }

  // Bind main add
  addMainBtn.addEventListener('click', addMain);
  mainInput.addEventListener('keypress', e => { if (e.key === 'Enter') addMain(); });

  // AI breakdown generation
  aiBtn.addEventListener('click', async () => {
    const task = mainInput.value.trim();
    if (!task) return;
    aiBtn.disabled = true;
    const originalText = aiBtn.textContent;
    aiBtn.textContent = 'Generating...';
    try {
      const prompt = `Break down the task '${task}' into a list of simple sub-tasks. Put each sub-task on a new line.`;
      const aiText = await callGemini(prompt);
      if (!aiText) throw new Error('No response');
      const steps = aiText.split('\n').map(t => t.replace(/^[*-]\s*/, '').trim()).filter(Boolean);
      const newNode = { text: task, completed: false, subtasks: steps.map(s => ({ text: s, completed: false, subtasks: [] })) };
      tree.push(newNode);
      saveTree();
      renderTree();
      mainInput.value = '';
    } catch (err) {
      alert(err.message);
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = originalText;
    }
  });

  // Initial render
  renderTree();

  // --- Task Receiving Logic ---
  async function handleReceivedTaskForTaskBreakdown(event) {
    const standardizedTask = event.detail;
    if (!standardizedTask || !standardizedTask.text) {
      console.warn('TaskBreakdown received invalid task:', standardizedTask);
      return;
    }

    let subtasks = [];
    try {
      const prompt = `Break down the task '${standardizedTask.text}' into a list of simple sub-tasks. Put each sub-task on a new line.`;
      const aiText = await callGemini(prompt);
      if (aiText) {
        subtasks = aiText
          .split('\n')
          .map(t => t.replace(/^[*-]\s*/, '').trim())
          .filter(Boolean)
          .map(s => ({ text: s, completed: false, subtasks: [] }));
      }
    } catch (err) {
      console.warn('Auto breakdown failed:', err);
    }

    const newTaskNode = {
      text: standardizedTask.text,
      completed: standardizedTask.isCompleted || false,
      subtasks
    };

    tree.push(newTaskNode);
    saveTree();
    renderTree();

    const msg = subtasks.length
      ? `Task '${standardizedTask.text}' added and broken into steps.`
      : `Task '${standardizedTask.text}' added to Task Breakdown.`;
    alert(msg);
  }

  window.EventBus.addEventListener('ef-receiveTaskFor-TaskBreakdown', handleReceivedTaskForTaskBreakdown);

});
