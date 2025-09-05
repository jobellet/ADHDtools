// Pomodoro Timer JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Request notification permission immediately when page loads
    if ('Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    new Notification('Notifications Enabled', { 
                        body: 'You will be notified when your Pomodoro sessions complete.'
                    });
                }
            });
        }
    }

    // DOM elements
    const minutesDisplay = document.getElementById('minutes');
    const secondsDisplay = document.getElementById('seconds');
    const timerLabel = document.getElementById('timer-label');
    const startButton = document.getElementById('start-timer');
    const pauseButton = document.getElementById('pause-timer');
    const resetButton = document.getElementById('reset-timer');
    const sessionCountDisplay = document.getElementById('session-count');
    const sessionsUntilLongDisplay = document.getElementById('sessions-until-long');
    const modeChangeMessage = document.getElementById('mode-change-message');
    const pomodoroProgressBar = document.getElementById('pomodoro-progress-bar');
    
    // Settings elements
    const focusDurationInput = document.getElementById('focus-duration');
    const shortBreakDurationInput = document.getElementById('short-break-duration');
    const longBreakDurationInput = document.getElementById('long-break-duration');
    const sessionsBeforeLongBreakInput = document.getElementById('sessions-before-long-break');
    const audioNotificationSelect = document.getElementById('audio-notification');
    const saveSettingsButton = document.getElementById('save-settings');
    const testSoundButton = document.getElementById('test-sound');
    
    // Timer variables
    let timer = null;
    let minutes;
    let seconds;
    let endTime = null; // Timestamp when current session should end
    let isRunning = false;
    let isPaused = false;
    let currentMode = 'focus'; // 'focus', 'shortBreak', 'longBreak'
    let sessionCount = parseInt(localStorage.getItem('pomodoroSessionsCompleted'), 10) || 0;
    let currentSessionTotalSeconds = 0; // For progress bar calculation
    
    // Audio elements
    const bellAudio = new Audio('https://soundbible.com/mp3/service-bell_daniel_simion.mp3');
    const chimeAudio = new Audio('https://soundbible.com/mp3/wind-chimes-daniel_simon.mp3');
    const digitalAudio = new Audio('https://soundbible.com/mp3/sms-alert-5-daniel_simon.mp3');
    
    // Load settings from localStorage
    let settings = JSON.parse(localStorage.getItem('pomodoroSettings')) || {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        audioNotification: 'bell'
    };
    
    // Initialize settings inputs
    focusDurationInput.value = settings.focusDuration;
    shortBreakDurationInput.value = settings.shortBreakDuration;
    longBreakDurationInput.value = settings.longBreakDuration;
    sessionsBeforeLongBreakInput.value = settings.sessionsBeforeLongBreak;
    audioNotificationSelect.value = settings.audioNotification;
    
    // Initialize timer display
    updateTimerDisplay(settings.focusDuration, 0);
    sessionCountDisplay.textContent = sessionCount;
    updateLongBreakInfo();
    // Persist session count
    localStorage.setItem('pomodoroSessionsCompleted', sessionCount);
    
    // Event listeners
    startButton.addEventListener('click', startTimer);
    pauseButton.addEventListener('click', pauseTimer);
    resetButton.addEventListener('click', resetTimer);
    saveSettingsButton.addEventListener('click', saveSettings);
    if (testSoundButton) testSoundButton.addEventListener('click', testSelectedSound);
    
    // Functions
    function startTimer() {
        if (isRunning && !isPaused) return;

        if (!isRunning || isPaused) {
            const wasPaused = isPaused;
            isRunning = true;
            isPaused = false;
            startButton.disabled = true;
            pauseButton.disabled = false;

            // If timer was not paused, initialize the time based on current mode
            if (!wasPaused) { // This means it's a new session or reset
                if (currentMode === 'focus') {
                    minutes = settings.focusDuration;
                    currentSessionTotalSeconds = settings.focusDuration * 60;
                    timerLabel.textContent = 'FOCUS';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--primary-light)';
                } else if (currentMode === 'shortBreak') {
                    minutes = settings.shortBreakDuration;
                    currentSessionTotalSeconds = settings.shortBreakDuration * 60;
                    timerLabel.textContent = 'SHORT BREAK';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-color)';
                } else if (currentMode === 'longBreak') {
                    minutes = settings.longBreakDuration;
                    currentSessionTotalSeconds = settings.longBreakDuration * 60;
                    timerLabel.textContent = 'LONG BREAK';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-dark)';
                }
                seconds = 0;
                if (pomodoroProgressBar) pomodoroProgressBar.style.width = '0%'; // Reset progress bar for new session
                updateTimerDisplay(minutes, seconds);
            } else {
                // currentSessionTotalSeconds should already be set from when session started
            }

            // Calculate end time based on current minutes/seconds
            const remaining = minutes * 60 + seconds;
            endTime = Date.now() + remaining * 1000;

            timer = setInterval(updateTimer, 1000);
        }
    }
    
    function pauseTimer() {
        if (isRunning && !isPaused) {
            clearInterval(timer);
            // Recalculate remaining time based on endTime
            const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            minutes = Math.floor(remaining / 60);
            seconds = remaining % 60;
            updateTimerDisplay(minutes, seconds);
            isPaused = true;
            startButton.disabled = false;
            pauseButton.disabled = true;
        }
    }
    
    function resetTimer() {
        clearInterval(timer);
        isRunning = false;
        isPaused = false;
        endTime = null;
        currentMode = 'focus';
        minutes = settings.focusDuration;
        seconds = 0;
        currentSessionTotalSeconds = settings.focusDuration * 60; // Reset for progress bar
        if (pomodoroProgressBar) pomodoroProgressBar.style.width = '0%';
        updateTimerDisplay(minutes, seconds);
        timerLabel.textContent = 'FOCUS';
        document.querySelector('.timer-circle').style.backgroundColor = 'var(--primary-light)';
        startButton.disabled = false;
        pauseButton.disabled = true;
        if (modeChangeMessage) modeChangeMessage.textContent = '';
        updateLongBreakInfo();
    }
    
    function updateTimer() {
        const remainingTotal = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        minutes = Math.floor(remainingTotal / 60);
        seconds = remainingTotal % 60;

        if (remainingTotal <= 0) {
            // Timer completed
            clearInterval(timer);
            isRunning = false;
            endTime = null;
            playNotification();

            // Switch modes
            if (currentMode === 'focus') {
                sessionCount++;
                sessionCountDisplay.textContent = sessionCount;
                localStorage.setItem('pomodoroSessionsCompleted', sessionCount);

                const isLongBreak = sessionCount % settings.sessionsBeforeLongBreak === 0;
                if (isLongBreak) {
                    currentMode = 'longBreak';
                    minutes = settings.longBreakDuration;
                    currentSessionTotalSeconds = settings.longBreakDuration * 60;
                    timerLabel.textContent = 'LONG BREAK';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-dark)';
                    if (modeChangeMessage) {
                        modeChangeMessage.textContent = 'Long break! Take a rest.';
                        modeChangeMessage.style.color = 'var(--secondary-dark)';
                    }
                } else {
                    currentMode = 'shortBreak';
                    minutes = settings.shortBreakDuration;
                    currentSessionTotalSeconds = settings.shortBreakDuration * 60;
                    timerLabel.textContent = 'SHORT BREAK';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-color)';
                    if (modeChangeMessage) {
                        modeChangeMessage.textContent = 'Short break! Stretch or relax.';
                        modeChangeMessage.style.color = 'var(--secondary-color)';
                    }
                }
            } else {
                currentMode = 'focus';
                minutes = settings.focusDuration;
                currentSessionTotalSeconds = settings.focusDuration * 60;
                timerLabel.textContent = 'FOCUS';
                document.querySelector('.timer-circle').style.backgroundColor = 'var(--primary-light)';
                if (modeChangeMessage) {
                    modeChangeMessage.textContent = 'Back to focus!';
                    modeChangeMessage.style.color = 'var(--primary-color)';
                }
            }
            updateLongBreakInfo();

            seconds = 0;
            if (pomodoroProgressBar) pomodoroProgressBar.style.width = '0%'; // Reset for new session segment
            updateTimerDisplay(minutes, seconds);
            startButton.disabled = false;
            pauseButton.disabled = true;
            return;
        }

        updateTimerDisplay(minutes, seconds);
    }
    
    function updateTimerDisplay(mins, secs) {
        minutesDisplay.textContent = mins < 10 ? '0' + mins : mins;
        secondsDisplay.textContent = secs < 10 ? '0' + secs : secs;

        if (pomodoroProgressBar && currentSessionTotalSeconds > 0 && isRunning) {
            const timeLeftInSeconds = mins * 60 + secs;
            const elapsedSeconds = currentSessionTotalSeconds - timeLeftInSeconds;
            let progressPercentage = (elapsedSeconds / currentSessionTotalSeconds) * 100;
            pomodoroProgressBar.style.width = Math.min(progressPercentage, 100) + '%';
        } else if (pomodoroProgressBar && !isRunning && !isPaused) { 
            // Ensure bar is at 0 if timer is reset and not just paused
             pomodoroProgressBar.style.width = '0%';
        }
    }
    
    function playNotification() {
        // Play sound safely
        try {
            switch (settings.audioNotification) {
                case 'bell':
                    bellAudio.play().catch(() => {});
                    break;
                case 'chime':
                    chimeAudio.play().catch(() => {});
                    break;
                case 'digital':
                    digitalAudio.play().catch(() => {});
                    break;
                case 'none':
                default:
                    break;
            }
        } catch (e) {
            console.error('Audio play failed:', e);
        }

        // Show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = currentMode === 'focus' ? 'Focus Session Complete!' : 'Break Over!';
            const body = currentMode === 'focus' ? 'Time for a break!' : 'Time to focus!';
            new Notification(title, { body });
        }
    }
    
    function saveSettings() {
        // Validate inputs
        const focusDuration = parseInt(focusDurationInput.value);
        const shortBreakDuration = parseInt(shortBreakDurationInput.value);
        const longBreakDuration = parseInt(longBreakDurationInput.value);
        const sessionsBeforeLongBreak = parseInt(sessionsBeforeLongBreakInput.value);
        
        if (isNaN(focusDuration) || isNaN(shortBreakDuration) || isNaN(longBreakDuration) || isNaN(sessionsBeforeLongBreak)) {
            alert('Please enter valid numbers for all durations.');
            return;
        }
        
        if (focusDuration < 1 || shortBreakDuration < 1 || longBreakDuration < 1 || sessionsBeforeLongBreak < 1) {
            alert('All values must be at least 1.');
            return;
        }

        if (focusDuration > 60 || shortBreakDuration > 30 || longBreakDuration > 60 || sessionsBeforeLongBreak > 10) {
            alert('Please keep durations within the allowed limits.');
            return;
        }
        
        // Update settings
        settings = {
            focusDuration,
            shortBreakDuration,
            longBreakDuration,
            sessionsBeforeLongBreak,
            audioNotification: audioNotificationSelect.value
        };
        
        // Save to localStorage
        localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
        
        // Remember current state to resume automatically
        const previousMode = currentMode;
        const wasRunning = isRunning;
        const wasPaused = isPaused;

        // Reset timer with new settings
        resetTimer();
        currentMode = previousMode;

        if (wasRunning || wasPaused) {
            startTimer();
            if (wasPaused) pauseTimer();
        } else {
            if (currentMode === 'shortBreak') {
                minutes = settings.shortBreakDuration;
                currentSessionTotalSeconds = settings.shortBreakDuration * 60;
                timerLabel.textContent = 'SHORT BREAK';
                document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-color)';
            } else if (currentMode === 'longBreak') {
                minutes = settings.longBreakDuration;
                currentSessionTotalSeconds = settings.longBreakDuration * 60;
                timerLabel.textContent = 'LONG BREAK';
                document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-dark)';
            } else {
                minutes = settings.focusDuration;
                currentSessionTotalSeconds = settings.focusDuration * 60;
                timerLabel.textContent = 'FOCUS';
                document.querySelector('.timer-circle').style.backgroundColor = 'var(--primary-light)';
            }
            seconds = 0;
            if (pomodoroProgressBar) pomodoroProgressBar.style.width = '0%';
            updateTimerDisplay(minutes, seconds);
        }

        updateLongBreakInfo();

        // Show confirmation
        alert('Settings saved successfully!');
    }

    function testSelectedSound() {
        const selection = audioNotificationSelect.value;
        let audio;
        switch (selection) {
            case 'bell':
                audio = bellAudio;
                break;
            case 'chime':
                audio = chimeAudio;
                break;
            case 'digital':
                audio = digitalAudio;
                break;
            default:
                return;
        }
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }

    function updateLongBreakInfo() {
        if (!sessionsUntilLongDisplay) return;
        const sessionsUntilLongBreak = settings.sessionsBeforeLongBreak - (sessionCount % settings.sessionsBeforeLongBreak);
        sessionsUntilLongDisplay.textContent = sessionsUntilLongBreak;
    }
});
