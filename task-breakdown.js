// Task Breakdown Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the task breakdown page
    if (!document.querySelector('.task-breakdown-container')) return;

    const mainTaskInput = document.getElementById('main-task-input');
    const addMainTaskBtn = document.getElementById('add-main-task-btn');
    const taskBreakdownList = document.getElementById('task-breakdown-list');
    
    // Load tasks from localStorage
    let breakdownTasks = JSON.parse(localStorage.getItem('adhd-breakdown-tasks')) || [];
    
    // Render all tasks
    function renderBreakdownTasks() {
        // Clear current list
        taskBreakdownList.innerHTML = '';
        
        // Create task elements
        breakdownTasks.forEach((mainTask, mainIndex) => {
            const mainTaskItem = document.createElement('div');
            mainTaskItem.className = `main-task-item ${mainTask.completed ? 'completed' : ''}`;
            
            // Create main task header
            const mainTaskHeader = document.createElement('div');
            mainTaskHeader.className = 'main-task-header';
            
            // Create checkbox for main task
            const mainCheckbox = document.createElement('input');
            mainCheckbox.type = 'checkbox';
            mainCheckbox.className = 'task-checkbox';
            mainCheckbox.checked = mainTask.completed;
            mainCheckbox.addEventListener('change', function() {
                toggleMainTaskComplete(mainIndex);
            });
            
            // Create main task text
            const mainTaskText = document.createElement('div');
            mainTaskText.className = 'main-task-text';
            mainTaskText.textContent = mainTask.text;
            
            // Create progress indicator
            const progressIndicator = document.createElement('div');
            progressIndicator.className = 'progress-indicator';
            const completedSubtasks = mainTask.subtasks.filter(subtask => subtask.completed).length;
            const totalSubtasks = mainTask.subtasks.length;
            const progressPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
            progressIndicator.textContent = `${progressPercentage}% (${completedSubtasks}/${totalSubtasks})`;
            
            // Create delete button for main task
            const deleteMainBtn = document.createElement('button');
            deleteMainBtn.className = 'delete-btn';
            deleteMainBtn.innerHTML = '&times;';
            deleteMainBtn.addEventListener('click', function() {
                deleteMainTask(mainIndex);
            });
            
            // Assemble main task header
            mainTaskHeader.appendChild(mainCheckbox);
            mainTaskHeader.appendChild(mainTaskText);
            mainTaskHeader.appendChild(progressIndicator);
            mainTaskHeader.appendChild(deleteMainBtn);
            
            // Create subtasks container
            const subtasksContainer = document.createElement('div');
            subtasksContainer.className = 'subtasks-container';
            
            // Create subtask list
            const subtaskList = document.createElement('div');
            subtaskList.className = 'subtask-list';
            
            // Add subtasks
            mainTask.subtasks.forEach((subtask, subtaskIndex) => {
                const subtaskItem = document.createElement('div');
                subtaskItem.className = `subtask-item ${subtask.completed ? 'completed' : ''}`;
                
                // Create checkbox for subtask
                const subtaskCheckbox = document.createElement('input');
                subtaskCheckbox.type = 'checkbox';
                subtaskCheckbox.className = 'task-checkbox';
                subtaskCheckbox.checked = subtask.completed;
                subtaskCheckbox.addEventListener('change', function() {
                    toggleSubtaskComplete(mainIndex, subtaskIndex);
                });
                
                // Create subtask text
                const subtaskText = document.createElement('div');
                subtaskText.className = 'subtask-text';
                subtaskText.textContent = subtask.text;
                
                // Create delete button for subtask
                const deleteSubtaskBtn = document.createElement('button');
                deleteSubtaskBtn.className = 'delete-btn';
                deleteSubtaskBtn.innerHTML = '&times;';
                deleteSubtaskBtn.addEventListener('click', function() {
                    deleteSubtask(mainIndex, subtaskIndex);
                });
                
                // Assemble subtask item
                subtaskItem.appendChild(subtaskCheckbox);
                subtaskItem.appendChild(subtaskText);
                subtaskItem.appendChild(deleteSubtaskBtn);
                
                subtaskList.appendChild(subtaskItem);
            });
            
            // Create add subtask form
            const addSubtaskForm = document.createElement('div');
            addSubtaskForm.className = 'add-subtask-form';
            
            const subtaskInput = document.createElement('input');
            subtaskInput.type = 'text';
            subtaskInput.className = 'subtask-input';
            subtaskInput.placeholder = 'Add a step...';
            
            const addSubtaskBtn = document.createElement('button');
            addSubtaskBtn.className = 'add-subtask-btn';
            addSubtaskBtn.textContent = 'Add Step';
            addSubtaskBtn.addEventListener('click', function() {
                if (subtaskInput.value.trim()) {
                    addSubtask(mainIndex, subtaskInput.value.trim());
                    subtaskInput.value = '';
                    subtaskInput.focus();
                }
            });
            
            // Handle enter key for subtask input
            subtaskInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && this.value.trim()) {
                    addSubtask(mainIndex, this.value.trim());
                    this.value = '';
                }
            });
            
            // Assemble add subtask form
            addSubtaskForm.appendChild(subtaskInput);
            addSubtaskForm.appendChild(addSubtaskBtn);
            
            // Assemble subtasks container
            subtasksContainer.appendChild(subtaskList);
            subtasksContainer.appendChild(addSubtaskForm);
            
            // Assemble main task item
            mainTaskItem.appendChild(mainTaskHeader);
            mainTaskItem.appendChild(subtasksContainer);
            
            taskBreakdownList.appendChild(mainTaskItem);
        });
    }
    
    // Add new main task
    function addMainTask() {
        if (!mainTaskInput.value.trim()) return;
        
        const newMainTask = {
            text: mainTaskInput.value.trim(),
            completed: false,
            subtasks: [],
            createdAt: new Date().toISOString()
        };
        
        breakdownTasks.push(newMainTask);
        saveTasks();
        
        // Clear input
        mainTaskInput.value = '';
        mainTaskInput.focus();
    }
    
    // Add new subtask
    function addSubtask(mainIndex, subtaskText) {
        const newSubtask = {
            text: subtaskText,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        breakdownTasks[mainIndex].subtasks.push(newSubtask);
        saveTasks();
    }
    
    // Toggle main task completion status
    function toggleMainTaskComplete(mainIndex) {
        const mainTask = breakdownTasks[mainIndex];
        mainTask.completed = !mainTask.completed;
        
        // If main task is completed, complete all subtasks
        if (mainTask.completed) {
            mainTask.subtasks.forEach(subtask => {
                subtask.completed = true;
            });
        }
        
        saveTasks();
    }
    
    // Toggle subtask completion status
    function toggleSubtaskComplete(mainIndex, subtaskIndex) {
        const subtask = breakdownTasks[mainIndex].subtasks[subtaskIndex];
        subtask.completed = !subtask.completed;
        
        // Check if all subtasks are completed
        const allSubtasksCompleted = breakdownTasks[mainIndex].subtasks.every(subtask => subtask.completed);
        
        // Update main task completion status
        breakdownTasks[mainIndex].completed = allSubtasksCompleted;
        
        saveTasks();
    }
    
    // Delete main task
    function deleteMainTask(mainIndex) {
        if (confirm('Are you sure you want to delete this task and all its steps?')) {
            breakdownTasks.splice(mainIndex, 1);
            saveTasks();
        }
    }
    
    // Delete subtask
    function deleteSubtask(mainIndex, subtaskIndex) {
        breakdownTasks[mainIndex].subtasks.splice(subtaskIndex, 1);
        
        // Update main task completion status
        const allSubtasksCompleted = breakdownTasks[mainIndex].subtasks.every(subtask => subtask.completed);
        breakdownTasks[mainIndex].completed = allSubtasksCompleted && breakdownTasks[mainIndex].subtasks.length > 0;
        
        saveTasks();
    }
    
    // Save tasks to localStorage
    function saveTasks() {
        localStorage.setItem('adhd-breakdown-tasks', JSON.stringify(breakdownTasks));
        renderBreakdownTasks();
    }
    
    // Event listeners
    if (addMainTaskBtn) {
        addMainTaskBtn.addEventListener('click', addMainTask);
    }
    
    if (mainTaskInput) {
        mainTaskInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addMainTask();
            }
        });
    }
    
    // Initial render
    renderBreakdownTasks();
});
