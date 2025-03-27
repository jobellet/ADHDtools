// Eisenhower Matrix JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const taskInput = document.getElementById('task-input');
    const addTaskButton = document.getElementById('add-task');
    const q1TasksList = document.getElementById('q1-tasks');
    const q2TasksList = document.getElementById('q2-tasks');
    const q3TasksList = document.getElementById('q3-tasks');
    const q4TasksList = document.getElementById('q4-tasks');
    
    // Matrix quadrants
    const quadrants = {
        q1: document.getElementById('important-urgent'),
        q2: document.getElementById('important-not-urgent'),
        q3: document.getElementById('not-important-urgent'),
        q4: document.getElementById('not-important-not-urgent')
    };
    
    // Load tasks from localStorage
    let tasks = JSON.parse(localStorage.getItem('eisenhowerTasks')) || {
        q1: [], // Important & Urgent
        q2: [], // Important & Not Urgent
        q3: [], // Not Important & Urgent
        q4: []  // Not Important & Not Urgent
    };
    
    // Initialize the matrix with saved tasks
    renderTasks();
    
    // Event listeners
    addTaskButton.addEventListener('click', addNewTask);
    taskInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addNewTask();
        }
    });
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Functions
    function addNewTask() {
        const taskText = taskInput.value.trim();
        if (taskText === '') return;
        
        // Create modal for quadrant selection
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Where does this task belong?</h3>
                <p>Select the appropriate quadrant for: "${taskText}"</p>
                <div class="quadrant-buttons">
                    <button data-quadrant="q1" class="btn">Important & Urgent</button>
                    <button data-quadrant="q2" class="btn">Important & Not Urgent</button>
                    <button data-quadrant="q3" class="btn">Not Important & Urgent</button>
                    <button data-quadrant="q4" class="btn">Not Important & Not Urgent</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners to quadrant buttons
        const buttons = modal.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                const quadrant = this.getAttribute('data-quadrant');
                const newTask = {
                    id: Date.now(),
                    text: taskText,
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                
                tasks[quadrant].push(newTask);
                saveTasks();
                renderTasks();
                
                // Remove modal
                document.body.removeChild(modal);
                
                // Clear input
                taskInput.value = '';
                taskInput.focus();
            });
        });
        
        // Add CSS for modal
        if (!document.getElementById('modal-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-styles';
            style.textContent = `
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-content {
                    background-color: white;
                    padding: 2rem;
                    border-radius: 8px;
                    max-width: 500px;
                    width: 90%;
                }
                .quadrant-buttons {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-top: 1.5rem;
                }
                .quadrant-buttons button:nth-child(1) {
                    background-color: #ffcdd2;
                    color: black;
                }
                .quadrant-buttons button:nth-child(2) {
                    background-color: #c8e6c9;
                    color: black;
                }
                .quadrant-buttons button:nth-child(3) {
                    background-color: #fff9c4;
                    color: black;
                }
                .quadrant-buttons button:nth-child(4) {
                    background-color: #e1f5fe;
                    color: black;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    function renderTasks() {
        // Clear all task lists
        q1TasksList.innerHTML = '';
        q2TasksList.innerHTML = '';
        q3TasksList.innerHTML = '';
        q4TasksList.innerHTML = '';
        
        // Render tasks for each quadrant
        renderQuadrantTasks('q1', q1TasksList);
        renderQuadrantTasks('q2', q2TasksList);
        renderQuadrantTasks('q3', q3TasksList);
        renderQuadrantTasks('q4', q4TasksList);
    }
    
    function renderQuadrantTasks(quadrant, listElement) {
        tasks[quadrant].forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.setAttribute('draggable', 'true');
            taskItem.setAttribute('data-id', task.id);
            taskItem.setAttribute('data-quadrant', quadrant);
            
            const taskText = document.createElement('div');
            taskText.className = 'task-text';
            taskText.textContent = task.text;
            if (task.completed) {
                taskText.style.textDecoration = 'line-through';
                taskText.style.opacity = '0.6';
            }
            
            const taskActions = document.createElement('div');
            taskActions.className = 'task-actions';
            
            const completeButton = document.createElement('button');
            completeButton.innerHTML = task.completed ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>';
            completeButton.title = task.completed ? 'Mark as incomplete' : 'Mark as complete';
            completeButton.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleTaskCompletion(quadrant, task.id);
            });
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'Delete task';
            deleteButton.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteTask(quadrant, task.id);
            });
            
            taskActions.appendChild(completeButton);
            taskActions.appendChild(deleteButton);
            
            taskItem.appendChild(taskText);
            taskItem.appendChild(taskActions);
            
            listElement.appendChild(taskItem);
        });
    }
    
    function toggleTaskCompletion(quadrant, taskId) {
        const taskIndex = tasks[quadrant].findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            tasks[quadrant][taskIndex].completed = !tasks[quadrant][taskIndex].completed;
            saveTasks();
            renderTasks();
        }
    }
    
    function deleteTask(quadrant, taskId) {
        tasks[quadrant] = tasks[quadrant].filter(task => task.id !== taskId);
        saveTasks();
        renderTasks();
    }
    
    function saveTasks() {
        localStorage.setItem('eisenhowerTasks', JSON.stringify(tasks));
    }
    
    function setupDragAndDrop() {
        // Add event listeners for drag and drop
        document.addEventListener('dragstart', function(e) {
            if (e.target.classList.contains('task-item')) {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    id: e.target.getAttribute('data-id'),
                    quadrant: e.target.getAttribute('data-quadrant')
                }));
                e.target.classList.add('dragging');
            }
        });
        
        document.addEventListener('dragend', function(e) {
            if (e.target.classList.contains('task-item')) {
                e.target.classList.remove('dragging');
            }
        });
        
        // Add drop zones to each quadrant
        for (const quadrantId in quadrants) {
            const quadrant = quadrants[quadrantId];
            
            quadrant.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.classList.add('drag-over');
            });
            
            quadrant.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            });
            
            quadrant.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const sourceQuadrant = data.quadrant;
                const taskId = parseInt(data.id);
                const targetQuadrant = this.id.replace('important-', 'q').replace('not-important-', 'q').replace('urgent', '1').replace('not-urgent', '2');
                
                // Only process if dropping into a different quadrant
                if (sourceQuadrant !== targetQuadrant) {
                    moveTask(sourceQuadrant, targetQuadrant, taskId);
                }
            });
        }
        
        // Add CSS for drag and drop
        if (!document.getElementById('drag-styles')) {
            const style = document.createElement('style');
            style.id = 'drag-styles';
            style.textContent = `
                .task-item.dragging {
                    opacity: 0.5;
                }
                .matrix-cell.drag-over {
                    background-color: rgba(0, 0, 0, 0.1);
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    function moveTask(sourceQuadrant, targetQuadrant, taskId) {
        // Find the task in the source quadrant
        const taskIndex = tasks[sourceQuadrant].findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;
        
        // Get the task and remove it from source
        const task = tasks[sourceQuadrant][taskIndex];
        tasks[sourceQuadrant].splice(taskIndex, 1);
        
        // Add to target quadrant
        tasks[targetQuadrant].push(task);
        
        // Save and render
        saveTasks();
        renderTasks();
    }
});
