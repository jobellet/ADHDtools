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
    const addTaskToRoutineBtn = document.getElementById('add-task-to-routine-btn');

    const routineStartTimeInput = document.getElementById('routine-start-time');
    const setStartTimeBtn = document.getElementById('set-start-time-btn');

    const currentRoutineNameDisplay = document.getElementById('current-routine-name');
    const currentRoutineTasksList = document.getElementById('current-routine-tasks');
    const expectedFinishTimeDisplay = document.getElementById('expected-finish-time');

    const startSelectedRoutineBtn = document.getElementById('start-selected-routine-btn');
    const currentTaskNameDisplay = document.getElementById('current-task-name');
    const currentTaskTimeLeftDisplay = document.getElementById('current-task-time-left');
    
    const routinePieChartCanvas = document.getElementById('routine-pie-chart');
    let pieChart; // To be initialized later with Chart.js or a custom implementation

    // Data Storage
    const ROUTINE_STORAGE_KEY = 'adhd-tool-routines';
    let routines = []; // Array to hold routine objects
    let selectedRoutineId = null; // ID of the currently selected routine in the dropdown
    let activeRoutine = null; // The routine object that is currently running
    let currentTaskIndex = -1; // Index of the current task in the active routine
    let currentTaskTimer = null; // Stores the setInterval ID for the current task
    let activeTaskTimeLeftSeconds = 0; // Stores the actual time left for the currently running task for manualAdvance logic
    let autoStartCheckTimer = null; // Stores the setInterval ID for checking auto-start times

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
                if (!Array.isArray(routines)) routines = []; // Ensure it's an array
            } catch (e) {
                console.error("Error parsing routines from localStorage:", e);
                routines = [];
            }
        } else {
            routines = [];
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
            currentRoutineNameDisplay.textContent = routine.name;
            currentRoutineTasksList.innerHTML = ''; // Clear previous tasks
            routine.tasks.forEach(task => {
                const li = document.createElement('li');
                li.textContent = `${task.name} (${task.duration} min)`;
                li.dataset.taskId = task.id; // Store task ID for potential future use
                currentRoutineTasksList.appendChild(li);
            });
            expectedFinishTimeDisplay.textContent = `Total duration: ${routine.totalDuration || 0} min`;
        } else {
            currentRoutineNameDisplay.textContent = 'No routine selected';
            currentRoutineTasksList.innerHTML = '';
            expectedFinishTimeDisplay.textContent = 'Total duration: -';
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

        const newTask = {
            id: generateId(),
            name: taskName,
            duration: duration
        };

        routine.tasks.push(newTask);
        
        // Recalculate totalDuration
        routine.totalDuration = routine.tasks.reduce((sum, task) => sum + task.duration, 0);
        
        saveRoutines();
        displaySelectedRoutineDetails(); // Refresh display

        taskNameInput.value = '';
        taskDurationInput.value = '';
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
        
        currentRoutineNameDisplay.textContent = `Active: ${activeRoutine.name}`;
        
        const now = new Date();
        const finishTime = new Date(now.getTime() + activeRoutine.totalDuration * 60000); 
        expectedFinishTimeDisplay.textContent = `Expected Finish: ${finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        
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
            
            displaySelectedRoutineDetails(); 
            activeRoutine = null; 
            currentTaskTimer = null; 
            drawPieChart(0, false); 
            return;
        }

        const currentTask = activeRoutine.tasks[currentTaskIndex];
        console.log("Starting task:", currentTask.name, "Duration:", currentTask.duration, "min");
        
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
        if (currentTaskTimer) {
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }
        currentTaskIndex++;
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
            // Check if focus is on an input field, if so, don't trigger spacebar advance
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }
            if (event.code === 'Space' && activeRoutine) { // Allow advance even if timer isn't "running" (e.g. task finished, waiting)
                event.preventDefault(); 
                manualAdvanceTask();
            }
        });
        
        console.log("Routine Tool Initialized with task timer, spacebar control, and input focus check.");
    }
    
    // Call initialization
    initializeRoutines();

});
