import { formatTime, getCalendarEvents } from './dayPlannerUtils.js';

export function renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize }) {
    if (!window.DataManager) return;

    dateDisplay.textContent = currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    timeBlocksContainer.innerHTML = '';
    const hourContents = [];

    for (let hour = 0; hour < 24; hour++) {
        const timeBlock = document.createElement('div');
        timeBlock.className = 'time-block';

        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.textContent = formatTime(hour, 0);
        timeBlock.appendChild(timeLabel);

        const eventContent = document.createElement('div');
        eventContent.className = 'event-content';
        hourContents.push(eventContent);

        timeBlock.appendChild(eventContent);
        timeBlocksContainer.appendChild(timeBlock);
    }

    const calendarEvents = getCalendarEvents(currentDate);
    calendarEvents.forEach(ev => {
        const startHour = parseInt(ev.start.slice(0, 2));
        const startMin = parseInt(ev.start.slice(3, 5));
        const start = startHour * 60 + startMin;
        const end = ev.end
            ? parseInt(ev.end.slice(0, 2)) * 60 + parseInt(ev.end.slice(3, 5))
            : start + 60;
        const lastHour = Math.min(23, Math.floor((end - 1) / 60));
        for (let h = Math.floor(start / 60); h <= lastHour; h++) {
            const hourContent = hourContents[h];
            if (!hourContent) continue;
            const hourStart = h * 60;
            const segStart = Math.max(start, hourStart);
            const segEnd = Math.min(end, hourStart + 60);
            const segMinutes = segEnd - segStart;
            const segOffset = segStart - hourStart;

            const eventDiv = document.createElement('div');
            eventDiv.className = 'event calendar-event';
            eventDiv.textContent = ev.title;
            eventDiv.style.top = `calc(${segOffset} * var(--minute-height))`;
            eventDiv.style.height = `calc(${segMinutes} * var(--minute-height))`;
            hourContent.appendChild(eventDiv);
        }
    });

    const allTasks = window.DataManager.getTasks();
    const plannerDateStr = currentDate.toISOString().slice(0, 10);
    const todaysTasks = allTasks.filter(task => task.plannerDate && task.plannerDate.startsWith(plannerDateStr));

    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);
    allTasks.filter(task => task.plannerDate && task.plannerDate.startsWith(prevDateStr)).forEach(task => {
        const startMins = parseInt(task.plannerDate.slice(11, 13)) * 60 + parseInt(task.plannerDate.slice(14, 16));
        const dur = task.duration || 60;
        if (startMins + dur > 1440) {
            const remainder = startMins + dur - 1440;
            todaysTasks.push({
                ...task,
                plannerDate: `${plannerDateStr}T00:00`,
                duration: remainder,
                _continuation: true
            });
        }
    });

    todaysTasks.forEach(task => {
        const startHour = parseInt(task.plannerDate.slice(11, 13));
        const startMin = parseInt(task.plannerDate.slice(14, 16));
        const start = startHour * 60 + startMin;
        const duration = task.duration || 60;
        const end = start + duration;
        const lastHour = Math.min(23, Math.floor((end - 1) / 60));
        for (let h = Math.floor(start / 60); h <= lastHour; h++) {
            const hourContent = hourContents[h];
            if (!hourContent) continue;
            const hourStart = h * 60;
            const segStart = Math.max(start, hourStart);
            const segEnd = Math.min(end, hourStart + 60);
            const segMinutes = segEnd - segStart;
            const segOffset = segStart - hourStart;

            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            eventDiv.textContent = task.text;
            eventDiv.style.top = `calc(${segOffset} * var(--minute-height))`;
            eventDiv.style.height = `calc(${segMinutes} * var(--minute-height))`;

            eventDiv.addEventListener('click', () => openModal(task));

            if (h === Math.floor(start / 60) && !task._continuation) {
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
            }

            hourContent.appendChild(eventDiv);
        }
    });
}
