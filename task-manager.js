// Task Manager Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the task manager page
    if (!document.querySelector('.task-manager-container')) return;

    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    const categorySelect = document.getElementById('category-select');
    const prioritySelect = document.getElementById('priority-select');
    const filterSelect = document.getElementById('filter-select');
    
    // Load tasks from localStorage
    let tasks = JSON.parse(localStorage.getItem('adhd-tasks')) || [];
    
    function generateUniqueId() {
      return 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
    // Render all tasks
    function renderTasks() {
        // Clear current list
        taskList.innerHTML = '';
        
        // Get filter value
        const filterValue = filterSelect ? filterSelect.value : 'all';
        
        // Filter tasks based on selection
        let filteredTasks = tasks;
        if (filterValue !== 'all') {
            if (filterValue === 'completed') {
                filteredTasks = tasks.filter(task => task.completed);
            } else if (filterValue === 'active') {
                filteredTasks = tasks.filter(task => !task.completed);
            } else if (filterValue.startsWith('category-')) {
                const category = filterValue.replace('category-', '');
                filteredTasks = tasks.filter(task => task.category === category);
            } else if (filterValue.startsWith('priority-')) {
                const priority = filterValue.replace('priority-', '');
                filteredTasks = tasks.filter(task => task.priority === priority);
            }
        }
        
        // Create task elements
        filteredTasks.forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = `task-item ${task.completed ? 'completed' : ''} priority-${task.priority}`;
            taskItem.dataset.id = task.id;  // Use the unique id

            // Create checkbox and add event listener using the task id
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', function() {
                toggleTaskComplete(task.id);
            });

            // Create delete button using the task id
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to delete this task?')) {
                    deleteTask(task.id);
                }
            });
            // Create task text
            const taskText = document.createElement('div');
            taskText.className = 'task-text';
            taskText.textContent = task.text;
            
            // Create category badge
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'category-badge';
            categoryBadge.textContent = task.category;
            
            // Create priority indicator
            const priorityIndicator = document.createElement('span');
            priorityIndicator.className = 'priority-indicator';
            priorityIndicator.textContent = getPriorityLabel(task.priority);
            
            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', function() {
                deleteTask(tasks.indexOf(task));
            });
            
            // Assemble task item
            taskItem.appendChild(checkbox);
            taskItem.appendChild(taskText);
            taskItem.appendChild(categoryBadge);
            taskItem.appendChild(priorityIndicator);
            taskItem.appendChild(deleteBtn);
            
            taskList.appendChild(taskItem);
            taskItem.appendChild(checkbox);
        });
        
        // Update task counter if it exists
        const taskCounter = document.getElementById('task-counter');
        if (taskCounter) {
            const activeCount = tasks.filter(task => !task.completed).length;
            taskCounter.textContent = `${activeCount} active task${activeCount !== 1 ? 's' : ''}`;
        }
    }
    
    // After loading tasks from localStorage, ensure each task has an id:
    tasks = tasks.map(task => {
      if (!task.id) {
        task.id = generateUniqueId();
      }
      return task;
    });

    function addTask() {
        if (!taskInput.value.trim()) return;

        const newTask = {
            id: generateUniqueId(),  // NEW: Unique identifier
            text: taskInput.value.trim(),
            completed: false,
            category: categorySelect ? categorySelect.value : 'general',
            priority: prioritySelect ? prioritySelect.value : 'medium',
            createdAt: new Date().toISOString()
        };

        tasks.push(newTask);
        saveTasks();

        // Clear input
        taskInput.value = '';
        taskInput.focus();
    }

    
    // Toggle task completion status
    function toggleTaskComplete(taskId) {
    const index = tasks.findIndex(task => task.id === taskId);
    if (index !== -1) {
        tasks[index].completed = !tasks[index].completed;
        saveTasks();
        }
    }

    
    
    // Delete task
    function deleteTask(taskId) {
        const index = tasks.findIndex(task => task.id === taskId);
        if (index !== -1) {
            tasks.splice(index, 1);
            saveTasks();
        }
    }

    
    // Save tasks to localStorage
    function saveTasks() {
        localStorage.setItem('adhd-tasks', JSON.stringify(tasks));
        renderTasks();
    }
    
    // Get priority label
    function getPriorityLabel(priority) {
        switch(priority) {
            case 'high': return 'High';
            case 'medium': return 'Med';
            case 'low': return 'Low';
            default: return 'Med';
        }
    }
    
    // Event listeners
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addTask);
    }
    
    if (taskInput) {
        taskInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addTask();
            }
        });
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', renderTasks);
    }
    
    // Clear completed tasks
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    if (clearCompletedBtn) {
        clearCompletedBtn.addEventListener('click', function() {
            tasks = tasks.filter(task => !task.completed);
            saveTasks();
        });
    }
    
    // Initial render
    renderTasks();
});
