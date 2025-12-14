document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if the routine section is present
    const routineSection = document.getElementById('routine');
    if (!routineSection) {
        return;
    }

    console.log("Routine Tool script loaded.");

    // --- DOM Elements for Player ---
    const playerRoutineNameDisplay = document.getElementById('player-current-routine-name');
    const playerRoutineTasksList = document.getElementById('player-routine-tasks');
    const expectedFinishTimeDisplay = document.getElementById('expected-finish-time');
    const calendarConflictDisplay = document.getElementById('routine-calendar-conflicts');

    // Controls
    const startSelectedRoutineBtn = document.getElementById('start-selected-routine-btn');
    const routineSkipBtn = document.getElementById('routine-skip-btn');
    const routineRescheduleBtn = document.getElementById('routine-reschedule-btn');
    const rescheduleModal = document.getElementById('routine-reschedule-modal');
    const rescheduleList = document.getElementById('routine-reschedule-list');
    const rescheduleSaveBtn = document.getElementById('routine-reschedule-save');
    const rescheduleCancelBtn = document.getElementById('routine-reschedule-cancel');
    const rescheduleCloseBtn = document.getElementById('routine-reschedule-close');

    const activeRoutineDisplay = document.getElementById('active-routine-display');
    const routineControls = document.querySelector('.routine-controls');
    const currentTaskDisplay = document.getElementById('current-task-display');
    const pieChartContainer = document.querySelector('.pie-chart-container');
    const routinePieChartCanvas = document.getElementById('routine-pie-chart');
    const routineAutoRunCheckbox = document.getElementById('routine-auto-run');

    // Focus mode elements
    const focusModeEl = document.getElementById('routine-focus-mode');
    const focusRoutineName = document.getElementById('focus-routine-name');
    const focusTaskNumber = document.getElementById('focus-task-number');
    const focusFinishTime = document.getElementById('focus-finish-time');
    const focusCurrentTaskName = document.getElementById('focus-current-task-name');
    const focusTimeRemaining = document.getElementById('focus-time-remaining');
    const focusProgressFill = document.getElementById('routine-focus-progress');
    const focusUpcomingTasks = document.getElementById('focus-upcoming-tasks');
    const focusTimerCircle = document.getElementById('focus-timer-circle');
    const focusCompleteTaskBtn = document.getElementById('focus-complete-task-btn');
    const focusSkipTaskBtn = document.getElementById('focus-skip-task-btn');
    const focusAutoRunToggle = document.getElementById('focus-auto-run');
    const exitFocusBtn = document.getElementById('exit-routine-focus');

    const currentTaskNameDisplay = document.getElementById('current-task-name');
    const currentTaskTimeLeftDisplay = document.getElementById('current-task-time-left');

    if (currentTaskDisplay) currentTaskDisplay.style.display = 'none';
    if (pieChartContainer) pieChartContainer.style.display = 'none';

    // --- DOM Elements for Settings Management ---
    const settingRoutineSelect = document.getElementById('setting-routine-select');
    const settingCreateRoutineBtn = document.getElementById('setting-create-routine-btn');
    const settingDeleteRoutineBtn = document.getElementById('setting-delete-routine-btn');
    const settingRoutineEditor = document.getElementById('setting-routine-editor');
    const settingRoutineName = document.getElementById('setting-routine-name');
    const settingRoutineStartTime = document.getElementById('setting-routine-start-time');
    const settingRoutineWeekdays = document.getElementById('setting-routine-weekdays');
    const settingRoutineTasksList = document.getElementById('setting-routine-tasks-list');
    const settingAddTaskBtn = document.getElementById('setting-add-task-btn');
    const settingSaveRoutineBtn = document.getElementById('setting-save-routine-btn');
    const settingExportRoutineBtn = document.getElementById('setting-export-routine-btn');
    const settingImportRoutineBtn = document.getElementById('setting-import-routine-btn');
    const settingImportRoutineFile = document.getElementById('setting-import-routine-file');


    // --- Data Storage ---
    const ROUTINE_STORAGE_KEY = 'adhd-tool-routines';
    const ROUTINE_RUN_REQUEST_KEY = 'adhd-tool-pending-routine-run';
    let routines = [];
    let selectedRoutineId = null; // ID of the routine currently being edited in settings
    let activeRoutine = null; // The routine object that is currently running
    let originalRoutineSnapshot = null; // To compare for changes at the end
    let currentTaskIndex = -1;
    let currentTaskTimer = null;
    let activeTaskTimeLeftSeconds = 0;
    let activeTaskTotalDurationSeconds = 0;
    let currentTaskStartTimestamp = null;
    let autoStartCheckTimer = null;
    const autoStartedToday = {};
    let activeRoutineStartTime = null;
    let activeRoutineEndTime = null;
    let autoRunEnabled = false;

    // Load config
    try {
        const cfg = window.ConfigManager?.getConfig?.();
        if (cfg && typeof cfg.routineAutoRunDefault === 'boolean') {
            autoRunEnabled = cfg.routineAutoRunDefault;
        }
    } catch (err) {
        console.warn('Unable to read routineAutoRunDefault from ConfigManager', err);
    }

    function syncAutoRunToggles() {
        if (routineAutoRunCheckbox) routineAutoRunCheckbox.checked = autoRunEnabled;
        if (focusAutoRunToggle) focusAutoRunToggle.checked = autoRunEnabled;
    }

    if (routineAutoRunCheckbox) {
        routineAutoRunCheckbox.checked = autoRunEnabled;
        routineAutoRunCheckbox.addEventListener('change', () => {
            autoRunEnabled = routineAutoRunCheckbox.checked;
            syncAutoRunToggles();
        });
    }

    if (focusAutoRunToggle) {
        focusAutoRunToggle.checked = autoRunEnabled;
        focusAutoRunToggle.addEventListener('change', () => {
            autoRunEnabled = focusAutoRunToggle.checked;
            syncAutoRunToggles();
        });
    }

    syncAutoRunToggles();

    // --- Utility Functions ---
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

    function formatClockTime(dateObj) {
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function updateExpectedFinishTime() {
        if (!expectedFinishTimeDisplay) return;

        if (!activeRoutine || currentTaskIndex < 0 || currentTaskIndex >= activeRoutine.tasks.length) {
            expectedFinishTimeDisplay.textContent = '-';
            activeRoutineEndTime = null;
            return;
        }

        let remainingSeconds = Math.max(0, activeTaskTimeLeftSeconds || 0);

        for (let i = currentTaskIndex + 1; i < activeRoutine.tasks.length; i++) {
            const task = activeRoutine.tasks[i];
            remainingSeconds += (parseInt(task.duration, 10) || 0) * 60;
        }

        const finishTime = new Date(Date.now() + remainingSeconds * 1000);
        expectedFinishTimeDisplay.textContent = formatClockTime(finishTime);
        activeRoutineEndTime = finishTime;
    }

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
        }

        // Migrate data structure if needed
        routines.forEach(routine => {
            if (!routine.id) routine.id = generateId();
            if (!Array.isArray(routine.tasks)) routine.tasks = [];
            if (!Array.isArray(routine.weekDays)) routine.weekDays = [0, 1, 2, 3, 4, 5, 6]; // Default to all days if missing

            routine.totalDuration = 0;
            routine.tasks.forEach(task => {
                if (!task.id) task.id = generateId();
                task.duration = parseInt(task.duration, 10) || 0;
                routine.totalDuration += task.duration;
            });
        });
    }

    // --- Routine Selection Logic ---
    function findBestRoutineForNow() {
        const now = new Date();
        const day = now.getDay(); // 0 (Sun) - 6 (Sat)
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const todaysRoutines = routines.filter(r => r.weekDays && r.weekDays.includes(day));

        if (todaysRoutines.length === 0) return null;

        todaysRoutines.sort((a, b) => {
            const timeA = parseTimeToMinutes(a.startTime) ?? 0;
            const timeB = parseTimeToMinutes(b.startTime) ?? 0;
            const diffA = Math.abs(timeA - currentMinutes);
            const diffB = Math.abs(timeB - currentMinutes);
            return diffA - diffB;
        });

        return todaysRoutines[0];
    }

    // --- Routine Management UI (Settings) ---

    function initSettingsUI() {
        if (!settingRoutineSelect) return;

        updateSettingsRoutineSelect();

        settingRoutineSelect.addEventListener('change', () => {
            selectedRoutineId = settingRoutineSelect.value;
            loadRoutineIntoEditor(selectedRoutineId);
        });

        settingCreateRoutineBtn.addEventListener('click', () => {
            const name = prompt("Enter new routine name:");
            if (name) {
                const newRoutine = {
                    id: generateId(),
                    name: name,
                    startTime: "08:00",
                    weekDays: [1, 2, 3, 4, 5],
                    tasks: [],
                    totalDuration: 0
                };
                routines.push(newRoutine);
                saveRoutines();
                updateSettingsRoutineSelect();
                settingRoutineSelect.value = newRoutine.id;
                loadRoutineIntoEditor(newRoutine.id);
            }
        });

        settingDeleteRoutineBtn.addEventListener('click', () => {
            if (!selectedRoutineId) return;
            if (confirm("Delete this routine?")) {
                routines = routines.filter(r => r.id !== selectedRoutineId);
                saveRoutines();
                selectedRoutineId = null;
                updateSettingsRoutineSelect();
                settingRoutineEditor.classList.add('hidden');
            }
        });

        settingSaveRoutineBtn.addEventListener('click', saveRoutineFromEditor);
        settingAddTaskBtn.addEventListener('click', addTaskInEditor);

        if (settingExportRoutineBtn) {
            settingExportRoutineBtn.addEventListener('click', exportRoutineToCSV);
        }
        if (settingImportRoutineBtn) {
            settingImportRoutineBtn.addEventListener('click', () => {
                settingImportRoutineFile.click();
            });
        }
        if (settingImportRoutineFile) {
            settingImportRoutineFile.addEventListener('change', importRoutineFromCSV);
        }
    }

    function updateSettingsRoutineSelect() {
        settingRoutineSelect.innerHTML = '<option value="">-- Select Routine --</option>';
        routines.forEach(r => {
            const option = document.createElement('option');
            option.value = r.id;
            option.textContent = r.name;
            settingRoutineSelect.appendChild(option);
        });
        if (selectedRoutineId) {
            settingRoutineSelect.value = selectedRoutineId;
        } else {
            settingRoutineSelect.value = "";
        }
    }

    function loadRoutineIntoEditor(routineId) {
        const routine = routines.find(r => r.id === routineId);
        if (!routine) {
            settingRoutineEditor.classList.add('hidden');
            selectedRoutineId = null;
            return;
        }

        selectedRoutineId = routineId;
        settingRoutineEditor.classList.remove('hidden');

        settingRoutineName.value = routine.name;
        settingRoutineStartTime.value = routine.startTime || '';

        const checkboxes = settingRoutineWeekdays.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = routine.weekDays && routine.weekDays.includes(parseInt(cb.value));
        });

        renderEditorTasks(routine.tasks);
    }

    function renderEditorTasks(tasks) {
        settingRoutineTasksList.innerHTML = '';
        tasks.forEach((task, index) => {
            const div = document.createElement('div');
            div.className = 'routine-task-item';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'task-name';
            nameInput.value = task.name;
            nameInput.placeholder = 'Task Name';

            const durationInput = document.createElement('input');
            durationInput.type = 'number';
            durationInput.className = 'task-duration';
            durationInput.value = task.duration;
            durationInput.min = '1';
            durationInput.placeholder = 'Min';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-remove-task';
            removeBtn.title = 'Remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => {
                div.remove();
            });

            div.appendChild(nameInput);
            div.appendChild(durationInput);
            div.appendChild(removeBtn);

            settingRoutineTasksList.appendChild(div);
        });
    }

    function addTaskInEditor() {
        const div = document.createElement('div');
        div.className = 'routine-task-item';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'task-name';
        nameInput.value = '';
        nameInput.placeholder = 'New Task';

        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.className = 'task-duration';
        durationInput.value = '5';
        durationInput.min = '1';
        durationInput.placeholder = 'Min';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove-task';
        removeBtn.title = 'Remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => {
            div.remove();
        });

        div.appendChild(nameInput);
        div.appendChild(durationInput);
        div.appendChild(removeBtn);

        settingRoutineTasksList.appendChild(div);
        nameInput.focus();
    }

    function saveRoutineFromEditor() {
        if (!selectedRoutineId) return;
        const routine = routines.find(r => r.id === selectedRoutineId);
        if (!routine) return;

        routine.name = settingRoutineName.value;
        routine.startTime = settingRoutineStartTime.value;

        const selectedDays = [];
        settingRoutineWeekdays.querySelectorAll('input:checked').forEach(cb => {
            selectedDays.push(parseInt(cb.value));
        });
        routine.weekDays = selectedDays;

        const newTasks = [];
        let totalDuration = 0;
        settingRoutineTasksList.querySelectorAll('.routine-task-item').forEach(div => {
            const name = div.querySelector('.task-name').value.trim();
            const duration = parseInt(div.querySelector('.task-duration').value) || 5;
            if (name) {
                newTasks.push({
                    id: generateId(),
                    name: name,
                    duration: duration,
                    startAt: null
                });
                totalDuration += duration;
            }
        });
        routine.tasks = newTasks;
        routine.totalDuration = totalDuration;

        saveRoutines();
        updateSettingsRoutineSelect();
        alert("Routine saved!");

        const best = findBestRoutineForNow();
        showReadyToStart(best);
    }

    function exportRoutineToCSV() {
        if (!selectedRoutineId) {
            alert("Please select a routine to export.");
            return;
        }
        const routine = routines.find(r => r.id === selectedRoutineId);
        if (!routine) return;

        // CSV Header
        let csvContent = "Task Name,Duration (min)\n";

        // Add Routine Metadata as comments or special rows?
        // For simplicity, let's just export tasks, but maybe the user wants the routine name too.
        // Let's prepend routine name and start time as comments or a header section.
        csvContent += `# Routine Name: ${routine.name}\n`;
        csvContent += `# Start Time: ${routine.startTime}\n`;
        csvContent += `# Week Days: ${routine.weekDays.join(',')}\n`;

        routine.tasks.forEach(task => {
            // Escape double quotes by doubling them, then wrap in quotes if contains comma or quote
            let safeName = task.name.replace(/"/g, '""');
            if (safeName.includes(',') || safeName.includes('"') || safeName.includes('\n')) {
                safeName = `"${safeName}"`;
            }
            csvContent += `${safeName},${task.duration}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${routine.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function importRoutineFromCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!selectedRoutineId) {
            alert("Please select (or create) a routine to import tasks into.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const lines = text.split('\n');
            const newTasks = [];

            // Simple CSV parser
            lines.forEach(line => {
                line = line.trim();
                if (!line) return;
                if (line.startsWith('#')) return; // Metadata or comments
                if (line.toLowerCase().startsWith('task name')) return; // Header

                // Handle quoted strings for task names
                let taskName = "";
                let durationStr = "0";

                // Regex for CSV parsing: matches quoted fields (handling escaped quotes) or unquoted fields
                // This regex captures:
                // 1. Quoted string: "..." (with "" for escaped quote)
                // 2. Unquoted string: anything until comma
                const regex = /(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g;
                let matches = [];
                let match;
                while ((match = regex.exec(line)) !== null) {
                    // match[1] is quoted content, match[2] is unquoted
                    let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
                    matches.push(val);
                }

                if (matches.length >= 1) {
                    taskName = matches[0];
                    if (matches.length >= 2) durationStr = matches[1];
                }

                if (taskName) {
                    const duration = parseInt(durationStr) || 5;
                    newTasks.push({
                        id: generateId(),
                        name: taskName.trim(),
                        duration: duration,
                        startAt: null
                    });
                }
            });

            if (newTasks.length > 0) {
                if (confirm(`Found ${newTasks.length} tasks. Append them to current routine?`)) {
                    // We append to the DOM directly to allow user to save/cancel
                    newTasks.forEach(task => {
                        const div = document.createElement('div');
                        div.className = 'routine-task-item';

                        const nameInput = document.createElement('input');
                        nameInput.type = 'text';
                        nameInput.className = 'task-name';
                        nameInput.value = task.name;
                        nameInput.placeholder = 'Task Name';

                        const durationInput = document.createElement('input');
                        durationInput.type = 'number';
                        durationInput.className = 'task-duration';
                        durationInput.value = task.duration;
                        durationInput.min = '1';
                        durationInput.placeholder = 'Min';

                        const removeBtn = document.createElement('button');
                        removeBtn.type = 'button';
                        removeBtn.className = 'btn-remove-task';
                        removeBtn.title = 'Remove';
                        removeBtn.innerHTML = '&times;';
                        removeBtn.addEventListener('click', () => {
                            div.remove();
                        });

                        div.appendChild(nameInput);
                        div.appendChild(durationInput);
                        div.appendChild(removeBtn);

                        settingRoutineTasksList.appendChild(div);
                    });

                    alert("Tasks imported! Click 'Save Routine' to persist changes.");
                }
            } else {
                alert("No valid tasks found in CSV.");
            }

            // Reset file input
            event.target.value = '';
        };
        reader.readAsText(file);
    }


    // --- Player Logic ---

    function showReadyToStart(routine) {
        if (!routine) {
            playerRoutineNameDisplay.textContent = "No routine scheduled for now.";
            playerRoutineTasksList.innerHTML = "";
            if (expectedFinishTimeDisplay) expectedFinishTimeDisplay.textContent = '-';
            return;
        }

        playerRoutineNameDisplay.textContent = `Next Up: ${routine.name}`;

        playerRoutineTasksList.innerHTML = '';
        routine.tasks.forEach(task => {
            const li = document.createElement('li');
            li.textContent = `${task.name} (${task.duration} min)`;
            playerRoutineTasksList.appendChild(li);
        });

        let startBtn = document.getElementById('start-best-match-btn');
        if (!startBtn) {
            startBtn = document.createElement('button');
            startBtn.id = 'start-best-match-btn';
            startBtn.className = 'btn btn-success btn-lg';
            startBtn.style.marginTop = '1rem';
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Routine';
            if(activeRoutineDisplay) activeRoutineDisplay.appendChild(startBtn);
        }
        startBtn.style.display = 'inline-block';

        const newBtn = startBtn.cloneNode(true);
        startBtn.parentNode.replaceChild(newBtn, startBtn);
        startBtn = newBtn;

        startBtn.addEventListener('click', () => {
            activateRoutine(routine.id);
            startBtn.style.display = 'none';
        });
    }

    function activateRoutine(routineId) {
        const originalRoutine = routines.find(r => r.id === routineId);
        if (!originalRoutine) return;

        activeRoutine = JSON.parse(JSON.stringify(originalRoutine));
        originalRoutineSnapshot = JSON.parse(JSON.stringify(originalRoutine));

        if (!Array.isArray(activeRoutine.tasks) || activeRoutine.tasks.length === 0) {
            alert("This routine has no tasks yet. Add at least one task before starting.");
            activeRoutine = null;
            return;
        }

        currentTaskIndex = 0;
        activeRoutineStartTime = new Date();

        if (currentTaskDisplay) currentTaskDisplay.style.display = '';
        if (pieChartContainer) pieChartContainer.style.display = '';
        if (routineControls) routineControls.style.display = '';

        playerRoutineNameDisplay.textContent = `Running: ${activeRoutine.name}`;
        playerRoutineNameDisplay.style.display = 'block';
        renderActiveRoutineTaskList();

        startNextTask();
        enterFocusMode();
    }

    function renderActiveRoutineTaskList() {
        if (!playerRoutineTasksList || !activeRoutine) return;

        playerRoutineTasksList.innerHTML = '';
        activeRoutine.tasks.forEach((task, index) => {
            const li = document.createElement('li');
            li.textContent = `${task.name} (${task.duration} min)`;
            if (index < currentTaskIndex) li.classList.add('completed-task');
            if (index === currentTaskIndex) li.classList.add('active-task');
            playerRoutineTasksList.appendChild(li);
        });

        playerRoutineTasksList.style.display = 'block';
    }

    function startNextTask() {
        if (!activeRoutine) return;

        if (currentTaskTimer) {
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }

        if (currentTaskIndex >= activeRoutine.tasks.length) {
            finishRoutine();
            return;
        }

        const task = activeRoutine.tasks[currentTaskIndex];
        currentTaskNameDisplay.textContent = task.name;

        activeTaskTimeLeftSeconds = task.duration * 60;
        activeTaskTotalDurationSeconds = activeTaskTimeLeftSeconds;

        currentTaskTimeLeftDisplay.textContent = formatTimeLeft(activeTaskTimeLeftSeconds);

        drawPieChart(1, false);

        currentTaskStartTimestamp = Date.now();

        renderActiveRoutineTaskList();

        currentTaskTimer = setInterval(() => {
            activeTaskTimeLeftSeconds--;
            currentTaskTimeLeftDisplay.textContent = formatTimeLeft(activeTaskTimeLeftSeconds);

            const pct = Math.max(0, activeTaskTimeLeftSeconds / activeTaskTotalDurationSeconds);
            drawPieChart(pct, activeTaskTimeLeftSeconds < 0);

            updateExpectedFinishTime();

            if (activeTaskTimeLeftSeconds <= 0) {
                 if (autoRunEnabled) {
                     manualAdvanceTask();
                 }
            }

            updateFocusUI();
        }, 1000);

        updateExpectedFinishTime();
        updateFocusUI();
    }

    function formatTimeLeft(seconds) {
        const abs = Math.abs(seconds);
        const m = Math.floor(abs / 60);
        const s = abs % 60;
        const sign = seconds < 0 ? '-' : '';
        return `${sign}${m}:${String(s).padStart(2, '0')}`;
    }

    function finishRoutine() {
        if (currentTaskTimer) clearInterval(currentTaskTimer);
        currentTaskDisplay.style.display = 'none';
        pieChartContainer.style.display = 'none';
        routineControls.style.display = 'none';

        const hasChanges = JSON.stringify(activeRoutine.tasks.map(t => ({n:t.name, d:t.duration}))) !==
                           JSON.stringify(originalRoutineSnapshot.tasks.map(t => ({n:t.name, d:t.duration})));

        if (hasChanges) {
            if (confirm("You modified this routine while running. Do you want to save these changes for next time?")) {
                const persistentRoutine = routines.find(r => r.id === activeRoutine.id);
                if (persistentRoutine) {
                    persistentRoutine.tasks = activeRoutine.tasks;
                    persistentRoutine.totalDuration = persistentRoutine.tasks.reduce((s, t) => s + (t.duration || 0), 0);
                    saveRoutines();
                    alert("Changes saved.");
                }
            }
        }

        activeRoutine = null;
        playerRoutineNameDisplay.textContent = "Routine Finished!";
        playerRoutineTasksList.innerHTML = '';
        playerRoutineTasksList.style.display = 'block';
        if (expectedFinishTimeDisplay) expectedFinishTimeDisplay.textContent = '-';

        exitFocusMode();

        setTimeout(() => {
             const best = findBestRoutineForNow();
             showReadyToStart(best);
        }, 3000);
    }

    function manualAdvanceTask() {
        if (!activeRoutine) return;
        currentTaskIndex++;
        startNextTask();
    }

    // --- On-the-fly Editing (Skip & Reschedule) ---
    function skipCurrentTask() {
        if (!activeRoutine || currentTaskIndex >= activeRoutine.tasks.length) return;

        const skippedTask = activeRoutine.tasks[currentTaskIndex];
        console.log("Skipping task:", skippedTask.name);

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
            li.dataset.originalIndex = currentTaskIndex + idx;

            const grip = document.createElement('span');
            grip.className = 'routine-reschedule-grip';
            grip.innerHTML = '<i class="fas fa-grip-vertical"></i>';

            const name = document.createElement('span');
            name.className = 'routine-reschedule-name';
            name.textContent = task.name;

            const meta = document.createElement('span');
            meta.className = 'routine-reschedule-meta';
            const parts = [`${task.duration} min`];
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

        const completedTasks = activeRoutine.tasks.slice(0, currentTaskIndex);
        const newRemainingTasks = [];

        Array.from(rescheduleList.children).forEach(item => {
            const originalIdx = parseInt(item.dataset.originalIndex);
            if (!isNaN(originalIdx) && activeRoutine.tasks[originalIdx]) {
                newRemainingTasks.push(activeRoutine.tasks[originalIdx]);
            }
        });

        if (newRemainingTasks.length > 0) {
            activeRoutine.tasks = completedTasks.concat(newRemainingTasks);
        }

        closeRescheduleModal(false);
        notify('Task order updated.');
        startNextTask();
    }

    // --- Interaction ---
    function setupSpacebarHandler() {
        let spacePressed = false;

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && activeRoutine && !spacePressed) {
                // Prevent scrolling
                e.preventDefault();
                spacePressed = true;
                if (routinePieChartCanvas) routinePieChartCanvas.style.opacity = '0.5';
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && activeRoutine) {
                if (spacePressed) {
                    manualAdvanceTask();
                    spacePressed = false;
                    if (routinePieChartCanvas) routinePieChartCanvas.style.opacity = '1';
                }
            }
        });
    }

    function setupTouchHandler() {
        if (!routinePieChartCanvas) return;

        let touchStartTime = 0;

        routinePieChartCanvas.addEventListener('touchstart', (e) => {
            if (activeRoutine) {
                e.preventDefault();
                touchStartTime = Date.now();
                routinePieChartCanvas.style.opacity = '0.5';
            }
        });

        routinePieChartCanvas.addEventListener('touchend', (e) => {
            if (activeRoutine) {
                e.preventDefault();
                const duration = Date.now() - touchStartTime;
                routinePieChartCanvas.style.opacity = '1';
                if (duration < 1000) {
                     manualAdvanceTask();
                }
            }
        });
    }

    // --- Chart ---
    function drawPieChart(percentage, isLate) {
        if (!routinePieChartCanvas) return;
        const ctx = routinePieChartCanvas.getContext('2d');
        const centerX = routinePieChartCanvas.width / 2;
        const centerY = routinePieChartCanvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        ctx.clearRect(0, 0, routinePieChartCanvas.width, routinePieChartCanvas.height);

        // Background
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#e0e0e0';
        ctx.fill();

        let displayPercentage = percentage;
        let color = '#4CAF50';

        if (isLate) {
            displayPercentage = 1;
            color = '#ff4d4d';
        }

        if (displayPercentage > 0) {
            const startAngle = -0.5 * Math.PI;
            const endAngle = startAngle + (displayPercentage * 2 * Math.PI);

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
    }


    // --- Focus Mode Integration ---
    // Minimal placeholder implementation if focus-mode.js is not handling this completely
    function enterFocusMode() {
        if(focusModeEl) focusModeEl.classList.remove('hidden');
        updateFocusUI();
    }
    function exitFocusMode() {
        if(focusModeEl) focusModeEl.classList.add('hidden');
    }
    function updateFocusUI() {
        if (!activeRoutine || !focusModeEl) return;

        const task = activeRoutine.tasks[currentTaskIndex];
        if (focusRoutineName) focusRoutineName.textContent = activeRoutine.name;
        if (focusCurrentTaskName) focusCurrentTaskName.textContent = task ? task.name : 'Finished';
        if (focusTimeRemaining) focusTimeRemaining.textContent = formatTimeLeft(activeTaskTimeLeftSeconds);
        if (focusTaskNumber) {
            const totalTasks = activeRoutine.tasks.length;
            const currentNumber = Math.min(currentTaskIndex + 1, totalTasks);
            focusTaskNumber.textContent = `Task ${currentNumber} of ${totalTasks}`;
        }
        if (focusFinishTime) {
            const finishTime = activeRoutineEndTime ? formatClockTime(activeRoutineEndTime) : '-';
            focusFinishTime.textContent = `Finish by ${finishTime}`;
        }

        // Progress bar
        if (focusProgressFill) {
            const pct = Math.min(100, Math.max(0, (currentTaskIndex / activeRoutine.tasks.length) * 100));
            focusProgressFill.style.width = `${pct}%`;
        }

        // Circular timer progress
        if (focusTimerCircle && activeTaskTotalDurationSeconds > 0) {
            const radius = 90;
            const circumference = 2 * Math.PI * radius;
            focusTimerCircle.style.strokeDasharray = `${circumference} ${circumference}`;
            const pct = Math.max(0, Math.min(1, activeTaskTimeLeftSeconds / activeTaskTotalDurationSeconds));
            focusTimerCircle.style.strokeDashoffset = `${circumference * (1 - pct)}`;
        }

        // Queue preview (minimal for now)
        if (focusUpcomingTasks) {
            focusUpcomingTasks.innerHTML = '';
            activeRoutine.tasks.slice(currentTaskIndex + 1).forEach(t => {
                const li = document.createElement('li');
                li.textContent = `${t.name} (${t.duration}m)`;
                focusUpcomingTasks.appendChild(li);
            });
        }
    }


    // --- Initialization ---
    loadRoutines();
    initSettingsUI();

    // Auto-select best routine
    const bestRoutine = findBestRoutineForNow();
    showReadyToStart(bestRoutine);

    setupSpacebarHandler();
    setupTouchHandler();

    // Export global functions if needed
    window.activateRoutine = activateRoutine;

    // Allow start button if present in DOM (for old bindings)
    if (startSelectedRoutineBtn) {
        startSelectedRoutineBtn.style.display = 'none'; // Use new UI
    }

    // Bind Player Controls (Moved to end to ensure elements exist)
    if (routineSkipBtn) routineSkipBtn.addEventListener('click', skipCurrentTask);
    if (routineRescheduleBtn) routineRescheduleBtn.addEventListener('click', openRescheduleModal);
    if (rescheduleSaveBtn) rescheduleSaveBtn.addEventListener('click', saveRescheduledOrder);
    if (rescheduleCancelBtn) rescheduleCancelBtn.addEventListener('click', () => closeRescheduleModal(true));
    if (rescheduleCloseBtn) rescheduleCloseBtn.addEventListener('click', () => closeRescheduleModal(true));
    if (rescheduleList) rescheduleList.addEventListener('dragover', handleRescheduleDragOver);
    if (focusCompleteTaskBtn) focusCompleteTaskBtn.addEventListener('click', manualAdvanceTask);
    if (focusSkipTaskBtn) focusSkipTaskBtn.addEventListener('click', skipCurrentTask);
    if (exitFocusBtn) exitFocusBtn.addEventListener('click', exitFocusMode);
});
