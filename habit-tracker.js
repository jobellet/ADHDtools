// Habit Tracker Implementation
document.addEventListener('DOMContentLoaded', function () {
    // Only initialize if we're on the habit tracker page
    if (!document.querySelector('.habit-tracker-container')) return;

    const habitInput = document.getElementById('habit-input');
    const addHabitBtn = document.getElementById('add-habit');
    const habitList = document.getElementById('habit-stats');
    const habitCalendar = document.getElementById('habit-calendar');
    const exportHabitsBtn = document.getElementById('export-habits');

    // Get current date information
    const currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    // Load habits from localStorage
    let habits = JSON.parse(localStorage.getItem('adhd-habits')) || [];

    // Load habit logs from localStorage
    let habitLogs = JSON.parse(localStorage.getItem('adhd-habit-logs')) || {};

    // Render habits and calendar
    function renderHabits() {
        // Clear current list
        habitList.innerHTML = '';

        // Create habit elements
        habits.forEach((habit, index) => {
            const habitItem = document.createElement('div');
            habitItem.className = 'habit-item';

            // Create habit header
            const habitHeader = document.createElement('div');
            habitHeader.className = 'habit-header';

            // Create habit name
            const habitName = document.createElement('div');
            habitName.className = 'habit-name';
            habitName.textContent = habit.name;

            // Create streak counter
            const streakCounter = document.createElement('div');
            streakCounter.className = 'streak-counter';
            const streak = calculateStreak(habit.id);
            const longest = calculateLongestStreak(habit.id);
            streakCounter.textContent = `${streak} day${streak !== 1 ? 's' : ''} streak (Longest: ${longest} day${longest !== 1 ? 's' : ''})`;

            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.innerHTML = '&#9998;';
            editBtn.addEventListener('click', function () {
                editHabit(index);
            });

            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', function () {
                deleteHabit(index);
            });

            // Assemble habit header
            habitHeader.appendChild(habitName);
            habitHeader.appendChild(streakCounter);
            habitHeader.appendChild(editBtn);
            habitHeader.appendChild(deleteBtn);

            // Create habit progress
            const habitProgress = document.createElement('div');
            habitProgress.className = 'habit-progress';

            // Calculate completion rate for current month
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const completedDays = Object.keys(habitLogs[habit.id] || {}).filter(date => {
                const logDate = new Date(date);
                return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
            }).length;

            const completionRate = Math.round((completedDays / daysInMonth) * 100);

            // Create progress bar
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';

            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = `${completionRate}%`;

            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            progressText.textContent = `${completionRate}% complete this month`;

            // Assemble progress bar
            progressBar.appendChild(progressFill);

            // Assemble habit progress
            habitProgress.appendChild(progressBar);
            habitProgress.appendChild(progressText);

            // Assemble habit item
            habitItem.appendChild(habitHeader);
            habitItem.appendChild(habitProgress);

            habitList.appendChild(habitItem);
        });
    }

    // Render calendar
    function renderCalendar() {
        // Clear current calendar
        habitCalendar.innerHTML = '';

        // Create month header
        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-header';

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        monthHeader.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        habitCalendar.appendChild(monthHeader);

        // Create calendar grid
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'calendar-grid';

        // Create day headers
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });

        // Get first day of month and number of days
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Add empty cells for days before first day of month
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyDay);
        }

        // Add days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const calendarDay = document.createElement('div');
            calendarDay.className = 'calendar-day';
            calendarDay.textContent = day;

            // Check if this is today
            const isToday = day === currentDate.getDate() &&
                currentMonth === currentDate.getMonth() &&
                currentYear === currentDate.getFullYear();

            if (isToday) {
                calendarDay.classList.add('today');
            }

            // Add habit checkboxes for each day
            if (habits.length > 0) {
                const habitChecks = document.createElement('div');
                habitChecks.className = 'habit-checks';

                habits.forEach(habit => {
                    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const isCompleted = habitLogs[habit.id] && habitLogs[habit.id][dateStr];
                    const habitId = habit.id;

                    const habitCheck = document.createElement('div');
                    habitCheck.className = `habit-check ${isCompleted ? 'completed' : ''}`;
                    habitCheck.title = habit.name;
                    habitCheck.dataset.habitId = habitId;

                    // Only allow toggling for dates up to today
                    const checkDate = new Date(currentYear, currentMonth, day);
                    if (checkDate <= currentDate) {
                        habitCheck.addEventListener('click', function (e) {
                            e.stopPropagation();
                            toggleHabitCompletion(habitId, dateStr);
                        });
                    }

                    habitChecks.appendChild(habitCheck);
                });

                calendarDay.appendChild(habitChecks);
            }

            calendarGrid.appendChild(calendarDay);
        }

        habitCalendar.appendChild(calendarGrid);

        // Add month navigation
        const monthNav = document.createElement('div');
        monthNav.className = 'month-nav';

        const prevMonthBtn = document.createElement('button');
        prevMonthBtn.className = 'prev-month-btn';
        prevMonthBtn.textContent = '← Previous Month';
        prevMonthBtn.addEventListener('click', function () {
            navigateMonth(-1);
        });

        const nextMonthBtn = document.createElement('button');
        nextMonthBtn.className = 'next-month-btn';
        nextMonthBtn.textContent = 'Next Month →';
        nextMonthBtn.addEventListener('click', function () {
            navigateMonth(1);
        });

        monthNav.appendChild(prevMonthBtn);
        monthNav.appendChild(nextMonthBtn);

        habitCalendar.appendChild(monthNav);
    }

    // Navigate to previous/next month
    function navigateMonth(direction) {
        const newDate = new Date(currentYear, currentMonth + direction, 1);
        currentMonth = newDate.getMonth();
        currentYear = newDate.getFullYear();
        renderCalendar();
        renderHabits(); // Re-render habits to update progress bars
    }

    // Add new habit
    function addHabit() {
        if (!habitInput.value.trim()) return;

        const newHabit = {
            id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
            name: habitInput.value.trim(),
            createdAt: new Date().toISOString()
        };

        habits.push(newHabit);
        saveHabits();

        // Clear input
        habitInput.value = '';
        habitInput.focus();
    }

    // Delete habit
    function deleteHabit(index) {
        if (confirm('Are you sure you want to delete this habit and all its tracking data?')) {
            const habitId = habits[index].id;
            habits.splice(index, 1);

            // Remove habit logs
            delete habitLogs[habitId];

            saveHabits();
            saveHabitLogs();
        }
    }

    // Edit habit name
    function editHabit(index) {
        const newName = prompt('Edit habit name:', habits[index].name);
        if (newName && newName.trim()) {
            habits[index].name = newName.trim();
            saveHabits();
        }
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Toggle habit completion for a specific date
    const debouncedRender = debounce(() => {
        renderCalendar();
        renderHabits(); // Update streak counters
    }, 100);

    function toggleHabitCompletion(habitId, dateStr) {
        // Initialize habit logs for this habit if not exists
        if (!habitLogs[habitId]) {
            habitLogs[habitId] = {};
        }

        // Toggle completion
        habitLogs[habitId][dateStr] = !habitLogs[habitId][dateStr];

        // If false, remove the entry
        if (!habitLogs[habitId][dateStr]) {
            delete habitLogs[habitId][dateStr];
        }

        saveHabitLogs();

        // Dispatch event
        if (window.EventBus) {
            window.EventBus.dispatchEvent(new CustomEvent('habitToggled', {
                detail: {
                    habitId: habitId,
                    dateStr: dateStr,
                    completed: habitLogs[habitId][dateStr]
                }
            }));
        }

        debouncedRender();
    }

    // Calculate current streak for a habit
    function calculateStreak(habitId) {
        if (!habitLogs[habitId]) return 0;

        let streak = 0;
        let currentStreak = 0;
        let checkDate = new Date(currentDate);

        // Check yesterday if today is not yet completed
        const todayStr = checkDate.toISOString().split('T')[0];
        if (!habitLogs[habitId][todayStr]) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // Count consecutive days backwards
        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];

            if (habitLogs[habitId][dateStr]) {
                currentStreak++;
            } else {
                break;
            }

            checkDate.setDate(checkDate.getDate() - 1);
        }

        return currentStreak;
    }

    // Calculate longest streak for a habit
    function calculateLongestStreak(habitId) {
        if (!habitLogs[habitId]) return 0;

        const dates = Object.keys(habitLogs[habitId]).sort();
        let longest = 0;
        let current = 0;
        let prevDate = null;

        dates.forEach(dateStr => {
            const date = new Date(dateStr);
            if (prevDate) {
                const diff = (date - prevDate) / (1000 * 60 * 60 * 24);
                if (diff === 1) {
                    current += 1;
                } else {
                    current = 1;
                }
            } else {
                current = 1;
            }

            if (current > longest) longest = current;
            prevDate = date;
        });

        return longest;
    }

    // Save habits to localStorage
    function saveHabits() {
        localStorage.setItem('adhd-habits', JSON.stringify(habits));
        renderHabits();
        renderCalendar();
    }

    // Save habit logs to localStorage
    function saveHabitLogs() {
        localStorage.setItem('adhd-habit-logs', JSON.stringify(habitLogs));
    }

    // Export habits and logs as JSON file
    function exportHabitData() {
        const data = { habits, habitLogs };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Event listeners
    if (addHabitBtn) {
        addHabitBtn.addEventListener('click', addHabit);
    }

    if (habitInput) {
        habitInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                addHabit();
            }
        });
    }

    if (exportHabitsBtn) {
        exportHabitsBtn.addEventListener('click', exportHabitData);
    }

    // Initial render
    renderHabits();
    renderCalendar();
});
