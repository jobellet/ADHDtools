// Google Calendar Integration
document.addEventListener('DOMContentLoaded', function() {
    // Retrieve credentials from localStorage; skip if not provided
    const CLIENT_ID = localStorage.getItem('gcalClientId');
    const API_KEY = localStorage.getItem('gcalApiKey');
    if (!CLIENT_ID || !API_KEY) {
        console.warn('Google Calendar integration skipped: missing credentials');
        return;
    }
    
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
            if (gapi.client.getToken()) {
                const signoutButtons = document.querySelectorAll('#signout-button');
                signoutButtons.forEach(button => {
                    button.disabled = false;
                    button.addEventListener('click', handleSignoutClick);
                });
                loadCalendarEvents();
            }
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

            localStorage.removeItem('adhd-calendar-events');
            window.EventBus.dispatchEvent(new Event('calendarEventsUpdated'));
        }
    }
    
    // Load calendar events
    async function loadCalendarEvents() {
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);

            const response = await gapi.client.calendar.events.list({
                calendarId: 'primary',
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                showDeleted: false,
                singleEvents: true,
                orderBy: 'startTime'
            });

            const events = (response.result.items || []).map(ev => {
                const start = ev.start.dateTime || ev.start.date;
                const end = ev.end && (ev.end.dateTime || ev.end.date);
                const startStr = new Date(start).toISOString().slice(0,16);
                const endStr = end ? new Date(end).toISOString().slice(0,16) : null;
                return {
                    title: ev.summary || '',
                    start: startStr,
                    end: endStr
                };
            });

            localStorage.setItem('adhd-calendar-events', JSON.stringify(events));
            window.EventBus.dispatchEvent(new Event('calendarEventsUpdated'));
        } catch (err) {
            console.error('Error loading calendar events:', err);
            const statusElements = document.querySelectorAll('#calendar-status');
            statusElements.forEach(el => {
                el.textContent = 'Error loading calendar events: ' + err.message;
            });
        }
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
