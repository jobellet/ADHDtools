// Google Calendar Integration
document.addEventListener('DOMContentLoaded', function() {
    // Google API Client ID - would need to be replaced with a real one in production
    const CLIENT_ID = 'your-google-client-id.apps.googleusercontent.com';
    const API_KEY = 'your-api-key';
    
    // Authorization scopes required by the API
    const SCOPES = 'https://www.googleapis.com/auth/calendar';
    
    let tokenClient;
    let gapiInited = false;
    let gisInited = false;
    
    // Add Google Calendar integration buttons to relevant tools
    const calendarIntegrationButtons = `
        <div class="calendar-integration">
            <h3>Calendar Integration</h3>
            <div class="integration-buttons">
                <button id="authorize-button" class="btn btn-primary" disabled>
                    <i class="fas fa-calendar-alt"></i> Connect Google Calendar
                </button>
                <button id="signout-button" class="btn btn-secondary" disabled>
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
            <div id="calendar-status" class="status-message"></div>
        </div>
    `;
    
    // Add integration UI to relevant tools
    const dayPlannerContainer = document.querySelector('#planner .day-planner-container');
    const taskManagerContainer = document.querySelector('#tasks .task-manager-container');
    
    if (dayPlannerContainer) {
        dayPlannerContainer.insertAdjacentHTML('afterbegin', calendarIntegrationButtons);
    }
    
    if (taskManagerContainer) {
        taskManagerContainer.insertAdjacentHTML('afterbegin', calendarIntegrationButtons);
    }
    
    // Load the Google API client and auth libraries
    function loadGoogleLibraries() {
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.onload = gapiLoaded;
        document.head.appendChild(script1);
        
        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.onload = gisLoaded;
        document.head.appendChild(script2);
    }
    
    // Initialize the API client library
    function gapiLoaded() {
        gapi.load('client', initializeGapiClient);
    }
    
    // Initialize the gapi.client object
    async function initializeGapiClient() {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        });
        gapiInited = true;
        maybeEnableButtons();
    }
    
    // Initialize the tokenClient
    function gisLoaded() {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
        maybeEnableButtons();
    }
    
    // Enable buttons if libraries are loaded
    function maybeEnableButtons() {
        const authorizeButtons = document.querySelectorAll('#authorize-button');
        if (gapiInited && gisInited) {
            authorizeButtons.forEach(button => {
                button.disabled = false;
                button.addEventListener('click', handleAuthClick);
            });
        }
    }
    
    // Handle authorization
    function handleAuthClick() {
        const statusElements = document.querySelectorAll('#calendar-status');
        
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                statusElements.forEach(el => {
                    el.textContent = 'Error: ' + resp.error;
                });
                return;
            }
            
            const signoutButtons = document.querySelectorAll('#signout-button');
            signoutButtons.forEach(button => {
                button.disabled = false;
                button.addEventListener('click', handleSignoutClick);
            });
            
            statusElements.forEach(el => {
                el.textContent = 'Connected to Google Calendar';
            });
            
            // After successful auth, load calendar events
            await loadCalendarEvents();
        };
        
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    }
    
    // Handle sign-out
    function handleSignoutClick() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            
            const statusElements = document.querySelectorAll('#calendar-status');
            statusElements.forEach(el => {
                el.textContent = 'Disconnected from Google Calendar';
            });
            
            const signoutButtons = document.querySelectorAll('#signout-button');
            signoutButtons.forEach(button => {
                button.disabled = true;
            });
        }
    }
    
    // Load calendar events
    async function loadCalendarEvents() {
        try {
            const response = await gapi.client.calendar.events.list({
                'calendarId': 'primary',
                'timeMin': (new Date()).toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': 10,
                'orderBy': 'startTime'
            });
            
            const events = response.result.items;
            
            // Update Day Planner with calendar events
            if (events.length > 0) {
                events.forEach(event => {
                    const start = event.start.dateTime || event.start.date;
                    const startDate = new Date(start);
                    const hour = startDate.getHours();
                    
                    // Add to day planner if within time range
                    if (hour >= 6 && hour < 22) {
                        const eventContent = document.querySelector(`.event-content[data-hour="${hour}"]`);
                        if (eventContent) {
                            const eventDiv = document.createElement('div');
                            eventDiv.className = 'event google-event';
                            eventDiv.innerHTML = `${event.summary} <span class="event-source">(Google Calendar)</span>`;
                            eventContent.appendChild(eventDiv);
                            
                            // Save to localStorage to persist
                            localStorage.setItem(`day-planner-${hour}`, eventContent.innerHTML);
                        }
                    }
                    
                    // Add to task manager if it's a task-like event
                    if (event.summary.toLowerCase().includes('task') || 
                        event.summary.toLowerCase().includes('todo') ||
                        event.summary.toLowerCase().includes('to do')) {
                        addTaskFromCalendar(event.summary, startDate);
                    }
                });
            }
            
        } catch (err) {
            console.error('Error loading calendar events:', err);
            const statusElements = document.querySelectorAll('#calendar-status');
            statusElements.forEach(el => {
                el.textContent = 'Error loading calendar events: ' + err.message;
            });
        }
    }
    
    // Add a task from calendar event
    function addTaskFromCalendar(summary, dueDate) {
        // Get task list and add the task
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        
        // Create a new task from calendar event
        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';
        taskItem.dataset.priority = 'medium';
        taskItem.dataset.category = 'calendar';
        
        const formattedDate = dueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        taskItem.innerHTML = `
            <div class="task-content">
                <input type="checkbox" class="task-checkbox">
                <span class="task-text">${summary}</span>
                <span class="task-meta">
                    <span class="task-due-date">${formattedDate}</span>
                    <span class="task-source">Google Calendar</span>
                </span>
            </div>
            <div class="task-actions">
                <button class="task-edit"><i class="fas fa-edit"></i></button>
                <button class="task-delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        taskList.appendChild(taskItem);
        
        // Update task counts
        updateTaskCounts();
        
        // Save tasks to localStorage
        saveTasks();
    }
    
    // Export events to Google Calendar
    async function exportEventToCalendar(summary, startTime, endTime, description) {
        if (!gapi.client || !gapi.client.getToken()) {
            alert('Please connect to Google Calendar first');
            return;
        }
        
        try {
            const event = {
                'summary': summary,
                'description': description || 'Added from ADHD Tools Hub',
                'start': {
                    'dateTime': startTime.toISOString(),
                    'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                'end': {
                    'dateTime': endTime.toISOString(),
                    'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            };
            
            const request = gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event
            });
            
            request.execute(function(event) {
                console.log('Event created: ' + event.htmlLink);
                alert('Event added to Google Calendar');
            });
            
        } catch (err) {
            console.error('Error creating calendar event:', err);
            alert('Error creating calendar event: ' + err.message);
        }
    }
    
    // Add export buttons to day planner events
    function addExportButtonsToDayPlanner() {
        const timeBlocks = document.querySelectorAll('.time-block');
        timeBlocks.forEach(block => {
            const timeLabel = block.querySelector('.time-label').textContent;
            const exportBtn = document.createElement('button');
            exportBtn.className = 'export-to-calendar-btn';
            exportBtn.innerHTML = '<i class="fas fa-calendar-plus"></i>';
            exportBtn.title = 'Export to Google Calendar';
            
            exportBtn.addEventListener('click', function() {
                const eventContent = block.querySelector('.event-content');
                if (eventContent && eventContent.textContent.trim()) {
                    const hourMatch = timeLabel.match(/(\d+):00/);
                    if (hourMatch) {
                        const hour = parseInt(hourMatch[1]);
                        const isPM = timeLabel.includes('PM');
                        
                        // Calculate 24-hour format hour
                        let hour24 = hour;
                        if (isPM && hour !== 12) hour24 += 12;
                        if (!isPM && hour === 12) hour24 = 0;
                        
                        // Create start and end times
                        const today = new Date();
                        const startTime = new Date(today.setHours(hour24, 0, 0, 0));
                        const endTime = new Date(today.setHours(hour24 + 1, 0, 0, 0));
                        
                        // Get event text
                        const eventText = eventContent.textContent.trim();
                        
                        // Export to calendar
                        exportEventToCalendar(eventText, startTime, endTime);
                    }
                } else {
                    alert('Please add content to this time block first');
                }
            });
            
            block.appendChild(exportBtn);
        });
    }
    
    // Add export buttons to tasks
    function addExportButtonsToTasks() {
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach(task => {
            if (!task.querySelector('.export-to-calendar-btn')) {
                const taskActions = task.querySelector('.task-actions');
                if (taskActions) {
                    const exportBtn = document.createElement('button');
                    exportBtn.className = 'export-to-calendar-btn';
                    exportBtn.innerHTML = '<i class="fas fa-calendar-plus"></i>';
                    exportBtn.title = 'Export to Google Calendar';
                    
                    exportBtn.addEventListener('click', function() {
                        const taskText = task.querySelector('.task-text').textContent;
                        
                        // Create start and end times (default to tomorrow)
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(9, 0, 0, 0);
                        const endTime = new Date(tomorrow);
                        endTime.setHours(10, 0, 0, 0);
                        
                        // Export to calendar
                        exportEventToCalendar(taskText, tomorrow, endTime, 'Task from ADHD Tools Hub');
                    });
                    
                    taskActions.appendChild(exportBtn);
                }
            }
        });
    }
    
    // Initialize calendar integration
    function initCalendarIntegration() {
        // Load Google libraries
        loadGoogleLibraries();
        
        // Add export buttons when day planner is loaded
        const dayPlannerObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    // Check if time blocks were added
                    if (document.querySelector('.time-block')) {
                        addExportButtonsToDayPlanner();
                        dayPlannerObserver.disconnect();
                    }
                }
            });
        });
        
        const timeBlocksContainer = document.getElementById('time-blocks');
        if (timeBlocksContainer) {
            dayPlannerObserver.observe(timeBlocksContainer, { childList: true, subtree: true });
        }
        
        // Add export buttons when tasks are loaded or added
        const taskListObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    addExportButtonsToTasks();
                }
            });
        });
        
        const taskList = document.getElementById('task-list');
        if (taskList) {
            taskListObserver.observe(taskList, { childList: true, subtree: true });
        }
    }
    
    // Initialize calendar integration when DOM is loaded
    initCalendarIntegration();
});
