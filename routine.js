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

    // const taskNameInput = document.getElementById('task-name'); // Removed
    // const taskDurationInput = document.getElementById('task-duration'); // Removed
    // const taskBreakInput = document.getElementById('task-break-duration'); // Removed
    // const taskNameInput = document.getElementById('task-name'); // Removed
    // const taskDurationInput = document.getElementById('task-duration'); // Removed
    // const taskBreakInput = document.getElementById('task-break-duration'); // Removed
    const addTaskToRoutineBtn = document.getElementById('add-task-to-routine-btn'); // Defined to prevent ReferenceError

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

    // --- TIME CALCULATION HELPER ---
    function calculateTaskTimes(routine) {
        let currentTime = new Date();
        if (routine.startTime) {
            const [hours, minutes] = routine.startTime.split(':').map(Number);
            currentTime.setHours(hours, minutes, 0, 0);
        } else {
            // If no start time, use 00:00 as base for relative time
            currentTime.setHours(0, 0, 0, 0);
        }

        return routine.tasks.map(task => {
            const startTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            currentTime.setMinutes(currentTime.getMinutes() + task.duration);
            const endTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${startTime} - ${endTime}`;
        });
    }

    // --- DISPLAY FUNCTIONS ---
    function displaySelectedRoutineDetails() {
        const routine = getRoutineById(selectedRoutineId);

        // Update header info
        if (routine) {
            if (currentRoutineNameDisplay) currentRoutineNameDisplay.textContent = routine.name;
            if (manageTotalDurationDisplay) manageTotalDurationDisplay.textContent = routine.totalDuration || 0;
            if (playerRoutineNameDisplay) playerRoutineNameDisplay.textContent = routine.name;

            // Update Player List (Read-only)
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
            if (manageTotalDurationDisplay) manageTotalDurationDisplay.textContent = '0';
            if (playerRoutineNameDisplay) playerRoutineNameDisplay.textContent = 'No routine selected/active';
            if (playerRoutineTasksList) playerRoutineTasksList.innerHTML = '';
            if (expectedFinishTimeDisplay) expectedFinishTimeDisplay.textContent = '-';
            if (currentRoutineTasksList) currentRoutineTasksList.innerHTML = '';
            return;
        }

        // Render Editor Table
        if (currentRoutineTasksList) {
            currentRoutineTasksList.innerHTML = '';
            const taskTimes = calculateTaskTimes(routine);

            // Render Insert Zone at the very top
            currentRoutineTasksList.appendChild(renderInsertZone(0));

            routine.tasks.forEach((task, index) => {
                const row = document.createElement('div');
                row.className = 'routine-row';
                row.dataset.taskId = task.id;
                row.dataset.index = index;

                // Drag & Drop Attributes
                row.draggable = true;
                row.addEventListener('dragstart', handleDragStart);
                row.addEventListener('dragover', handleDragOver);
                row.addEventListener('drop', handleDrop);
                row.addEventListener('dragend', handleDragEnd);

                // 1. Grip Column
                const gripCol = document.createElement('div');
                gripCol.className = 'col-grip';
                gripCol.innerHTML = '<i class="fas fa-grip-vertical"></i>'; // FontAwesome grip icon
                row.appendChild(gripCol);

                // 2. Time Column
                const timeCol = document.createElement('div');
                timeCol.className = 'col-time';
                timeCol.textContent = taskTimes[index];
                row.appendChild(timeCol);

                // 3. Name Column (Input)
                const nameCol = document.createElement('div');
                nameCol.className = 'col-name';
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.value = task.name;
                nameInput.addEventListener('change', (e) => {
                    task.name = e.target.value;
                    saveRoutines();
                });
                nameCol.appendChild(nameInput);
                row.appendChild(nameCol);

                // 4. Duration Column (Smart Controls)
                const durationCol = document.createElement('div');
                durationCol.className = 'col-duration';
                const durationControl = document.createElement('div');
                durationControl.className = 'duration-control';

                const minusBtn = document.createElement('button');
                minusBtn.className = 'duration-btn';
                minusBtn.textContent = '-';
                minusBtn.tabIndex = -1;
                minusBtn.addEventListener('click', () => updateTaskDuration(task, -5));

                const durationInput = document.createElement('input');
                durationInput.type = 'number';
                durationInput.value = task.duration;
                durationInput.min = 1;
                durationInput.addEventListener('change', (e) => {
                    let val = parseInt(e.target.value, 10);
                    if (val < 1) val = 1;
                    updateTaskDuration(task, val - task.duration); // Pass difference
                });

                const plusBtn = document.createElement('button');
                plusBtn.className = 'duration-btn';
                plusBtn.textContent = '+';
                plusBtn.tabIndex = -1;
                plusBtn.addEventListener('click', () => updateTaskDuration(task, 5));

                durationControl.appendChild(minusBtn);
                durationControl.appendChild(durationInput);
                durationControl.appendChild(plusBtn);
                durationCol.appendChild(durationControl);
                row.appendChild(durationCol);

                // 5. Actions Column
                const actionsCol = document.createElement('div');
                actionsCol.className = 'col-actions';
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.title = 'Delete task';
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`Delete "${task.name}"?`)) {
                        deleteTaskFromRoutine(task.id);
                    }
                });
                actionsCol.appendChild(deleteBtn);
                row.appendChild(actionsCol);

                currentRoutineTasksList.appendChild(row);

                // Render Insert Zone after each task
                currentRoutineTasksList.appendChild(renderInsertZone(index + 1));
            });
        }
    }

    function renderInsertZone(index) {
        const zone = document.createElement('div');
        zone.className = 'routine-insert-zone';
        zone.title = 'Click to add task here';
        zone.addEventListener('click', () => {
            // Replace zone with new task input row
            const newRow = document.createElement('div');
            newRow.className = 'routine-new-task-row';

            newRow.innerHTML = `
                <div class="col-grip"></div>
                <div class="col-time">New</div>
                <div class="col-name"><input type="text" placeholder="Task Name" id="new-task-name-${index}"></div>
                <div class="col-duration"><input type="number" value="5" min="1" id="new-task-duration-${index}"></div>
                <div class="col-actions">
                    <button id="save-new-task-${index}" class="btn btn-primary btn-sm">Add</button>
                    <button id="cancel-new-task-${index}" class="btn btn-secondary btn-sm">X</button>
                </div>
            `;

            zone.replaceWith(newRow);

            const nameInput = newRow.querySelector(`#new-task-name-${index}`);
            const durationInput = newRow.querySelector(`#new-task-duration-${index}`);
            const saveBtn = newRow.querySelector(`#save-new-task-${index}`);
            const cancelBtn = newRow.querySelector(`#cancel-new-task-${index}`);

            nameInput.focus();

            const saveHandler = () => {
                const name = nameInput.value.trim();
                const duration = parseInt(durationInput.value, 10);
                if (name && duration > 0) {
                    addTaskAt(index, name, duration);
                }
            };

            saveBtn.addEventListener('click', saveHandler);
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveHandler();
            });
            durationInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveHandler();
            });

            cancelBtn.addEventListener('click', () => {
                displaySelectedRoutineDetails(); // Re-render to restore zones
            });
        });
        return zone;
    }

    function addTaskAt(index, name, duration) {
        const routine = getRoutineById(selectedRoutineId);
        if (!routine) return;

        const newTask = {
            id: generateId(),
            name: name,
            duration: duration
        };

        routine.tasks.splice(index, 0, newTask);
        recalculateTotalDuration(routine);
        saveRoutines();
        displaySelectedRoutineDetails();
    }

    function updateTaskDuration(task, change) {
        let newDuration = task.duration + change;
        if (newDuration < 1) newDuration = 1;
        task.duration = newDuration;

        const routine = getRoutineById(selectedRoutineId);
        recalculateTotalDuration(routine);
        saveRoutines();
        displaySelectedRoutineDetails();
    }

    function recalculateTotalDuration(routine) {
        routine.totalDuration = routine.tasks.reduce((sum, t) => sum + (parseInt(t.duration, 10) || 0), 0);
    }

    // --- DRAG & DROP HANDLERS ---
    let draggedItemIndex = null;

    function handleDragStart(e) {
        draggedItemIndex = parseInt(this.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDrop(e) {
        e.stopPropagation();
        const targetIndex = parseInt(this.dataset.index, 10);
        if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
            const routine = getRoutineById(selectedRoutineId);
            const movedTask = routine.tasks.splice(draggedItemIndex, 1)[0];
            routine.tasks.splice(targetIndex, 0, movedTask);
            saveRoutines();
            displaySelectedRoutineDetails();
        }
        return false;
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        draggedItemIndex = null;
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

    function deleteRoutineHandler() {
        if (!selectedRoutineId) {
            alert("Please select a routine to delete.");
            return;
        }

        const routine = getRoutineById(selectedRoutineId);
        if (!routine) return;

        if (confirm(`Are you sure you want to delete the routine "${routine.name}"? This cannot be undone.`)) {
            const index = routines.findIndex(r => r.id === selectedRoutineId);
            if (index > -1) {
                routines.splice(index, 1);
                saveRoutines();

                // Select another routine if available
                if (routines.length > 0) {
                    selectedRoutineId = routines[Math.max(0, index - 1)].id;
                } else {
                    selectedRoutineId = null;
                }

                updateRoutineSelectDropdown();
                displaySelectedRoutineDetails();
                alert(`Routine "${routine.name}" deleted.`);
            }
        }
    }

    // addTaskToRoutineHandler removed as it is replaced by inline insertion logic


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
    // --- INITIALIZATION ---
    // (Moved to end of file)


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

        // Switch to player view if not already
        updateRoutineView(true);

        activateRoutine(selectedRoutineId);
    }

    // --- PIE CHART FUNCTION ---


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
        routineSelect.disabled = true;
        createRoutineBtn.disabled = true;
        if (addTaskToRoutineBtn) addTaskToRoutineBtn.disabled = true;
        setStartTimeBtn.disabled = true;
        setStartTimeBtn.disabled = true;
        startSelectedRoutineBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Routine Active';
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

        // Enter focus mode
        enterFocusMode();

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
            if (addTaskToRoutineBtn) addTaskToRoutineBtn.disabled = false;
            setStartTimeBtn.disabled = false;
            startSelectedRoutineBtn.innerHTML = '<i class="fas fa-play"></i> Start Selected Routine';
            startSelectedRoutineBtn.disabled = false;

            if (activeRoutineDisplay) activeRoutineDisplay.style.display = '';
            if (routineControls) routineControls.style.display = '';
            displaySelectedRoutineDetails();
            activeRoutine = null;
            currentTaskTimer = null;
            drawPieChart(0, false);
            if (currentTaskDisplay) currentTaskDisplay.style.display = 'none';
            if (pieChartContainer) pieChartContainer.style.display = 'none';

            // Exit focus mode
            if (typeof exitFocusMode === 'function') {
                exitFocusMode();
            }

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

            // Update focus mode timer
            if (typeof updateFocusTimer === 'function') {
                updateFocusTimer();
            }

            if (activeTaskTimeLeftSeconds < 0) {
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
    // --- CSV IMPORT/EXPORT ---
    function exportRoutineToCSV() {
        const routine = getRoutineById(selectedRoutineId);
        if (!routine) {
            alert('Please select a routine to export.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        // Format: Task Name, Duration
        routine.tasks.forEach(task => {
            const name = task.name.replace(/"/g, '""'); // Escape quotes
            const row = `"${name}",${task.duration}`;
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${routine.name}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function importRoutineFromCSV(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            const rows = text.split(/[\r\n]+/).filter(row => row.trim() !== '');

            const tasks = [];
            let totalDuration = 0;

            rows.forEach(row => {
                // Regex to match CSV fields: "..." or non-comma
                const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
                let match;
                const columns = [];
                while ((match = regex.exec(row))) {
                    let val = match[1];
                    if (val.length && val.charAt(0) === '"') {
                        val = val.slice(1, -1).replace(/""/g, '"');
                    }
                    columns.push(val);
                }

                // Expecting: Name, Duration
                if (columns.length >= 2) {
                    // Clean up regex artifacts if needed, but the loop handles it.
                    // Actually, let's use a simpler robust split for the specific format requested.
                    // If the user edits in Excel, it might be standard CSV.

                    let name = columns[0].trim();
                    let duration = parseInt(columns[1], 10);

                    // Fallback for simple comma split if regex failed or for simple lines
                    if (!name && row.indexOf(',') > -1) {
                        const parts = row.split(',');
                        name = parts[0].trim();
                        duration = parseInt(parts[1], 10);
                    }

                    if (name && !isNaN(duration)) {
                        tasks.push({
                            id: generateId(),
                            name: name,
                            duration: duration
                        });
                        totalDuration += duration;
                    }
                }
            });

            if (tasks.length === 0) {
                alert('No valid tasks found in CSV. Format should be: Task Name, Duration (minutes)');
                return;
            }

            const routineName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

            const newRoutine = {
                id: generateId(),
                name: routineName,
                startTime: null,
                tasks: tasks,
                totalDuration: totalDuration
            };

            routines.push(newRoutine);
            saveRoutines();
            updateRoutineSelectDropdown();

            // Select the new routine
            selectedRoutineId = newRoutine.id;
            routineSelect.value = newRoutine.id;
            displaySelectedRoutineDetails();

            alert(`Routine "${routineName}" imported successfully!`);
        };
        reader.readAsText(file);
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
        // addTaskToRoutineBtn.addEventListener('click', addTaskToRoutineHandler); // Removed
        setStartTimeBtn.addEventListener('click', setRoutineStartTimeHandler);
        startSelectedRoutineBtn.addEventListener('click', startSelectedRoutineHandler);

        const deleteRoutineBtn = document.getElementById('delete-routine-btn');
        if (deleteRoutineBtn) {
            deleteRoutineBtn.addEventListener('click', deleteRoutineHandler);
        }

        // Import/Export Listeners
        const importBtn = document.getElementById('import-routine-btn');
        const exportBtn = document.getElementById('export-routine-btn');
        const fileInput = document.getElementById('routine-file-input');

        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    importRoutineFromCSV(e.target.files[0]);
                    fileInput.value = ''; // Reset
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', exportRoutineToCSV);
        }

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
        if (window.EventBus) {
            window.EventBus.addEventListener('ef-receiveTaskFor-Routine', handleReceivedTaskForRoutine);
        }

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
    createRoutineHandler = function (nameFromPrompt) {
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
    // window.addTaskToRoutineHandler = addTaskToRoutineHandler; // Removed
    window.activateRoutine = activateRoutine;
    window.manualAdvanceTask = manualAdvanceTask;
    window.editTaskInRoutine = editTaskInRoutine;
    window.deleteTaskFromRoutine = deleteTaskFromRoutine;

    // --- FOCUS MODE FUNCTIONS ---
    const focusModeEl = document.getElementById('routine-focus-mode');
    const exitFocusBtn = document.getElementById('exit-routine-focus');
    const focusRoutineName = document.getElementById('focus-routine-name');
    const focusTaskNumber = document.getElementById('focus-task-number');
    const focusFinishTime = document.getElementById('focus-finish-time');
    const focusCurrentTaskName = document.getElementById('focus-current-task-name');
    const focusTimeRemaining = document.getElementById('focus-time-remaining');
    const focusTimerCircle = document.getElementById('focus-timer-circle');
    const focusProgressBar = document.getElementById('routine-focus-progress');
    const focusUpcomingTasks = document.getElementById('focus-upcoming-tasks');
    const focusCompleteBtn = document.getElementById('focus-complete-task-btn');
    const focusSkipBtn = document.getElementById('focus-skip-task-btn');

    function enterFocusMode() {
        if (!focusModeEl) return;
        focusModeEl.classList.remove('hidden');
        updateFocusUI();
    }

    function exitFocusMode() {
        if (!focusModeEl) return;
        focusModeEl.classList.add('hidden');
    }

    function updateFocusUI() {
        if (!activeRoutine) return;

        // Update routine name
        if (focusRoutineName) {
            focusRoutineName.textContent = activeRoutine.name;
        }

        // Update task number
        if (focusTaskNumber) {
            focusTaskNumber.textContent = `Task ${currentTaskIndex + 1} of ${activeRoutine.tasks.length}`;
        }

        // Update finish time
        const remainingTasks = activeRoutine.tasks.slice(currentTaskIndex);
        const totalRemainingMinutes = remainingTasks.reduce((s, t) => s + t.duration, 0);
        const finishTime = new Date(Date.now() + totalRemainingMinutes * 60000);
        if (focusFinishTime) {
            focusFinishTime.textContent = `Finish by ${finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }

        // Update progress bar
        const completedTasks = currentTaskIndex;
        const totalTasks = activeRoutine.tasks.length;
        const progressPercent = (completedTasks / totalTasks) * 100;
        if (focusProgressBar) {
            focusProgressBar.style.width = `${progressPercent}%`;
        }

        // Update current task
        const currentTask = activeRoutine.tasks[currentTaskIndex];
        if (currentTask && focusCurrentTaskName) {
            focusCurrentTaskName.textContent = currentTask.name;
        }

        // Update upcoming tasks
        if (focusUpcomingTasks) {
            focusUpcomingTasks.innerHTML = '';
            const upcoming = activeRoutine.tasks.slice(currentTaskIndex + 1);
            upcoming.forEach(task => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${task.name}</span>
                    <span class="task-duration">${task.duration} min</span>
                `;
                focusUpcomingTasks.appendChild(li);
            });
        }
    }

    function updateFocusTimer() {
        if (!focusTimeRemaining || !focusTimerCircle) return;

        const minutes = Math.floor(activeTaskTimeLeftSeconds / 60);
        const seconds = activeTaskTimeLeftSeconds % 60;
        focusTimeRemaining.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

        // Update circle timer
        if (activeRoutine && currentTaskIndex < activeRoutine.tasks.length) {
            const currentTask = activeRoutine.tasks[currentTaskIndex];
            const totalSeconds = currentTask.duration * 60;
            const circumference = 2 * Math.PI * 90; // radius is 90
            const progress = Math.max(0, activeTaskTimeLeftSeconds / totalSeconds);
            const offset = circumference * (1 - progress);
            focusTimerCircle.style.strokeDashoffset = offset;
        }
    }

    // Event listeners for focus mode
    if (exitFocusBtn) {
        exitFocusBtn.addEventListener('click', exitFocusMode);
    }

    if (focusCompleteBtn) {
        focusCompleteBtn.addEventListener('click', () => {
            manualAdvanceTask();
        });
    }

    if (focusSkipBtn) {
        focusSkipBtn.addEventListener('click', () => {
            manualAdvanceTask();
        });
    }

    // Add keyboard support (spacebar to complete task)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && activeRoutine && !focusModeEl.classList.contains('hidden')) {
            e.preventDefault();
            manualAdvanceTask();
        }
        if (e.code === 'Escape' && activeRoutine && !focusModeEl.classList.contains('hidden')) {
            exitFocusMode();
        }
    });

    // Modify startNextTask to update focus UI
    const originalStartNextTask = startNextTask;
    startNextTask = function () {
        originalStartNextTask();
        if (activeRoutine && !focusModeEl.classList.contains('hidden')) {
            updateFocusUI();
        }
    };

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

    // Expose functions for testing
    window.initializeRoutines = loadRoutines; // loadRoutines is the initialization function
    window.createRoutineHandler = createRoutineHandler;
    window.addTaskAt = addTaskAt;
    window.activateRoutine = activateRoutine;
    window.manualAdvanceTask = manualAdvanceTask;
    window.editTaskInRoutine = editTaskInRoutine;
    window.deleteTaskFromRoutine = deleteTaskFromRoutine;

});
