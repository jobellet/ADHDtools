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
                    if (task.isCompleted) {
                        eventDiv.style.textDecoration = 'line-through';
                    }
                    eventDiv.addEventListener('click', () => {
                        // Simple toggle completion
                        window.DataManager.updateTask(task.id, { isCompleted: !task.isCompleted });
                    });
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

    function openModal() {
        eventModal.style.display = 'block';
        eventTitleInput.value = '';
        populateTimeOptions();
    }

    function closeModal() {
        eventModal.style.display = 'none';
    }

    addEventBtn.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', e => { if (e.target === eventModal) closeModal(); });

    eventForm.addEventListener('submit', e => {
        e.preventDefault();
        const title = eventTitleInput.value.trim();
        if (!title) return;
        
        const time = eventTimeSelect.value;
        const plannerDateTime = `${currentDate.toISOString().slice(0, 10)}T${time}`;

        window.DataManager.addTask({
            text: title,
            originalTool: 'DayPlanner',
            plannerDate: plannerDateTime,
        });
        
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

    window.EventBus.addEventListener('dataChanged', renderDayPlanner);

    renderDayPlanner();
});

