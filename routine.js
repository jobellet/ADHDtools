document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if the routine section is present
    const routineSection = document.getElementById('routine');
    if (!routineSection) {
        return;
    }

    console.log("Routine Tool script loaded.");

    // DOM Elements
    const routineNameInput = document.getElementById('routine-name');
    const createRoutineBtn = document.getElementById('create-routine-btn');
    const routineSelect = document.getElementById('routine-select');

    const taskNameInput = document.getElementById('task-name');
    const taskDurationInput = document.getElementById('task-duration');
    const taskBreakInput = document.getElementById('task-break-duration');
    const addTaskToRoutineBtn = document.getElementById('add-task-to-routine-btn');

    const routineStartTimeInput = document.getElementById('routine-start-time');
    const setStartTimeBtn = document.getElementById('set-start-time-btn');

    const currentRoutineNameDisplay = document.getElementById('current-routine-name');
    const currentRoutineTasksList = document.getElementById('current-routine-tasks');
    const manageTotalDurationDisplay = document.getElementById('manage-total-duration');

    const playerRoutineNameDisplay = document.getElementById('player-current-routine-name');
    const playerRoutineTasksList = document.getElementById('player-routine-tasks');
    const expectedFinishTimeDisplay = document.getElementById('expected-finish-time');

    const startSelectedRoutineBtn = document.getElementById('start-selected-routine-btn');
    const currentTaskNameDisplay = document.getElementById('current-task-name');
    const currentTaskTimeLeftDisplay = document.getElementById('current-task-time-left');

    const activeRoutineDisplay = document.getElementById('active-routine-display');
    const routineControls = document.querySelector('.routine-controls');
    const currentTaskDisplay = document.getElementById('current-task-display');
    const pieChartContainer = document.querySelector('.pie-chart-container');
    const routinePieChartCanvas = document.getElementById('routine-pie-chart');
    if (currentTaskDisplay) currentTaskDisplay.style.display = 'none';
    if (pieChartContainer) pieChartContainer.style.display = 'none';
    let pieChart; // To be initialized later with Chart.js or a custom implementation

    // View Switching Elements
    const routineShowPlayerBtn = document.getElementById('routine-show-player-btn');
    const routineShowSetupBtn = document.getElementById('routine-show-setup-btn');
    const routinePlayerSection = document.querySelector('.routine-player'); // Assuming this is the correct selector
    const routineSetupSection = document.querySelector('.routine-setup'); // Assuming this is the correct selector

    const essential = [
        routineNameInput,
        createRoutineBtn,
        routineSelect,
        taskNameInput,
        taskDurationInput,
        addTaskToRoutineBtn,
        routineStartTimeInput,
        setStartTimeBtn,
        startSelectedRoutineBtn
    ];
    if (essential.some(el => !el)) {
        console.warn('Routine tool elements missing; skipping initialization');
        return;
    }

    // Data Storage
    const ROUTINE_STORAGE_KEY = 'adhd-tool-routines';
    let routines = []; // Array to hold routine objects
    let selectedRoutineId = null; // ID of the currently selected routine in the dropdown
    let activeRoutine = null; // The routine object that is currently running
    let currentTaskIndex = -1; // Index of the current task in the active routine
    let currentTaskTimer = null; // Stores the setInterval ID for the current task
    let activeTaskTimeLeftSeconds = 0; // Stores the actual time left for the currently running task for manualAdvance logic
    let autoStartCheckTimer = null; // Stores the setInterval ID for checking auto-start times
    const autoStartedToday = {}; // Tracks routines that have auto-started today

    // --- NOTIFICATION & AUTO-START HELPERS ---
    function requestNotificationPermission() {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function notify(message) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification(message);
                return;
            } catch (err) {
                console.warn('Notification error:', err);
            }
        }
        if (typeof alert === 'function') {
            alert(message);
        } else {
            console.log(message);
        }
    }

    function scheduleAutoStartCheck() {
        if (autoStartCheckTimer) {
            clearInterval(autoStartCheckTimer);
        }
        autoStartCheckTimer = setInterval(() => {
            const now = new Date();
            const hhmm = now.toTimeString().slice(0, 5);
            const today = now.toISOString().split('T')[0];

            routines.forEach(routine => {
                if (
                    routine.startTime === hhmm &&
                    autoStartedToday[routine.id] !== today &&
                    !activeRoutine
                ) {
                    autoStartedToday[routine.id] = today;
                    notify(`Starting routine: ${routine.name}`);
                    activateRoutine(routine.id);
                }
            });
        }, 1000);
    }

    // --- PIE CHART FUNCTION ---
    function drawPieChart(percentage, isLate) {
        if (!routinePieChartCanvas) return; 
        const ctx = routinePieChartCanvas.getContext('2d');
        const centerX = routinePieChartCanvas.width / 2;
        const centerY = routinePieChartCanvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10; 

        ctx.clearRect(0, 0, routinePieChartCanvas.width, routinePieChartCanvas.height);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#e0e0e0'; 
        ctx.fill();
        
        let displayPercentage = percentage;

        if (isLate) { 
            displayPercentage = 1; 
        } else if (percentage <= 0) { 
            return;
        }

        if (displayPercentage > 0) {
            const startAngle = -0.5 * Math.PI; 
            const endAngle = startAngle + (displayPercentage * 2 * Math.PI);
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = isLate ? '#ff4d4d' : '#4CAF50'; 
            ctx.fill();
        }
    }

    // --- DATA STRUCTURES ---
    // Routine Object: { id: string, name: string, tasks: Array, startTime: string (HH:MM), totalDuration: number (minutes) }
    // Task Object: { id: string, name: string, duration: number (minutes) } // Note: 'completed' field removed as per new instructions

    // --- UTILITY FUNCTIONS ---
    function generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : 'routine-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    function updateRoutineSelectDropdown() {
        const previouslySelected = selectedRoutineId;
        routineSelect.innerHTML = '<option value="">-- Select a Routine --</option>';
        routines.forEach(routine => {
            const option = document.createElement('option');
            option.value = routine.id;
            option.textContent = routine.name;
            routineSelect.appendChild(option);
        });

        if (previouslySelected && routines.find(r => r.id === previouslySelected)) {
            routineSelect.value = previouslySelected;
        } else {
            // This will be handled by loadRoutines or the change listener
            // If no routine is selected after load, it will stay on "-- Select a Routine --"
            // or be set to the first routine by loadRoutines.
             if (routineSelect.options.length > 1 && !previouslySelected) {
                // This case is mostly for when routines array is populated and no specific ID was pre-selected
             } else if (routines.length === 0) {
                 routineSelect.value = "";
             }
        }
    }

    function getRoutineById(id) {
        return routines.find(routine => routine.id === id);
    }

    // --- CORE DATA FUNCTIONS ---
    function saveRoutines() {
        localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(routines));
    }

    function loadRoutines() {
        const storedRoutines = localStorage.getItem(ROUTINE_STORAGE_KEY);
        if (storedRoutines) {
            try {
                routines = JSON.parse(storedRoutines);
                if (!Array.isArray(routines)) routines = [];
            } catch (e) {
                console.error("Error parsing routines from localStorage:", e);
                routines = [];
            }
        } else {
            routines = [];
            if (!(typeof window !== 'undefined' && window.__SKIP_DEFAULT_ROUTINES__)) {
                const defaultRoutine = {
                    id: generateId(),
                    name: 'Morning Routine',
                    startTime: null,
                    tasks: [
                        { id: generateId(), name: 'Wake Up', duration: 5 },
                        { id: generateId(), name: 'Brush Teeth', duration: 3 },
                        { id: generateId(), name: 'Breakfast', duration: 15 }
                    ],
                    totalDuration: 0
                };
                defaultRoutine.totalDuration = defaultRoutine.tasks.reduce((s, t) => s + t.duration, 0);
                routines.push(defaultRoutine);
                saveRoutines();
            }
        }

        routines.forEach(routine => {
            if (!routine.id) {
                routine.id = generateId();
            }
            routine.totalDuration = 0; // Initialize or reset
            if (!Array.isArray(routine.tasks)) routine.tasks = []; // Ensure tasks is an array
            
            routine.tasks.forEach(task => {
                if (!task.id) {
                    task.id = generateId();
                }
                // Ensure duration is a number
                task.duration = parseInt(task.duration, 10) || 0;
                routine.totalDuration += task.duration;
                 // Remove 'completed' field if it exists from older structures
                delete task.completed;
            });
        });
        
        updateRoutineSelectDropdown();

        if (routines.length > 0) {
            // If selectedRoutineId is not valid or not set, select the first routine
            if (!selectedRoutineId || !getRoutineById(selectedRoutineId)) {
                 selectedRoutineId = routines[0].id;
            }
            routineSelect.value = selectedRoutineId; // Update dropdown selection
        } else {
            selectedRoutineId = null;
            routineSelect.value = ""; // Ensure "-- Select a Routine --" is selected
        }
        displaySelectedRoutineDetails(); // Display details for the loaded/selected routine
    }

    // --- DISPLAY FUNCTIONS ---
    function displaySelectedRoutineDetails() {
        const routine = getRoutineById(selectedRoutineId);
        if (routine) {
            if (currentRoutineNameDisplay) currentRoutineNameDisplay.textContent = routine.name;
            if (currentRoutineTasksList) {
                currentRoutineTasksList.innerHTML = '';
                routine.tasks.forEach((task, index) => {
                    const li = document.createElement('li');
                    li.dataset.taskId = task.id;
                    li.draggable = true;
                    li.tabIndex = 0;
                    li.addEventListener('dragstart', e => {
                        e.dataTransfer.setData('text/plain', index);
                    });
                    li.addEventListener('dragover', e => e.preventDefault());
                    li.addEventListener('drop', e => {
                        e.preventDefault();
                        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                        const to = index;
                        if (isNaN(from) || from === to) return;
                        const moved = routine.tasks.splice(from, 1)[0];
                        routine.tasks.splice(to, 0, moved);
                        saveRoutines();
                        displaySelectedRoutineDetails();
                        setTimeout(() => {
                            if (currentRoutineTasksList.children[to]) {
                                currentRoutineTasksList.children[to].focus();
                            }
                        }, 0);
                    });
                    li.addEventListener('keydown', e => {
                        if (e.key === 'ArrowUp' && index > 0) {
                            const moved = routine.tasks.splice(index, 1)[0];
                            routine.tasks.splice(index - 1, 0, moved);
                            saveRoutines();
                            displaySelectedRoutineDetails();
                        } else if (e.key === 'ArrowDown' && index < routine.tasks.length - 1) {
                            const moved = routine.tasks.splice(index, 1)[0];
                            routine.tasks.splice(index + 1, 0, moved);
                            saveRoutines();
                            displaySelectedRoutineDetails();
                        }
                    });

                    const taskText = document.createElement('span');
                    taskText.textContent = `${task.name} (${task.duration} min)`;
                    li.appendChild(taskText);

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'routine-task-actions';

                    const upBtn = document.createElement('button');
                    upBtn.textContent = '↑';
                    upBtn.title = 'Move task up';
                    upBtn.addEventListener('click', () => {
                        if (index > 0) {
                            const moved = routine.tasks.splice(index, 1)[0];
                            routine.tasks.splice(index - 1, 0, moved);
                            saveRoutines();
                            displaySelectedRoutineDetails();
                        }
                    });

                    const downBtn = document.createElement('button');
                    downBtn.textContent = '↓';
                    downBtn.title = 'Move task down';
                    downBtn.addEventListener('click', () => {
                        if (index < routine.tasks.length - 1) {
                            const moved = routine.tasks.splice(index, 1)[0];
                            routine.tasks.splice(index + 1, 0, moved);
                            saveRoutines();
                            displaySelectedRoutineDetails();
                        }
                    });

                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Edit';
                    editBtn.title = 'Edit task';
                    editBtn.className = 'edit-routine-task-btn';
                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        showEditTaskUI(li, task);
                    });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.title = 'Delete task';
                    deleteBtn.className = 'delete-routine-task-btn';
                    deleteBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (confirm(`Are you sure you want to delete task: "${task.name}"?`)) {
                            deleteTaskFromRoutine(task.id);
                        }
                    });

                    actionsDiv.appendChild(upBtn);
                    actionsDiv.appendChild(downBtn);
                    actionsDiv.appendChild(editBtn);
                    actionsDiv.appendChild(deleteBtn);
                    li.appendChild(actionsDiv);

                    currentRoutineTasksList.appendChild(li);
                });
            }

            if (manageTotalDurationDisplay) {
                manageTotalDurationDisplay.textContent = routine.totalDuration || 0;
            }

            if (playerRoutineNameDisplay) playerRoutineNameDisplay.textContent = routine.name;
            if (playerRoutineTasksList) {
                playerRoutineTasksList.innerHTML = '';
                routine.tasks.forEach(task => {
                    const li = document.createElement('li');
                    li.textContent = `${task.name} (${task.duration} min)`;
                    playerRoutineTasksList.appendChild(li);
                });
            }
            if (expectedFinishTimeDisplay) expectedFinishTimeDisplay.textContent = '-';
        } else {
            if (currentRoutineNameDisplay) currentRoutineNameDisplay.textContent = 'No routine selected';
            if (currentRoutineTasksList) currentRoutineTasksList.innerHTML = '';
            if (manageTotalDurationDisplay) manageTotalDurationDisplay.textContent = '0';
            if (playerRoutineNameDisplay) playerRoutineNameDisplay.textContent = 'No routine selected/active';
            if (playerRoutineTasksList) playerRoutineTasksList.innerHTML = '';
            if (expectedFinishTimeDisplay) expectedFinishTimeDisplay.textContent = '-';
        }
    }

    // --- EVENT HANDLERS ---
    function createRoutineHandler() {
        const routineName = routineNameInput.value.trim();
        if (!routineName) {
            alert("Please enter a routine name.");
            return;
        }

        const newRoutine = {
            id: generateId(),
            name: routineName,
            tasks: [],
            startTime: null,
            totalDuration: 0
        };

        routines.push(newRoutine);
        saveRoutines();

        selectedRoutineId = newRoutine.id; // Select the new routine
        updateRoutineSelectDropdown(); // Updates dropdown and sets routineSelect.value
        displaySelectedRoutineDetails(); // Display its details

        routineNameInput.value = ''; // Clear input
    }

    function addTaskToRoutineHandler() {
        const taskName = taskNameInput.value.trim();
        const taskDuration = taskDurationInput.value;
        const breakDuration = taskBreakInput.value;

        if (!selectedRoutineId) {
            alert("Please select a routine first.");
            return;
        }

        const routine = getRoutineById(selectedRoutineId);
        if (!routine) {
            alert("Selected routine not found. Please try reloading.");
            return;
        }

        if (!taskName) {
            alert("Please enter a task name.");
            return;
        }

        const duration = parseInt(taskDuration, 10);
        if (isNaN(duration) || duration <= 0) {
            alert("Please enter a valid positive number for task duration.");
            return;
        }

        const breakDur = parseInt(breakDuration, 10);
        if (breakDuration && (isNaN(breakDur) || breakDur < 0)) {
            alert("Please enter a valid number for break duration (0 or more).");
            return;
        }

        const newTask = {
            id: generateId(),
            name: taskName,
            duration: duration
        };

        routine.tasks.push(newTask);
        if (breakDur && breakDur > 0) {
            routine.tasks.push({ id: generateId(), name: 'Break', duration: breakDur });
        }
        
        // Recalculate totalDuration
        routine.totalDuration = routine.tasks.reduce((sum, task) => sum + task.duration, 0);
        
        saveRoutines();
        displaySelectedRoutineDetails(); // Refresh display

        taskNameInput.value = '';
        taskDurationInput.value = '';
        taskBreakInput.value = '';
    }


    // --- CORE DATA FUNCTIONS (Continued) ---
    function deleteTaskFromRoutine(taskId) {
        if (!selectedRoutineId) {
            console.error("No routine selected to delete task from.");
            return;
        }
        const routine = getRoutineById(selectedRoutineId);
        if (!routine) {
            console.error("Routine not found for task deletion.");
            return;
        }

        const taskIndex = routine.tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) {
            console.error("Task not found for deletion:", taskId);
            return;
        }

        routine.tasks.splice(taskIndex, 1); // Remove the task

        // Recalculate totalDuration
        routine.totalDuration = routine.tasks.reduce((sum, task) => sum + (parseInt(task.duration, 10) || 0), 0);

        saveRoutines();
        displaySelectedRoutineDetails(); // Refresh display
    }

    // --- CORE DATA FUNCTIONS (Continued) ---
    function editTaskInRoutine(taskId, newName, newDuration) {
        if (!selectedRoutineId) {
            console.error("No routine selected to edit task in.");
            alert("Error: No routine selected.");
            return;
        }
        const routine = getRoutineById(selectedRoutineId);
        if (!routine) {
            console.error("Routine not found for task edit.");
            alert("Error: Selected routine not found.");
            return;
        }

        const task = routine.tasks.find(t => t.id === taskId);
        if (!task) {
            console.error("Task not found for edit:", taskId);
            alert("Error: Task to edit not found.");
            return;
        }

        const trimmedName = newName.trim();
        if (!trimmedName) {
            alert("Task name cannot be empty.");
            return; 
        }

        const duration = parseInt(newDuration, 10);
        if (isNaN(duration) || duration <= 0) {
            alert("Please enter a valid positive number for task duration.");
            return;
        }

        task.name = trimmedName;
        task.duration = duration;

        // Recalculate totalDuration
        routine.totalDuration = routine.tasks.reduce((sum, t) => sum + (parseInt(t.duration, 10) || 0), 0);

        saveRoutines();
        displaySelectedRoutineDetails(); // Refresh display
    }

    // --- UI FOR EDITING TASK ---
    function showEditTaskUI(listItem, task) {
        // Clear current content
        listItem.innerHTML = ''; 

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = task.name;
        nameInput.className = 'edit-routine-task-name-input';

        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.value = task.duration;
        durationInput.min = '1';
        durationInput.className = 'edit-routine-task-duration-input';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-routine-task-btn';
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const newName = nameInput.value.trim();
            const newDuration = parseInt(durationInput.value, 10);
            editTaskInRoutine(task.id, newName, newDuration);
            // displaySelectedRoutineDetails() called by editTaskInRoutine will restore view
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'cancel-edit-routine-task-btn';
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            displaySelectedRoutineDetails(); // Restore original display
        });

        listItem.appendChild(nameInput);
        listItem.appendChild(durationInput);
        listItem.appendChild(saveBtn);
        listItem.appendChild(cancelBtn);
    }

    // --- INITIALIZATION ---
    function initializeRoutines() {
        loadRoutines(); // Load routines and display the first one or empty state

        routineSelect.addEventListener('change', () => {
            selectedRoutineId = routineSelect.value;
            displaySelectedRoutineDetails();
            // When selection changes, also update the start time input if the new routine has one
            const selected = getRoutineById(selectedRoutineId);
            if (selected && selected.startTime) {
                routineStartTimeInput.value = selected.startTime;
            } else {
                routineStartTimeInput.value = '';
            }
        });

        createRoutineBtn.addEventListener('click', createRoutineHandler);
        addTaskToRoutineBtn.addEventListener('click', addTaskToRoutineHandler);
        setStartTimeBtn.addEventListener('click', setRoutineStartTimeHandler);
        startSelectedRoutineBtn.addEventListener('click', startSelectedRoutineHandler);
        
        console.log("Routine Tool Initialized with core event handlers and start/activate logic.");
    }

    // --- EVENT HANDLERS (Continued) ---
    function setRoutineStartTimeHandler() {
        const timeValue = routineStartTimeInput.value; // Can be empty string
        if (!selectedRoutineId) {
            alert("Please select a routine first.");
            return;
        }
        const routine = getRoutineById(selectedRoutineId);
        if (!routine) {
            alert("Selected routine not found. Please try reloading.");
            return;
        }

        if (timeValue) {
            routine.startTime = timeValue;
            alert(`Auto-start time set to ${timeValue} for routine "${routine.name}".`);
        } else {
            routine.startTime = null;
            alert(`Auto-start time cleared for routine "${routine.name}".`);
        }
        saveRoutines();
        // Re-schedule auto start checks whenever the time is updated
        scheduleAutoStartCheck();
        // No direct display update needed here other than the alert,
        // but if we had a dedicated place for start time display, it would be updated.
    }

    function startSelectedRoutineHandler() {
        if (!selectedRoutineId) {
            alert("Please select a routine to start.");
            return;
        }
        const routine = getRoutineById(selectedRoutineId);
        if (!routine) {
            alert("Selected routine not found. Please try reloading.");
            return;
        }
        if (!routine.tasks || routine.tasks.length === 0) {
            alert("Cannot start an empty routine. Add some tasks first.");
            return;
        }
        activateRoutine(selectedRoutineId);
    }

    // --- PIE CHART FUNCTION ---
    function drawPieChart(percentage, isLate) {
        const ctx = routinePieChartCanvas.getContext('2d');
        const centerX = routinePieChartCanvas.width / 2;
        const centerY = routinePieChartCanvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10; // 10px padding

        // Clear Canvas
        ctx.clearRect(0, 0, routinePieChartCanvas.width, routinePieChartCanvas.height);

        // Draw Background Circle (Time Total)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#e0e0e0'; // Light grey
        ctx.fill();

        // Draw Foreground Arc (Time Remaining)
        if (percentage > 0) { // Only draw if there's time remaining or it's late (percentage could be > 0 if late)
            const startAngle = -0.5 * Math.PI; // Start at the top
            // If late, percentage might become negative from calculation, cap at 0 for visual if not desired to go reverse
            // However, the prompt logic is percentageRemaining = Math.max(0, timeLeft / original)
            // So percentage will be 0 if timeLeft is negative.
            // To make it red when late (timeLeft < 0), the percentage for drawing should still be >0, or we draw full red circle.
            // The current prompt implies `percentageRemaining` is used for the arc size.
            // If timeLeftForTask < 0, percentageRemaining will be 0.
            // Let's adjust so if it's late, we draw a full red circle, otherwise draw the percentage.
            
            let displayPercentage = percentage;
            if (isLate && percentage <= 0) { 
                // If truly late (time ran out and is negative) and percentage is 0, draw full red circle
                displayPercentage = 1; 
            } else if (percentage <= 0 && !isLate) {
                // Task completed on time, do not draw foreground.
                return;
            }


            const endAngle = startAngle + (displayPercentage * 2 * Math.PI);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = isLate ? '#ff4d4d' : '#4CAF50'; // Red if late, Green if on time
            ctx.fill();
        }
    }


    // --- ROUTINE EXECUTION LOGIC ---
    function activateRoutine(routineId) {
        activeRoutine = getRoutineById(routineId);
        if (!activeRoutine) {
            console.error("Failed to activate routine: ID not found", routineId);
            alert("Error: Could not find the routine to activate.");
            return;
        }

        if (currentTaskTimer) { 
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }
        activeTaskTimeLeftSeconds = 0; // Reset for new routine
        currentTaskIndex = 0;
        console.log("Activating routine:", activeRoutine.name);

        routineSelect.disabled = true;
        createRoutineBtn.disabled = true;
        addTaskToRoutineBtn.disabled = true;
        setStartTimeBtn.disabled = true;
        startSelectedRoutineBtn.textContent = "Routine Active";
        startSelectedRoutineBtn.disabled = true;
        startSelectedRoutineBtn.blur();
        if (activeRoutineDisplay) activeRoutineDisplay.style.display = 'none';
        if (routineControls) routineControls.style.display = 'none';

        currentRoutineNameDisplay.textContent = `Active: ${activeRoutine.name}`;

        const now = new Date();
        const finishTime = new Date(now.getTime() + activeRoutine.totalDuration * 60000);
        expectedFinishTimeDisplay.textContent = finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (currentTaskDisplay) currentTaskDisplay.style.display = '';
        if (pieChartContainer) pieChartContainer.style.display = '';
        drawPieChart(1, false);
        startNextTask();
    }

    function startNextTask() {
        if (currentTaskTimer) {
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }
        activeTaskTimeLeftSeconds = 0; // Reset for next task or completion

        if (!activeRoutine || currentTaskIndex < 0 || currentTaskIndex >= activeRoutine.tasks.length) {
            console.log("Routine completed.");
            currentTaskNameDisplay.textContent = "Routine Finished!";
            currentTaskTimeLeftDisplay.textContent = "-";
            
            routineSelect.disabled = false;
            createRoutineBtn.disabled = false;
            addTaskToRoutineBtn.disabled = false;
            setStartTimeBtn.disabled = false;
            startSelectedRoutineBtn.textContent = "Start Selected Routine";
            startSelectedRoutineBtn.disabled = false;

            if (activeRoutineDisplay) activeRoutineDisplay.style.display = '';
            if (routineControls) routineControls.style.display = '';
            displaySelectedRoutineDetails();
            activeRoutine = null;
            currentTaskTimer = null;
            drawPieChart(0, false);
            if (currentTaskDisplay) currentTaskDisplay.style.display = 'none';
            if (pieChartContainer) pieChartContainer.style.display = 'none';
            notify("Routine finished!");
            return;
        }

        const currentTask = activeRoutine.tasks[currentTaskIndex];
        console.log("Starting task:", currentTask.name, "Duration:", currentTask.duration, "min");

        const remainingTasks = activeRoutine.tasks.slice(currentTaskIndex);
        const totalRemainingMinutes = remainingTasks.reduce((s, t) => s + t.duration, 0);
        const finishTime = new Date(Date.now() + totalRemainingMinutes * 60000);
        expectedFinishTimeDisplay.textContent = finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        currentTaskNameDisplay.textContent = currentTask.name;
        activeTaskTimeLeftSeconds = currentTask.duration * 60;
        const originalTaskDurationSeconds = currentTask.duration * 60;
        
        drawPieChart(1, false); 
        currentTaskTimeLeftDisplay.textContent = `${Math.floor(activeTaskTimeLeftSeconds / 60)}:${String(activeTaskTimeLeftSeconds % 60).padStart(2, '0')}`;

        currentTaskTimer = setInterval(() => {
            activeTaskTimeLeftSeconds--;
            currentTaskTimeLeftDisplay.textContent = `${Math.floor(activeTaskTimeLeftSeconds / 60)}:${String(activeTaskTimeLeftSeconds % 60).padStart(2, '0')}`;
            
            const percentageRemaining = Math.max(0, activeTaskTimeLeftSeconds / originalTaskDurationSeconds);
            const isTaskLate = activeTaskTimeLeftSeconds < 0; 
            drawPieChart(percentageRemaining, isTaskLate);

            if (activeTaskTimeLeftSeconds < 0 && originalTaskDurationSeconds <= 0) { 
                 clearInterval(currentTaskTimer);
                 currentTaskTimer = null;
                 currentTaskIndex++;
                 startNextTask();
                 return; 
            }

            if (activeTaskTimeLeftSeconds <= 0 && !isTaskLate) {
                clearInterval(currentTaskTimer);
                currentTaskTimer = null;
                notify(`Task "${currentTask.name}" finished`);
                currentTaskIndex++;
                startNextTask();
            }
        }, 1000);
    }

    function manualAdvanceTask() {
         if (!activeRoutine) { 
            return;
        }
      
        if (!currentTaskTimer && activeTaskTimeLeftSeconds > 0) { 
            // Timer isn't running (e.g. error/paused), but the task wasn't finished or late
            return;
        }

        console.log("Manually advancing task.");
        const finishedTask = activeRoutine.tasks[currentTaskIndex];
        if (currentTaskTimer) {
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }
        currentTaskIndex++;
        notify(`Task "${finishedTask.name}" finished`);
        startNextTask();
    }
    
    // --- INITIALIZATION (adjusting the previous one) ---
    function initializeRoutines() {
        loadRoutines(); 

        routineSelect.addEventListener('change', () => {
            selectedRoutineId = routineSelect.value;
            displaySelectedRoutineDetails();
            const selected = getRoutineById(selectedRoutineId);
            if (selected && selected.startTime) {
                routineStartTimeInput.value = selected.startTime;
            } else {
                routineStartTimeInput.value = '';
            }
        });

        createRoutineBtn.addEventListener('click', createRoutineHandler);
        addTaskToRoutineBtn.addEventListener('click', addTaskToRoutineHandler);
        setStartTimeBtn.addEventListener('click', setRoutineStartTimeHandler);
        startSelectedRoutineBtn.addEventListener('click', startSelectedRoutineHandler);

        document.addEventListener('keydown', (event) => {
            if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                return;
            }
            if ((event.code === 'Space' || event.key === ' ') && activeRoutine) {
                event.preventDefault();
                event.stopPropagation();
                manualAdvanceTask();
            }
        });

        if (routinePieChartCanvas) {
            const tapHandler = (e) => {
                if (activeRoutine) {
                    e.preventDefault();
                    manualAdvanceTask();
                }
            };
            routinePieChartCanvas.addEventListener('click', tapHandler);
            routinePieChartCanvas.addEventListener('touchstart', tapHandler);
        }
        
        console.log("Routine Tool Initialized with task timer, spacebar/tap control, and input focus check.");

        // --- Task Receiving Logic ---
        window.EventBus.addEventListener('ef-receiveTaskFor-Routine', handleReceivedTaskForRoutine);

        requestNotificationPermission();
        scheduleAutoStartCheck();
    }

    function handleReceivedTaskForRoutine(event) {
        const standardizedTask = event.detail;
        if (!standardizedTask || !standardizedTask.text) {
            console.warn("Routine tool received invalid task:", standardizedTask);
            return;
        }

        let targetRoutineId = selectedRoutineId;

        if (!targetRoutineId && routines.length > 0) {
            const routineIdPrompt = prompt(`Enter ID of routine to add task to (or leave blank for current/first, or type 'NEW' to create one):\nAvailable IDs: ${routines.map(r => `${r.id} (${r.name})`).join(', ')}`, routines[0]?.id || '');
            if (routineIdPrompt === null) { // User cancelled
                alert("Task addition cancelled.");
                return;
            }
            if (routineIdPrompt.toUpperCase() === 'NEW') {
                 const newRoutineName = prompt("Enter name for the new routine:");
                 if (newRoutineName) {
                    createRoutineHandler(newRoutineName); // Assuming createRoutineHandler can take a name and sets selectedRoutineId
                    targetRoutineId = selectedRoutineId; // createRoutineHandler should set this
                 } else {
                    alert("New routine creation cancelled. Task not added.");
                    return;
                 }
            } else if (routineIdPrompt.trim() !== '') {
                targetRoutineId = routineIdPrompt.trim();
            } else if (routines.length > 0) {
                targetRoutineId = selectedRoutineId || routines[0].id; // Default to current or first if blank
            }
        } else if (routines.length === 0) {
            const newRoutineName = prompt("No routines available. Enter name to create a new routine for this task, or cancel:");
            if (newRoutineName) {
                createRoutineHandler(newRoutineName);
                targetRoutineId = selectedRoutineId;
            } else {
                alert("No routines available and new routine not created. Please create a routine first. Task not added.");
                return;
            }
        }
        
        if (!targetRoutineId) {
             alert("No target routine selected or created. Task not added.");
             return;
        }

        const targetRoutine = getRoutineById(targetRoutineId);
        if (!targetRoutine) {
            alert(`Routine with ID '${targetRoutineId}' not found. Task not added.`);
            return;
        }
        
        // If a different routine was selected via prompt, update the main selection
        if (selectedRoutineId !== targetRoutineId) {
            selectedRoutineId = targetRoutineId;
            routineSelect.value = targetRoutineId; 
            // Update start time input if the new routine has one
            if (targetRoutine.startTime) {
                routineStartTimeInput.value = targetRoutine.startTime;
            } else {
                routineStartTimeInput.value = '';
            }
        }


        const durationString = prompt(`Enter duration (in minutes) for task '${standardizedTask.text}' in routine '${targetRoutine.name}':`, standardizedTask.duration || '10');
        if (durationString === null) { // User cancelled prompt
            alert("Duration entry cancelled. Task not added.");
            return;
        }
        const duration = parseInt(durationString, 10);

        if (isNaN(duration) || duration <= 0) {
            alert("Invalid duration. Task not added.");
            return;
        }

        const newRoutineTask = {
            id: window.CrossTool.generateId(), // Use CrossTool's generator
            name: standardizedTask.text,
            duration: duration
        };

        targetRoutine.tasks.push(newRoutineTask);
        targetRoutine.totalDuration = targetRoutine.tasks.reduce((sum, task) => sum + (parseInt(task.duration, 10) || 0), 0);

        saveRoutines();
        displaySelectedRoutineDetails(); // Refresh display
        alert(`Task '${standardizedTask.text}' added to routine '${targetRoutine.name}'.`);
    }
    
    // Modify createRoutineHandler to optionally take a name and not clear input if name is passed
    // This is an adjustment to make the 'NEW' routine flow smoother
    const originalCreateRoutineHandler = createRoutineHandler;
    createRoutineHandler = function(nameFromPrompt) {
        const routineName = typeof nameFromPrompt === 'string' ? nameFromPrompt : routineNameInput.value.trim();
        if (!routineName) {
            alert("Please enter a routine name.");
            return;
        }

        const newRoutine = {
            id: generateId(), // Use local generateId or CrossTool.generateId
            name: routineName,
            tasks: [],
            startTime: null,
            totalDuration: 0
        };

        routines.push(newRoutine);
        saveRoutines();

        selectedRoutineId = newRoutine.id; 
        updateRoutineSelectDropdown(); 
        displaySelectedRoutineDetails(); 

        if (typeof nameFromPrompt !== 'string') { // Only clear if not programmatically called
            routineNameInput.value = ''; 
        }
    };

    // --- VIEW SWITCHING LOGIC ---
    function updateRoutineView(showPlayer) {
        if (!routinePlayerSection || !routineSetupSection || !routineShowPlayerBtn || !routineShowSetupBtn) {
            console.warn("Routine view switching elements not found.");
            return;
        }

        if (showPlayer) {
            routinePlayerSection.classList.remove('routine-section-hidden');
            routineSetupSection.classList.add('routine-section-hidden');

            routineShowPlayerBtn.classList.add('active', 'btn-primary');
            routineShowPlayerBtn.classList.remove('btn-secondary');
            routineShowPlayerBtn.setAttribute('aria-pressed', 'true');

            routineShowSetupBtn.classList.remove('active', 'btn-primary');
            routineShowSetupBtn.classList.add('btn-secondary');
            routineShowSetupBtn.setAttribute('aria-pressed', 'false');
        } else { // Show Setup
            routineSetupSection.classList.remove('routine-section-hidden');
            routinePlayerSection.classList.add('routine-section-hidden');

            routineShowSetupBtn.classList.add('active', 'btn-primary');
            routineShowSetupBtn.classList.remove('btn-secondary');
            routineShowSetupBtn.setAttribute('aria-pressed', 'true');

            routineShowPlayerBtn.classList.remove('active', 'btn-primary');
            routineShowPlayerBtn.classList.add('btn-secondary');
            routineShowPlayerBtn.setAttribute('aria-pressed', 'false');
        }
    }
    
    window.initializeRoutines = initializeRoutines;
    window.createRoutineHandler = createRoutineHandler;
    window.addTaskToRoutineHandler = addTaskToRoutineHandler;
    window.activateRoutine = activateRoutine;
    window.manualAdvanceTask = manualAdvanceTask;
    window.editTaskInRoutine = editTaskInRoutine;
    window.deleteTaskFromRoutine = deleteTaskFromRoutine;

    if (routineShowPlayerBtn && routineShowSetupBtn) {
        routineShowPlayerBtn.addEventListener('click', () => updateRoutineView(true));
        routineShowSetupBtn.addEventListener('click', () => updateRoutineView(false));
    } else {
        console.warn("Routine view toggle buttons not found, view switching may not work.");
    }

    // Initial view setup (ensure player is visible by default if no other logic dictates it)
    // This is mostly redundant if HTML is set up correctly with routine-section-hidden on setup.
    // updateRoutineView(true); // Could call this, but HTML default should be fine.

    // Call initialization
    initializeRoutines();

});
