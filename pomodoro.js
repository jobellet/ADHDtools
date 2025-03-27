// Pomodoro Timer JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Request notification permission immediately when page loads
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(permission) {
            if (permission === 'granted') {
                new Notification('Notifications Enabled', { 
                    body: 'You will be notified when your Pomodoro sessions complete.'
                });
            }
        });
    }

    // DOM elements
    const minutesDisplay = document.getElementById('minutes');
    const secondsDisplay = document.getElementById('seconds');
    const timerLabel = document.getElementById('timer-label');
    const startButton = document.getElementById('start-timer');
    const pauseButton = document.getElementById('pause-timer');
    const resetButton = document.getElementById('reset-timer');
    const sessionCountDisplay = document.getElementById('session-count');
    
    // Settings elements
    const focusDurationInput = document.getElementById('focus-duration');
    const shortBreakDurationInput = document.getElementById('short-break-duration');
    const longBreakDurationInput = document.getElementById('long-break-duration');
    const sessionsBeforeLongBreakInput = document.getElementById('sessions-before-long-break');
    const audioNotificationSelect = document.getElementById('audio-notification');
    const saveSettingsButton = document.getElementById('save-settings');
    
    // Timer variables
    let timer;
    let minutes;
    let seconds;
    let isRunning = false;
    let isPaused = false;
    let currentMode = 'focus'; // 'focus', 'shortBreak', 'longBreak'
    let sessionCount = 0;
    
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
    
    // Event listeners
    startButton.addEventListener('click', startTimer);
    pauseButton.addEventListener('click', pauseTimer);
    resetButton.addEventListener('click', resetTimer);
    saveSettingsButton.addEventListener('click', saveSettings);
    
    // Functions
    function startTimer() {
        if (isRunning && !isPaused) return;
        
        if (!isRunning || isPaused) {
            isRunning = true;
            isPaused = false;
            startButton.disabled = true;
            pauseButton.disabled = false;
            
            // If timer was not paused, initialize the time based on current mode
            if (!isPaused) {
                if (currentMode === 'focus') {
                    minutes = settings.focusDuration;
                    timerLabel.textContent = 'FOCUS';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--primary-light)';
                } else if (currentMode === 'shortBreak') {
                    minutes = settings.shortBreakDuration;
                    timerLabel.textContent = 'SHORT BREAK';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-color)';
                } else if (currentMode === 'longBreak') {
                    minutes = settings.longBreakDuration;
                    timerLabel.textContent = 'LONG BREAK';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-dark)';
                }
                seconds = 0;
                updateTimerDisplay(minutes, seconds);
            }
            
            timer = setInterval(updateTimer, 1000);
        }
    }
    
    function pauseTimer() {
        if (isRunning && !isPaused) {
            clearInterval(timer);
            isPaused = true;
            startButton.disabled = false;
            pauseButton.disabled = true;
        }
    }
    
    function resetTimer() {
        clearInterval(timer);
        isRunning = false;
        isPaused = false;
        currentMode = 'focus';
        minutes = settings.focusDuration;
        seconds = 0;
        updateTimerDisplay(minutes, seconds);
        timerLabel.textContent = 'FOCUS';
        document.querySelector('.timer-circle').style.backgroundColor = 'var(--primary-light)';
        startButton.disabled = false;
        pauseButton.disabled = true;
    }
    
    function updateTimer() {
        if (seconds === 0) {
            if (minutes === 0) {
                // Timer completed
                clearInterval(timer);
                isRunning = false;
                playNotification();
                
                // Switch modes
                if (currentMode === 'focus') {
                    sessionCount++;
                    sessionCountDisplay.textContent = sessionCount;
                    
                    // Check if it's time for a long break
                    if (sessionCount % settings.sessionsBeforeLongBreak === 0) {
                        currentMode = 'longBreak';
                        minutes = settings.longBreakDuration;
                        timerLabel.textContent = 'LONG BREAK';
                        document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-dark)';
                    } else {
                        currentMode = 'shortBreak';
                        minutes = settings.shortBreakDuration;
                        timerLabel.textContent = 'SHORT BREAK';
                        document.querySelector('.timer-circle').style.backgroundColor = 'var(--secondary-color)';
                    }
                } else {
                    // After any break, go back to focus mode
                    currentMode = 'focus';
                    minutes = settings.focusDuration;
                    timerLabel.textContent = 'FOCUS';
                    document.querySelector('.timer-circle').style.backgroundColor = 'var(--primary-light)';
                }
                
                seconds = 0;
                updateTimerDisplay(minutes, seconds);
                startButton.disabled = false;
                pauseButton.disabled = true;
                
                // Show browser notification if permission is granted
                if (Notification.permission === 'granted') {
                    const notificationTitle = currentMode === 'focus' ? 'Break Over!' : 'Focus Session Complete!';
                    const notificationBody = currentMode === 'focus' ? 'Time to focus!' : 'Take a break!';
                    new Notification(notificationTitle, { body: notificationBody });
                }
                
                return;
            }
            minutes--;
            seconds = 59;
        } else {
            seconds--;
        }
        
        updateTimerDisplay(minutes, seconds);
    }
    
    function updateTimerDisplay(mins, secs) {
        minutesDisplay.textContent = mins < 10 ? '0' + mins : mins;
        secondsDisplay.textContent = secs < 10 ? '0' + secs : secs;
    }
    
    function playNotification() {
        switch (settings.audioNotification) {
            case 'bell':
                bellAudio.play();
                break;
            case 'chime':
                chimeAudio.play();
                break;
            case 'digital':
                digitalAudio.play();
                break;
            case 'none':
                // No sound
                break;
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
        
        // Reset timer with new settings
        resetTimer();
        
        // Show confirmation
        alert('Settings saved successfully!');
    }
});
