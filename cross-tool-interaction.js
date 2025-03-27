// Cross-Tool Interaction
document.addEventListener('DOMContentLoaded', function() {
    // Central data store for sharing information between tools
    const toolsDataStore = {
        // Store active tasks from Task Manager
        tasks: [],
        // Store pomodoro sessions
        pomodoroSessions: [],
        // Store habits from Habit Tracker
        habits: [],
        // Store projects from Task Breakdown
        projects: []
    };
    
    // Load data from localStorage
    function loadDataFromStorage() {
        // Load tasks
        const savedTasks = localStorage.getItem('adhd-tasks');
        if (savedTasks) {
            toolsDataStore.tasks = JSON.parse(savedTasks);
        }
        
        // Load pomodoro sessions
        const savedSessions = localStorage.getItem('pomodoro-sessions');
        if (savedSessions) {
            toolsDataStore.pomodoroSessions = JSON.parse(savedSessions);
        }
        
        // Load habits
        const savedHabits = localStorage.getItem('adhd-habits');
        if (savedHabits) {
            toolsDataStore.habits = JSON.parse(savedHabits);
        }
        
        // Load projects
        const savedProjects = localStorage.getItem('adhd-projects');
        if (savedProjects) {
            toolsDataStore.projects = JSON.parse(savedProjects);
        }
    }
    
    // Save data to localStorage
    function saveDataToStorage() {
        localStorage.setItem('adhd-tasks', JSON.stringify(toolsDataStore.tasks));
        localStorage.setItem('pomodoro-sessions', JSON.stringify(toolsDataStore.pomodoroSessions));
        localStorage.setItem('adhd-habits', JSON.stringify(toolsDataStore.habits));
        localStorage.setItem('adhd-projects', JSON.stringify(toolsDataStore.projects));
    }
    
    // Initialize data store
    loadDataFromStorage();
    
    // Add task interaction buttons to Pomodoro Timer
    function addTaskInteractionToPomodoro() {
        const pomodoroContainer = document.querySelector('.pomodoro-container');
        if (!pomodoroContainer) return;
        
        const taskInteractionSection = document.createElement('div');
        taskInteractionSection.className = 'task-interaction-section';
        taskInteractionSection.innerHTML = `
            <h3>Current Task</h3>
            <div class="current-task-container">
                <select id="pomodoro-task-select">
                    <option value="">Select a task to work on...</option>
                </select>
                <div id="current-task-display">No task selected</div>
            </div>
            <div class="task-progress">
                <div class="progress-label">Task Progress:</div>
                <div class="progress-bar-container">
                    <div id="task-progress-bar" class="progress-bar" style="width: 0%"></div>
                </div>
                <div id="task-progress-percentage">0%</div>
            </div>
        `;
        
        // Insert after timer controls
        const timerControls = pomodoroContainer.querySelector('.timer-controls');
        if (timerControls) {
            timerControls.after(taskInteractionSection);
        } else {
            pomodoroContainer.appendChild(taskInteractionSection);
        }
        
        // Populate task select with tasks from Task Manager
        updatePomodoroTaskSelect();
        
        // Add event listener to task select
        const taskSelect = document.getElementById('pomodoro-task-select');
        if (taskSelect) {
            taskSelect.addEventListener('change', function() {
                const selectedTaskId = this.value;
                if (selectedTaskId) {
                    const task = toolsDataStore.tasks.find(t => t.id === selectedTaskId);
                    if (task) {
                        document.getElementById('current-task-display').textContent = task.text;
                        
                        // Update task with pomodoro session
                        task.pomodoroSessions = task.pomodoroSessions || [];
                        const currentSession = {
                            startTime: new Date().toISOString(),
                            duration: parseInt(document.getElementById('focus-duration').value) || 25
                        };
                        task.pomodoroSessions.push(currentSession);
                        
                        // Save updated tasks
                        saveDataToStorage();
                        
                        // Update progress
                        updateTaskProgress(task);
                    }
                } else {
                    document.getElementById('current-task-display').textContent = 'No task selected';
                    document.getElementById('task-progress-bar').style.width = '0%';
                    document.getElementById('task-progress-percentage').textContent = '0%';
                }
            });
        }
    }
    
    // Update Pomodoro task select with tasks from Task Manager
    function updatePomodoroTaskSelect() {
        const taskSelect = document.getElementById('pomodoro-task-select');
        if (!taskSelect) return;
        
        // Clear existing options except the first one
        while (taskSelect.options.length > 1) {
            taskSelect.remove(1);
        }
        
        // Add tasks as options
        toolsDataStore.tasks.forEach(task => {
            if (!task.completed) {
                const option = document.createElement('option');
                option.value = task.id;
                option.textContent = task.text;
                taskSelect.appendChild(option);
            }
        });
    }
    
    // Update task progress based on pomodoro sessions
    function updateTaskProgress(task) {
        if (!task || !task.pomodoroSessions) return;
        
        // Calculate total minutes spent on task
        const totalMinutes = task.pomodoroSessions.reduce((total, session) => {
            return total + (session.duration || 25);
        }, 0);
        
        // Estimate progress (assuming 4 pomodoro sessions = 100%)
        const progressPercent = Math.min(Math.round((totalMinutes / 100) * 100), 100);
        
        // Update progress bar
        const progressBar = document.getElementById('task-progress-bar');
        const progressPercentage = document.getElementById('task-progress-percentage');
        
        if (progressBar && progressPercentage) {
            progressBar.style.width = `${progressPercent}%`;
            progressPercentage.textContent = `${progressPercent}%`;
        }
    }
    
    // Add completed pomodoro sessions to Habit Tracker
    function addPomodoroToHabitTracker() {
        // Check if we're on the habit tracker page
        const habitTrackerContainer = document.querySelector('.habit-tracker-container');
        if (!habitTrackerContainer) return;
        
        // Add a "Pomodoro Sessions" habit if it doesn't exist
        let pomodoroHabit = toolsDataStore.habits.find(h => h.name === 'Complete Pomodoro Sessions');
        
        if (!pomodoroHabit) {
            pomodoroHabit = {
                id: 'pomodoro-habit-' + Date.now(),
                name: 'Complete Pomodoro Sessions',
                dates: {},
                createdAt: new Date().toISOString()
            };
            toolsDataStore.habits.push(pomodoroHabit);
            saveDataToStorage();
        }
        
        // Update habit with completed pomodoro sessions
        const today = new Date().toISOString().split('T')[0];
        
        // Count today's sessions
        const todaySessions = toolsDataStore.pomodoroSessions.filter(session => {
            const sessionDate = new Date(session.startTime).toISOString().split('T')[0];
            return sessionDate === today;
        });
        
        // Update habit for today
        if (todaySessions.length > 0) {
            pomodoroHabit.dates[today] = todaySessions.length;
            saveDataToStorage();
        }
    }
    
    // Add task completion to Rewards system
    function addTaskCompletionToRewards() {
        // Listen for task completion events
        document.addEventListener('taskCompleted', function(e) {
            const task = e.detail;
            
            // Add points to rewards system
            addRewardPoints(10, `Completed task: ${task.text}`);
            
            // Check if we should trigger a celebration
            const completedTasks = toolsDataStore.tasks.filter(t => t.completed).length;
            
            if (completedTasks % 5 === 0) {
                // Trigger celebration every 5 tasks
                triggerCelebration('milestone', `You've completed ${completedTasks} tasks!`);
            }
        });
    }
    
    // Add reward points
    function addRewardPoints(points, reason) {
        // Get current points
        let currentPoints = parseInt(localStorage.getItem('reward-points') || '0');
        
        // Add new points
        currentPoints += points;
        
        // Save updated points
        localStorage.setItem('reward-points', currentPoints.toString());
        
        // Log reward activity
        const rewardActivities = JSON.parse(localStorage.getItem('reward-activities') || '[]');
        rewardActivities.push({
            date: new Date().toISOString(),
            points: points,
            reason: reason,
            total: currentPoints
        });
        localStorage.setItem('reward-activities', JSON.stringify(rewardActivities));
        
        // Update rewards display if on rewards page
        updateRewardsDisplay();
    }
    
    // Update rewards display
    function updateRewardsDisplay() {
        const rewardsList = document.getElementById('rewards-list');
        if (!rewardsList) return;
        
        // Get reward activities
        const rewardActivities = JSON.parse(localStorage.getItem('reward-activities') || '[]');
        
        // Clear existing items
        rewardsList.innerHTML = '';
        
        // Add activities to list
        rewardActivities.slice(-10).reverse().forEach(activity => {
            const date = new Date(activity.date).toLocaleDateString();
            const li = document.createElement('li');
            li.className = 'reward-item';
            li.innerHTML = `
                <div class="reward-date">${date}</div>
                <div class="reward-reason">${activity.reason}</div>
                <div class="reward-points">+${activity.points} points</div>
            `;
            rewardsList.appendChild(li);
        });
        
        // Update total points display
        const totalPoints = localStorage.getItem('reward-points') || '0';
        const pointsDisplay = document.querySelector('.rewards-container .total-points');
        if (pointsDisplay) {
            pointsDisplay.textContent = totalPoints;
        } else {
            // Create points display if it doesn't exist
            const rewardsContainer = document.querySelector('.rewards-container');
            if (rewardsContainer) {
                const pointsDiv = document.createElement('div');
                pointsDiv.className = 'points-display';
                pointsDiv.innerHTML = `<h3>Total Points: <span class="total-points">${totalPoints}</span></h3>`;
                rewardsContainer.prepend(pointsDiv);
            }
        }
    }
    
    // Trigger celebration animation
    function triggerCelebration(type, message) {
        const celebrationContainer = document.getElementById('celebration-container');
        if (!celebrationContainer) return;
        
        // Create celebration element
        const celebration = document.createElement('div');
        celebration.className = `celebration ${type}`;
        
        if (type === 'confetti') {
            // Add confetti animation
            for (let i = 0; i < 100; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-piece';
                confetti.style.left = `${Math.random() * 100}%`;
                confetti.style.animationDelay = `${Math.random() * 3}s`;
                confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 80%, 60%)`;
                celebration.appendChild(confetti);
            }
        }
        
        // Add message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'celebration-message';
        messageDiv.textContent = message;
        celebration.appendChild(messageDiv);
        
        // Add to container
        celebrationContainer.appendChild(celebration);
        
        // Remove after animation
        setTimeout(() => {
            celebration.classList.add('fade-out');
            setTimeout(() => {
                celebration.remove();
            }, 1000);
        }, 5000);
    }
    
    // Add Eisenhower Matrix integration with Task Manager
    function integrateEisenhowerWithTaskManager() {
        // Listen for task addition in Eisenhower Matrix
        document.addEventListener('eisenhowerTaskAdded', function(e) {
            const task = e.detail;
            
            // Add task to Task Manager
            addTaskToTaskManager(task.text, getPriorityFromQuadrant(task.quadrant), 'eisenhower');
        });
        
        // Add button to send tasks from Task Manager to Eisenhower Matrix
        const taskManagerContainer = document.querySelector('.task-manager-container');
        if (taskManagerContainer) {
            const sendToEisenhowerBtn = document.createElement('button');
            sendToEisenhowerBtn.className = 'btn btn-secondary';
            sendToEisenhowerBtn.innerHTML = '<i class="fas fa-th-large"></i> Send to Eisenhower Matrix';
            sendToEisenhowerBtn.addEventListener('click', function() {
                // Get selected tasks
                const selectedTasks = document.querySelectorAll('.task-item.selected');
                if (selectedTasks.length === 0) {
                    alert('Please select at least one task to send to the Eisenhower Matrix');
                    return;
                }
                
                // Send each selected task to Eisenhower Matrix
                selectedTasks.forEach(taskElement => {
                    const taskText = taskElement.querySelector('.task-text').textContent;
                    const priority = taskElement.dataset.priority;
                    
                    // Determine quadrant based on priority
                    const quadrant = getQuadrantFromPriority(priority);
                    
                    // Add to Eisenhower Matrix
                    addTaskToEisenhowerMatrix(taskText, quadrant);
                });
                
                // Show confirmation
                alert(`Sent ${selectedTasks.length} task(s) to Eisenhower Matrix`);
            });
            
            // Add button to task manager controls
            const taskInputContainer = taskManagerContainer.querySelector('.task-input-container');
            if (taskInputContainer) {
                taskInputContainer.appendChild(sendToEisenhowerBtn);
            }
        }
    }
    
    // Get priority from Eisenhower quadrant
    function getPriorityFromQuadrant(quadrant) {
        switch (quadrant) {
            case 'q1': // Important & Urgent
                return 'high';
            case 'q2': // Important & Not Urgent
                return 'medium';
            case 'q3': // Not Important & Urgent
                return 'medium';
            case 'q4': // Not Important & Not Urgent
                return 'low';
            default:
                return 'medium';
        }
    }
    
    // Get Eisenhower quadrant from task priority
    function getQuadrantFromPriority(priority) {
        switch (priority) {
            case 'high':
                return 'q1'; // Important & Urgent
            case 'medium':
                return 'q2'; // Important & Not Urgent
            case 'low':
                return 'q4'; // Not Important & Not Urgent
            default:
                return 'q2';
        }
    }
    
    // Add task to Task Manager
    function addTaskToTaskManager(text, priority, category) {
        // Create task object
        const task = {
            id: 'task-' + Date.now(),
            text: text,
            priority: priority || 'medium',
            category: category || 'other',
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        // Add to data store
        toolsDataStore.tasks.push(task);
        saveDataToStorage();
        
        // Update task list if on Task Manager page
        updateTaskManagerList();
        
        // Update Pomodoro task select
        updatePomodoroTaskSelect();
        
        return task;
    }
    
    // Update Task Manager list
    function updateTaskManagerList() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        
        // Clear existing tasks
        taskList.innerHTML = '';
        
        // Add tasks to list
        toolsDataStore.tasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = 'task-item';
            taskItem.dataset.id = task.id;
            taskItem.dataset.priority = task.priority;
            taskItem.dataset.category = task.category;
            
            if (task.completed) {
                taskItem.classList.add('completed');
            }
            
            taskItem.innerHTML = `
                <div class="task-content">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <span class="task-text">${task.text}</span>
                    <span class="task-meta">
                        <span class="task-priority ${task.priority}">${task.priority}</span>
                        <span class="task-category">${task.category}</span>
                    </span>
                </div>
                <div class="task-actions">
                    <button class="task-edit"><i class="fas fa-edit"></i></button>
                    <button class="task-delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            // Add checkbox event listener
            const checkbox = taskItem.querySelector('.task-checkbox');
            checkbox.addEventListener('change', function() {
                task.completed = this.checked;
                if (this.checked) {
                    taskItem.classList.add('completed');
                    
                    // Dispatch task completed event
                    const event = new CustomEvent('taskCompleted', { detail: task });
                    document.dispatchEvent(event);
                } else {
                    taskItem.classList.remove('completed');
                }
                
                saveDataToStorage();
                updateTaskCounts();
            });
            
            // Add delete button event listener
            const deleteBtn = taskItem.querySelector('.task-delete');
            deleteBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to delete this task?')) {
                    // Remove from data store
                    const index = toolsDataStore.tasks.findIndex(t => t.id === task.id);
                    if (index !== -1) {
                        toolsDataStore.tasks.splice(index, 1);
                        saveDataToStorage();
                    }
                    
                    // Remove from DOM
                    taskItem.remove();
                    
                    // Update counts
                    updateTaskCounts();
                    
                    // Update Pomodoro task select
                    updatePomodoroTaskSelect();
                }
            });
            
            // Add edit button event listener
            const editBtn = taskItem.querySelector('.task-edit');
            editBtn.addEventListener('click', function() {
                const newText = prompt('Edit task:', task.text);
                if (newText !== null && newText.trim() !== '') {
                    task.text = newText.trim();
                    taskItem.querySelector('.task-text').textContent = newText.trim();
                    saveDataToStorage();
                    
                    // Update Pomodoro task select
                    updatePomodoroTaskSelect();
                }
            });
            
            // Add selection functionality
            taskItem.addEventListener('click', function(e) {
                // Don't toggle selection when clicking checkbox, buttons, etc.
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                    this.classList.toggle('selected');
                }
            });
            
            taskList.appendChild(taskItem);
        });
        
        // Update task counts
        updateTaskCounts();
    }
    
    // Update task counts in Task Manager
    function updateTaskCounts() {
        const totalTasks = document.getElementById('total-tasks');
        const completedTasks = document.getElementById('completed-tasks');
        const remainingTasks = document.getElementById('remaining-tasks');
        
        if (!totalTasks || !completedTasks || !remainingTasks) return;
        
        const total = toolsDataStore.tasks.length;
        const completed = toolsDataStore.tasks.filter(t => t.completed).length;
        const remaining = total - completed;
        
        totalTasks.textContent = total;
        completedTasks.textContent = completed;
        remainingTasks.textContent = remaining;
    }
    
    // Add task to Eisenhower Matrix
    function addTaskToEisenhowerMatrix(text, quadrant) {
        // Check if we're on the Eisenhower Matrix page
        const quadrantElement = document.getElementById(`${quadrant}-tasks`);
        if (!quadrantElement) return;
        
        // Create task element
        const taskElement = document.createElement('div');
        taskElement.className = 'matrix-task';
        taskElement.textContent = text;
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-task';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Delete this task?')) {
                taskElement.remove();
                saveEisenhowerTasks();
            }
        });
        
        // Add complete button
        const completeBtn = document.createElement('button');
        completeBtn.className = 'complete-task';
        completeBtn.innerHTML = '✓';
        completeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            taskElement.classList.toggle('completed');
            saveEisenhowerTasks();
            
            if (taskElement.classList.contains('completed')) {
                // Add to Task Manager as completed
                const task = addTaskToTaskManager(text, getPriorityFromQuadrant(quadrant), 'eisenhower');
                task.completed = true;
                saveDataToStorage();
                
                // Trigger task completed event
                const event = new CustomEvent('taskCompleted', { detail: task });
                document.dispatchEvent(event);
            }
        });
        
        taskElement.appendChild(deleteBtn);
        taskElement.appendChild(completeBtn);
        quadrantElement.appendChild(taskElement);
        
        // Save Eisenhower tasks
        saveEisenhowerTasks();
    }
    
    // Save Eisenhower Matrix tasks
    function saveEisenhowerTasks() {
        const quadrants = ['q1', 'q2', 'q3', 'q4'];
        const eisenhowerTasks = {};
        
        quadrants.forEach(quadrant => {
            const tasksElement = document.getElementById(`${quadrant}-tasks`);
            if (tasksElement) {
                eisenhowerTasks[quadrant] = [];
                
                const taskElements = tasksElement.querySelectorAll('.matrix-task');
                taskElements.forEach(taskElement => {
                    eisenhowerTasks[quadrant].push({
                        text: taskElement.textContent.replace('×✓', '').trim(),
                        completed: taskElement.classList.contains('completed')
                    });
                });
            }
        });
        
        localStorage.setItem('eisenhower-tasks', JSON.stringify(eisenhowerTasks));
    }
    
    // Integrate Task Breakdown with Task Manager
    function integrateTaskBreakdownWithTaskManager() {
        // Add button to send tasks from Task Manager to Task Breakdown
        const taskManagerContainer = document.querySelector('.task-manager-container');
        if (taskManagerContainer) {
            const sendToBreakdownBtn = document.createElement('button');
            sendToBreakdownBtn.className = 'btn btn-secondary';
            sendToBreakdownBtn.innerHTML = '<i class="fas fa-project-diagram"></i> Create Project';
            sendToBreakdownBtn.addEventListener('click', function() {
                // Get selected tasks
                const selectedTasks = document.querySelectorAll('.task-item.selected');
                if (selectedTasks.length === 0) {
                    alert('Please select at least one task to create a project');
                    return;
                }
                
                // Prompt for project name
                const projectName = prompt('Enter project name:');
                if (!projectName || projectName.trim() === '') return;
                
                // Create project
                const project = {
                    id: 'project-' + Date.now(),
                    name: projectName.trim(),
                    subtasks: [],
                    createdAt: new Date().toISOString()
                };
                
                // Add selected tasks as subtasks
                selectedTasks.forEach(taskElement => {
                    const taskText = taskElement.querySelector('.task-text').textContent;
                    project.subtasks.push({
                        id: 'subtask-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                        text: taskText,
                        completed: false
                    });
                });
                
                // Add to data store
                toolsDataStore.projects.push(project);
                saveDataToStorage();
                
                // Show confirmation
                alert(`Created project "${projectName}" with ${selectedTasks.length} subtask(s)`);
                
                // Update project list if on Task Breakdown page
                updateProjectList();
            });
            
            // Add button to task manager controls
            const taskInputContainer = taskManagerContainer.querySelector('.task-input-container');
            if (taskInputContainer) {
                taskInputContainer.appendChild(sendToBreakdownBtn);
            }
        }
        
        // Listen for project completion events
        document.addEventListener('projectCompleted', function(e) {
            const project = e.detail;
            
            // Add reward points
            addRewardPoints(50, `Completed project: ${project.name}`);
            
            // Trigger celebration
            triggerCelebration('confetti', `Project completed: ${project.name}`);
        });
    }
    
    // Update project list in Task Breakdown
    function updateProjectList() {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;
        
        // Clear existing projects
        projectList.innerHTML = '';
        
        // Add projects to list
        toolsDataStore.projects.forEach(project => {
            const projectItem = document.createElement('li');
            projectItem.className = 'project-item';
            projectItem.dataset.id = project.id;
            
            // Calculate completion percentage
            const totalSubtasks = project.subtasks.length;
            const completedSubtasks = project.subtasks.filter(st => st.completed).length;
            const completionPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
            
            projectItem.innerHTML = `
                <div class="project-name">${project.name}</div>
                <div class="project-meta">
                    <span class="project-progress">${completionPercent}%</span>
                    <button class="project-delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            // Add click event to show subtasks
            projectItem.addEventListener('click', function(e) {
                if (!e.target.closest('.project-delete')) {
                    showProjectSubtasks(project);
                }
            });
            
            // Add delete button event listener
            const deleteBtn = projectItem.querySelector('.project-delete');
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this project?')) {
                    // Remove from data store
                    const index = toolsDataStore.projects.findIndex(p => p.id === project.id);
                    if (index !== -1) {
                        toolsDataStore.projects.splice(index, 1);
                        saveDataToStorage();
                    }
                    
                    // Remove from DOM
                    projectItem.remove();
                }
            });
            
            projectList.appendChild(projectItem);
        });
    }
    
    // Show project subtasks in Task Breakdown
    function showProjectSubtasks(project) {
        const subtaskList = document.getElementById('subtask-list');
        const currentProjectTitle = document.getElementById('current-project-title');
        const subtaskInput = document.getElementById('subtask-input');
        const addSubtaskBtn = document.getElementById('add-subtask');
        
        if (!subtaskList || !currentProjectTitle || !subtaskInput || !addSubtaskBtn) return;
        
        // Update project title
        currentProjectTitle.textContent = project.name;
        currentProjectTitle.dataset.projectId = project.id;
        
        // Enable input and button
        subtaskInput.disabled = false;
        addSubtaskBtn.disabled = false;
        
        // Clear existing subtasks
        subtaskList.innerHTML = '';
        
        // Add subtasks to list
        project.subtasks.forEach(subtask => {
            const subtaskItem = document.createElement('li');
            subtaskItem.className = 'subtask-item';
            subtaskItem.dataset.id = subtask.id;
            
            if (subtask.completed) {
                subtaskItem.classList.add('completed');
            }
            
            subtaskItem.innerHTML = `
                <div class="subtask-content">
                    <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}>
                    <span class="subtask-text">${subtask.text}</span>
                </div>
                <div class="subtask-actions">
                    <button class="subtask-edit"><i class="fas fa-edit"></i></button>
                    <button class="subtask-delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            // Add checkbox event listener
            const checkbox = subtaskItem.querySelector('.subtask-checkbox');
            checkbox.addEventListener('change', function() {
                subtask.completed = this.checked;
                if (this.checked) {
                    subtaskItem.classList.add('completed');
                } else {
                    subtaskItem.classList.remove('completed');
                }
                
                saveDataToStorage();
                updateProjectProgress(project);
            });
            
            // Add delete button event listener
            const deleteBtn = subtaskItem.querySelector('.subtask-delete');
            deleteBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to delete this subtask?')) {
                    // Remove from project
                    const index = project.subtasks.findIndex(st => st.id === subtask.id);
                    if (index !== -1) {
                        project.subtasks.splice(index, 1);
                        saveDataToStorage();
                    }
                    
                    // Remove from DOM
                    subtaskItem.remove();
                    
                    // Update progress
                    updateProjectProgress(project);
                }
            });
            
            // Add edit button event listener
            const editBtn = subtaskItem.querySelector('.subtask-edit');
            editBtn.addEventListener('click', function() {
                const newText = prompt('Edit subtask:', subtask.text);
                if (newText !== null && newText.trim() !== '') {
                    subtask.text = newText.trim();
                    subtaskItem.querySelector('.subtask-text').textContent = newText.trim();
                    saveDataToStorage();
                }
            });
            
            subtaskList.appendChild(subtaskItem);
        });
        
        // Add event listener to add subtask button
        addSubtaskBtn.onclick = function() {
            const subtaskText = subtaskInput.value.trim();
            if (subtaskText === '') return;
            
            // Create new subtask
            const subtask = {
                id: 'subtask-' + Date.now(),
                text: subtaskText,
                completed: false
            };
            
            // Add to project
            project.subtasks.push(subtask);
            saveDataToStorage();
            
            // Add to DOM
            const subtaskItem = document.createElement('li');
            subtaskItem.className = 'subtask-item';
            subtaskItem.dataset.id = subtask.id;
            
            subtaskItem.innerHTML = `
                <div class="subtask-content">
                    <input type="checkbox" class="subtask-checkbox">
                    <span class="subtask-text">${subtask.text}</span>
                </div>
                <div class="subtask-actions">
                    <button class="subtask-edit"><i class="fas fa-edit"></i></button>
                    <button class="subtask-delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            // Add checkbox event listener
            const checkbox = subtaskItem.querySelector('.subtask-checkbox');
            checkbox.addEventListener('change', function() {
                subtask.completed = this.checked;
                if (this.checked) {
                    subtaskItem.classList.add('completed');
                } else {
                    subtaskItem.classList.remove('completed');
                }
                
                saveDataToStorage();
                updateProjectProgress(project);
            });
            
            // Add delete button event listener
            const deleteBtn = subtaskItem.querySelector('.subtask-delete');
            deleteBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to delete this subtask?')) {
                    // Remove from project
                    const index = project.subtasks.findIndex(st => st.id === subtask.id);
                    if (index !== -1) {
                        project.subtasks.splice(index, 1);
                        saveDataToStorage();
                    }
                    
                    // Remove from DOM
                    subtaskItem.remove();
                    
                    // Update progress
                    updateProjectProgress(project);
                }
            });
            
            // Add edit button event listener
            const editBtn = subtaskItem.querySelector('.subtask-edit');
            editBtn.addEventListener('click', function() {
                const newText = prompt('Edit subtask:', subtask.text);
                if (newText !== null && newText.trim() !== '') {
                    subtask.text = newText.trim();
                    subtaskItem.querySelector('.subtask-text').textContent = newText.trim();
                    saveDataToStorage();
                }
            });
            
            subtaskList.appendChild(subtaskItem);
            
            // Clear input
            subtaskInput.value = '';
            
            // Update progress
            updateProjectProgress(project);
        };
        
        // Update progress
        updateProjectProgress(project);
    }
    
    // Update project progress
    function updateProjectProgress(project) {
        const progressBar = document.getElementById('progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (!progressBar || !progressPercentage) return;
        
        // Calculate completion percentage
        const totalSubtasks = project.subtasks.length;
        const completedSubtasks = project.subtasks.filter(st => st.completed).length;
        const completionPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
        
        // Update progress bar
        progressBar.style.width = `${completionPercent}%`;
        progressPercentage.textContent = `${completionPercent}%`;
        
        // Check if project is completed
        if (completionPercent === 100 && totalSubtasks > 0) {
            // Dispatch project completed event
            const event = new CustomEvent('projectCompleted', { detail: project });
            document.dispatchEvent(event);
        }
        
        // Update project list
        updateProjectList();
    }
    
    // Initialize cross-tool interactions
    function initCrossToolInteractions() {
        // Add task interaction to Pomodoro Timer
        addTaskInteractionToPomodoro();
        
        // Add Pomodoro sessions to Habit Tracker
        addPomodoroToHabitTracker();
        
        // Add task completion to Rewards system
        addTaskCompletionToRewards();
        
        // Integrate Eisenhower Matrix with Task Manager
        integrateEisenhowerWithTaskManager();
        
        // Integrate Task Breakdown with Task Manager
        integrateTaskBreakdownWithTaskManager();
        
        // Initialize data in relevant tools
        document.addEventListener('toolLoaded', function(e) {
            const toolId = e.detail.toolId;
            
            switch (toolId) {
                case 'tasks':
                    updateTaskManagerList();
                    break;
                case 'breakdown':
                    updateProjectList();
                    break;
                case 'rewards':
                    updateRewardsDisplay();
                    break;
                case 'pomodoro':
                    updatePomodoroTaskSelect();
                    break;
            }
        });
    }
    
    // Initialize when DOM is loaded
    initCrossToolInteractions();
});
