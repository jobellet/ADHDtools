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
    const calendarConflictDisplay = document.getElementById('routine-calendar-conflicts');

    const startSelectedRoutineBtn = document.getElementById('start-selected-routine-btn');
    const currentTaskNameDisplay = document.getElementById('current-task-name');
    const currentTaskTimeLeftDisplay = document.getElementById('current-task-time-left');

    const activeRoutineDisplay = document.getElementById('active-routine-display');
    const routineControls = document.querySelector('.routine-controls');
    const currentTaskDisplay = document.getElementById('current-task-display');
    const pieChartContainer = document.querySelector('.pie-chart-container');
    const routinePieChartCanvas = document.getElementById('routine-pie-chart');
    const routineAutoRunCheckbox = document.getElementById('routine-auto-run');
    const routineSkipBtn = document.getElementById('routine-skip-btn');
    const routineRescheduleBtn = document.getElementById('routine-reschedule-btn');
    const rescheduleModal = document.getElementById('routine-reschedule-modal');
    const rescheduleList = document.getElementById('routine-reschedule-list');
    const rescheduleSaveBtn = document.getElementById('routine-reschedule-save');
    const rescheduleCancelBtn = document.getElementById('routine-reschedule-cancel');
    const rescheduleCloseBtn = document.getElementById('routine-reschedule-close');
    if (currentTaskDisplay) currentTaskDisplay.style.display = 'none';
    if (pieChartContainer) pieChartContainer.style.display = 'none';
    let pieChart; // To be initialized later with Chart.js or a custom implementation
    // Initialize auto-run state based on configuration. Users can override via the
    // checkbox in the routine player. The default value is pulled from
    // ConfigManager (routineAutoRunDefault), falling back to false if not set.
    let autoRunEnabled = false;
    try {
        const cfg = window.ConfigManager?.getConfig?.();
        if (cfg && typeof cfg.routineAutoRunDefault === 'boolean') {
            autoRunEnabled = cfg.routineAutoRunDefault;
        }
    } catch (err) {
        console.warn('Unable to read routineAutoRunDefault from ConfigManager', err);
    }
    // const routineAutoRunCheckbox = document.getElementById('routine-auto-run'); // Removed/Moved to focus mode
    // const routineSkipBtn = document.getElementById('routine-skip-btn'); // Removed/Moved to focus mode

    // View Switching Elements
    const routineShowPlayerBtn = document.getElementById('routine-show-player-btn');
    const routineShowSetupBtn = document.getElementById('routine-show-setup-btn');
    const routinePlayerSection = document.querySelector('.routine-player'); // Assuming this is the correct selector
    const routineSetupSection = document.querySelector('.routine-setup'); // Assuming this is the correct selector

    const quickTaskForm = document.getElementById('routine-quick-task-form');
    const quickTaskTitleInput = document.getElementById('routine-quick-task-title');
    const quickTaskImportanceInput = document.getElementById('routine-quick-task-importance');
    const quickTaskUrgencyInput = document.getElementById('routine-quick-task-urgency');
    const quickTaskDurationInput = document.getElementById('routine-quick-task-duration');
    const quickTaskImportanceValue = document.getElementById('routine-importance-value');
    const quickTaskUrgencyValue = document.getElementById('routine-urgency-value');
    const createTaskModel = window.TaskModel?.createTask;

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
    const ROUTINE_RUN_REQUEST_KEY = 'adhd-tool-pending-routine-run';
    let routines = []; // Array to hold routine objects
    let selectedRoutineId = null; // ID of the currently selected routine in the dropdown
    let activeRoutine = null; // The routine object that is currently running
    let currentTaskIndex = -1; // Index of the current task in the active routine
    let currentTaskTimer = null; // Stores the setInterval ID for the current task
    let activeTaskTimeLeftSeconds = 0; // Stores the actual time left for the currently running task for manualAdvance logic
    let currentTaskStartTimestamp = null; // Tracks when the active task began
    let autoStartCheckTimer = null; // Stores the setInterval ID for checking auto-start times
    const autoStartedToday = {}; // Tracks routines that have auto-started today
    let activeRoutineStartTime = null; // Timestamp of when the current routine began
    let activeRoutineEndTime = null; // Expected end time based on current run

    function getDefaultTaskMinutes() {
        const cfg = window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG || {};
        const parsed = parseInt(cfg.defaultTaskMinutes, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
    }

    function getLearnedDurationMinutes(title) {
        const getter = window.DurationLearning?.getEstimatedDuration;
        if (typeof getter !== 'function') return null;
        return getter(title);
    }

    function recordDurationForTask(task) {
        const recorder = window.DurationLearning?.recordTaskDuration;
        if (typeof recorder !== 'function' || !task) return;

        const now = Date.now();
        const elapsedMinutes = currentTaskStartTimestamp
            ? Math.round((now - currentTaskStartTimestamp) / 60000)
            : null;

        const scheduledMinutes = Number(task.duration) || Number(task.estimatedMinutes) || getDefaultTaskMinutes();
        const minutesToRecord = Math.max(1, Number.isFinite(elapsedMinutes) && elapsedMinutes > 0 ? elapsedMinutes : scheduledMinutes);

        recorder(task.name || task.title || 'Task', minutesToRecord);
    }

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

    // --- CALENDAR COLLISION HELPERS ---
    function parseCalendarDate(value, isEnd = false) {
        if (!value) return null;
        const dateString = value.length === 10 ? `${value}T${isEnd ? '23:59:59' : '00:00:00'}` : value;
        const parsed = new Date(dateString);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    function getCalendarEventsForToday() {
        const events = JSON.parse(localStorage.getItem('adhd-calendar-events')) || [];
        const todayStr = new Date().toISOString().slice(0, 10);
        return events.filter(ev => ev.start && ev.start.startsWith(todayStr));
    }

    function findRoutineCalendarConflicts(windowStart, windowEnd) {
        if (!windowStart || !windowEnd) return [];

        return getCalendarEventsForToday()
            .map(ev => {
                const start = parseCalendarDate(ev.start, false);
                let end = parseCalendarDate(ev.end, true);

                if (start && !end) {
                    const defaultDurationMs = ev.start.length === 10 ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
                    end = new Date(start.getTime() + defaultDurationMs);
                }

                return {
                    title: ev.title || 'Calendar event',
                    start,
                    end
                };
            })
            .filter(ev => ev.start && ev.end && ev.start < windowEnd && ev.end > windowStart);
    }

    function formatClockTime(dateObj) {
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function updateRoutineCalendarConflicts() {
        if (!calendarConflictDisplay) return;

        if (!activeRoutineStartTime || !activeRoutineEndTime) {
            calendarConflictDisplay.style.display = 'none';
            calendarConflictDisplay.textContent = '';
            return;
        }

        const conflicts = findRoutineCalendarConflicts(activeRoutineStartTime, activeRoutineEndTime);

        if (!conflicts.length) {
            calendarConflictDisplay.style.display = 'none';
            calendarConflictDisplay.textContent = '';
            return;
        }

        const conflictText = conflicts
            .map(ev => `${formatClockTime(ev.start)}–${formatClockTime(ev.end)}: ${ev.title}`)
            .join('; ');

        calendarConflictDisplay.textContent = `Calendar events overlap this routine: ${conflictText}`;
        calendarConflictDisplay.style.display = '';
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
                    !activeRoutine &&
                    Array.isArray(routine.tasks) &&
                    routine.tasks.length > 0
                ) {
                    autoStartedToday[routine.id] = today;
                    notify(`Starting routine: ${routine.name}`);
                    activateRoutine(routine.id);
                }
            });
        }, 1000);
    }

    function initQuickTaskCapture() {
        if (!quickTaskForm || !quickTaskTitleInput) return;

        let quickTaskFeedbackTimeout = null;
        const getQuickTaskFeedbackBox = () => {
            let box = quickTaskForm.querySelector('.quick-task-feedback');
            if (!box) {
                box = document.createElement('div');
                box.className = 'quick-task-feedback';
                box.style.marginTop = '0.5rem';
                box.style.fontSize = '0.9rem';
                box.style.padding = '0.5rem 0.75rem';
                box.style.borderRadius = '6px';
                box.style.display = 'none';
                quickTaskForm.appendChild(box);
            }
            return box;
        };

        const showQuickTaskFeedback = (message, type = 'success') => {
            const box = getQuickTaskFeedbackBox();
            if (!box) return;
            box.textContent = message;
            box.style.display = 'block';
            box.style.backgroundColor = type === 'error' ? '#fdecea' : '#e8f5e9';
            box.style.color = type === 'error' ? '#c62828' : '#1b5e20';
            box.style.border = type === 'error' ? '1px solid #f44336' : '1px solid #4caf50';
            if (quickTaskFeedbackTimeout) clearTimeout(quickTaskFeedbackTimeout);
            quickTaskFeedbackTimeout = setTimeout(() => {
                box.style.display = 'none';
            }, 4000);
        };

        const defaultMinutes = getDefaultTaskMinutes();
        if (quickTaskDurationInput && defaultMinutes) {
            quickTaskDurationInput.value = defaultMinutes;
            quickTaskDurationInput.placeholder = `Default: ${defaultMinutes} min`;
        }

        const syncSliderValue = (input, display) => {
            if (input && display) {
                display.textContent = input.value;
            }
        };

        syncSliderValue(quickTaskImportanceInput, quickTaskImportanceValue);
        syncSliderValue(quickTaskUrgencyInput, quickTaskUrgencyValue);

        [
            [quickTaskImportanceInput, quickTaskImportanceValue],
            [quickTaskUrgencyInput, quickTaskUrgencyValue]
        ].forEach(([input, display]) => {
            if (!input || !display) return;
            input.addEventListener('input', () => syncSliderValue(input, display));
        });

        quickTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!window.DataManager) return;
            const title = quickTaskTitleInput.value.trim();
            if (!title) return;

            const importance = Number(quickTaskImportanceInput?.value ?? 5);
            const urgency = Number(quickTaskUrgencyInput?.value ?? 5);
            const rawDuration = (quickTaskDurationInput?.value || '').trim();
            const parsedDuration = rawDuration === '' ? NaN : parseInt(rawDuration, 10);
            const hasInvalidDuration = rawDuration !== '' && (!Number.isFinite(parsedDuration) || parsedDuration <= 0);
            if (hasInvalidDuration) {
                showQuickTaskFeedback('Please enter a positive duration in minutes.', 'error');
                quickTaskDurationInput?.focus?.();
                return;
            }

            const learnedDuration = getLearnedDurationMinutes(title);
            const durationMinutes = Number.isFinite(parsedDuration)
                ? parsedDuration
                : (learnedDuration ?? defaultMinutes);

            const baseTask = {
                title,
                text: title,
                importance: Number.isFinite(importance) ? importance : 5,
                urgency: Number.isFinite(urgency) ? urgency : 5,
                estimatedMinutes: durationMinutes,
                durationMinutes,
                duration: durationMinutes,
                source: 'routine',
                originalTool: 'routine',
                plannerDate: null,
            };

            const task = createTaskModel ? createTaskModel(baseTask) : baseTask;
            window.DataManager.addTask(task);

            quickTaskForm.reset();
            if (quickTaskImportanceInput) quickTaskImportanceInput.value = '5';
            if (quickTaskUrgencyInput) quickTaskUrgencyInput.value = '5';
            if (quickTaskDurationInput && defaultMinutes) quickTaskDurationInput.value = defaultMinutes;
            syncSliderValue(quickTaskImportanceInput, quickTaskImportanceValue);
            syncSliderValue(quickTaskUrgencyInput, quickTaskUrgencyValue);
            showQuickTaskFeedback('Quick task saved for today and ready to schedule.', 'success');
        });
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
    // Task Object: { id: string, name: string, duration: number (minutes), startAt?: string (HH:MM) } // Note: 'completed' field removed as per new instructions

    // --- UTILITY FUNCTIONS ---
    function generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : 'routine-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    function parseTimeToMinutes(hhmm) {
        if (!hhmm || typeof hhmm !== 'string') return null;
        const trimmed = hhmm.trim();
        const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (!match) return null;
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes;
    }

    function minutesToDate(minutesOfDay) {
        const base = new Date();
        const totalMinutes = Math.max(0, minutesOfDay || 0);
        base.setHours(0, 0, 0, 0);
        base.setMinutes(totalMinutes);
        return base;
    }

    function buildRoutineRunUrl() {
        const newTabUrl = new URL(window.location.href);
        const pathSegments = newTabUrl.pathname.split('/').filter(Boolean);

        if (pathSegments[pathSegments.length - 1]?.toLowerCase() !== 'routine') {
            pathSegments[pathSegments.length] = 'routine';
        }

        newTabUrl.pathname = '/' + pathSegments.join('/');
        newTabUrl.searchParams.set('autostartRoutine', '1');
        return newTabUrl.toString();
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
                const validatedStart = parseTimeToMinutes(task.startAt);
                task.startAt = validatedStart !== null ? minutesToDate(validatedStart).toTimeString().slice(0, 5) : null;
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

    function handlePendingRoutineRun() {
        const params = new URLSearchParams(window.location.search);
        const shouldAutoStart = params.get('autostartRoutine') === '1';
        const pendingRunRaw = localStorage.getItem(ROUTINE_RUN_REQUEST_KEY);

        if (!shouldAutoStart || !pendingRunRaw) {
            return;
        }

        let pendingRun;
        try {
            pendingRun = JSON.parse(pendingRunRaw);
        } catch (err) {
            console.warn('Could not parse pending routine run request:', err);
            localStorage.removeItem(ROUTINE_RUN_REQUEST_KEY);
            return;
        }

        if (!pendingRun || !pendingRun.routineId) {
            localStorage.removeItem(ROUTINE_RUN_REQUEST_KEY);
            return;
        }

        const routineToRun = getRoutineById(pendingRun.routineId);
        if (!routineToRun) {
            localStorage.removeItem(ROUTINE_RUN_REQUEST_KEY);
            alert('The requested routine could not be found. Please try starting it again.');
            return;
        }

        selectedRoutineId = routineToRun.id;
        routineSelect.value = routineToRun.id;
        updateRoutineView(true);
        activateRoutine(routineToRun.id);
        localStorage.removeItem(ROUTINE_RUN_REQUEST_KEY);
    }

    // --- TIME CALCULATION HELPER ---
    function calculateTaskTimes(routine) {
        let currentMinutes = routine.startTime ? parseTimeToMinutes(routine.startTime) : 0;
        if (currentMinutes === null) currentMinutes = 0;

        return routine.tasks.map(task => {
            const taskStartMinutes = parseTimeToMinutes(task.startAt);
            const startMinutes = taskStartMinutes !== null ? taskStartMinutes : currentMinutes;
            const endMinutes = startMinutes + task.duration;
            currentMinutes = endMinutes;

            const startDate = minutesToDate(startMinutes);
            const endDate = minutesToDate(endMinutes);

            const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                const startCol = document.createElement('div');
                startCol.className = 'col-start';
                const startInput = document.createElement('input');
                startInput.type = 'time';
                startInput.value = task.startAt || '';
                startInput.addEventListener('change', (e) => {
                    const value = e.target.value.trim();
                    const minutesValue = parseTimeToMinutes(value);
                    if (value && minutesValue === null) {
                        alert('Please enter a valid start time in HH:MM format or leave blank.');
                        e.target.value = task.startAt || '';
                        return;
                    }
                    task.startAt = value && minutesValue !== null ? minutesToDate(minutesValue).toTimeString().slice(0, 5) : null;
                    saveRoutines();
                });
                startCol.appendChild(startInput);
                row.appendChild(startCol);

                // 5. Duration Column (Smart Controls)
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

                // 6. Actions Column
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
                <div class="col-start"><input type="time" id="new-task-start-${index}" aria-label="Task start time"></div>
                <div class="col-duration"><input type="number" value="5" min="1" id="new-task-duration-${index}"></div>
                <div class="col-actions">
                    <button id="save-new-task-${index}" class="btn btn-primary btn-sm">Add</button>
                    <button id="cancel-new-task-${index}" class="btn btn-secondary btn-sm">X</button>
                </div>
            `;

            zone.replaceWith(newRow);

            const nameInput = newRow.querySelector(`#new-task-name-${index}`);
            const durationInput = newRow.querySelector(`#new-task-duration-${index}`);
            const startInput = newRow.querySelector(`#new-task-start-${index}`);
            const saveBtn = newRow.querySelector(`#save-new-task-${index}`);
            const cancelBtn = newRow.querySelector(`#cancel-new-task-${index}`);

            nameInput.focus();

            const saveHandler = () => {
                const name = nameInput.value.trim();
                const duration = parseInt(durationInput.value, 10);
                const startAt = startInput.value.trim();
                if (startAt && parseTimeToMinutes(startAt) === null) {
                    alert('Please enter a valid start time (HH:MM) or leave blank.');
                    return;
                }
                if (name && duration > 0) {
                    addTaskAt(index, name, duration, startAt || null);
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

    function addTaskAt(index, name, duration, startAt = null) {
        const routine = getRoutineById(selectedRoutineId);
        if (!routine) return;

        const trimmedName = (name || '').trim();
        const parsedDuration = parseInt(duration, 10);

        if (!trimmedName || isNaN(parsedDuration) || parsedDuration <= 0) {
            if (typeof alert === 'function') {
                alert('Please provide a task name and a positive duration.');
            }
            return;
        }

        const normalizedStart = parseTimeToMinutes(startAt);

        const newTask = {
            id: generateId(),
            name: trimmedName,
            duration: parsedDuration,
            startAt: normalizedStart !== null ? minutesToDate(normalizedStart).toTimeString().slice(0, 5) : null
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
    function editTaskInRoutine(taskId, newName, newDuration, newStartAt = null) {
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

        const normalizedStart = parseTimeToMinutes(newStartAt);
        if (newStartAt && normalizedStart === null) {
            alert('Please enter a valid start time in HH:MM format or leave blank.');
            return;
        }

        task.name = trimmedName;
        task.duration = duration;
        task.startAt = normalizedStart !== null ? minutesToDate(normalizedStart).toTimeString().slice(0, 5) : null;

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

        const startInput = document.createElement('input');
        startInput.type = 'time';
        startInput.value = task.startAt || '';
        startInput.className = 'edit-routine-task-start-input';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-routine-task-btn';
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const newName = nameInput.value.trim();
            const newDuration = parseInt(durationInput.value, 10);
            const newStartAt = startInput.value.trim();
            editTaskInRoutine(task.id, newName, newDuration, newStartAt || null);
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
        listItem.appendChild(startInput);
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

        const pendingRun = {
            routineId: selectedRoutineId,
            timestamp: Date.now()
        };
        localStorage.setItem(ROUTINE_RUN_REQUEST_KEY, JSON.stringify(pendingRun));

        const desiredUrl = new URL(buildRoutineRunUrl());
        const currentUrl = new URL(window.location.href);

        if (currentUrl.toString() !== desiredUrl.toString()) {
            window.history.replaceState({}, '', desiredUrl);
        }

        updateRoutineView(true);
        activateRoutine(selectedRoutineId);
        localStorage.removeItem(ROUTINE_RUN_REQUEST_KEY);
    }

    // --- PIE CHART FUNCTION ---


    // --- ROUTINE EXECUTION LOGIC ---
    function activateRoutine(routineId) {
        const originalRoutine = getRoutineById(routineId);
        if (!originalRoutine) {
            console.error("Failed to activate routine: ID not found", routineId);
            alert("Error: Could not find the routine to activate.");
            return;
        }
        if (!originalRoutine.tasks || originalRoutine.tasks.length === 0) {
            alert("Cannot start an empty routine. Add some tasks first.");
            startSelectedRoutineBtn.disabled = false;
            startSelectedRoutineBtn.innerHTML = '<i class="fas fa-play"></i> Start Selected Routine';
            if (currentTaskNameDisplay) currentTaskNameDisplay.textContent = '';
            if (currentTaskTimeLeftDisplay) currentTaskTimeLeftDisplay.textContent = '';
            return;
        }
        // Deep copy the routine to allow modification (skipping/reordering) without affecting the saved routine
        activeRoutine = JSON.parse(JSON.stringify(originalRoutine));

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
        activeRoutineStartTime = now;
        activeRoutineEndTime = finishTime;
        expectedFinishTimeDisplay.textContent = finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateRoutineCalendarConflicts();
        if (currentTaskDisplay) currentTaskDisplay.style.display = '';
        if (pieChartContainer) pieChartContainer.style.display = '';
        drawPieChart(1, false);

        // Enter focus mode
        enterFocusMode();

        startNextTask();
    }

    function selectNextTaskIndexAndDelay() {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const remaining = activeRoutine.tasks
            .map((task, idx) => ({ task, idx, startMinutes: parseTimeToMinutes(task.startAt) }))
            .filter(item => item.idx >= currentTaskIndex);

        if (remaining.length === 0) return null;

        const upcomingWithStart = remaining
            .filter(item => item.startMinutes !== null && item.startMinutes >= nowMinutes)
            .sort((a, b) => a.startMinutes - b.startMinutes);

        const earliestScheduled = upcomingWithStart[0];

        if (!earliestScheduled) {
            return { index: currentTaskIndex, delaySeconds: 0 };
        }

        const windowMinutes = earliestScheduled.startMinutes - nowMinutes;

        if (windowMinutes > 0) {
            const fitCandidates = remaining
                .filter(item => item.idx !== earliestScheduled.idx)
                .filter(item => (item.startMinutes === null || item.startMinutes <= nowMinutes) && item.task.duration <= windowMinutes)
                .sort((a, b) => a.task.duration - b.task.duration);

            if (fitCandidates.length > 0) {
                return { index: fitCandidates[0].idx, delaySeconds: 0 };
            }

            return { index: earliestScheduled.idx, delaySeconds: windowMinutes * 60 };
        }

        return { index: earliestScheduled.idx, delaySeconds: 0 };
    }

    function startNextTask() {
        if (currentTaskTimer) {
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }
        activeTaskTimeLeftSeconds = 0; // Reset for next task or completion
        currentTaskStartTimestamp = null;

        // Clear flicker effect
        if (focusModeEl) {
            focusModeEl.classList.remove('overdue-flicker');
        }

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
            activeRoutineStartTime = null;
            activeRoutineEndTime = null;
            currentTaskTimer = null;
            drawPieChart(0, false);
            if (currentTaskDisplay) currentTaskDisplay.style.display = 'none';
            if (pieChartContainer) pieChartContainer.style.display = 'none';

            // Exit focus mode
            if (typeof exitFocusMode === 'function') {
                exitFocusMode();
            }

            notify("Routine finished!");
            updateRoutineCalendarConflicts();
            return;
        }

        const selection = selectNextTaskIndexAndDelay();
        if (!selection) {
            console.log("No further tasks available.");
            return;
        }

        const targetIndex = selection.index;
        if (targetIndex !== currentTaskIndex) {
            const [nextTask] = activeRoutine.tasks.splice(targetIndex, 1);
            activeRoutine.tasks.splice(currentTaskIndex, 0, nextTask);
        }

        const currentTask = activeRoutine.tasks[currentTaskIndex];
        console.log("Starting task:", currentTask.name, "Duration:", currentTask.duration, "min");

        const remainingTasks = activeRoutine.tasks.slice(currentTaskIndex);
        const totalRemainingMinutes = remainingTasks.reduce((s, t) => s + t.duration, 0) + (selection.delaySeconds || 0) / 60;
        const finishTime = new Date(Date.now() + totalRemainingMinutes * 60000);
        expectedFinishTimeDisplay.textContent = finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        currentTaskNameDisplay.textContent = currentTask.name;
        activeTaskTimeLeftSeconds = currentTask.duration * 60 + (selection.delaySeconds || 0);
        const originalTaskDurationSeconds = activeTaskTimeLeftSeconds;
        currentTaskStartTimestamp = Date.now();

        drawPieChart(1, false);
        currentTaskTimeLeftDisplay.textContent = `${Math.floor(activeTaskTimeLeftSeconds / 60)}:${String(activeTaskTimeLeftSeconds % 60).padStart(2, '0')}`;

        if (typeof updateFocusUI === 'function') {
            updateFocusUI();
        }

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
                // Overdue logic
                if (focusModeEl && !focusModeEl.classList.contains('overdue-flicker')) {
                    focusModeEl.classList.add('overdue-flicker');
                }

                // If Auto Run is enabled, advance immediately even if overdue
                if (autoRunEnabled) {
                    clearInterval(currentTaskTimer);
                    currentTaskTimer = null;
                    recordDurationForTask(currentTask);
                    notify(`Task "${currentTask.name}" finished (Auto Run)`);
                    currentTaskIndex++;
                    startNextTask();
                    return;
                }
            }

            if (activeTaskTimeLeftSeconds <= 0 && !isTaskLate) {
                if (autoRunEnabled) {
                    clearInterval(currentTaskTimer);
                    currentTaskTimer = null;
                    recordDurationForTask(currentTask);
                    notify(`Task "${currentTask.name}" finished (Auto Run)`);
                    currentTaskIndex++;
                    startNextTask();
                } else {
                    // Just notify once when hitting 0, but let timer continue into negative for flicker
                    if (activeTaskTimeLeftSeconds === 0) {
                        notify(`Task "${currentTask.name}" time up!`);
                    }
                }
            }
        }, 1000);
    }

    function skipCurrentTask() {
        if (!activeRoutine || currentTaskIndex >= activeRoutine.tasks.length) return;

        const skippedTask = activeRoutine.tasks[currentTaskIndex];
        console.log("Skipping task:", skippedTask.name);

        // Remove current task completely and move to the next item in the queue
        activeRoutine.tasks.splice(currentTaskIndex, 1);
        notify(`Skipped "${skippedTask.name}".`);

        startNextTask();
    }

    let draggingRescheduleItem = null;

    function getRescheduleDragAfterElement(container, y) {
        const items = [...container.querySelectorAll('.routine-reschedule-item:not(.dragging)')];
        return items.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
    }

    function handleRescheduleDragStart(e) {
        draggingRescheduleItem = e.currentTarget;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => draggingRescheduleItem.classList.add('dragging'), 0);
    }

    function handleRescheduleDragEnd() {
        if (draggingRescheduleItem) {
            draggingRescheduleItem.classList.remove('dragging');
            draggingRescheduleItem = null;
        }
    }

    function handleRescheduleDragOver(e) {
        e.preventDefault();
        if (!draggingRescheduleItem) return;
        const afterElement = getRescheduleDragAfterElement(rescheduleList, e.clientY);
        if (!afterElement) {
            rescheduleList.appendChild(draggingRescheduleItem);
        } else if (afterElement !== draggingRescheduleItem) {
            rescheduleList.insertBefore(draggingRescheduleItem, afterElement);
        }
    }

    function buildRescheduleList() {
        if (!rescheduleList || !activeRoutine) return;
        const remainingTasks = activeRoutine.tasks.slice(currentTaskIndex);
        rescheduleList.innerHTML = '';

        remainingTasks.forEach((task, idx) => {
            const li = document.createElement('li');
            li.className = 'routine-reschedule-item';
            if (idx === 0) {
                li.classList.add('routine-reschedule-current');
            }
            li.draggable = true;
            li.dataset.index = currentTaskIndex + idx;

            const grip = document.createElement('span');
            grip.className = 'routine-reschedule-grip';
            grip.innerHTML = '<i class="fas fa-grip-vertical"></i>';

            const name = document.createElement('span');
            name.className = 'routine-reschedule-name';
            name.textContent = task.name;

            const meta = document.createElement('span');
            meta.className = 'routine-reschedule-meta';
            const parts = [`${task.duration} min`];
            if (task.startAt) parts.push(task.startAt);
            if (idx === 0) parts.push('current');
            meta.textContent = parts.join(' • ');

            li.appendChild(grip);
            li.appendChild(name);
            li.appendChild(meta);

            li.addEventListener('dragstart', handleRescheduleDragStart);
            li.addEventListener('dragend', handleRescheduleDragEnd);

            rescheduleList.appendChild(li);
        });
    }

    function openRescheduleModal() {
        if (!activeRoutine || !rescheduleModal || currentTaskIndex < 0 || currentTaskIndex >= activeRoutine.tasks.length) return;
        if (currentTaskTimer) {
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }
        buildRescheduleList();
        rescheduleModal.classList.remove('hidden');
    }

    function closeRescheduleModal(shouldResume = false) {
        if (rescheduleModal) {
            rescheduleModal.classList.add('hidden');
        }
        if (shouldResume && activeRoutine) {
            startNextTask();
        }
    }

    function saveRescheduledOrder() {
        if (!activeRoutine || !rescheduleList) return;
        const order = Array.from(rescheduleList.children).map(item => Number(item.dataset.index));
        const completedTasks = activeRoutine.tasks.slice(0, currentTaskIndex);
        const remainingTasks = order.map(idx => activeRoutine.tasks[idx]).filter(Boolean);

        activeRoutine.tasks = completedTasks.concat(remainingTasks);
        currentTaskIndex = completedTasks.length;

        closeRescheduleModal(false);
        notify('Task order updated.');
        startNextTask();
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
        recordDurationForTask(finishedTask);
        currentTaskIndex++;
        // notify(`Task "${finishedTask.name}" finished`);
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
        // Format: Task Name, Duration, Start At (HH:MM optional)
        routine.tasks.forEach(task => {
            const name = task.name.replace(/"/g, '""'); // Escape quotes
            const start = task.startAt ? task.startAt : '';
            const row = `"${name}",${task.duration},"${start}"`;
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

                // Expecting: Name, Duration, Optional Start
                if (columns.length >= 2) {
                    // Clean up regex artifacts if needed, but the loop handles it.
                    // Actually, let's use a simpler robust split for the specific format requested.
                    // If the user edits in Excel, it might be standard CSV.

                    let name = columns[0].trim();
                    let duration = parseInt(columns[1], 10);
                    let startAt = columns[2] ? columns[2].trim() : '';

                    // Fallback for simple comma split if regex failed or for simple lines
                    if (!name && row.indexOf(',') > -1) {
                        const parts = row.split(',');
                        name = parts[0].trim();
                        duration = parseInt(parts[1], 10);
                        startAt = parts[2] ? parts[2].trim() : '';
                    }

                    const normalizedStart = parseTimeToMinutes(startAt);
                    const safeStart = startAt && normalizedStart !== null ? minutesToDate(normalizedStart).toTimeString().slice(0, 5) : null;

                    if (name && !isNaN(duration)) {
                        tasks.push({
                            id: generateId(),
                            name: name,
                            duration: duration,
                            startAt: safeStart
                        });
                        totalDuration += duration;
                    }
                }
            });

            if (tasks.length === 0) {
                alert('No valid tasks found in CSV. Format should be: Task Name, Duration (minutes), Optional Start Time (HH:MM)');
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
        startSelectedRoutineBtn.disabled = false;
        startSelectedRoutineBtn.innerHTML = '<i class="fas fa-play"></i> Start Selected Routine';
        if (currentTaskNameDisplay) currentTaskNameDisplay.textContent = '';
        if (currentTaskTimeLeftDisplay) currentTaskTimeLeftDisplay.textContent = '';
        initQuickTaskCapture();
        loadRoutines();
        handlePendingRoutineRun();

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

        if (routineAutoRunCheckbox) {
            // Set initial state based on configuration
            routineAutoRunCheckbox.checked = autoRunEnabled;
            routineAutoRunCheckbox.addEventListener('change', (e) => {
                autoRunEnabled = e.target.checked;
                console.log("Auto Run:", autoRunEnabled);
                // Persist override back to ConfigManager so future sessions remember the user choice
                try {
                    window.ConfigManager?.updateConfig?.({ routineAutoRunDefault: autoRunEnabled });
                } catch (err) {
                    console.warn('Failed to persist routineAutoRunDefault to ConfigManager', err);
                }
            });
        }

        if (routineSkipBtn) {
            routineSkipBtn.addEventListener('click', skipCurrentTask);
        }

        if (routineRescheduleBtn && rescheduleModal && rescheduleList) {
            routineRescheduleBtn.addEventListener('click', openRescheduleModal);
        }
        if (rescheduleSaveBtn) {
            rescheduleSaveBtn.addEventListener('click', saveRescheduledOrder);
        }
        if (rescheduleCancelBtn) {
            rescheduleCancelBtn.addEventListener('click', () => closeRescheduleModal(true));
        }
        if (rescheduleCloseBtn) {
            rescheduleCloseBtn.addEventListener('click', () => closeRescheduleModal(true));
        }
        if (rescheduleList) {
            rescheduleList.addEventListener('dragover', handleRescheduleDragOver);
        }

        // --- Task Receiving Logic ---
        if (window.EventBus) {
            window.EventBus.addEventListener('ef-receiveTaskFor-Routine', handleReceivedTaskForRoutine);
            window.EventBus.addEventListener('calendarEventsUpdated', updateRoutineCalendarConflicts);
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
    const focusAutoRunCheckbox = document.getElementById('focus-auto-run');
    const queuePreviewPanel = document.getElementById('routine-queue-panel');
    const queuePreviewList = document.getElementById('routine-queue-list');
    const queuePreviewCloseBtn = document.getElementById('routine-queue-close');
    const queueDropIndicator = document.createElement('li');
    queueDropIndicator.className = 'queue-drop-indicator';
    queueDropIndicator.textContent = 'Release to place';
    let queueDragIndex = null;
    let queueDropIndex = null;
    let isQueueDragging = false;
    let queuePreviewLockedOpen = false;

    function isQueueExpanded() {
        return queuePreviewPanel && (
            queuePreviewLockedOpen ||
            queuePreviewPanel.classList.contains('expanded') ||
            queuePreviewPanel.matches(':hover')
        );
    }

    function expandQueuePreview() {
        if (!queuePreviewPanel) return;
        queuePreviewPanel.classList.add('expanded');
    }

    function collapseQueuePreview(force = false) {
        if (!queuePreviewPanel) return;
        if (force) {
            queuePreviewLockedOpen = false;
        }
        if (!queuePreviewLockedOpen) {
            queuePreviewPanel.classList.remove('expanded');
        }
    }

    if (queuePreviewPanel) {
        queuePreviewPanel.addEventListener('mouseenter', expandQueuePreview);
        queuePreviewPanel.addEventListener('mouseleave', () => collapseQueuePreview(false));
        queuePreviewPanel.addEventListener('click', (event) => {
            // Toggle a locked open state for touch users without hover
            if (event.target.closest('button')) return; // don't toggle from button clicks if added later
            queuePreviewLockedOpen = !queuePreviewLockedOpen;
            if (queuePreviewLockedOpen) {
                expandQueuePreview();
            } else {
                collapseQueuePreview(true);
            }
        });
    }

    if (queuePreviewCloseBtn) {
        queuePreviewCloseBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (isQueueExpanded()) {
                collapseQueuePreview(true);
                return;
            }

            if (typeof exitFocusMode === 'function') {
                exitFocusMode();
            }
        });
    }

    if (focusModeEl) {
        focusModeEl.addEventListener('click', (event) => {
            if (!queuePreviewPanel || !isQueueExpanded()) return;
            if (queuePreviewPanel.contains(event.target)) return;

            const clickedLeftSide = event.clientX < window.innerWidth / 2;
            if (clickedLeftSide) {
                collapseQueuePreview(true);
            }
        });
    }

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

        renderQueuePreview();
    }

    function getUpcomingTasksWithTimes() {
        if (!activeRoutine || currentTaskIndex < 0) return [];

        const upcoming = activeRoutine.tasks.slice(currentTaskIndex + 1);
        let runningStart = Date.now() + Math.max(0, activeTaskTimeLeftSeconds) * 1000;

        return upcoming.map(task => {
            const startAt = new Date(runningStart);
            runningStart += task.duration * 60000;
            return { task, startAt };
        });
    }

    function renderQueuePreview() {
        if (!queuePreviewPanel || !queuePreviewList) return;

        if (!activeRoutine || currentTaskIndex < 0 || !activeRoutine.tasks.length) {
            queuePreviewPanel.classList.add('hidden');
            queuePreviewList.innerHTML = '';
            collapseQueuePreview(true);
            return;
        }

        queuePreviewPanel.classList.remove('hidden');
        queuePreviewList.innerHTML = '';
        const items = getUpcomingTasksWithTimes();

        items.forEach((entry, index) => {
            const li = document.createElement('li');
            li.className = 'queue-item';
            li.draggable = true;
            li.dataset.queueIndex = index;
            li.textContent = `${formatClockTime(entry.startAt)} ${entry.task.name}`;

            li.addEventListener('dragstart', () => handleQueueDragStart(index, li));
            li.addEventListener('dragend', handleQueueDragEnd);
            li.addEventListener('dragover', handleQueueDragOver);

            queuePreviewList.appendChild(li);
        });

        queuePreviewList.addEventListener('dragover', handleQueueDragOver);
        queuePreviewList.addEventListener('drop', handleQueueDrop);
    }

    function updateQueueTimes() {
        if (!queuePreviewList || isQueueDragging) return;
        const items = getUpcomingTasksWithTimes();
        const liNodes = queuePreviewList.querySelectorAll('.queue-item');

        if (liNodes.length !== items.length) {
            renderQueuePreview();
            return;
        }

        items.forEach((entry, idx) => {
            const li = liNodes[idx];
            li.dataset.queueIndex = idx;
            li.textContent = `${formatClockTime(entry.startAt)} ${entry.task.name}`;
        });
    }

    function handleQueueDragStart(index, li) {
        queueDragIndex = index;
        isQueueDragging = true;
        li.classList.add('dragging');
    }

    function handleQueueDragEnd() {
        const indicator = queuePreviewList ? queuePreviewList.querySelector('.queue-drop-indicator') : null;
        if (indicator) indicator.remove();
        queueDragIndex = null;
        queueDropIndex = null;
        isQueueDragging = false;
        renderQueuePreview();
    }

    function handleQueueDragOver(event) {
        if (!queuePreviewList || queueDragIndex === null) return;
        event.preventDefault();

        const target = event.target.closest('.queue-item');
        const items = Array.from(queuePreviewList.querySelectorAll('.queue-item:not(.dragging)'));
        if (!target || !items.length) return;

        const targetIndex = items.indexOf(target);
        const { top, height } = target.getBoundingClientRect();
        const isAfter = event.clientY > top + height / 2;
        queueDropIndex = isAfter ? targetIndex + 1 : targetIndex;

        queueDropIndicator.style.marginTop = isAfter ? '0.35rem' : '0';
        queueDropIndicator.style.marginBottom = isAfter ? '0' : '0.35rem';

        const existingIndicator = queuePreviewList.querySelector('.queue-drop-indicator');
        if (existingIndicator) existingIndicator.remove();

        if (queueDropIndex >= items.length) {
            queuePreviewList.appendChild(queueDropIndicator);
        } else {
            queuePreviewList.insertBefore(queueDropIndicator, items[queueDropIndex]);
        }
    }

    function handleQueueDrop(event) {
        if (queueDragIndex === null || queueDropIndex === null) return;
        event.preventDefault();

        const upcoming = activeRoutine.tasks.slice(currentTaskIndex + 1);
        const [movedTask] = upcoming.splice(queueDragIndex, 1);
        const safeDropIndex = Math.min(Math.max(queueDropIndex, 0), upcoming.length);
        upcoming.splice(safeDropIndex, 0, movedTask);

        activeRoutine.tasks = activeRoutine.tasks.slice(0, currentTaskIndex + 1).concat(upcoming);
        queueDragIndex = null;
        queueDropIndex = null;
        isQueueDragging = false;

        const indicator = queuePreviewList.querySelector('.queue-drop-indicator');
        if (indicator) indicator.remove();

        renderQueuePreview();
        updateFocusUI();
        displaySelectedRoutineDetails();
    }

    function updateFocusTimer() {
        if (!focusTimeRemaining || !focusTimerCircle) return;

        const minutes = Math.floor(activeTaskTimeLeftSeconds / 60);
        const seconds = activeTaskTimeLeftSeconds % 60;
        focusTimeRemaining.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

        updateQueueTimes();

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
            skipCurrentTask(); // Use the new smart skip logic
        });
    }

    if (focusAutoRunCheckbox) {
        focusAutoRunCheckbox.addEventListener('change', (e) => {
            autoRunEnabled = e.target.checked;
        });
    }

    // Add keyboard support (spacebar to complete task)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && activeRoutine && focusModeEl && !focusModeEl.classList.contains('hidden')) {
            e.preventDefault();
            manualAdvanceTask();
        }
        if (e.code === 'Escape' && activeRoutine && focusModeEl && !focusModeEl.classList.contains('hidden')) {
            exitFocusMode();
        }
    });

    // Modify startNextTask to update focus UI
    const originalStartNextTask = startNextTask;
    startNextTask = function () {
        originalStartNextTask();
        if (activeRoutine && focusModeEl && !focusModeEl.classList.contains('hidden')) {
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
