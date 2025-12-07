import { renderDayPlanner } from './renderDay.js';
import { populateTimeOptions, populateTaskOptions, getDefaultTime, getCalendarEvents, getDayBounds, getDefaultDurationMinutes } from './dayPlannerUtils.js';
import { createTask } from './core/task-model.js';

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
    aiPlanBtn,
    fillDayBtn,
    recordBtn,
    eventModal,
    closeButton,
    eventForm,
    eventTitleInput,
    eventTimeSelect,
    eventTaskSelect,
    eventDurationInput,
    eventModalTitle;

function openModal(task, presetTime, externalTask) {
    eventModal.style.display = 'block';
    populateTimeOptions(eventTimeSelect);
    populateTaskOptions(eventTaskSelect);
    pendingExternalTask = null;
    if (task) {
        editingTaskId = task.id;
        eventModalTitle.textContent = 'Edit Event';
        eventTitleInput.value = task.text;
        eventTimeSelect.value = task.plannerDate.slice(11, 16);
        eventDurationInput.value = task.duration || getDefaultDurationMinutes();
        eventTitleInput.disabled = false;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = true;
    } else if (externalTask) {
        editingTaskId = null;
        pendingExternalTask = externalTask;
        eventModalTitle.textContent = 'Schedule Task';
        eventTitleInput.value = externalTask.text || '';
        eventTimeSelect.value = presetTime || getDefaultTime();
        eventDurationInput.value = externalTask.duration || getDefaultDurationMinutes();
        eventTitleInput.disabled = true;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = true;
    } else {
        editingTaskId = null;
        eventModalTitle.textContent = 'Add Event';
        eventTitleInput.value = '';
        eventTimeSelect.value = presetTime || getDefaultTime();
        eventDurationInput.value = getDefaultDurationMinutes();
        eventTitleInput.disabled = false;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = false;
    }
}

function closeModal() {
    eventModal.style.display = 'none';
    if (eventForm) eventForm.reset();
    editingTaskId = null;
    pendingExternalTask = null;
    eventTitleInput.disabled = false;
    if (eventTaskSelect) eventTaskSelect.disabled = false;
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
    if (!window.callGemini) {
        console.warn('Gemini API not available');
        return;
    }
    const todayStr = currentDate.toISOString().slice(0, 10);
    const prompt = `Today is ${todayStr}. From the following text: "${text}", extract the event title, date, start time, and duration in minutes. Return JSON with keys: title, date (YYYY-MM-DD), time (HH:MM), duration.`;
    const response = await window.callGemini(prompt);
    if (!response) return;
    let parsed;
    try {
        parsed = JSON.parse(response);
    } catch (err) {
        console.error('Failed to parse Gemini response:', response);
        return;
    }
    if (!parsed.title || !parsed.time) return;
    const datePart = parsed.date || todayStr;
    const plannerDate = `${datePart}T${parsed.time}`;
    window.DataManager.addTask({
        text: parsed.title,
        plannerDate,
        duration: Number(parsed.duration) || getDefaultDurationMinutes(),
        originalTool: 'planner'
    });
    renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
}

function startResize(e, task, eventDiv) {
    e.preventDefault();
    const startY = e.clientY;
    const startDuration = task.duration || getDefaultDurationMinutes();
    const minuteHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;
    function onMove(ev) {
        const diff = ev.clientY - startY;
        const minutes = Math.max(5, startDuration + Math.round(diff / minuteHeight / 5) * 5);
        eventDiv.style.height = `calc(${minutes} * var(--minute-height))`;
    }
    function onUp(ev) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const diff = ev.clientY - startY;
        const minutes = Math.max(5, startDuration + Math.round(diff / minuteHeight / 5) * 5);
        window.DataManager.updateTask(task.id, { duration: minutes });
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

let zoomLevel = 1;
function applyZoom() {
    document.documentElement.style.setProperty('--minute-height', `${2 * zoomLevel}px`);
}

function scrollToCurrent() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const { startMinutes, endMinutes } = getDayBounds();
    const minuteHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;

    // Center current time in viewport by subtracting half the container height
    const containerHeight = timeBlocksContainer.clientHeight;
    const boundedMinutes = Math.min(Math.max(currentMinutes, startMinutes), endMinutes);
    const scrollPosition = ((boundedMinutes - startMinutes) * minuteHeight) - (containerHeight / 2);

    timeBlocksContainer.scrollTop = Math.max(0, Math.min(timeBlocksContainer.scrollHeight - containerHeight, scrollPosition));
}

function getBreakdownTasks() {
    const tree = JSON.parse(localStorage.getItem('adhd-breakdown-tasks')) || [];
    const tasks = [];
    function traverse(nodes) {
        nodes.forEach(n => {
            if (n.completed) return;
            if (n.subtasks && n.subtasks.length) {
                traverse(n.subtasks);
            } else if (n.text) {
                tasks.push(n.text);
            }
        });
    }
    traverse(tree);
    return tasks;
}

function getEisenhowerTasks() {
    const data = JSON.parse(localStorage.getItem('eisenhowerTasks')) || { q1: [], q2: [], q3: [], q4: [] };
    const tasks = [];
    ['q1', 'q2'].forEach(q => {
        (data[q] || []).forEach(t => {
            if (!t.completed && t.text) tasks.push(t.text);
        });
    });
    return tasks;
}

async function autoPlanDay() {
    try {
        aiPlanBtn.disabled = true;
        const breakdownTasks = getBreakdownTasks();
        const eisenhowerTasks = getEisenhowerTasks();
        const tasks = [...breakdownTasks, ...eisenhowerTasks];
        if (tasks.length === 0) {
            alert('No tasks found in Breakdown or Eisenhower tools.');
            return;
        }
        const events = getCalendarEvents(currentDate);
        events.forEach(ev => {
            const plannerDateTime = `${currentDate.toISOString().slice(0, 10)}T${ev.start}`;
            const existing = window.DataManager.getTasks().map(wrapTask).find(t => t.plannerDate === plannerDateTime && t.text === ev.title);
            if (!existing) {
                const startMins = parseInt(ev.start.slice(0, 2)) * 60 + parseInt(ev.start.slice(3, 5));
                const endMins = ev.end ? parseInt(ev.end.slice(0, 2)) * 60 + parseInt(ev.end.slice(3, 5)) : startMins + 60;
                window.DataManager.addTask({
                    text: ev.title,
                    plannerDate: plannerDateTime,
                    duration: Math.max(5, endMins - startMins),
                    originalTool: 'Calendar'
                });
            }
        });
        let prompt = `Today is ${currentDate.toDateString()}.`;
        if (events.length) {
            prompt += `\nExisting events:`;
            events.forEach(ev => {
                prompt += `\n- ${ev.start}${ev.end ? '-' + ev.end : ''} ${ev.title}`;
            });
        } else {
            prompt += `\nNo existing events.`;
        }
        prompt += `\nTasks to schedule:`;
        tasks.forEach(t => { prompt += `\n- ${t}`; });
        prompt += `\nReturn a JSON array of objects with time (HH:MM 24h), text, and duration in minutes.`;

        const aiText = await window.callGemini(prompt);
        if (!aiText) {
            alert('Gemini did not return a plan.');
            return;
        }
        let jsonText = aiText;
        const match = aiText.match(/```(?:json)?([\s\S]*?)```/);
        if (match) jsonText = match[1];
        let plan;
        try {
            plan = JSON.parse(jsonText);
        } catch (err) {
            alert('Failed to parse Gemini response.');
            return;
        }
        if (!Array.isArray(plan)) {
            alert('Gemini response was not an array.');
            return;
        }
        plan.forEach(item => {
            if (!item.time || !item.text) return;
            const duration = parseInt(item.duration, 10) || getDefaultDurationMinutes();
            const plannerDateTime = `${currentDate.toISOString().slice(0, 10)}T${item.time}`;
            window.DataManager.addTask({
                text: item.text,
                plannerDate: plannerDateTime,
                duration,
                originalTool: 'Gemini'
            });
        });
        alert('Day planned with Gemini.');
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

function fillDayFromCalendarAndTasks() {
    if (!window.DataManager) return;
    const defaultDuration = getDefaultDurationMinutes();
    const { startMinutes, endMinutes } = getDayBounds();
    const dayStr = currentDate.toISOString().slice(0, 10);

    const busyBlocks = getCalendarEvents(currentDate)
        .map(ev => {
            const start = parseTimeToMinutes(ev.start);
            let end = parseTimeToMinutes(ev.end);
            if (start === null) return null;
            if (end === null) end = start + defaultDuration;
            return {
                start: Math.max(startMinutes, start),
                end: Math.min(endMinutes, end),
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

    const tasks = window.DataManager.getTasks()
        .filter(t => !t.plannerDate && !t.isCompleted)
        .sort((a, b) => {
            const impA = Number.isFinite(a.importance) ? a.importance : 5;
            const impB = Number.isFinite(b.importance) ? b.importance : 5;
            const urgA = Number.isFinite(a.urgency) ? a.urgency : 5;
            const urgB = Number.isFinite(b.urgency) ? b.urgency : 5;
            const bucket = (imp, urg) => (imp >= 7 && urg >= 7 ? 3 : imp >= 7 ? 2 : urg >= 7 ? 1 : 0);
            const bucketDiff = bucket(impB, urgB) - bucket(impA, urgA);
            if (bucketDiff !== 0) return bucketDiff;
            return (impB + urgB) - (impA + urgA);
        });

    const gaps = [];
    let cursor = startMinutes;
    busyBlocks.forEach(block => {
        if (block.start > cursor) {
            gaps.push({ start: cursor, end: block.start });
        }
        cursor = Math.max(cursor, block.end);
    });
    if (cursor < endMinutes) {
        gaps.push({ start: cursor, end: endMinutes });
    }

    const unscheduled = [...tasks];
    gaps.forEach(gap => {
        let pointer = gap.start;
        let idx = 0;
        while (idx < unscheduled.length) {
            const task = unscheduled[idx];
            const duration = task.duration || task.durationMinutes || task.estimatedMinutes || defaultDuration;
            if (pointer + duration <= gap.end) {
                const timeStr = minutesToTime(pointer);
                window.DataManager.updateTask(task.id, {
                    plannerDate: `${dayStr}T${timeStr}`,
                    duration,
                });
                unscheduled.splice(idx, 1);
                pointer += duration;
            } else {
                idx++;
            }
        }
    });

    renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
    alert('Day filled from calendar events and prioritized tasks.');
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
    fillDayBtn = document.getElementById('fill-day-tasks-btn');
    recordBtn = document.getElementById('record-event-btn');
    eventModal = document.getElementById('event-modal');
    closeButton = eventModal.querySelector('.close-button');
    eventForm = document.getElementById('event-form');
    eventTitleInput = document.getElementById('event-title');
    eventTimeSelect = document.getElementById('event-time');
    eventTaskSelect = document.getElementById('event-task');
    eventDurationInput = document.getElementById('event-duration');
    eventModalTitle = document.getElementById('event-modal-title');

    addEventBtn.addEventListener('click', () => openModal(null, getDefaultTime()));
    if (recordBtn) {
        recordBtn.addEventListener('click', startVoiceRecognition);
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) recordBtn.disabled = true;
    }
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', e => { if (e.target === eventModal) closeModal(); });

    timeBlocksContainer.addEventListener('click', e => {
        if (e.target.closest('.event')) return;
        const cls = e.target.classList;
        if (!(e.target === timeBlocksContainer || cls.contains('time-block') || cls.contains('event-content'))) return;
        const rect = timeBlocksContainer.getBoundingClientRect();
        const minuteHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;
        const { startMinutes, endMinutes } = getDayBounds();
        const y = e.clientY - rect.top + timeBlocksContainer.scrollTop;
        let minutes = Math.round(y / minuteHeight / 5) * 5 + startMinutes;
        minutes = Math.min(Math.max(startMinutes, minutes), Math.max(startMinutes, endMinutes - 5));
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        openModal(null, timeStr);
    });

    eventTaskSelect.addEventListener('change', () => {
        const id = eventTaskSelect.value;
        if (id) {
            const task = getTaskFromStore(id);
            eventTitleInput.value = task?.name || task?.text || '';
            eventTitleInput.disabled = true;
            eventDurationInput.value = task?.durationMinutes || task?.duration || getDefaultDurationMinutes();
        } else {
            eventTitleInput.disabled = false;
            eventTitleInput.value = '';
        }
    });

    eventForm.addEventListener('submit', e => {
        e.preventDefault();
        const time = eventTimeSelect.value;
        const duration = parseInt(eventDurationInput.value, 10) || getDefaultDurationMinutes();
        const plannerDateTime = `${currentDate.toISOString().slice(0, 10)}T${time}`;

        if (editingTaskId) {
            const title = eventTitleInput.value.trim();
            updateTaskInStore(editingTaskId, { name: title, text: title, plannerDate: plannerDateTime, deadline: plannerDateTime, durationMinutes: duration, duration });
        } else if (pendingExternalTask) {
            const title = eventTitleInput.value.trim() || pendingExternalTask.text;
            addTaskToStore({
                name: title,
                text: title,
                originalTool: pendingExternalTask.originalTool || 'TaskManager',
                priority: pendingExternalTask.priority || 'medium',
                importance: pendingExternalTask.importance,
                urgency: pendingExternalTask.urgency,
                category: pendingExternalTask.category || 'other',
                plannerDate: plannerDateTime,
                deadline: plannerDateTime,
                durationMinutes: duration,
                duration,
                isFixed: true,
            });
        } else {
            const selectedTaskId = eventTaskSelect.value;
            if (selectedTaskId) {
                updateTaskInStore(selectedTaskId, { plannerDate: plannerDateTime, deadline: plannerDateTime, durationMinutes: duration, duration, isFixed: true });
            } else {
                const title = eventTitleInput.value.trim();
                if (!title) return;
                addTaskToStore({
                    name: title,
                    text: title,
                    originalTool: 'DayPlanner',
                    plannerDate: plannerDateTime,
                    deadline: plannerDateTime,
                    durationMinutes: duration,
                    duration,
                    isFixed: true,
                });
            }
        }

        closeModal();
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!confirm('Clear all events for this day? This will unschedule them from the planner.')) return;
            const plannerDateStr = currentDate.toISOString().slice(0, 10);
            const todaysTasks = (window.TaskStore?.getAllTasks ? window.TaskStore.getAllTasks() : window.DataManager.getTasks())
                .map(wrapTask)
                .filter(task => task.plannerDate && task.plannerDate.startsWith(plannerDateStr));
            todaysTasks.forEach(task => {
                updateTaskInStore(task.hash || task.id, { plannerDate: null, deadline: task.deadline && !task.deadline.startsWith(plannerDateStr) ? task.deadline : null, isFixed: false });
            });
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
        updateSlider();
    });

    window.EventBus.addEventListener('calendarEventsUpdated', () => {
        const prev = timeBlocksContainer.scrollTop;
        renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
        timeBlocksContainer.scrollTop = prev;
    });

    window.EventBus.addEventListener('ef-receiveTaskFor-DayPlanner', handleReceivedTaskForDayPlanner);

    renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
    scrollToCurrent();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.dayPlannerInited) return;
    window.dayPlannerInited = true;
    initDayPlanner();
});
