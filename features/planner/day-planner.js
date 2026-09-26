import { renderDayPlanner, relabelTimeline, getMinuteHeight } from './render-day.js';
import { populateTaskOptions, getDefaultTime, getDayBounds, getDefaultDurationMinutes, localDateString } from './planner-utils.js';
import { planDayWithAI } from './ai-plan.js';
import { createTask } from '../../core/task-model.js';
import { geocode, getRoute } from './routing.js';

let editingTaskId = null;
let pendingExternalTask = null;
let currentDate = new Date();

const wrapTask = (task) => createTask(task, task);
const getTaskFromStore = (id) => {
    if (window.TaskStore?.getTaskByHash) return window.TaskStore.getTaskByHash(id);
    if (window.DataManager?.getTask) return window.DataManager.getTask(id);
    return null;
};

const addTaskToStore = (task) => {
    if (window.TaskStore?.addTask) return window.TaskStore.addTask(task);
    return window.DataManager?.addTask ? window.DataManager.addTask(task) : null;
};

const updateTaskInStore = (id, updates) => {
    if (window.TaskStore?.updateTaskByHash) return window.TaskStore.updateTaskByHash(id, updates);
    if (window.DataManager?.updateTask) return window.DataManager.updateTask(id, updates);
    return null;
};

let dateDisplay,
    timeBlocksContainer,
    addEventBtn,
    clearBtn,
    generateScheduleBtn,
    aiPlanBtn,
    recordBtn,
    eventModal,
    closeButton,
    eventForm,
    eventTitleInput,
    eventTimeSelect,
    eventTaskSelect,
    eventDurationInput,
    eventImportanceInput,
    eventUrgencyInput,
    eventDeadlineInput,
    eventDependencySelect,
    eventLocationInput,
    eventLocationSuggestions,
    eventTravelModeContainer,
    eventTravelModeSelect,
    eventModalTitle;

let selectedLocationCoords = null;
let locationDebounce = null;

const tr = (key, vars) => (window.I18n ? window.I18n.t(key, vars) : key);

function setDuration(minutes) {
    eventDurationInput.value = minutes;
    eventModal.querySelectorAll('.event-chip[data-minutes]').forEach(chip => {
        const on = Number(chip.dataset.minutes) === Number(minutes);
        chip.classList.toggle('active', on);
        chip.setAttribute('aria-pressed', String(on));
    });
}

function showConflict(message, freeMinutes) {
    const box = eventModal.querySelector('#event-conflict');
    box.innerHTML = '';
    if (!message) {
        box.hidden = true;
        return;
    }
    const text = document.createElement('p');
    text.textContent = message;
    box.appendChild(text);
    if (Number.isFinite(freeMinutes)) {
        const use = document.createElement('button');
        use.type = 'button';
        use.className = 'btn btn-primary btn-sm';
        use.textContent = tr('event.useFree', { time: minutesToTime(freeMinutes) });
        use.addEventListener('click', () => {
            eventTimeSelect.value = minutesToTime(freeMinutes);
            showConflict(null);
        });
        box.appendChild(use);
    }
    box.hidden = false;
}

function openModal(task, presetTime, externalTask) {
    eventModal.classList.add('active');
    eventModal.style.display = 'flex';
    document.body.classList.add('modal-open');
    populateTaskOptions(eventTaskSelect);
    if (eventTaskSelect.options[0]) eventTaskSelect.options[0].textContent = '—';
    populateDependencyOptions();
    showConflict(null);
    eventModal.querySelector('.event-more').open = false;
    const removeBtn = eventModal.querySelector('#event-remove-btn');
    removeBtn.hidden = !task;
    pendingExternalTask = null;
    if (task) {
        editingTaskId = task.hash || task.id;
        eventModalTitle.textContent = tr('event.titleEdit');
        eventTitleInput.value = (task.name || task.text || '').replace(/\[(FIX|FLEX)\]\s*/gi, '').trim();
        eventTimeSelect.value = task.plannerDate.slice(11, 16);
        setDuration(task.duration || task.durationMinutes || getDefaultDurationMinutes());
        eventImportanceInput.value = task.importance || 5;
        eventUrgencyInput.value = task.urgency || 5;
        const realDeadline = task.deadline && task.deadline.slice(0, 16) !== (task.plannerDate || '').slice(0, 16) ? task.deadline : '';
        eventDeadlineInput.value = realDeadline ? realDeadline.slice(0, 16) : '';
        eventDependencySelect.value = task.dependency || '';
        eventLocationInput.value = task.location || '';
        selectedLocationCoords = task.locationCoords || null;
        if (task.travelMode) {
            eventTravelModeContainer.style.display = 'block';
            eventTravelModeSelect.value = task.travelMode;
        } else {
            eventTravelModeContainer.style.display = 'none';
        }
        eventTitleInput.disabled = false;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = true;
    } else if (externalTask) {
        editingTaskId = null;
        pendingExternalTask = externalTask;
        eventModalTitle.textContent = tr('event.titleSchedule');
        eventTitleInput.value = externalTask.text || '';
        eventTimeSelect.value = presetTime || getDefaultTime();
        setDuration(externalTask.duration || getDefaultDurationMinutes());
        eventImportanceInput.value = externalTask.importance || externalTask.priority || 5;
        eventUrgencyInput.value = externalTask.urgency || externalTask.priority || 5;
        eventDeadlineInput.value = externalTask.deadline ? externalTask.deadline.slice(0, 16) : '';
        eventDependencySelect.value = externalTask.dependency || '';
        eventLocationInput.value = externalTask.location || '';
        selectedLocationCoords = externalTask.locationCoords || null;
        if (externalTask.travelMode) {
            eventTravelModeContainer.style.display = 'block';
            eventTravelModeSelect.value = externalTask.travelMode;
        } else {
            eventTravelModeContainer.style.display = 'none';
        }
        eventTitleInput.disabled = true;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = true;
    } else {
        editingTaskId = null;
        eventModalTitle.textContent = tr('event.titleAdd');
        eventTitleInput.value = '';
        eventTimeSelect.value = presetTime || getDefaultTime();
        setDuration(30);
        eventImportanceInput.value = 5;
        eventUrgencyInput.value = 5;
        eventDeadlineInput.value = '';
        eventDependencySelect.value = '';
        eventLocationInput.value = '';
        selectedLocationCoords = null;
        eventTravelModeContainer.style.display = 'none';
        eventTitleInput.disabled = false;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = false;
    }
    // Hide "pick a task" when there is nothing to pick.
    eventTaskSelect.closest('.event-more').querySelector('[for="event-task"]').hidden = eventTaskSelect.options.length <= 1;
    eventTaskSelect.hidden = eventTaskSelect.options.length <= 1;
    if (!eventTitleInput.disabled && !eventTitleInput.value) {
        setTimeout(() => eventTitleInput.focus(), 50);
    }
}

function closeModal() {
    eventModal.classList.remove('active');
    eventModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    if (eventForm) eventForm.reset();
    showConflict(null);
    editingTaskId = null;
    pendingExternalTask = null;
    eventTitleInput.disabled = false;
    if (eventTaskSelect) eventTaskSelect.disabled = false;
}

function populateDependencyOptions() {
    if (!eventDependencySelect) return;
    const tasks = (window.TaskStore?.getAllTasks?.() || window.DataManager?.getTasks?.() || []).map(wrapTask);
    const current = eventDependencySelect.value;
    eventDependencySelect.innerHTML = '<option value="">—</option>';
    tasks.forEach(task => {
        const opt = document.createElement('option');
        opt.value = task.hash || task.id;
        opt.textContent = task.name || task.text;
        if (task.completed || opt.value === editingTaskId || opt.value === (pendingExternalTask?.id || '')) return;
        eventDependencySelect.appendChild(opt);
    });
    if (current) eventDependencySelect.value = current;
}

function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Speech recognition not supported in this browser.');
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        await handleVoiceCommand(transcript);
    };
    recognition.onerror = (e) => console.error('Speech recognition error:', e.error);
    recognition.start();
}

async function handleVoiceCommand(text) {
    // Works offline via the heuristic parser; upgrades to the configured AI provider automatically.
    if (!window.TaskParser) {
        console.warn('TaskParser not available');
        return;
    }
    const parsed = await window.TaskParser.parseSmart(text);
    if (!parsed || !parsed.name) {
        alert('Could not understand that. Try e.g. "Team meeting tomorrow at 10am for 45 minutes".');
        return;
    }
    const plannerDate = parsed.plannerDate || null;
    window.DataManager.addTask({
        text: parsed.name,
        plannerDate,
        deadline: parsed.deadline || null,
        duration: parsed.durationMinutes || getDefaultDurationMinutes(),
        importance: parsed.importance || undefined,
        originalTool: 'planner'
    });
    renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
}

// When [start, start+duration) collides with a routine, a calendar event or
// another pinned task on the planner's day: { message, free }; else null.
function findConflict(newStartMinutes, newDurationMinutes, ignoreId) {
    const scheduler = window.UnifiedScheduler;
    if (!scheduler?.findConflicts) return null;
    const dateStr = localDateString(currentDate);
    const ignore = ignoreId ? [ignoreId] : [];
    const clashes = scheduler.findConflicts({ dateStr, startMinutes: newStartMinutes, durationMinutes: newDurationMinutes, ignore });
    if (!clashes.length) return null;
    const names = clashes.map(c => `“${c.name}” (${minutesToTime(c.start)}–${minutesToTime(c.end)})`).join(', ');
    const free = scheduler.findNextFreeSlot({ dateStr, fromMinutes: newStartMinutes, durationMinutes: newDurationMinutes, ignore });
    const hint = Number.isFinite(free) ? ` ${tr('conflict.nextFree', { time: minutesToTime(free) })}` : '';
    return { message: `${tr('conflict.taken', { names })}${hint}`, free };
}

function describeConflict(newStartMinutes, newDurationMinutes, ignoreId) {
    return findConflict(newStartMinutes, newDurationMinutes, ignoreId)?.message || null;
}

function startResize(e, task, eventDiv) {
    e.preventDefault();
    const startY = e.clientY;
    const startDuration = task.duration || getDefaultDurationMinutes();
    const minuteHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;
    const minutesFor = ev => Math.max(5, startDuration + Math.round((ev.clientY - startY) / minuteHeight / 5) * 5);
    function onMove(ev) {
        eventDiv.style.height = `calc(${minutesFor(ev)} * var(--minute-height))`;
    }
    function onUp(ev) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const minutes = minutesFor(ev);
        const startMins = parseTimeToMinutes(task.plannerDate.slice(11, 16));
        const conflict = startMins !== null ? describeConflict(startMins, minutes, task.hash || task.id) : null;
        if (conflict) {
            alert(conflict);
            eventDiv.style.height = `calc(${startDuration} * var(--minute-height))`;
            return;
        }
        updateTaskInStore(task.hash || task.id, { duration: minutes, durationMinutes: minutes });
        window.EventBus?.dispatchEvent(new Event('dataChanged'));
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

// Zoom = pixels per minute (--minute-height). Pinch on phones, trackpad pinch
// or Ctrl+scroll on desktop. Remembered between visits.
const ZOOM_KEY = 'adhd-planner-zoom';
const ZOOM_MIN = 0.5;   // 30 px per hour: most of a day on one phone screen
const ZOOM_MAX = 5;     // 300 px per hour
let relabelFrame = null;

function readZoom() {
    const saved = parseFloat(localStorage.getItem(ZOOM_KEY));
    return Number.isFinite(saved) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, saved)) : 2;
}

function applyZoom(minuteHeight = readZoom()) {
    document.documentElement.style.setProperty('--minute-height', `${minuteHeight}px`);
}

// Change the zoom and keep `anchorMinute` under the same screen point (offsetPx from the list top).
function setZoom(minuteHeight, anchorMinute, offsetPx) {
    const mh = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, minuteHeight));
    applyZoom(mh);
    const { startMinutes } = getDayBounds();
    timeBlocksContainer.scrollTop = timelineOffset() + (anchorMinute - startMinutes) * mh - offsetPx;
    try { localStorage.setItem(ZOOM_KEY, String(Math.round(mh * 100) / 100)); } catch { /* storage full */ }
    if (!relabelFrame) {
        relabelFrame = requestAnimationFrame(() => { relabelFrame = null; relabelTimeline(); });
    }
}

// Minute of the day at a screen Y (the timeline element knows its own position).
function minuteAtClientY(clientY) {
    const timeline = timeBlocksContainer.querySelector('.timeline');
    const top = timeline ? timeline.getBoundingClientRect().top : timeBlocksContainer.getBoundingClientRect().top;
    return getDayBounds().startMinutes + (clientY - top) / getMinuteHeight();
}

// Top margin of the timeline inside the scrolling list.
function timelineOffset() {
    return timeBlocksContainer.querySelector('.timeline')?.offsetTop || 0;
}

function setupZoomGestures() {
    let pinch = null;
    const distance = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const middleY = t => (t[0].clientY + t[1].clientY) / 2;
    timeBlocksContainer.addEventListener('touchstart', e => {
        if (e.touches.length !== 2) return;
        const y = middleY(e.touches);
        pinch = { d0: distance(e.touches), mh0: getMinuteHeight(), minute: minuteAtClientY(y) };
    }, { passive: true });
    timeBlocksContainer.addEventListener('touchmove', e => {
        if (!pinch || e.touches.length !== 2) return;
        e.preventDefault(); // our zoom, not the page zoom
        const y = middleY(e.touches);
        const rect = timeBlocksContainer.getBoundingClientRect();
        setZoom(pinch.mh0 * distance(e.touches) / pinch.d0, pinch.minute, y - rect.top);
    }, { passive: false });
    const endPinch = e => { if (e.touches.length < 2) pinch = null; };
    timeBlocksContainer.addEventListener('touchend', endPinch);
    timeBlocksContainer.addEventListener('touchcancel', endPinch);

    // Trackpad pinch arrives as wheel events with ctrlKey.
    timeBlocksContainer.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const rect = timeBlocksContainer.getBoundingClientRect();
        // Small steps for trackpads, capped for mouse wheels (one notch ≈ 18 %).
        const delta = Math.max(-50, Math.min(50, e.deltaY));
        setZoom(getMinuteHeight() * Math.exp(-delta * 0.004), minuteAtClientY(e.clientY), e.clientY - rect.top);
    }, { passive: false });
}

function scrollToCurrent() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const { startMinutes, endMinutes } = getDayBounds();
    const containerHeight = timeBlocksContainer.clientHeight;
    // Hidden planner (other tool open): try again when it is shown.
    if (!containerHeight) return;
    // Put "now" about a quarter down the view, whatever the zoom.
    const boundedMinutes = Math.min(Math.max(currentMinutes, startMinutes), endMinutes);
    const target = timelineOffset() + (boundedMinutes - startMinutes) * getMinuteHeight() - containerHeight * 0.25;
    timeBlocksContainer.scrollTo({
        top: Math.max(0, Math.min(timeBlocksContainer.scrollHeight - containerHeight, target)),
        behavior: 'instant',
    });
}

async function autoPlanDay() {
    try {
        aiPlanBtn.disabled = true;
        const result = await planDayWithAI(currentDate, {
            tr,
            dayBounds: getDayBounds(),
            defaultDurationMinutes: getDefaultDurationMinutes(),
        });
        if (!result.ok) {
            window.DataManager?.showNotification?.(result.message, 'error');
            return;
        }
        const parts = [result.message];
        if (result.moved) parts.push(tr('plan.aiMoved', { n: result.moved }));
        if (result.dropped) parts.push(tr('plan.aiDroppedCount', { n: result.dropped }));
        window.DataManager?.showNotification?.(parts.join(' '), result.dropped ? 'warning' : 'success');
        renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
    } finally {
        aiPlanBtn.disabled = false;
    }
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function handleReceivedTaskForDayPlanner(event) {
    const task = event.detail;
    if (!task || !task.text) {
        console.warn('Day Planner received invalid task:', task);
        return;
    }
    const timeStr = getDefaultTime();
    openModal(null, timeStr, task);
}

function initDayPlanner() {
    const container = document.querySelector('.day-planner-container');
    if (!container) return;

    dateDisplay = document.getElementById('current-date');
    timeBlocksContainer = document.getElementById('time-blocks');
    addEventBtn = document.getElementById('add-event-btn');
    clearBtn = document.getElementById('clear-events-btn');
    aiPlanBtn = document.getElementById('ai-plan-day-btn');
    recordBtn = document.getElementById('record-event-btn');
    generateScheduleBtn = document.getElementById('generate-schedule-btn');
    eventModal = document.getElementById('event-modal');
    closeButton = eventModal.querySelector('.close-button');
    eventForm = document.getElementById('event-form');
    eventTitleInput = document.getElementById('event-title');
    eventTimeSelect = document.getElementById('event-time');
    eventTaskSelect = document.getElementById('event-task');
    eventDurationInput = document.getElementById('event-duration');
    eventImportanceInput = document.getElementById('event-importance');
    eventUrgencyInput = document.getElementById('event-urgency');
    eventDeadlineInput = document.getElementById('event-deadline');
    eventDependencySelect = document.getElementById('event-dependency');
    eventLocationInput = document.getElementById('event-location');
    eventLocationSuggestions = document.getElementById('event-location-suggestions');
    eventTravelModeContainer = document.getElementById('event-travel-mode-container');
    eventTravelModeSelect = document.getElementById('event-travel-mode');
    eventModalTitle = document.getElementById('event-modal-title');

    if (!eventModal || !eventForm) {
        console.warn('Day Planner modal elements missing; skipping initialization');
        return;
    }

    if (eventLocationInput) {
        eventLocationInput.addEventListener('input', () => {
            const query = eventLocationInput.value.trim();
            if (query.length < 3) {
                eventLocationSuggestions.style.display = 'none';
                selectedLocationCoords = null;
                return;
            }
            clearTimeout(locationDebounce);
            locationDebounce = setTimeout(async () => {
                const results = await geocode(query);
                if (results && results.length > 0 && eventLocationInput.value.trim() === query) {
                    eventLocationSuggestions.innerHTML = '';
                    results.forEach(res => {
                        const li = document.createElement('li');
                        li.textContent = res.displayName;
                        li.style.padding = '8px';
                        li.style.cursor = 'pointer';
                        li.addEventListener('click', () => {
                            eventLocationInput.value = res.displayName;
                            selectedLocationCoords = res;
                            eventLocationSuggestions.style.display = 'none';
                        });
                        eventLocationSuggestions.appendChild(li);
                    });
                    eventLocationSuggestions.style.display = 'block';
                } else {
                    eventLocationSuggestions.style.display = 'none';
                }
            }, 500);
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            if (e.target !== eventLocationInput && e.target !== eventLocationSuggestions) {
                eventLocationSuggestions.style.display = 'none';
            }
        });
    }

    if (eventTravelModeSelect) {
        eventTravelModeSelect.addEventListener('change', async () => {
            if (editingTaskId) {
                const task = getTaskFromStore(editingTaskId);
                if (task && task.locationCoords && task.startLocationCoords) {
                    const route = await getRoute(task.startLocationCoords, task.locationCoords, eventTravelModeSelect.value);
                    if (route) {
                        updateTaskInStore(editingTaskId, { travelMode: route.mode, durationMinutes: route.minutes, duration: route.minutes });
                        window.EventBus?.dispatchEvent(new Event('dataChanged'));
                        window.dispatchEvent(new Event('scheduleNeedsRefresh'));
                    }
                }
            }
        });
    }

    addEventBtn.addEventListener('click', () => openModal(null, getDefaultTime()));
    if (recordBtn) {
        recordBtn.addEventListener('click', startVoiceRecognition);
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) recordBtn.disabled = true;
    }
    closeButton.addEventListener('click', closeModal);
    eventModal.querySelector('.event-cancel')?.addEventListener('click', closeModal);
    window.addEventListener('click', e => { if (e.target === eventModal) closeModal(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && eventModal.classList.contains('active')) closeModal();
    });
    eventModal.querySelectorAll('.event-chip[data-minutes]').forEach(chip => {
        chip.addEventListener('click', () => { setDuration(Number(chip.dataset.minutes)); showConflict(null); });
    });
    eventDurationInput.addEventListener('input', () => setDuration(eventDurationInput.value));
    eventTimeSelect.addEventListener('input', () => showConflict(null));
    eventModal.querySelector('#event-remove-btn')?.addEventListener('click', () => {
        if (!editingTaskId) return;
        if (window.TaskStore?.deleteTasks) window.TaskStore.deleteTasks([editingTaskId]);
        else window.DataManager?.deleteTask?.(editingTaskId);
        window.EventBus?.dispatchEvent(new Event('dataChanged'));
        closeModal();
    });

    // Tap on free space in the timeline: new event at that time (5-minute steps).
    timeBlocksContainer.addEventListener('click', e => {
        if (e.target.closest('.event') || !e.target.closest('.timeline')) return;
        const { startMinutes, endMinutes } = getDayBounds();
        let minutes = Math.round(minuteAtClientY(e.clientY) / 5) * 5;
        minutes = Math.min(Math.max(startMinutes, minutes), Math.max(startMinutes, endMinutes - 5));
        openModal(null, minutesToTime(minutes));
    });
    setupZoomGestures();

    eventTaskSelect.addEventListener('change', () => {
        const id = eventTaskSelect.value;
        if (id) {
            const task = getTaskFromStore(id);
            eventTitleInput.value = task?.name || task?.text || '';
            eventTitleInput.disabled = true;
            setDuration(task?.durationMinutes || task?.duration || getDefaultDurationMinutes());
        } else {
            eventTitleInput.disabled = false;
            eventTitleInput.value = '';
        }
    });

    eventForm.addEventListener('submit', e => {
        e.preventDefault();
        const time = eventTimeSelect.value;
        if (!eventTitleInput.value.trim() && !eventTaskSelect.value) {
            eventTitleInput.focus();
            eventTitleInput.classList.add('invalid');
            setTimeout(() => eventTitleInput.classList.remove('invalid'), 1200);
            return;
        }
        if (!/^\d{2}:\d{2}$/.test(time)) {
            eventTimeSelect.focus();
            return;
        }
        const duration = parseInt(eventDurationInput.value, 10) || getDefaultDurationMinutes();
        const plannerDateTime = `${localDateString(currentDate)}T${time}`;
        const importance = parseInt(eventImportanceInput.value, 10) || 5;
        const urgency = parseInt(eventUrgencyInput.value, 10) || 5;
        const deadlineVal = eventDeadlineInput.value ? new Date(eventDeadlineInput.value) : null;
        const deadline = deadlineVal ? new Date(deadlineVal.getTime() - (deadlineVal.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : null;
        const dependency = eventDependencySelect?.value || null;
        const locationStr = eventLocationInput ? eventLocationInput.value.trim() : '';

        const startMins = parseTimeToMinutes(time);
        const taskIdToIgnore = editingTaskId || (pendingExternalTask ? pendingExternalTask.id : (eventTaskSelect.value || null));
        const conflict = startMins !== null ? findConflict(startMins, duration, taskIdToIgnore) : null;
        if (conflict) {
            showConflict(conflict.message, conflict.free);
            return;
        }

        let savedTask = null;
        if (editingTaskId) {
            const title = eventTitleInput.value.trim();
            savedTask = updateTaskInStore(editingTaskId, { name: title, text: title, plannerDate: plannerDateTime, deadline, durationMinutes: duration, duration, importance, urgency, dependency, location: locationStr, locationCoords: selectedLocationCoords });
        } else if (pendingExternalTask) {
            const title = eventTitleInput.value.trim() || pendingExternalTask.text;
            savedTask = addTaskToStore(createTask({
                name: title,
                text: title,
                originalTool: pendingExternalTask.originalTool || 'TaskManager',
                priority: pendingExternalTask.priority || 'medium',
                importance: pendingExternalTask.importance ?? importance,
                urgency: pendingExternalTask.urgency ?? urgency,
                category: pendingExternalTask.category || 'other',
                plannerDate: plannerDateTime,
                deadline,
                durationMinutes: duration,
                duration,
                dependency,
                location: locationStr,
                locationCoords: selectedLocationCoords,
                isFixed: true,
            }));
        } else {
            const selectedTaskId = eventTaskSelect.value;
            if (selectedTaskId) {
                savedTask = updateTaskInStore(selectedTaskId, { plannerDate: plannerDateTime, deadline, durationMinutes: duration, duration, isFixed: true, importance, urgency, dependency, location: locationStr, locationCoords: selectedLocationCoords });
            } else {
                const title = eventTitleInput.value.trim();
                if (!title) return;
                savedTask = addTaskToStore(createTask({
                    name: title,
                    text: title,
                    originalTool: 'DayPlanner',
                    plannerDate: plannerDateTime,
                    deadline,
                    durationMinutes: duration,
                    duration,
                    isFixed: true,
                    dependency,
                    importance,
                    urgency,
                    location: locationStr,
                    locationCoords: selectedLocationCoords,
                }));
            }
        }

        // Auto-compute travel time if necessary
        if (savedTask && savedTask.locationCoords) {
            const scheduler = window.UnifiedScheduler;
            if (scheduler) {
                const blocks = scheduler.getBusyBlocks(localDateString(currentDate));
                const precedingBlocks = blocks.filter(b => b.end <= startMins && b.id !== savedTask.id);
                if (precedingBlocks.length > 0) {
                    const prevBlock = precedingBlocks[precedingBlocks.length - 1];
                    let prevCoords = null;
                    if (prevBlock.kind === 'task' || prevBlock.kind === 'event') {
                        const t = getTaskFromStore(prevBlock.id);
                        if (t && t.locationCoords) prevCoords = t.locationCoords;
                    }
                    if (prevCoords && (prevCoords.lat !== savedTask.locationCoords.lat || prevCoords.lon !== savedTask.locationCoords.lon)) {
                        getRoute(prevCoords, savedTask.locationCoords).then(route => {
                            if (!route) return;
                            const travelStartMins = startMins - route.minutes;
                            const dateStr = localDateString(currentDate);
                            const place = String(savedTask.location || '').split(',')[0].trim();
                            // The travel block obeys the same rule as everything else: never double-book.
                            const clashes = travelStartMins < 0 ? [{}] : scheduler.findConflicts({
                                dateStr, startMinutes: travelStartMins, durationMinutes: route.minutes, ignore: [savedTask.hash],
                            });
                            if (clashes.length) {
                                window.DataManager?.showNotification?.(tr('event.travelNoRoom', { min: route.minutes, place }), 'error');
                                return;
                            }
                            addTaskToStore(createTask({
                                name: tr('event.travelTo', { place }),
                                text: tr('event.travelTo', { place }),
                                plannerDate: `${dateStr}T${minutesToTime(travelStartMins)}`,
                                durationMinutes: route.minutes,
                                duration: route.minutes,
                                deadline: null,
                                isFixed: true,
                                originalTool: 'DayPlanner',
                                travelMode: route.mode,
                                startLocationCoords: prevCoords,
                                locationCoords: savedTask.locationCoords,
                            }));
                            window.EventBus?.dispatchEvent(new Event('dataChanged'));
                            window.dispatchEvent(new Event('scheduleNeedsRefresh'));
                        });
                    }
                }
            }
        }

        window.EventBus?.dispatchEvent(new Event('dataChanged'));
        closeModal();
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!confirm('Clear all events for this day? This will unschedule them from the planner.')) return;
            const plannerDateStr = localDateString(currentDate);
            const todaysTasks = (window.TaskStore?.getAllTasks ? window.TaskStore.getAllTasks() : window.DataManager.getTasks())
                .map(wrapTask)
                .filter(task => task.plannerDate && task.plannerDate.startsWith(plannerDateStr));
            todaysTasks.forEach(task => {
                updateTaskInStore(task.hash || task.id, { plannerDate: null, deadline: task.deadline && !task.deadline.startsWith(plannerDateStr) ? task.deadline : null, isFixed: false });
            });
        });
    }

    if (generateScheduleBtn) {
        generateScheduleBtn.addEventListener('click', () => {
            const scheduler = window.UnifiedScheduler || window.TaskScheduler;
            if (!scheduler?.getTodaySchedule) {
                alert('Scheduler not available yet.');
                return;
            }
            const schedule = scheduler.getTodaySchedule(new Date());
            const todayStr = localDateString(currentDate);
            const cfg = window.ConfigManager?.getConfig?.() || {};
            const fixedTag = cfg.fixedTag || '[FIX]';
            const flexTag = cfg.flexibleTag || '[FLEX]';
            schedule.forEach(slot => {
                // Routine blocks and calendar events already own their time.
                if (slot.task.source === 'routine' || slot.task.source === 'calendar') return;
                const startMinutes = slot.scheduledStart ?? slot.startMinutes;
                const hours = String(Math.floor(startMinutes / 60)).padStart(2, '0');
                const minutes = String(startMinutes % 60).padStart(2, '0');
                const plannerDate = `${todayStr}T${hours}:${minutes}`;
                const duration = Math.max(5, (slot.scheduledEnd ?? slot.endMinutes) - (slot.scheduledStart ?? slot.startMinutes));
                const deadline = slot.task.deadline || null;
                const name = slot.task.name || slot.task.text || 'Task';
                const isFlexTagged = name.includes(flexTag);
                const isFixed = isFlexTagged ? false : (slot.task.isFixed || name.includes(fixedTag));
                if (slot.task.hash) {
                    updateTaskInStore(slot.task.hash, { plannerDate, deadline, durationMinutes: duration, duration, isFixed, autoPinned: false });
                } else {
                    addTaskToStore({
                        name,
                        text: name,
                        plannerDate,
                        deadline,
                        duration,
                        durationMinutes: duration,
                        isFixed,
                        importance: slot.task.importance ?? 5,
                        urgency: slot.task.urgency ?? 5,
                        originalTool: slot.task.source || 'scheduler',
                    });
                }
            });
            window.EventBus?.dispatchEvent(new Event('dataChanged'));
            renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
        });
    }

    if (aiPlanBtn) {
        aiPlanBtn.addEventListener('click', autoPlanDay);
    }

    applyZoom();

    window.EventBus.addEventListener('dataChanged', () => {
        const prev = timeBlocksContainer.scrollTop;
        renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
        timeBlocksContainer.scrollTop = prev;
    });

    window.EventBus.addEventListener('calendarEventsUpdated', () => {
        const prev = timeBlocksContainer.scrollTop;
        renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
        timeBlocksContainer.scrollTop = prev;
    });

    window.EventBus.addEventListener('ef-receiveTaskFor-DayPlanner', handleReceivedTaskForDayPlanner);

    const rerender = () => {
        const prev = timeBlocksContainer.scrollTop;
        renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
        timeBlocksContainer.scrollTop = prev;
    };
    window.addEventListener('scheduleNeedsRefresh', rerender);
    window.addEventListener('routinesChanged', rerender);
    window.addEventListener('configUpdated', rerender);
    window.addEventListener('languageChanged', rerender);
    setInterval(rerender, 60000);

    renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
    scrollToCurrent();
    window.DayPlanner = { scrollToCurrent, rerender };
    window.addEventListener('toolChanged', (e) => {
        if (e.detail?.tool === 'planner') requestAnimationFrame(scrollToCurrent);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.dayPlannerInited) return;
    window.dayPlannerInited = true;
    initDayPlanner();
});
