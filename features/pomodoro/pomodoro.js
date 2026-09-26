// Pomodoro Timer JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Request notification permission immediately when page loads
    if ('Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(function (permission) {
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

    // Interval Chime variables
    let nextChimeSeconds = null;


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

    // --- Inject Interval Chime UI ---
    const timerControls = document.querySelector('.timer-controls');
    const chimeContainer = document.createElement('div');
    chimeContainer.className = 'interval-chime-controls';
    chimeContainer.style.marginTop = '15px';
    chimeContainer.style.display = 'flex';
    chimeContainer.style.alignItems = 'center';
    chimeContainer.style.justifyContent = 'center';
    chimeContainer.style.gap = '10px';

    const chimeCheckbox = document.createElement('input');
    chimeCheckbox.type = 'checkbox';
    chimeCheckbox.id = 'interval-chime-toggle';

    const chimeLabel = document.createElement('label');
    chimeLabel.htmlFor = 'interval-chime-toggle';
    chimeLabel.textContent = 'Interval Chime:';
    chimeLabel.style.margin = '0';

    const chimeSelect = document.createElement('select');
    chimeSelect.id = 'interval-chime-select';
    [5, 10, 15].forEach(min => {
        const option = document.createElement('option');
        option.value = min;
        option.textContent = `Every ${min} min`;
        chimeSelect.appendChild(option);
    });

    chimeContainer.appendChild(chimeCheckbox);
    chimeContainer.appendChild(chimeLabel);
    chimeContainer.appendChild(chimeSelect);
    timerControls.parentNode.insertBefore(chimeContainer, timerControls.nextSibling);

    // Load interval chime settings
    const chimeSettings = JSON.parse(localStorage.getItem('pomodoroIntervalChime')) || {
        enabled: false,
        interval: 5
    };
    chimeCheckbox.checked = chimeSettings.enabled;
    chimeSelect.value = chimeSettings.interval;

    chimeCheckbox.addEventListener('change', () => {
        saveChimeSettings();
        if (isRunning && !isPaused) recalculateNextChime();
    });
    chimeSelect.addEventListener('change', () => {
        saveChimeSettings();
        if (isRunning && !isPaused) recalculateNextChime();
    });

    function saveChimeSettings() {
        localStorage.setItem('pomodoroIntervalChime', JSON.stringify({
            enabled: chimeCheckbox.checked,
            interval: parseInt(chimeSelect.value, 10)
        }));
    }

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
    function recalculateNextChime() {
        if (currentMode !== 'focus' || !chimeCheckbox.checked) {
            nextChimeSeconds = null;
            return;
        }

        const intervalSeconds = parseInt(chimeSelect.value, 10) * 60;
        const totalDuration = settings.focusDuration * 60;

        // Calculate how much time has passed in the current session
        const remainingTimeSeconds = minutes * 60 + seconds;
        const elapsedSeconds = totalDuration - remainingTimeSeconds;

        // Calculate the next threshold
        const nextThreshold = Math.floor(elapsedSeconds / intervalSeconds) * intervalSeconds + intervalSeconds;

        // Only set next chime if it falls within the session duration
        if (nextThreshold < totalDuration) {
            nextChimeSeconds = nextThreshold;
        } else {
            nextChimeSeconds = null;
        }
    }

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

            recalculateNextChime();

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
        nextChimeSeconds = null;
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

        if (currentMode === 'focus' && nextChimeSeconds !== null) {
            const elapsed = (settings.focusDuration * 60) - remainingTotal;
            if (elapsed >= nextChimeSeconds) {
                playIntervalChime();
                recalculateNextChime();
            }
        }

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

                // Dispatch event
                if (window.EventBus) {
                    window.EventBus.dispatchEvent(new CustomEvent('pomodoroCompleted', {
                        detail: {
                            timestamp: new Date().toISOString(),
                            duration: settings.focusDuration
                        }
                    }));
                }

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

    let audioContext = null;

    function playIntervalChime() {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            const duration = 2.0; // Seconds

            // Soft master volume
            const masterGain = audioContext.createGain();
            masterGain.gain.setValueAtTime(0, audioContext.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.1); // Soft attack
            masterGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration); // Long fade
            masterGain.connect(audioContext.destination);

            // First oscillator (Base tone, e.g., Tibetan bowl fundamental)
            const osc1 = audioContext.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(432, audioContext.currentTime); // Relaxing frequency
            osc1.connect(masterGain);

            // Second oscillator (Slightly detuned for richness/chorus effect)
            const osc2 = audioContext.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(436, audioContext.currentTime);
            osc2.connect(masterGain);

            osc1.start();
            osc2.start();
            osc1.stop(audioContext.currentTime + duration);
            osc2.stop(audioContext.currentTime + duration);
        } catch (e) {
            console.error('Interval chime playback failed:', e);
        }
    }

    // Notification sounds are made in the browser (Web Audio): no download,
    // works offline, no third-party request.
    function getAudioContext() {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();
        return audioContext;
    }

    // One struck tone: sine partials with a fast attack and an exponential decay.
    function strike(ctx, when, partials, decay, volume) {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(volume, when + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
        gain.connect(ctx.destination);
        partials.forEach(([freq, level]) => {
            const osc = ctx.createOscillator();
            const partGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, when);
            partGain.gain.value = level;
            osc.connect(partGain).connect(gain);
            osc.start(when);
            osc.stop(when + decay + 0.05);
        });
    }

    function playSound(kind) {
        if (!kind || kind === 'none') return;
        try {
            const ctx = getAudioContext();
            const t = ctx.currentTime + 0.02;
            if (kind === 'bell') {
                // Service bell: bright, inharmonic partials, ~1.5 s ring.
                strike(ctx, t, [[1318, 1], [3163, 0.45], [4430, 0.25], [6590, 0.12]], 1.6, 0.35);
            } else if (kind === 'chime') {
                // Soft wind chime: four notes going down.
                [1568, 1319, 1175, 988].forEach((f, i) => strike(ctx, t + i * 0.22, [[f, 1], [f * 2.76, 0.2]], 1.8, 0.18));
            } else if (kind === 'digital') {
                // Two short beeps.
                [0, 0.18].forEach(offset => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.value = 1760;
                    gain.gain.setValueAtTime(0.08, t + offset);
                    gain.gain.setValueAtTime(0.0001, t + offset + 0.1);
                    osc.connect(gain).connect(ctx.destination);
                    osc.start(t + offset);
                    osc.stop(t + offset + 0.12);
                });
            }
        } catch (e) {
            console.error('Sound playback failed:', e);
        }
    }

    function playNotification() {
        playSound(settings.audioNotification);

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
        playSound(audioNotificationSelect.value);
    }

    function updateLongBreakInfo() {
        if (!sessionsUntilLongDisplay) return;
        const sessionsUntilLongBreak = settings.sessionsBeforeLongBreak - (sessionCount % settings.sessionsBeforeLongBreak);
        sessionsUntilLongDisplay.textContent = sessionsUntilLongBreak;
    }
});
