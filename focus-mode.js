// Focus Mode Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the focus mode page
    if (!document.querySelector('.focus-mode-container')) return;

    const startFocusBtn = document.getElementById('start-focus-btn');
    const exitFocusBtn = document.getElementById('exit-focus-btn');
    const focusDurationSelect = document.getElementById('focus-duration');
    const focusGoalInput = document.getElementById('focus-goal');
    const focusContainer = document.getElementById('focus-container');
    const focusTimer = document.getElementById('focus-timer');
    const focusGoalDisplay = document.getElementById('focus-goal-display');
    const distractionCounter = document.getElementById('distraction-counter');
    const addDistractionBtn = document.getElementById('add-distraction-btn');
    const distractionList = document.getElementById('distraction-list');
    const motivationalQuote = document.getElementById('motivational-quote');
    
    // Focus mode variables
    let timer;
    let minutes;
    let seconds;
    let distractions = [];
    let isInFocusMode = false;
    
    // Quotes for motivation
    const quotes = [
        "The secret of getting ahead is getting started. - Mark Twain",
        "You don't have to be great to start, but you have to start to be great. - Zig Ziglar",
        "Focus on being productive instead of busy. - Tim Ferriss",
        "It's not about having time, it's about making time. - Unknown",
        "The way to get started is to quit talking and begin doing. - Walt Disney",
        "Don't watch the clock; do what it does. Keep going. - Sam Levenson",
        "Productivity is never an accident. It is always the result of a commitment to excellence. - Paul J. Meyer",
        "You miss 100% of the shots you don't take. - Wayne Gretzky",
        "The most effective way to do it, is to do it. - Amelia Earhart",
        "Start where you are. Use what you have. Do what you can. - Arthur Ashe"
    ];
    
    // Start focus mode
    function startFocusMode() {
        if (!focusGoalInput.value.trim()) {
            alert('Please enter a focus goal');
            return;
        }
        
        isInFocusMode = true;
        
        // Set duration
        minutes = parseInt(focusDurationSelect.value);
        seconds = 0;
        
        // Display goal
        focusGoalDisplay.textContent = focusGoalInput.value.trim();
        
        // Clear distractions
        distractions = [];
        distractionList.innerHTML = '';
        distractionCounter.textContent = '0';
        
        // Display random quote
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        motivationalQuote.textContent = randomQuote;
        
        // Update UI
        document.body.classList.add('focus-mode-active');
        focusContainer.classList.add('active');
        
        // Start timer
        updateTimerDisplay();
        timer = setInterval(updateTimer, 1000);
        
        // Request fullscreen if available
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Error attempting to enable fullscreen:', err);
            });
        }
        
        // Store session start in localStorage
        const focusSession = {
            goal: focusGoalInput.value.trim(),
            duration: minutes,
            startTime: new Date().toISOString(),
            distractions: []
        };
        localStorage.setItem('current-focus-session', JSON.stringify(focusSession));
    }
    
    // Exit focus mode
    function exitFocusMode(completed = false) {
        isInFocusMode = false;
        
        // Clear timer
        clearInterval(timer);
        
        // Update UI
        document.body.classList.remove('focus-mode-active');
        focusContainer.classList.remove('active');
        
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.log('Error attempting to exit fullscreen:', err);
            });
        }
        
        // Get current session from localStorage
        const focusSession = JSON.parse(localStorage.getItem('current-focus-session')) || {};
        
        // Update session with end time and distractions
        focusSession.endTime = new Date().toISOString();
        focusSession.completed = completed;
        focusSession.distractions = distractions;
        
        // Save to history
        const focusHistory = JSON.parse(localStorage.getItem('focus-history')) || [];
        focusHistory.push(focusSession);
        localStorage.setItem('focus-history', JSON.stringify(focusHistory));
        
        // Clear current session
        localStorage.removeItem('current-focus-session');
        
        // Show summary
        if (completed) {
            alert(`Focus session completed! You had ${distractions.length} distractions.`);
        } else {
            alert(`Focus session ended early. You had ${distractions.length} distractions.`);
        }
    }
    
    // Update timer
    function updateTimer() {
        if (seconds === 0) {
            if (minutes === 0) {
                // Timer completed
                clearInterval(timer);
                exitFocusMode(true);
                return;
            }
            minutes--;
            seconds = 59;
        } else {
            seconds--;
        }
        
        updateTimerDisplay();
    }
    
    // Update timer display
    function updateTimerDisplay() {
        focusTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Add distraction
    function addDistraction() {
        if (!isInFocusMode) return;
        
        const timestamp = new Date().toISOString();
        const distraction = {
            timestamp,
            timeDisplay: new Date().toLocaleTimeString()
        };
        
        distractions.push(distraction);
        
        // Update counter
        distractionCounter.textContent = distractions.length;
        
        // Add to list
        const distractionItem = document.createElement('div');
        distractionItem.className = 'distraction-item';
        distractionItem.textContent = `Distraction at ${distraction.timeDisplay}`;
        distractionList.appendChild(distractionItem);
        
        // Update session in localStorage
        const focusSession = JSON.parse(localStorage.getItem('current-focus-session')) || {};
        focusSession.distractions = distractions;
        localStorage.setItem('current-focus-session', JSON.stringify(focusSession));
    }
    
    // Event listeners
    if (startFocusBtn) {
        startFocusBtn.addEventListener('click', startFocusMode);
    }
    
    if (exitFocusBtn) {
        exitFocusBtn.addEventListener('click', function() {
            exitFocusMode(false);
        });
    }
    
    if (addDistractionBtn) {
        addDistractionBtn.addEventListener('click', addDistraction);
    }
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Alt+D to add distraction
        if (isInFocusMode && e.altKey && e.key === 'd') {
            addDistraction();
        }
        
        // Escape to exit focus mode
        if (isInFocusMode && e.key === 'Escape') {
            exitFocusMode(false);
        }
    });
    
    // Check for existing session on page load
    const existingSession = JSON.parse(localStorage.getItem('current-focus-session'));
    if (existingSession) {
        // Calculate remaining time
        const startTime = new Date(existingSession.startTime);
        const elapsedMinutes = Math.floor((new Date() - startTime) / (1000 * 60));
        const remainingMinutes = Math.max(0, existingSession.duration - elapsedMinutes);
        
        if (remainingMinutes > 0) {
            // Restore session
            focusGoalInput.value = existingSession.goal;
            focusDurationSelect.value = existingSession.duration;
            
            // Ask if user wants to resume
            if (confirm('You have an unfinished focus session. Would you like to resume?')) {
                minutes = remainingMinutes;
                seconds = 0;
                distractions = existingSession.distractions || [];
                
                // Restore UI
                focusGoalDisplay.textContent = existingSession.goal;
                distractionCounter.textContent = distractions.length;
                
                // Restore distraction list
                distractionList.innerHTML = '';
                distractions.forEach(distraction => {
                    const distractionItem = document.createElement('div');
                    distractionItem.className = 'distraction-item';
                    distractionItem.textContent = `Distraction at ${distraction.timeDisplay}`;
                    distractionList.appendChild(distractionItem);
                });
                
                // Start timer
                isInFocusMode = true;
                document.body.classList.add('focus-mode-active');
                focusContainer.classList.add('active');
                updateTimerDisplay();
                timer = setInterval(updateTimer, 1000);
            } else {
                // Clear session
                localStorage.removeItem('current-focus-session');
            }
        } else {
            // Session expired
            localStorage.removeItem('current-focus-session');
        }
    }
});
