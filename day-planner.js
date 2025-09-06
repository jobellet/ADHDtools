import { renderDayPlanner } from './renderDay.js';
import { populateTimeOptions, populateTaskOptions, getDefaultTime, getCalendarEvents } from './dayPlannerUtils.js';

let editingTaskId = null;
let pendingExternalTask = null;
let currentDate = new Date();

let dateDisplay,
    timeBlocksContainer,
    addEventBtn,
    clearBtn,
    aiPlanBtn,
    recordBtn,
    eventModal,
    closeButton,
    eventForm,
    eventTitleInput,
    eventTimeSelect,
    eventTaskSelect,
    eventDurationInput,
    eventModalTitle,
    scrollSlider;

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
        eventDurationInput.value = task.duration || 60;
        eventTitleInput.disabled = false;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = true;
    } else if (externalTask) {
        editingTaskId = null;
        pendingExternalTask = externalTask;
        eventModalTitle.textContent = 'Schedule Task';
        eventTitleInput.value = externalTask.text || '';
        eventTimeSelect.value = presetTime || getDefaultTime();
        eventDurationInput.value = externalTask.duration || 60;
        eventTitleInput.disabled = true;
        eventTaskSelect.value = '';
        eventTaskSelect.disabled = true;
    } else {
        editingTaskId = null;
        eventModalTitle.textContent = 'Add Event';
        eventTitleInput.value = '';
        eventTimeSelect.value = presetTime || getDefaultTime();
        eventDurationInput.value = 60;
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
        duration: Number(parsed.duration) || 60,
        originalTool: 'planner'
    });
    renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
}

function startResize(e, task, eventDiv) {
    e.preventDefault();
    const startY = e.clientY;
    const startDuration = task.duration || 60;
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

function updateSlider() {
    if (!scrollSlider) return;
    scrollSlider.max = Math.max(0, timeBlocksContainer.scrollHeight - timeBlocksContainer.clientHeight);
    scrollSlider.value = timeBlocksContainer.scrollTop;
    scrollSlider.style.height = `${timeBlocksContainer.clientHeight}px`;
    scrollSlider.style.top = `${timeBlocksContainer.offsetTop}px`;
}

let zoomLevel = 1;
function applyZoom() {
    document.documentElement.style.setProperty('--minute-height', `${2 * zoomLevel}px`);
    updateSlider();
}

function scrollToCurrent() {
    const now = new Date();
    const hoursFromStart = now.getHours();
    const minuteHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;
    timeBlocksContainer.scrollTop = hoursFromStart * 60 * minuteHeight;
    updateSlider();
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
            const plannerDateTime = `${currentDate.toISOString().slice(0,10)}T${ev.start}`;
            const existing = window.DataManager.getTasks().find(t => t.plannerDate === plannerDateTime && t.text === ev.title);
            if (!existing) {
                const startMins = parseInt(ev.start.slice(0,2)) * 60 + parseInt(ev.start.slice(3,5));
                const endMins = ev.end ? parseInt(ev.end.slice(0,2)) * 60 + parseInt(ev.end.slice(3,5)) : startMins + 60;
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
            const duration = parseInt(item.duration, 10) || 60;
            const plannerDateTime = `${currentDate.toISOString().slice(0,10)}T${item.time}`;
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
    eventModal = document.getElementById('event-modal');
    closeButton = eventModal.querySelector('.close-button');
    eventForm = document.getElementById('event-form');
    eventTitleInput = document.getElementById('event-title');
    eventTimeSelect = document.getElementById('event-time');
    eventTaskSelect = document.getElementById('event-task');
    eventDurationInput = document.getElementById('event-duration');
    eventModalTitle = document.getElementById('event-modal-title');
    scrollSlider = document.getElementById('time-scroll-slider');

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
        const y = e.clientY - rect.top + timeBlocksContainer.scrollTop;
        let minutes = Math.round(y / minuteHeight / 5) * 5;
        minutes = Math.min(1435, Math.max(0, minutes));
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        openModal(null, timeStr);
    });

    if (scrollSlider) {
        scrollSlider.addEventListener('input', () => {
            timeBlocksContainer.scrollTop = scrollSlider.value;
        });
        timeBlocksContainer.addEventListener('scroll', () => {
            scrollSlider.value = timeBlocksContainer.scrollTop;
        });
    }

    eventTaskSelect.addEventListener('change', () => {
        const id = eventTaskSelect.value;
        if (id) {
            const task = window.DataManager.getTask(id);
            eventTitleInput.value = task.text;
            eventTitleInput.disabled = true;
            eventDurationInput.value = task.duration || 60;
        } else {
            eventTitleInput.disabled = false;
            eventTitleInput.value = '';
        }
    });

    eventForm.addEventListener('submit', e => {
        e.preventDefault();
        const time = eventTimeSelect.value;
        const duration = parseInt(eventDurationInput.value, 10) || 60;
        const plannerDateTime = `${currentDate.toISOString().slice(0, 10)}T${time}`;

        if (editingTaskId) {
            const title = eventTitleInput.value.trim();
            window.DataManager.updateTask(editingTaskId, { text: title, plannerDate: plannerDateTime, duration });
        } else if (pendingExternalTask) {
            const title = eventTitleInput.value.trim() || pendingExternalTask.text;
            window.DataManager.addTask({
                text: title,
                originalTool: pendingExternalTask.originalTool || 'TaskManager',
                priority: pendingExternalTask.priority || 'medium',
                category: pendingExternalTask.category || 'other',
                plannerDate: plannerDateTime,
                duration,
            });
        } else {
            const selectedTaskId = eventTaskSelect.value;
            if (selectedTaskId) {
                window.DataManager.updateTask(selectedTaskId, { plannerDate: plannerDateTime, duration });
            } else {
                const title = eventTitleInput.value.trim();
                if (!title) return;
                window.DataManager.addTask({
                    text: title,
                    originalTool: 'DayPlanner',
                    plannerDate: plannerDateTime,
                    duration,
                });
            }
        }

        closeModal();
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!confirm('Clear all events for this day? This will unschedule them from the planner.')) return;
            const plannerDateStr = currentDate.toISOString().slice(0, 10);
            const todaysTasks = window.DataManager.getTasks().filter(task => task.plannerDate && task.plannerDate.startsWith(plannerDateStr));
            todaysTasks.forEach(task => {
                window.DataManager.updateTask(task.id, { plannerDate: null });
            });
        });
    }

    if (aiPlanBtn) {
        aiPlanBtn.addEventListener('click', autoPlanDay);
    }

    applyZoom();

    timeBlocksContainer.addEventListener('wheel', e => {
        if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            zoomLevel = Math.min(4, Math.max(0.5, zoomLevel * factor));
            applyZoom();
        }
    }, { passive: false });

    let pinchDist = null;
    timeBlocksContainer.addEventListener('touchmove', e => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (pinchDist) {
                const factor = dist / pinchDist;
                zoomLevel = Math.min(4, Math.max(0.5, zoomLevel * factor));
                applyZoom();
            }
            pinchDist = dist;
        }
    }, { passive: false });
    timeBlocksContainer.addEventListener('touchend', () => pinchDist = null);

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
        updateSlider();
    });

    window.EventBus.addEventListener('ef-receiveTaskFor-DayPlanner', handleReceivedTaskForDayPlanner);

    renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize });
    scrollToCurrent();
    updateSlider();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.dayPlannerInited) return;
    window.dayPlannerInited = true;
    initDayPlanner();
});

