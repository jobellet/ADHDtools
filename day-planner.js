// day-planner.js

document.addEventListener('DOMContentLoaded', function() {
    if (window.dayPlannerInited) return;
    window.dayPlannerInited = true;

    const container = document.querySelector('.day-planner-container');
    if (!container) return;

    const dateDisplay = document.getElementById('current-date');
    const timeBlocksContainer = document.getElementById('time-blocks');
    const addEventBtn = document.getElementById('add-event-btn');
    const clearBtn = document.getElementById('clear-events-btn');
    const eventModal = document.getElementById('event-modal');
    const closeButton = eventModal.querySelector('.close-button');
    const eventForm = document.getElementById('event-form');
    const eventTitleInput = document.getElementById('event-title');
    const eventTimeSelect = document.getElementById('event-time');
    const eventTaskSelect = document.getElementById('event-task');
    const eventDurationInput = document.getElementById('event-duration');
    const eventModalTitle = document.getElementById('event-modal-title');

    let editingTaskId = null;

    let currentDate = new Date();

    function renderDayPlanner() {
        if (!window.DataManager) return;

        dateDisplay.textContent = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        timeBlocksContainer.innerHTML = '';
        const allTasks = window.DataManager.getTasks();
        const plannerDateStr = currentDate.toISOString().slice(0, 10);

        const todaysTasks = allTasks.filter(task => task.plannerDate && task.plannerDate.startsWith(plannerDateStr));

        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 60) { // Simplified to hourly blocks
                const timeBlock = document.createElement('div');
                timeBlock.className = 'time-block';
                const timeKey = `${plannerDateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                
                const timeLabel = document.createElement('div');
                timeLabel.className = 'time-label';
                timeLabel.textContent = formatTime(hour, minute);
                timeBlock.appendChild(timeLabel);

                const eventContent = document.createElement('div');
                eventContent.className = 'event-content';

                const tasksInBlock = todaysTasks.filter(t => t.plannerDate.startsWith(timeKey.slice(0, 13)));

                tasksInBlock.forEach(task => {
                    const eventDiv = document.createElement('div');
                    eventDiv.className = 'event';
                    eventDiv.textContent = task.text;
                    eventDiv.style.height = `calc(${task.duration || 60} * var(--minute-height))`;

                    eventDiv.addEventListener('click', () => openModal(task));

                    const del = document.createElement('span');
                    del.className = 'delete-event';
                    del.textContent = '×';
                    del.addEventListener('click', e => {
                        e.stopPropagation();
                        window.DataManager.updateTask(task.id, { plannerDate: null });
                    });
                    eventDiv.appendChild(del);

                    const handle = document.createElement('div');
                    handle.className = 'resize-handle';
                    handle.addEventListener('mousedown', e => startResize(e, task, eventDiv));
                    eventDiv.appendChild(handle);

                    eventContent.appendChild(eventDiv);
                });

                timeBlock.appendChild(eventContent);
                timeBlocksContainer.appendChild(timeBlock);
            }
        }
    }

    function formatTime(h, m) {
        const period = h >= 12 ? 'PM' : 'AM';
        let hh = h % 12; if (hh === 0) hh = 12;
        return `${hh}:${m.toString().padStart(2, '0')} ${period}`;
    }

    function populateTimeOptions() {
        eventTimeSelect.innerHTML = '';
        for (let h = 0; h < 24; h++) {
            const opt = document.createElement('option');
            opt.value = `${String(h).padStart(2, '0')}:00`;
            opt.textContent = formatTime(h, 0);
            eventTimeSelect.appendChild(opt);
        }
    }

    function populateTaskOptions() {
        eventTaskSelect.innerHTML = '<option value="">-- New Event --</option>';
        const tasks = window.DataManager.getTasks().filter(t => !t.plannerDate);
        tasks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.text;
            eventTaskSelect.appendChild(opt);
        });
    }

    function openModal(task) {
        eventModal.style.display = 'block';
        populateTimeOptions();
        populateTaskOptions();
        if (task) {
            editingTaskId = task.id;
            eventModalTitle.textContent = 'Edit Event';
            eventTitleInput.value = task.text;
            eventTimeSelect.value = task.plannerDate.slice(11, 16);
            eventDurationInput.value = task.duration || 60;
            eventTitleInput.disabled = false;
            eventTaskSelect.value = '';
            eventTaskSelect.disabled = true;
        } else {
            editingTaskId = null;
            eventModalTitle.textContent = 'Add Event';
            eventTitleInput.value = '';
            eventTimeSelect.selectedIndex = 0;
            eventDurationInput.value = 60;
            eventTitleInput.disabled = false;
            eventTaskSelect.value = '';
            eventTaskSelect.disabled = false;
        }
    }

    function closeModal() {
        eventModal.style.display = 'none';
    }

    addEventBtn.addEventListener('click', () => openModal());
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', e => { if (e.target === eventModal) closeModal(); });

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

    function startResize(e, task, eventDiv) {
        e.preventDefault();
        const startY = e.clientY;
        const startDuration = task.duration || 60;
        const minuteHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;
        function onMove(ev) {
            const diff = ev.clientY - startY;
            const minutes = Math.max(15, startDuration + Math.round(diff / minuteHeight / 15) * 15);
            eventDiv.style.height = `calc(${minutes} * var(--minute-height))`;
        }
        function onUp(ev) {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const diff = ev.clientY - startY;
            const minutes = Math.max(15, startDuration + Math.round(diff / minuteHeight / 15) * 15);
            window.DataManager.updateTask(task.id, { duration: minutes });
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // Zoom handling
    let zoomLevel = 1;
    function applyZoom() {
        document.documentElement.style.setProperty('--minute-height', `${2 * zoomLevel}px`);
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

    function scrollToCurrent() {
        const now = new Date();
        const hoursFromStart = now.getHours();
        const minuteHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;
        timeBlocksContainer.scrollTop = hoursFromStart * 60 * minuteHeight;
    }

    window.EventBus.addEventListener('dataChanged', () => {
        renderDayPlanner();
        scrollToCurrent();
    });

    renderDayPlanner();
    scrollToCurrent();
});

