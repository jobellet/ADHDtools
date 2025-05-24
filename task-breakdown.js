// task-breakdown.js

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if on the task breakdown page
  const container = document.querySelector('.task-breakdown-container');
  if (!container) return;

  const mainInput = document.getElementById('project-input');
  const addMainBtn = document.getElementById('add-project');
  const listContainer = document.getElementById('project-list');
  const STORAGE_KEY = 'adhd-breakdown-tasks';

  // Load or initialize tree
  let tree = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

  function saveTree() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
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

  // Initial render
  renderTree();

  // --- Task Receiving Logic ---
  function handleReceivedTaskForTaskBreakdown(event) {
    const standardizedTask = event.detail;
    if (!standardizedTask || !standardizedTask.text) {
        console.warn("TaskBreakdown received invalid task:", standardizedTask);
        return;
    }

    const newTaskNode = {
        text: standardizedTask.text,
        completed: standardizedTask.isCompleted || false,
        subtasks: [] // Transferred task added as a main task without subtasks initially
    };

    tree.push(newTaskNode); // Add to the root of the tree
    saveTree();
    renderTree();
    alert(`Task '${standardizedTask.text}' added to Task Breakdown as a new main project/task.`);
  }

  window.EventBus.addEventListener('ef-receiveTaskFor-TaskBreakdown', handleReceivedTaskForTaskBreakdown);

});
