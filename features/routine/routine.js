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
    const routineSkipBtn = document.getElementById('routine-skip-btn');
    const routineRescheduleBtn = document.getElementById('routine-reschedule-btn');
    const rescheduleModal = document.getElementById('routine-reschedule-modal');
    const rescheduleList = document.getElementById('routine-reschedule-list');
    const rescheduleSaveBtn = document.getElementById('routine-reschedule-save');
    const rescheduleCancelBtn = document.getElementById('routine-reschedule-cancel');
    const rescheduleCloseBtn = document.getElementById('routine-reschedule-close');
    const rescheduleSheet = document.getElementById('routine-edit-sheet');
    const rescheduleSheetBackdrop = document.getElementById('routine-edit-sheet-backdrop');
    const rescheduleSheetList = document.getElementById('routine-reschedule-list-mobile');
    const rescheduleSheetCloseBtn = document.getElementById('routine-edit-sheet-close');
    const rescheduleSheetCancelBtn = document.getElementById('routine-edit-sheet-cancel');
    const rescheduleSheetSaveBtn = document.getElementById('routine-edit-sheet-save');

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
    // Player controls only make sense while a routine runs.
    if (routineControls) routineControls.style.display = 'none';

    // --- DOM Elements for Settings Management ---
    const routineListCards = document.getElementById('routine-list-cards');
    const settingCreateRoutineBtn = document.getElementById('setting-create-routine-btn');
    const routineNewAiBtn = document.getElementById('routine-new-ai-btn');
    const routineAiInput = document.getElementById('routine-ai-input');
    const routineAiVoiceBtn = document.getElementById('routine-ai-voice-btn');
    const routineAiApplyBtn = document.getElementById('routine-ai-apply-btn');
    const routineAiStatus = document.getElementById('routine-ai-status');
    const routineEditModal = document.getElementById('routine-edit-modal');
    const routineEditModalBackdrop = document.getElementById('routine-edit-modal-backdrop');
    const routineEditModalCloseBtn = document.getElementById('routine-edit-modal-close');
    const routineEditModalSaveBtn = document.getElementById('routine-edit-modal-save-btn');
    const routineEditModalDeleteBtn = document.getElementById('routine-edit-modal-delete-btn');
    const routineEditModalAddTaskBtn = document.getElementById('routine-edit-modal-add-task-btn');
    const routineEditModalName = document.getElementById('routine-edit-modal-name');
    const routineEditModalStartTime = document.getElementById('routine-edit-modal-start-time');
    const routineEditModalWeekdays = document.getElementById('routine-edit-modal-weekdays');
    const routineEditModalShowTasks = document.getElementById('routine-edit-modal-show-tasks');
    const routineEditModalTasksList = document.getElementById('routine-edit-modal-tasks-list');
    const routinePickerModal = document.getElementById('routine-picker-modal');
    const routinePickerModalBackdrop = document.getElementById('routine-picker-modal-backdrop');
    const routinePickerModalCloseBtn = document.getElementById('routine-picker-modal-close');
    const routinePickerList = document.getElementById('routine-picker-list');
    const settingExportRoutineBtn = document.getElementById('setting-export-routine-btn');
    const settingImportRoutineBtn = document.getElementById('setting-import-routine-btn');
    const settingImportRoutineFile = document.getElementById('setting-import-routine-file');

    // --- DOM Elements for View Tabs ---
    const routineViewPlayerBtn = document.getElementById('routine-view-player-btn');
    const routineViewManageBtn = document.getElementById('routine-view-manage-btn');
    const routineViewPlayer = document.getElementById('routine-view-player');
    const routineViewManage = document.getElementById('routine-view-manage');



    const routineTemplates = {
        "morning-launch": {
            name: "Morning Launch",
            startTime: "08:00",
            weekDays: [1, 2, 3, 4, 5],
            tasks: [
                { name: "Drink water", duration: 2 },
                { name: "Take medications", duration: 3 },
                { name: "Review top 3 tasks", duration: 5 }
            ]
        },
        "evening-shutdown": {
            name: "Evening Shutdown",
            startTime: "17:00",
            weekDays: [1, 2, 3, 4, 5],
            tasks: [
                { name: "Clear desk", duration: 5 },
                { name: "Log wins", duration: 5 },
                { name: "Set tomorrow's anchor task", duration: 5 }
            ]
        }
    };

    // --- Data Storage ---
    const ROUTINE_STORAGE_KEY = 'adhd-tool-routines';
    const ROUTINE_RUNS_KEY = 'adhd-routine-runs'; // { [routineId]: last completed date }
    let routines = [];
    let selectedRoutineId = null; // ID of the routine currently being edited in settings
    let activeRoutine = null; // The routine object that is currently running
    let originalRoutineSnapshot = null; // To compare for changes at the end
    let currentTaskIndex = -1;
    let currentTaskTimer = null;
    let activeTaskTimeLeftSeconds = 0;
    let activeTaskTotalDurationSeconds = 0;
    let activeRoutineStartTime = null;
    let activeRoutineEndTime = null;
    let autoRunEnabled = false;
    let stepEndTimeMs = 0;

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

    function formatClockTime(dateObj) {
        return dateObj.toLocaleTimeString(document.documentElement.lang || undefined, { hour: '2-digit', minute: '2-digit' });
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
        // The scheduler books routine time: let the planner and Now view refresh.
        window.dispatchEvent(new Event('routinesChanged'));
    }

    function todayStr() {
        return window.UnifiedScheduler?.localDateString?.(new Date()) || new Date().toISOString().slice(0, 10);
    }

    function markRoutineDoneToday(routineId) {
        try {
            const runs = JSON.parse(localStorage.getItem(ROUTINE_RUNS_KEY) || '{}');
            runs[routineId] = todayStr();
            runs._active = null;
            localStorage.setItem(ROUTINE_RUNS_KEY, JSON.stringify(runs));
        } catch (err) {
            console.warn('Could not record routine run', err);
        }
        window.dispatchEvent(new Event('scheduleNeedsRefresh'));
    }

    function persistActiveRoutineState() {
        try {
            const runs = JSON.parse(localStorage.getItem(ROUTINE_RUNS_KEY) || '{}');
            if (!activeRoutine || currentTaskIndex < 0 || currentTaskIndex >= activeRoutine.tasks.length) {
                if (runs._active) {
                    runs._active = null;
                    localStorage.setItem(ROUTINE_RUNS_KEY, JSON.stringify(runs));
                }
                return;
            }
            runs._active = {
                routineId: activeRoutine.id,
                name: activeRoutine.name,
                currentTaskIndex,
                stepEndTimeMs,
                activeTaskTotalDurationSeconds,
                autoRunEnabled,
                tasks: activeRoutine.tasks,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(ROUTINE_RUNS_KEY, JSON.stringify(runs));
        } catch (err) {
            console.warn('Could not persist active routine state', err);
        }
    }

    function syncActiveRoutineFromStorage() {
        try {
            const runs = JSON.parse(localStorage.getItem(ROUTINE_RUNS_KEY) || '{}');
            const remote = runs?._active;
            if (!remote || !remote.routineId || !Array.isArray(remote.tasks) || !remote.tasks.length) {
                // If our currently running routine was marked done today on another device, stop it cleanly.
                if (activeRoutine && runs?.[activeRoutine.id] === todayStr()) {
                    if (currentTaskTimer) window.clearInterval(currentTaskTimer);
                    currentTaskTimer = null;
                    activeRoutine = null;
                    window.AttentionService?.clearCountdownStatus('routine');
                    window.AttentionService?.releaseWakeLock('routine');
                    exitFocusMode();
                    window.dispatchEvent(new Event('routinePlayerChanged'));
                    showReadyToStart(findBestRoutineForNow());
                }
                return;
            }
            // Ignore stale remote runs whose step already ended more than 2 hours ago.
            if (remote.stepEndTimeMs && Date.now() - remote.stepEndTimeMs > 2 * 3600 * 1000) return;

            const sameState = activeRoutine
                && activeRoutine.id === remote.routineId
                && currentTaskIndex === remote.currentTaskIndex
                && Math.abs((stepEndTimeMs || 0) - (remote.stepEndTimeMs || 0)) < 2000;
            if (sameState) return;

            if (currentTaskTimer) {
                window.clearInterval(currentTaskTimer);
                currentTaskTimer = null;
            }
            const baseRoutine = routines.find(r => r.id === remote.routineId) || { id: remote.routineId, name: remote.name, tasks: remote.tasks };
            activeRoutine = {
                ...JSON.parse(JSON.stringify(baseRoutine)),
                name: remote.name || baseRoutine.name,
                tasks: JSON.parse(JSON.stringify(remote.tasks)),
            };
            originalRoutineSnapshot = JSON.parse(JSON.stringify(baseRoutine));
            currentTaskIndex = Math.min(Math.max(0, Number(remote.currentTaskIndex) || 0), activeRoutine.tasks.length - 1);
            if (typeof remote.autoRunEnabled === 'boolean') {
                autoRunEnabled = remote.autoRunEnabled;
                syncAutoRunToggles();
            }
            const task = activeRoutine.tasks[currentTaskIndex];
            activeTaskTotalDurationSeconds = Number(remote.activeTaskTotalDurationSeconds) || ((task.duration || 5) * 60);
            stepEndTimeMs = Number(remote.stepEndTimeMs) || (Date.now() + activeTaskTotalDurationSeconds * 1000);
            activeTaskTimeLeftSeconds = Math.max(0, Math.ceil((stepEndTimeMs - Date.now()) / 1000));

            if (currentTaskDisplay) currentTaskDisplay.style.display = '';
            if (pieChartContainer) pieChartContainer.style.display = '';
            if (routineControls) routineControls.style.display = '';
            if (playerRoutineNameDisplay) {
                playerRoutineNameDisplay.textContent = `Running: ${activeRoutine.name}`;
                playerRoutineNameDisplay.style.display = 'block';
            }
            if (currentTaskNameDisplay) currentTaskNameDisplay.textContent = task.name;
            renderActiveRoutineTaskList();
            currentTaskTimer = window.setInterval(handleTick, 1000);
            handleTick();
            window.dispatchEvent(new Event('routinePlayerChanged'));
        } catch (err) {
            console.warn('Could not sync active routine from storage', err);
        }
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


    function loadTemplate(templateId) {
        const template = routineTemplates[templateId];
        if (!template) {
            console.error(`Template "${templateId}" not found.`);
            return;
        }

        const newRoutine = {
            id: generateId(),
            name: template.name,
            startTime: template.startTime,
            weekDays: [...template.weekDays],
            tasks: template.tasks.map(t => ({
                id: generateId(),
                name: t.name,
                duration: t.duration,
                startAt: null
            })),
            totalDuration: template.tasks.reduce((sum, t) => sum + (t.duration || 0), 0)
        };

        routines.push(newRoutine);
        saveRoutines();
        updateSettingsRoutineSelect();
        return newRoutine;
    }

    function isMobileViewport() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function notify(message, type) {
        if (window.DataManager?.showNotification) {
            window.DataManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    // --- View Tabs ---
    function showRoutineView(view) {
        if (routineViewPlayerBtn) routineViewPlayerBtn.classList.toggle('active', view === 'player');
        if (routineViewManageBtn) routineViewManageBtn.classList.toggle('active', view === 'manage');
        if (routineViewPlayerBtn) routineViewPlayerBtn.setAttribute('aria-selected', view === 'player' ? 'true' : 'false');
        if (routineViewManageBtn) routineViewManageBtn.setAttribute('aria-selected', view === 'manage' ? 'true' : 'false');
        if (routineViewPlayer) routineViewPlayer.classList.toggle('hidden', view !== 'player');
        if (routineViewManage) routineViewManage.classList.toggle('hidden', view !== 'manage');
    }

    function setupRoutineViewTabs() {
        if (!routineViewPlayerBtn || !routineViewManageBtn) return;
        routineViewPlayerBtn.addEventListener('click', () => showRoutineView('player'));
        routineViewManageBtn.addEventListener('click', () => showRoutineView('manage'));
        // The Now view plays the routine of the moment; this tab is for managing them.
        showRoutineView('manage');
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

    // --- Routine Management UI ---

    const DAY_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

    function formatDays(weekDays) {
        if (!Array.isArray(weekDays) || weekDays.length === 0) return 'No days set';
        if (weekDays.length === 7) return 'Every day';
        const ordered = [1, 2, 3, 4, 5, 6, 0].filter(d => weekDays.includes(d));
        return ordered.map(d => DAY_LABELS[d]).join(', ');
    }

    function initSettingsUI() {
        updateSettingsRoutineSelect();

        if (settingCreateRoutineBtn) {
            settingCreateRoutineBtn.addEventListener('click', () => {
                const newRoutine = {
                    id: generateId(),
                    name: '',
                    startTime: "08:00",
                    weekDays: [1, 2, 3, 4, 5],
                    tasks: [],
                    totalDuration: 0,
                    showTasksInDayView: true,
                };
                routines.push(newRoutine);
                saveRoutines();
                selectedRoutineId = newRoutine.id;
                updateSettingsRoutineSelect();
                openRoutineEditModal(newRoutine, true);
            });
        }

        if (routineNewAiBtn) {
            routineNewAiBtn.addEventListener('click', () => {
                const newRoutine = {
                    id: generateId(),
                    name: '',
                    startTime: "08:00",
                    weekDays: [1, 2, 3, 4, 5],
                    tasks: [],
                    totalDuration: 0,
                    showTasksInDayView: true,
                };
                routines.push(newRoutine);
                saveRoutines();
                selectedRoutineId = newRoutine.id;
                updateSettingsRoutineSelect();
                openRoutineEditModal(newRoutine, true);
                if (routineAiInput) {
                    setTimeout(() => routineAiInput.focus(), 150);
                }
            });
        }

        if (routineAiApplyBtn) {
            routineAiApplyBtn.addEventListener('click', handleApplyAI);
        }
        if (routineAiInput) {
            routineAiInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyAI();
                }
            });
        }
        if (routineAiVoiceBtn) {
            routineAiVoiceBtn.addEventListener('click', handleRoutineVoice);
        }

        if (routineEditModalSaveBtn) routineEditModalSaveBtn.addEventListener('click', saveRoutineFromModal);
        if (routineEditModalDeleteBtn) routineEditModalDeleteBtn.addEventListener('click', deleteSelectedRoutine);
        if (routineEditModalAddTaskBtn) routineEditModalAddTaskBtn.addEventListener('click', () => addTaskRow(routineEditModalTasksList));

        if (routineEditModalCloseBtn) routineEditModalCloseBtn.addEventListener('click', closeRoutineEditModal);
        if (routineEditModalBackdrop) routineEditModalBackdrop.addEventListener('click', closeRoutineEditModal);

        if (routinePickerModalCloseBtn) routinePickerModalCloseBtn.addEventListener('click', closeRoutinePicker);
        if (routinePickerModalBackdrop) routinePickerModalBackdrop.addEventListener('click', closeRoutinePicker);

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
        renderRoutineCards();
    }

    function renderRoutineCards() {
        if (!routineListCards) return;
        routineListCards.innerHTML = '';

        routines.forEach(routine => {
            const card = document.createElement('div');
            card.className = 'routine-card';

            const info = document.createElement('button');
            info.type = 'button';
            info.className = 'routine-card-info';
            const taskCount = (routine.tasks || []).length;
            const totalMin = (routine.tasks || []).reduce((sum, t) => sum + (parseInt(t.duration, 10) || 0), 0);
            const meta = [];
            if (routine.startTime) meta.push(routine.startTime);
            meta.push(formatDays(routine.weekDays));
            if (taskCount > 0) {
                const booked = window.UnifiedScheduler?.routineBookedMinutes?.(routine, getBufferPercent()) || totalMin;
                meta.push(tr('routine.meta', { n: taskCount, min: totalMin, booked }));
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'routine-card-name';
            nameSpan.textContent = routine.name || 'Untitled routine';
            const metaSpan = document.createElement('span');
            metaSpan.className = 'routine-card-meta';
            metaSpan.textContent = meta.join(' \u00b7 ');

            info.appendChild(nameSpan);
            info.appendChild(metaSpan);
            info.addEventListener('click', () => {
                selectedRoutineId = routine.id;
                openRoutineEditModal(routine);
            });

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'routine-card-play';
            playBtn.title = 'Run routine';
            playBtn.setAttribute('aria-label', `Run ${routine.name || 'routine'}`);
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.addEventListener('click', () => {
                closeRoutinePicker();
                activateRoutine(routine.id);
            });

            card.appendChild(info);
            card.appendChild(playBtn);
            routineListCards.appendChild(card);
        });

        if (routines.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'routine-cards-empty';
            const text = document.createElement('p');
            text.textContent = tr('routine.empty');
            empty.appendChild(text);
            Object.entries(routineTemplates).forEach(([id, template]) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-outline btn-sm';
                btn.textContent = `+ ${template.name} (${template.startTime})`;
                btn.addEventListener('click', () => {
                    const conflicts = window.UnifiedScheduler?.findRoutineConflicts?.(template, routines, getBufferPercent()) || [];
                    if (conflicts.length) {
                        notify(`${template.name} overlaps “${conflicts[0].name}”. Create it and change its time.`, 'error');
                    }
                    const created = loadTemplate(id);
                    if (created && conflicts.length) openRoutineEditModal(created);
                });
                empty.appendChild(btn);
            });
            routineListCards.appendChild(empty);
        }
    }

    function tr(key, vars) {
        return window.I18n ? window.I18n.t(key, vars) : key;
    }

    function getBufferPercent() {
        const pct = Number(window.ConfigManager?.getConfig?.().routineBufferPercent);
        return Number.isFinite(pct) ? pct : 10;
    }

    // --- Routine AI & Microphone / Speech Integration ---

    let routineSpeechActive = null;
    let routineNativePollTimer = null;
    let routineMediaRecorder = null;
    let routineAudioChunks = [];

    function resetRoutineVoiceBtn() {
        if (routineNativePollTimer) {
            clearInterval(routineNativePollTimer);
            routineNativePollTimer = null;
        }
        if (routineSpeechActive) {
            try { routineSpeechActive.stop(); } catch (_) {}
            routineSpeechActive = null;
        }
        if (routineMediaRecorder && routineMediaRecorder.state !== 'inactive') {
            try { routineMediaRecorder.stop(); } catch (_) {}
            routineMediaRecorder = null;
        }
        if (routineAiVoiceBtn) {
            routineAiVoiceBtn.classList.remove('listening');
            routineAiVoiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    }

    function parseRoutineOffline(text, currentRoutine = {}) {
        const result = {
            id: currentRoutine?.id,
            name: currentRoutine?.name || '',
            startTime: currentRoutine?.startTime || '07:30',
            weekDays: Array.isArray(currentRoutine?.weekDays) && currentRoutine.weekDays.length > 0
                ? [...currentRoutine.weekDays]
                : [1, 2, 3, 4, 5],
            tasks: Array.isArray(currentRoutine?.tasks)
                ? currentRoutine.tasks.map(t => ({ ...t }))
                : [],
            showTasksInDayView: currentRoutine?.showTasksInDayView !== false,
        };

        const raw = (text || '').trim();
        if (!raw) return result;

        // 1. Time extraction
        const timeMatch = raw.match(/(?:(?:à|at|um|vers|start at|heure\s*(?:à|:)?)\s*)?([01]?[0-9]|2[0-3])(?::([0-5][0-9])|h([0-5][0-9])?)\s*(am|pm)?\b/i)
            || raw.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/)
            || raw.match(/\b([1-9]|1[0-2])\s*(am|pm)\b/i);

        if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            let minutes = parseInt(timeMatch[2] || timeMatch[3] || '0', 10);
            const ampm = (timeMatch[4] || timeMatch[2] || '').toLowerCase();
            if (ampm === 'pm' && hours < 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            const hh = String(hours).padStart(2, '0');
            const mm = String(minutes).padStart(2, '0');
            result.startTime = `${hh}:${mm}`;
        }

        // 2. Weekdays extraction
        const lower = raw.toLowerCase();
        if (/lundi\s+au\s+vendredi|mon(?:day)?\s+(?:to|through)\s+fri(?:day)?|weekdays|en\s+semaine|werktags|d[ií]as\s+laborales/i.test(lower)) {
            result.weekDays = [1, 2, 3, 4, 5];
        } else if (/week-?end|fin\s+de\s+semaine|wochenende|fin\s+de\s+semana/i.test(lower)) {
            result.weekDays = [0, 6];
        } else if (/tous\s+les\s+jours|every\s*day|chaque\s+jour|jeden\s+tag|todos\s+los\s+d[ií]as/i.test(lower)) {
            result.weekDays = [0, 1, 2, 3, 4, 5, 6];
        } else {
            const foundDays = [];
            if (/lundi|monday|montag|lunes/i.test(lower)) foundDays.push(1);
            if (/mardi|tuesday|dienstag|martes/i.test(lower)) foundDays.push(2);
            if (/mercredi|wednesday|mittwoch|mi[eé]rcoles/i.test(lower)) foundDays.push(3);
            if (/jeudi|thursday|donnerstag|jueves/i.test(lower)) foundDays.push(4);
            if (/vendredi|friday|freitag|viernes/i.test(lower)) foundDays.push(5);
            if (/samedi|saturday|samstag|s[aá]bado/i.test(lower)) foundDays.push(6);
            if (/dimanche|sunday|sonntag|domingo/i.test(lower)) foundDays.push(0);
            if (foundDays.length > 0) {
                result.weekDays = foundDays.sort((a, b) => a - b);
            }
        }

        // 3. Routine name extraction
        const knownRoutineMatch = raw.match(/\b(routine\s+(?:du\s+matin|du\s+soir|matinale|de\s+travail|quotidienne)|morning\s+routine|evening\s+routine|night\s+routine|work\s+routine|bedtime\s+routine)\b/i);
        if (knownRoutineMatch) {
            result.name = knownRoutineMatch[1].charAt(0).toUpperCase() + knownRoutineMatch[1].slice(1);
        } else {
            const namedPrefixMatch = raw.match(/^(?:crée|create|nouvelle|new\s+routine|routine)?\s*["'«]?([a-zA-Z0-9\s_-]{3,30})["'»]?\s*:(?!\d\d)/i);
            if (namedPrefixMatch && !/\b(?:à|at|\d)\b/i.test(namedPrefixMatch[1])) {
                result.name = namedPrefixMatch[1].trim();
            }
        }
        if (!result.name) {
            result.name = currentRoutine?.name || 'Routine';
        }

        // 4. Step removal: "supprime/remove/delete/lösche/elimina <step name>"
        const removeMatch = raw.match(/(?:supprime|supprimer|remove|delete|lösche|löschen|elimina|eliminar)\s+["'«]?([^,.\n]+?)["'»]?$/i);
        if (removeMatch) {
            const toRemove = removeMatch[1].trim().toLowerCase();
            result.tasks = result.tasks.filter(t => !t.name.toLowerCase().includes(toRemove));
            return result;
        }

        // 5. Step addition: "ajoute/add/füge hinzu/agrega <step name> <duration>"
        const addMatch = raw.match(/(?:ajoute|ajouter|add|füge\s+hinzu|agrega|agregar)\s+(?:(\d+)\s*(?:min|m|minutes?)\s+(?:de\s+)?)?["'«]?([^,.\n]+?)["'»]?(?:\s+(\d+)\s*(?:min|m|minutes?))?$/i);
        if (addMatch && !raw.includes(':') && !raw.includes(',')) {
            const dur1 = addMatch[1];
            const stepName = addMatch[2].trim();
            const dur2 = addMatch[3];
            const duration = parseInt(dur1 || dur2 || '10', 10);
            if (stepName) {
                result.tasks.push({
                    id: generateId(),
                    name: stepName.charAt(0).toUpperCase() + stepName.slice(1),
                    duration: Math.max(1, duration),
                });
                return result;
            }
        }

        // 6. Multiple steps extraction (e.g. "Méditation 10m, Douche 15m, Café 10m" or after colon)
        let stepsText = raw;
        const stepsColonMatch = raw.match(/(?<!\d\d?):(?!\d\d)\s*(.+)$/);
        if (stepsColonMatch) {
            stepsText = stepsColonMatch[1];
        } else {
            stepsText = stepsText.replace(/(?:à|at|um|vers|start at|heure\s*(?:à|:)?)\s*[01]?[0-9](?::[0-5][0-9]|h(?:[0-5][0-9])?)\s*(am|pm)?/gi, '');
            stepsText = stepsText.replace(/\b[01]?[0-9]:[0-5][0-9]\b/gi, '');
            stepsText = stepsText.replace(/\b[1-9]|1[0-2]\s*(am|pm)\b/gi, '');
            stepsText = stepsText.replace(/\b(?:du\s+lundi\s+au\s+vendredi|lundi\s+au\s+vendredi|on\s+weekdays|weekdays|en\s+semaine|werktags|días\s+laborales)\b/gi, '');
            stepsText = stepsText.replace(/\b(routine\s+(?:du\s+matin|du\s+soir|matinale|de\s+travail|quotidienne)|morning\s+routine|evening\s+routine|night\s+routine|work\s+routine|bedtime\s+routine)\b/gi, '');
        }
        const rawParts = stepsText.split(/[,;\n]|\b(?:puis|then|danach|y\s+luego)\b/i);
        const parsedSteps = [];
        rawParts.forEach(part => {
            let p = part.trim();
            if (!p) return;
            const durMatch = p.match(/(?:(\d+)\s*(?:min|m|minutes?)\s+(?:de\s+)?)?(.+?)(?:\s*\(?(\d+)\s*(?:min|m|minutes?)\)?)?$/i);
            if (durMatch) {
                let duration = parseInt(durMatch[1] || durMatch[3] || '', 10);
                let name = (durMatch[2] || '').trim();
                name = name.replace(/\b(?:du lundi au vendredi|lundi au vendredi|weekdays|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, '').trim();
                name = name.replace(/^(?:et|and|und|y)\s+/i, '').trim();
                if (name.length > 1 && !/^(?:à|at|um)\s+\d/i.test(name)) {
                    if (!duration || isNaN(duration)) duration = 10;
                    parsedSteps.push({
                        id: generateId(),
                        name: name.charAt(0).toUpperCase() + name.slice(1),
                        duration: Math.max(1, duration),
                    });
                }
            }
        });

        if (parsedSteps.length > 0) {
            if (raw.includes(':') || result.tasks.length === 0 || /avec|with|mit|con/i.test(raw)) {
                result.tasks = parsedSteps;
            } else {
                result.tasks.push(...parsedSteps);
            }
        }

        return result;
    }

    async function applyRoutineAI(instruction, currentRoutine = {}) {
        if (window.AIAssistant?.isEnabled?.()) {
            try {
                const systemPrompt = `You are an AI assistant for an ADHD planner. The user wants to create or update a routine.
A routine contains:
- "name": string (the routine title)
- "startTime": "HH:MM" (24-hour time string, e.g. "07:30")
- "weekDays": array of numbers from 0 (Sunday) to 6 (Saturday). For Monday to Friday, use [1, 2, 3, 4, 5].
- "tasks": array of steps [{ "name": string, "duration": number (minutes) }].
- "showTasksInDayView": boolean (true by default)

Based on the CURRENT ROUTINE state and the USER INSTRUCTION (which may be in English, French, German, or Spanish), output the updated routine JSON.
Output ONLY a valid JSON object matching the schema. No markdown formatting, no conversational text.`;

                const userPrompt = `CURRENT ROUTINE:
${JSON.stringify({
  name: currentRoutine?.name || '',
  startTime: currentRoutine?.startTime || '07:30',
  weekDays: currentRoutine?.weekDays || [1, 2, 3, 4, 5],
  tasks: (currentRoutine?.tasks || []).map(t => ({ name: t.name, duration: t.duration })),
  showTasksInDayView: currentRoutine?.showTasksInDayView !== false,
}, null, 2)}

USER INSTRUCTION:
"${instruction}"`;

                const res = await window.AIAssistant.completeJSON(userPrompt, { system: systemPrompt, temperature: 0.2 });
                if (res && (res.name || res.startTime || Array.isArray(res.tasks) || Array.isArray(res.weekDays))) {
                    return {
                        id: currentRoutine?.id,
                        name: res.name || currentRoutine?.name || 'Routine',
                        startTime: res.startTime || currentRoutine?.startTime || '07:30',
                        weekDays: Array.isArray(res.weekDays) && res.weekDays.length ? res.weekDays.map(Number) : (currentRoutine?.weekDays || [1, 2, 3, 4, 5]),
                        tasks: Array.isArray(res.tasks) && res.tasks.length ? res.tasks.map(t => ({
                            id: t.id || generateId(),
                            name: String(t.name || 'Step').trim(),
                            duration: Math.max(1, parseInt(t.duration, 10) || 5),
                        })) : (currentRoutine?.tasks || []),
                        showTasksInDayView: res.showTasksInDayView !== false,
                    };
                }
            } catch (e) {
                console.warn('AI routine update failed, using offline fallback:', e);
            }
        }
        return parseRoutineOffline(instruction, currentRoutine);
    }

    async function handleApplyAI() {
        const text = (routineAiInput?.value || '').trim();
        if (!text) return;
        const routine = routines.find(r => r.id === selectedRoutineId) || {
            id: selectedRoutineId,
            name: routineEditModalName.value,
            startTime: routineEditModalStartTime.value,
            weekDays: Array.from(routineEditModalWeekdays.querySelectorAll('input:checked')).map(cb => parseInt(cb.value)),
            tasks: collectTaskRows(routineEditModalTasksList),
            showTasksInDayView: routineEditModalShowTasks ? routineEditModalShowTasks.checked : true,
        };

        if (routineAiStatus) {
            routineAiStatus.textContent = tr('routine.aiProcessing');
            routineAiStatus.className = 'routine-ai-status';
            routineAiStatus.classList.remove('hidden');
        }
        if (routineAiApplyBtn) routineAiApplyBtn.disabled = true;

        try {
            const updated = await applyRoutineAI(text, routine);
            if (updated) {
                if (updated.name) routineEditModalName.value = updated.name;
                if (updated.startTime) routineEditModalStartTime.value = updated.startTime;
                if (Array.isArray(updated.weekDays)) {
                    const checkboxes = routineEditModalWeekdays.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => {
                        cb.checked = updated.weekDays.includes(parseInt(cb.value));
                    });
                }
                if (updated.showTasksInDayView !== undefined && routineEditModalShowTasks) {
                    routineEditModalShowTasks.checked = updated.showTasksInDayView;
                }
                if (Array.isArray(updated.tasks) && updated.tasks.length > 0) {
                    routineEditModalTasksList.innerHTML = '';
                    updated.tasks.forEach(task => appendTaskRow(routineEditModalTasksList, task));
                }
                if (routineAiStatus) {
                    routineAiStatus.textContent = tr('routine.aiSuccess');
                    routineAiStatus.className = 'routine-ai-status success';
                }
            }
        } catch (err) {
            if (routineAiStatus) {
                routineAiStatus.textContent = tr('routine.aiError', { error: err.message || 'Error' });
                routineAiStatus.className = 'routine-ai-status error';
            }
        } finally {
            if (routineAiApplyBtn) routineAiApplyBtn.disabled = false;
        }
    }

    async function handleRoutineVoice() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const isNative = Boolean(window.AttentionService?.isNative?.());

        if (routineAiVoiceBtn?.classList.contains('listening')) {
            if (isNative) {
                const res = await window.AttentionService.invokeNative('native_stop_speech', {});
                resetRoutineVoiceBtn();
                if (res?.transcript && routineAiInput) {
                    routineAiInput.value = res.transcript;
                    handleApplyAI();
                }
            } else if (routineSpeechActive) {
                routineSpeechActive.stop();
            } else if (routineMediaRecorder && routineMediaRecorder.state === 'recording') {
                routineMediaRecorder.stop();
            }
            return;
        }

        if (!SpeechRecognition && !isNative) {
            if (navigator.mediaDevices?.getUserMedia && window.AIAssistant?.transcribeAudio) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    routineMediaRecorder = new MediaRecorder(stream);
                    routineAudioChunks = [];
                    routineMediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) routineAudioChunks.push(e.data);
                    };
                    routineMediaRecorder.onstop = async () => {
                        stream.getTracks().forEach(track => track.stop());
                        resetRoutineVoiceBtn();
                        if (routineAudioChunks.length === 0) return;
                        const audioBlob = new Blob(routineAudioChunks, { type: 'audio/webm' });
                        if (routineAiStatus) {
                            routineAiStatus.textContent = tr('routine.aiProcessing');
                            routineAiStatus.className = 'routine-ai-status';
                        }
                        try {
                            const transcript = await window.AIAssistant.transcribeAudio(audioBlob, {
                                language: (window.I18n?.getLang?.() || 'en').slice(0, 2)
                            });
                            if (transcript && routineAiInput) {
                                routineAiInput.value = transcript;
                                handleApplyAI();
                            }
                        } catch (err) {
                            if (routineAiStatus) {
                                routineAiStatus.textContent = tr('routine.aiError', { error: err.message || 'Audio error' });
                                routineAiStatus.className = 'routine-ai-status error';
                            }
                        }
                    };
                    routineAiVoiceBtn.classList.add('listening');
                    routineAiVoiceBtn.innerHTML = '<i class="fas fa-microphone fa-beat" style="color: #ef4444"></i>';
                    if (routineAiStatus) {
                        routineAiStatus.textContent = tr('routine.aiListening');
                        routineAiStatus.className = 'routine-ai-status';
                        routineAiStatus.classList.remove('hidden');
                    }
                    routineMediaRecorder.start();
                } catch (err) {
                    resetRoutineVoiceBtn();
                    if (routineAiStatus) {
                        routineAiStatus.textContent = tr('routine.aiError', { error: 'Microphone permission denied' });
                        routineAiStatus.className = 'routine-ai-status error';
                        routineAiStatus.classList.remove('hidden');
                    }
                }
                return;
            }

            if (routineAiStatus) {
                routineAiStatus.textContent = tr('routine.aiError', { error: 'Speech recognition not supported' });
                routineAiStatus.className = 'routine-ai-status error';
                routineAiStatus.classList.remove('hidden');
            }
            return;
        }

        routineAiVoiceBtn.classList.add('listening');
        routineAiVoiceBtn.innerHTML = '<i class="fas fa-microphone fa-beat" style="color: #ef4444"></i>';
        if (routineAiStatus) {
            routineAiStatus.textContent = tr('routine.aiListening');
            routineAiStatus.className = 'routine-ai-status';
            routineAiStatus.classList.remove('hidden');
        }

        const lang = (window.I18n?.getLang?.() || document.documentElement.lang || 'en').toLowerCase();
        const langMap = { fr: 'fr-FR', de: 'de-DE', es: 'es-ES', en: 'en-US' };
        const speechLang = langMap[lang] || `${lang}-${lang.toUpperCase()}`;

        if (isNative) {
            await window.AttentionService.invokeNative('native_start_speech', { lang: speechLang });
            routineNativePollTimer = setInterval(async () => {
                const res = await window.AttentionService.invokeNative('native_poll_speech', {});
                if (!res) return;
                if (res.transcript && routineAiInput) {
                    routineAiInput.value = res.transcript;
                }
                if (res.status === 'done') {
                    resetRoutineVoiceBtn();
                    if (res.transcript && routineAiInput) {
                        routineAiInput.value = res.transcript;
                        handleApplyAI();
                    }
                } else if (res.status === 'error') {
                    resetRoutineVoiceBtn();
                    if (routineAiStatus) {
                        routineAiStatus.textContent = tr('routine.aiError', { error: res.error || 'Speech error' });
                        routineAiStatus.className = 'routine-ai-status error';
                    }
                }
            }, 250);
            return;
        }

        const recognition = new SpeechRecognition();
        routineSpeechActive = recognition;
        recognition.lang = speechLang;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            resetRoutineVoiceBtn();
            const transcript = event.results?.[0]?.[0]?.transcript;
            if (transcript && routineAiInput) {
                routineAiInput.value = transcript;
                handleApplyAI();
            }
        };

        recognition.onerror = (event) => {
            resetRoutineVoiceBtn();
            if (routineAiStatus) {
                routineAiStatus.textContent = tr('routine.aiError', { error: event.error || 'Speech error' });
                routineAiStatus.className = 'routine-ai-status error';
            }
        };

        recognition.onend = () => {
            resetRoutineVoiceBtn();
        };

        try {
            recognition.start();
        } catch (e) {
            resetRoutineVoiceBtn();
            if (routineAiStatus) {
                routineAiStatus.textContent = tr('routine.aiError', { error: e.message || 'Speech error' });
                routineAiStatus.className = 'routine-ai-status error';
            }
        }
    }

    // --- Routine Edit Modal (mobile sheet / desktop dialog) ---

    function openRoutineEditModal(routine, isNew = false) {
        if (!routineEditModal || !routine) return;
        selectedRoutineId = routine.id;

        routineEditModalName.value = routine.name || '';
        routineEditModalStartTime.value = routine.startTime || '';
        if (routineEditModalDeleteBtn) {
            routineEditModalDeleteBtn.style.display = isNew ? 'none' : '';
        }

        const checkboxes = routineEditModalWeekdays.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = routine.weekDays && routine.weekDays.includes(parseInt(cb.value));
        });

        if (routineEditModalShowTasks) {
            routineEditModalShowTasks.checked = routine.showTasksInDayView !== false;
        }
        if (routineAiInput) {
            routineAiInput.value = '';
        }
        if (routineAiStatus) {
            routineAiStatus.textContent = '';
            routineAiStatus.className = 'routine-ai-status hidden';
        }
        resetRoutineVoiceBtn();

        routineEditModalTasksList.innerHTML = '';
        (routine.tasks || []).forEach(task => appendTaskRow(routineEditModalTasksList, task));

        routineEditModal.classList.remove('hidden');
        if (routineEditModalBackdrop) routineEditModalBackdrop.classList.remove('hidden');
        routineEditModalName.focus();
    }

    function closeRoutineEditModal() {
        resetRoutineVoiceBtn();
        if (!routineEditModal) return;
        routineEditModal.classList.add('hidden');
        if (routineEditModalBackdrop) routineEditModalBackdrop.classList.add('hidden');
    }

    function saveRoutineFromModal() {
        if (!selectedRoutineId) return closeRoutineEditModal();
        const routine = routines.find(r => r.id === selectedRoutineId);
        if (!routine) return closeRoutineEditModal();

        const name = routineEditModalName.value.trim();
        if (!name) {
            routineEditModalName.focus();
            notify('Please give this routine a name.');
            return;
        }

        const selectedDays = [];
        routineEditModalWeekdays.querySelectorAll('input:checked').forEach(cb => {
            selectedDays.push(parseInt(cb.value));
        });
        const showTasksInDayView = routineEditModalShowTasks ? routineEditModalShowTasks.checked : true;
        const draft = {
            ...routine,
            name,
            startTime: routineEditModalStartTime.value,
            weekDays: selectedDays,
            tasks: collectTaskRows(routineEditModalTasksList),
            showTasksInDayView,
        };

        // Routines book their time (+ buffer): two routines can't share it.
        const conflicts = window.UnifiedScheduler?.findRoutineConflicts?.(draft, routines, getBufferPercent()) || [];
        if (conflicts.length) {
            const booked = window.UnifiedScheduler.routineBookedMinutes(draft, getBufferPercent());
            notify(tr('routine.overlap', { name, start: draft.startTime, min: booked, other: conflicts[0].name, otherStart: conflicts[0].startTime }), 'error');
            routineEditModalStartTime.focus();
            return;
        }

        Object.assign(routine, draft);
        routine.totalDuration = routine.tasks.reduce((sum, t) => sum + t.duration, 0);

        saveRoutines();
        updateSettingsRoutineSelect();
        closeRoutineEditModal();
        notify('Routine saved!');

        const best = findBestRoutineForNow();
        showReadyToStart(best);
    }

    function deleteSelectedRoutine() {
        if (!selectedRoutineId) return;
        if (!confirm("Delete this routine?")) return;
        routines = routines.filter(r => r.id !== selectedRoutineId);
        saveRoutines();
        selectedRoutineId = null;
        updateSettingsRoutineSelect();
        closeRoutineEditModal();
    }

    // --- Routine Picker (run any routine from the player view) ---

    function openRoutinePicker() {
        if (!routinePickerModal) return;
        routinePickerList.innerHTML = '';

        routines.forEach(routine => {
            const li = document.createElement('li');
            li.className = 'routine-picker-item';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'routine-picker-btn';
            const label = document.createElement('span');
            label.textContent = routine.name || 'Untitled routine';
            const meta = document.createElement('span');
            meta.className = 'routine-card-meta';
            const taskCount = (routine.tasks || []).length;
            meta.textContent = taskCount > 0 ? `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}` : 'No tasks yet';
            btn.appendChild(label);
            btn.appendChild(meta);
            btn.addEventListener('click', () => {
                closeRoutinePicker();
                activateRoutine(routine.id);
            });

            li.appendChild(btn);
            routinePickerList.appendChild(li);
        });

        if (routines.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'routine-cards-empty';
            empty.textContent = 'No routines yet. Create one in the Routines tab.';
            routinePickerList.appendChild(empty);
        }

        routinePickerModal.classList.remove('hidden');
        if (routinePickerModalBackdrop) routinePickerModalBackdrop.classList.remove('hidden');
    }

    function closeRoutinePicker() {
        if (!routinePickerModal) return;
        routinePickerModal.classList.add('hidden');
        if (routinePickerModalBackdrop) routinePickerModalBackdrop.classList.add('hidden');
    }

    // One step in the routine editor:
    //   [drag handle] [step name] [open/close]
    //   details (tap the step to open): duration, move up / down, delete.
    // On phones only the name shows until the step is tapped; on larger
    // screens the details stay open.
    function appendTaskRow(listEl, task) {
        const div = document.createElement('div');
        div.className = 'routine-task-item';

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'routine-drag-handle';
        handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        handle.title = tr('routine.drag');
        handle.setAttribute('aria-label', tr('routine.drag'));
        handle.addEventListener('pointerdown', (e) => startStepDrag(e, div, listEl));

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'task-name';
        nameInput.value = task ? task.name : '';
        nameInput.placeholder = tr('routine.stepName');
        nameInput.setAttribute('aria-label', tr('routine.stepName'));

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'routine-step-toggle';
        toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
        toggle.setAttribute('aria-label', tr('routine.editStep'));
        toggle.addEventListener('click', () => setStepOpen(div, !div.classList.contains('open')));

        const details = document.createElement('div');
        details.className = 'routine-step-details';

        const durationLabel = document.createElement('label');
        durationLabel.className = 'task-duration-label';
        const durationText = document.createElement('span');
        durationText.textContent = tr('routine.duration');
        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.className = 'task-duration';
        durationInput.inputMode = 'numeric';
        durationInput.value = task ? task.duration : '5';
        durationInput.min = '1';
        durationLabel.append(durationText, durationInput);

        const moveBtn = (icon, label, dir) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'routine-step-move';
            btn.innerHTML = `<i class="fas ${icon}"></i>`;
            btn.title = label;
            btn.setAttribute('aria-label', label);
            btn.addEventListener('click', () => moveStep(div, dir));
            return btn;
        };

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove-task';
        removeBtn.title = tr('routine.removeStep');
        removeBtn.setAttribute('aria-label', tr('routine.removeStep'));
        removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        removeBtn.addEventListener('click', () => {
            div.remove();
        });

        details.append(durationLabel, moveBtn('fa-arrow-up', tr('routine.moveUp'), -1), moveBtn('fa-arrow-down', tr('routine.moveDown'), 1), removeBtn);

        // Tapping the step (its name) opens it; other steps close.
        nameInput.addEventListener('focus', () => setStepOpen(div, true));

        div.append(handle, nameInput, toggle, details);
        listEl.appendChild(div);
        return div;
    }

    function setStepOpen(row, open) {
        if (open) {
            row.parentElement?.querySelectorAll('.routine-task-item.open').forEach(other => {
                if (other !== row) other.classList.remove('open');
            });
        }
        row.classList.toggle('open', open);
        row.querySelector('.routine-step-toggle')?.setAttribute('aria-expanded', String(open));
    }

    function moveStep(row, dir) {
        const target = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!target) return;
        if (dir < 0) row.parentElement.insertBefore(row, target);
        else row.parentElement.insertBefore(target, row);
        row.querySelector(dir < 0 ? '.routine-step-move' : '.routine-step-move:nth-of-type(2)')?.focus();
        flashStep(row);
    }

    function flashStep(row) {
        row.classList.remove('moved');
        void row.offsetWidth; // restart the animation
        row.classList.add('moved');
    }

    // Drag a step by its handle (mouse, pen or finger).
    function startStepDrag(e, row, listEl) {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        // Listen on the document: moving the row in the DOM would drop a
        // pointer capture on the handle.
        const pointerId = e.pointerId;
        row.classList.add('dragging');
        listEl.classList.add('is-sorting');

        const onMove = (ev) => {
            if (ev.pointerId !== pointerId) return;
            ev.preventDefault();
            const siblings = [...listEl.querySelectorAll('.routine-task-item')].filter(el => el !== row);
            const after = siblings.find(el => {
                const box = el.getBoundingClientRect();
                return ev.clientY < box.top + box.height / 2;
            });
            if (after) {
                if (row.nextElementSibling !== after) listEl.insertBefore(row, after);
            } else if (listEl.lastElementChild !== row) {
                listEl.appendChild(row);
            }
            // Scroll the list when dragging near its edges.
            const box = listEl.getBoundingClientRect();
            if (ev.clientY < box.top + 30) listEl.scrollTop -= 8;
            else if (ev.clientY > box.bottom - 30) listEl.scrollTop += 8;
        };
        const onUp = (ev) => {
            if (ev.pointerId !== pointerId) return;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
            row.classList.remove('dragging');
            listEl.classList.remove('is-sorting');
            flashStep(row);
        };
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
    }

    function collectTaskRows(listEl) {
        const tasks = [];
        listEl.querySelectorAll('.routine-task-item').forEach(div => {
            const name = div.querySelector('.task-name').value.trim();
            const duration = parseInt(div.querySelector('.task-duration').value) || 5;
            if (name) {
                tasks.push({
                    id: generateId(),
                    name: name,
                    duration: duration,
                    startAt: null
                });
            }
        });
        return tasks;
    }

    function addTaskRow(listEl) {
        const div = appendTaskRow(listEl, null);
        const nameInput = div.querySelector('.task-name');
        if (nameInput) nameInput.focus();
        div.scrollIntoView?.({ block: 'nearest' });
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
                    // Fix: The regex matches empty string at the end of line sometimes or between commas
                    if (match[0] === '' && match.index === line.length) break;
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
                        appendTaskRow(routineEditModalTasksList, task);
                    });

                    notify("Steps imported. Tap Save to keep them.");
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
            if (activeRoutineDisplay) {
                let runOtherBtn = document.getElementById('run-other-routine-btn');
                if (!runOtherBtn) {
                    runOtherBtn = document.createElement('button');
                    runOtherBtn.id = 'run-other-routine-btn';
                    runOtherBtn.type = 'button';
                    runOtherBtn.className = 'btn btn-outline';
                    runOtherBtn.innerHTML = '<i class="fas fa-list"></i> <span data-i18n="routine-run-other">Run another routine</span>';
                    activeRoutineDisplay.appendChild(runOtherBtn);
                }
                const newRunBtn = runOtherBtn.cloneNode(true);
                runOtherBtn.parentNode.replaceChild(newRunBtn, runOtherBtn);
                newRunBtn.addEventListener('click', openRoutinePicker);
                newRunBtn.style.display = '';
            }
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

        const newBtn = startBtn.cloneNode ? startBtn.cloneNode(true) : startBtn;
        startBtn.parentNode?.replaceChild?.(newBtn, startBtn);
        startBtn = newBtn;

        startBtn.addEventListener('click', () => {
            activateRoutine(routine.id);
            startBtn.style.display = 'none';
        });

        let runOtherBtn = document.getElementById('run-other-routine-btn');
        if (!runOtherBtn && activeRoutineDisplay) {
            runOtherBtn = document.createElement('button');
            runOtherBtn.id = 'run-other-routine-btn';
            runOtherBtn.type = 'button';
            runOtherBtn.className = 'btn btn-outline';
            runOtherBtn.innerHTML = '<i class="fas fa-list"></i> <span data-i18n="routine-run-other">Run another routine</span>';
            activeRoutineDisplay.appendChild(runOtherBtn);
        }
        if (runOtherBtn) {
            const newRunBtn = runOtherBtn.cloneNode ? runOtherBtn.cloneNode(true) : runOtherBtn;
            runOtherBtn.parentNode?.replaceChild?.(newRunBtn, runOtherBtn);
            newRunBtn.addEventListener('click', openRoutinePicker);
            newRunBtn.style.display = '';
        }
    }

    function activateRoutine(routineId) {
        const originalRoutine = routines.find(r => r.id === routineId);
        if (!originalRoutine) return;

        activeRoutine = JSON.parse(JSON.stringify(originalRoutine));
        originalRoutineSnapshot = JSON.parse(JSON.stringify(originalRoutine));

        if (!Array.isArray(activeRoutine.tasks) || activeRoutine.tasks.length === 0) {
            alert("This routine has no tasks yet. Add at least one task before starting.");
            if (currentTaskNameDisplay) currentTaskNameDisplay.textContent = '';
            if (currentTaskTimeLeftDisplay) currentTaskTimeLeftDisplay.textContent = '';
            activeRoutine = null;
            return;
        }

        currentTaskIndex = 0;
        activeRoutineStartTime = new Date();
        showRoutineView('player');

        if (currentTaskDisplay) currentTaskDisplay.style.display = '';
        if (pieChartContainer) pieChartContainer.style.display = '';
        if (routineControls) routineControls.style.display = '';

        playerRoutineNameDisplay.textContent = `Running: ${activeRoutine.name}`;
        playerRoutineNameDisplay.style.display = 'block';
        renderActiveRoutineTaskList();

        window.AttentionService?.requestNotificationPermission();
        window.AttentionService?.acquireWakeLock('routine');

        startNextTask();
        enterFocusMode();
        window.dispatchEvent(new Event('routinePlayerChanged'));
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

    function handleTick() {
        if (!activeRoutine || !currentTaskTimer) return;
        const task = activeRoutine.tasks[currentTaskIndex];

        activeTaskTimeLeftSeconds = Math.ceil((stepEndTimeMs - Date.now()) / 1000);

        if (activeTaskTimeLeftSeconds <= 0) {
            activeTaskTimeLeftSeconds = 0;
            if (currentTaskTimeLeftDisplay) currentTaskTimeLeftDisplay.textContent = formatTimeLeft(activeTaskTimeLeftSeconds);
            drawPieChart(0, true);
            updateExpectedFinishTime();
            updateFocusUI();

            window.clearInterval(currentTaskTimer);
            currentTaskTimer = null;

            window.AttentionService?.playNativeSound('chime');

            let nextStepName = '';
            let bodyKey = 'player.stepTimeUpBodyLast';
            let notifyArgs = { step: task.name };

            if (currentTaskIndex + 1 < activeRoutine.tasks.length) {
                nextStepName = activeRoutine.tasks[currentTaskIndex + 1].name;
                bodyKey = 'player.stepTimeUpBody';
                notifyArgs.next = nextStepName;
            }

            if (window.AttentionService?.triggerTaskAlarm && !autoRunEnabled) {
                window.AttentionService.triggerTaskAlarm({
                    title: tr('player.stepTimeUpTitle', { step: task.name }),
                    body: tr(bodyKey, notifyArgs),
                    onDone: () => manualAdvanceTask(),
                    onSnooze: (mins) => {
                        activeTaskTimeLeftSeconds += mins * 60;
                        activeTaskTotalDurationSeconds += mins * 60;
                    }
                });
            } else {
                window.AttentionService?.notify(
                    tr('player.stepTimeUpTitle', { step: task.name }),
                    tr(bodyKey, notifyArgs),
                    { tag: 'routine-step' }
                );
            }

            if (autoRunEnabled) {
                manualAdvanceTask();
            }
            return;
        }

        if (currentTaskTimeLeftDisplay) currentTaskTimeLeftDisplay.textContent = formatTimeLeft(activeTaskTimeLeftSeconds);
        const pct = Math.max(0, activeTaskTimeLeftSeconds / activeTaskTotalDurationSeconds);
        drawPieChart(pct, false);
        updateExpectedFinishTime();
        updateFocusUI();

        window.AttentionService?.setCountdownStatus({
            source: 'routine',
            label: `${activeRoutine.name}: ${task.name}`,
            remainingSeconds: activeTaskTimeLeftSeconds,
            isRunning: true
        });
    }

    function startNextTask() {
        if (!activeRoutine) return;

        if (currentTaskTimer) {
            window.clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }

        if (currentTaskIndex >= activeRoutine.tasks.length) {
            finishRoutine();
            return;
        }

        const task = activeRoutine.tasks[currentTaskIndex];
        if (currentTaskNameDisplay) currentTaskNameDisplay.textContent = task.name;

        activeTaskTimeLeftSeconds = task.duration * 60;
        activeTaskTotalDurationSeconds = activeTaskTimeLeftSeconds;
        stepEndTimeMs = Date.now() + activeTaskTotalDurationSeconds * 1000;
        persistActiveRoutineState();

        if (currentTaskTimeLeftDisplay) currentTaskTimeLeftDisplay.textContent = formatTimeLeft(activeTaskTimeLeftSeconds);
        drawPieChart(1, false);
        renderActiveRoutineTaskList();

        window.AttentionService?.setCountdownStatus({
            source: 'routine',
            label: `${activeRoutine.name}: ${task.name}`,
            remainingSeconds: activeTaskTimeLeftSeconds,
            isRunning: true
        });

        currentTaskTimer = window.setInterval(handleTick, 1000);
        handleTick(); // Initial draw/update
    }

    function formatTimeLeft(seconds) {
        const abs = Math.abs(seconds);
        const m = Math.floor(abs / 60);
        const s = abs % 60;
        const sign = seconds < 0 ? '-' : '';
        return `${sign}${m}:${String(s).padStart(2, '0')}`;
    }

    function finishRoutine() {
        if (currentTaskTimer) window.clearInterval(currentTaskTimer);
        if (currentTaskDisplay) currentTaskDisplay.style.display = 'none';
        if (pieChartContainer) pieChartContainer.style.display = 'none';
        if (routineControls) routineControls.style.display = 'none';

        const completedRoutineName = activeRoutine?.name;

        window.AttentionService?.clearCountdownStatus('routine');
        window.AttentionService?.releaseWakeLock('routine');

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

        if (completedRoutineName) {
            window.AttentionService?.notify(
                tr('player.routineDoneNotifyTitle'),
                tr('player.routineDoneNotifyBody', { name: completedRoutineName }),
                { tag: 'routine-done', sound: 'bell' }
            );
        }

        markRoutineDoneToday(activeRoutine.id);
        activeRoutine = null;
        window.dispatchEvent(new Event('routinePlayerChanged'));
        if (playerRoutineNameDisplay) playerRoutineNameDisplay.textContent = "Routine Finished!";
        if (currentTaskNameDisplay) currentTaskNameDisplay.textContent = "Routine Finished!";
        if (playerRoutineTasksList) {
            playerRoutineTasksList.innerHTML = '';
            playerRoutineTasksList.style.display = 'block';
        }
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

    function handleRescheduleDragOver(e, container) {
        e.preventDefault();
        const listEl = container || rescheduleList;
        if (!draggingRescheduleItem || !listEl) return;
        const afterElement = getRescheduleDragAfterElement(listEl, e.clientY);
        if (!afterElement) {
            listEl.appendChild(draggingRescheduleItem);
        } else if (afterElement !== draggingRescheduleItem) {
            listEl.insertBefore(draggingRescheduleItem, afterElement);
        }
    }

    function buildRescheduleList(listEl) {
        if (!listEl || !activeRoutine) return;
        const remainingTasks = activeRoutine.tasks.slice(currentTaskIndex);
        listEl.innerHTML = '';

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

            const moveBtns = document.createElement('span');
            moveBtns.className = 'routine-reschedule-move';

            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'routine-reschedule-arrow';
            upBtn.title = 'Move up';
            upBtn.setAttribute('aria-label', 'Move task up');
            upBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            upBtn.addEventListener('click', () => {
                const prev = li.previousElementSibling;
                if (prev) listEl.insertBefore(li, prev);
            });

            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'routine-reschedule-arrow';
            downBtn.title = 'Move down';
            downBtn.setAttribute('aria-label', 'Move task down');
            downBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            downBtn.addEventListener('click', () => {
                const next = li.nextElementSibling;
                if (next) listEl.insertBefore(next, li);
            });

            moveBtns.appendChild(upBtn);
            moveBtns.appendChild(downBtn);

            li.appendChild(grip);
            li.appendChild(name);
            li.appendChild(meta);
            li.appendChild(moveBtns);

            li.addEventListener('dragstart', handleRescheduleDragStart);
            li.addEventListener('dragend', handleRescheduleDragEnd);

            listEl.appendChild(li);
        });
    }

    function openRescheduleModal() {
        if (!activeRoutine || currentTaskIndex < 0 || currentTaskIndex >= activeRoutine.tasks.length) return;

        if (currentTaskTimer) {
            clearInterval(currentTaskTimer);
            currentTaskTimer = null;
        }

        if (isMobileViewport() && rescheduleSheet && rescheduleSheetList) {
            buildRescheduleList(rescheduleSheetList);
            rescheduleSheet.classList.remove('hidden');
            if (rescheduleSheetBackdrop) rescheduleSheetBackdrop.classList.remove('hidden');
            return;
        }

        if (!rescheduleModal || !rescheduleList) return;
        buildRescheduleList(rescheduleList);
        rescheduleModal.classList.remove('hidden');
    }

    function closeRescheduleModal(shouldResume = false) {
        if (rescheduleModal) {
            rescheduleModal.classList.add('hidden');
        }
        if (rescheduleSheet) {
            rescheduleSheet.classList.add('hidden');
            if (rescheduleSheetBackdrop) rescheduleSheetBackdrop.classList.add('hidden');
        }
        if (shouldResume && activeRoutine) {
            startNextTask();
        }
    }

    function saveRescheduledOrder() {
        if (!activeRoutine) return;
        const sourceList = (rescheduleSheet && !rescheduleSheet.classList.contains('hidden')) ? rescheduleSheetList : rescheduleList;
        if (!sourceList) return;

        const completedTasks = activeRoutine.tasks.slice(0, currentTaskIndex);
        const newRemainingTasks = [];

        Array.from(sourceList.children).forEach(item => {
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

        // Desktop accessibility: let a click advance tasks as a quick interaction.
        routinePieChartCanvas.addEventListener('click', () => {
            if (activeRoutine) {
                manualAdvanceTask();
            }
        });
    }

    // --- Chart ---
    function drawPieChart(percentage, isLate) {
        if (!routinePieChartCanvas) return;
        const ctx = routinePieChartCanvas.getContext?.('2d');
        if (!ctx) return;
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
        window.dispatchEvent(new Event('routinePlayerChanged'));
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
            focusTaskNumber.textContent = tr('player.stepOf', { n: currentNumber, total: totalTasks });
        }
        if (focusFinishTime) {
            const finishTime = activeRoutineEndTime ? formatClockTime(activeRoutineEndTime) : '-';
            focusFinishTime.textContent = tr('player.finishBy', { time: finishTime });
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

    // Auto-select best routine or resume a running routine synced from another device
    const bestRoutine = findBestRoutineForNow();
    showReadyToStart(bestRoutine);
    syncActiveRoutineFromStorage();

    setupSpacebarHandler();
    setupTouchHandler();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && activeRoutine && currentTaskTimer) {
            handleTick();
        }
    });

    // Public API for the Now view.
    window.activateRoutine = activateRoutine;
    window.manualAdvanceTask = manualAdvanceTask;
    window.RoutinePlayer = {
        isRunning: () => Boolean(activeRoutine),
        runningRoutineId: () => activeRoutine?.id || null,
        getState: () => activeRoutine ? {
            routineId: activeRoutine.id,
            name: activeRoutine.name,
            stepIndex: currentTaskIndex,
            stepCount: activeRoutine.tasks.length,
            stepName: activeRoutine.tasks[currentTaskIndex]?.name || '',
            secondsLeft: activeTaskTimeLeftSeconds,
            stepSeconds: activeTaskTotalDurationSeconds,
        } : null,
        start: activateRoutine,
        show: enterFocusMode,
        parseRoutineOffline,
        applyRoutineAI,
        openEditModal: openRoutineEditModal,
        edit: (routineId) => {
            const routine = routines.find(r => r.id === routineId);
            if (routine) openRoutineEditModal(routine);
        },
        deleteRoutine: (routineId, name) => {
            loadRoutines();
            routines = routines.filter(r => {
                if (!r) return false;
                if (routineId && (String(r.id) === String(routineId) || r.id == routineId)) return false;
                if (name && r.name && r.name.trim().toLowerCase() === name.trim().toLowerCase()) return false;
                return true;
            });
            saveRoutines();
            try {
                const runs = JSON.parse(localStorage.getItem('adhd-routine-runs') || '{}');
                if (routineId) delete runs[routineId];
                if (runs._active && (runs._active.routineId == routineId || runs._active.name === name)) {
                    delete runs._active;
                }
                localStorage.setItem('adhd-routine-runs', JSON.stringify(runs));
            } catch (_) {}
            if (selectedRoutineId && (String(selectedRoutineId) === String(routineId) || selectedRoutineId == routineId)) {
                selectedRoutineId = null;
            }
            updateSettingsRoutineSelect();
            window.dispatchEvent(new CustomEvent('routinesChanged'));
            window.dispatchEvent(new CustomEvent('scheduleNeedsRefresh'));
        },
        unscheduleRoutine: (routineId, name) => {
            loadRoutines();
            routines.forEach(r => {
                if (!r) return;
                const matchId = routineId && (String(r.id) === String(routineId) || r.id == routineId);
                const matchName = name && r.name && r.name.trim().toLowerCase() === name.trim().toLowerCase();
                if (matchId || matchName) {
                    r.weekDays = [];
                    r.startTime = '';
                }
            });
            saveRoutines();
            updateSettingsRoutineSelect();
            window.dispatchEvent(new CustomEvent('routinesChanged'));
            window.dispatchEvent(new CustomEvent('scheduleNeedsRefresh'));
        },
    };

    // Keep in sync when another tab or a sync pulls new routines.
    window.addEventListener('languageChanged', () => updateSettingsRoutineSelect());
    const reloadRoutinesAndActive = () => {
        loadRoutines();
        updateSettingsRoutineSelect();
        syncActiveRoutineFromStorage();
        if (!activeRoutine) {
            showReadyToStart(findBestRoutineForNow());
        }
    };
    window.addEventListener('cloudSyncApplied', reloadRoutinesAndActive);
    window.addEventListener('storage', (e) => {
        if (!e.key || e.key === ROUTINE_STORAGE_KEY || e.key === ROUTINE_RUNS_KEY) {
            reloadRoutinesAndActive();
        }
    });

    // Bind Player Controls (Moved to end to ensure elements exist)
    if (routineSkipBtn) routineSkipBtn.addEventListener('click', skipCurrentTask);
    if (routineRescheduleBtn) routineRescheduleBtn.addEventListener('click', openRescheduleModal);
    if (rescheduleSaveBtn) rescheduleSaveBtn.addEventListener('click', saveRescheduledOrder);
    if (rescheduleCancelBtn) rescheduleCancelBtn.addEventListener('click', () => closeRescheduleModal(true));
    if (rescheduleCloseBtn) rescheduleCloseBtn.addEventListener('click', () => closeRescheduleModal(true));
    if (rescheduleList) rescheduleList.addEventListener('dragover', (e) => handleRescheduleDragOver(e, rescheduleList));
    if (rescheduleSheetList) rescheduleSheetList.addEventListener('dragover', (e) => handleRescheduleDragOver(e, rescheduleSheetList));
    if (rescheduleSheetCloseBtn) rescheduleSheetCloseBtn.addEventListener('click', () => closeRescheduleModal(true));
    if (rescheduleSheetCancelBtn) rescheduleSheetCancelBtn.addEventListener('click', () => closeRescheduleModal(true));
    if (rescheduleSheetSaveBtn) rescheduleSheetSaveBtn.addEventListener('click', saveRescheduledOrder);
    if (rescheduleSheetBackdrop) rescheduleSheetBackdrop.addEventListener('click', () => closeRescheduleModal(true));
    setupRoutineViewTabs();
    if (focusCompleteTaskBtn) focusCompleteTaskBtn.addEventListener('click', manualAdvanceTask);
    if (focusSkipTaskBtn) focusSkipTaskBtn.addEventListener('click', skipCurrentTask);
    if (exitFocusBtn) exitFocusBtn.addEventListener('click', exitFocusMode);
});
