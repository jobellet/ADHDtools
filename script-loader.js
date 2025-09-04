// Update index.html to include the new JavaScript files
document.addEventListener('DOMContentLoaded', function() {
    // Load Google Calendar integration only if credentials are provided
    const clientId = localStorage.getItem('gcalClientId');
    const apiKey = localStorage.getItem('gcalApiKey');
    if (clientId && apiKey && !document.querySelector('script[src="calendar-integration.js"]')) {
        const calendarScript = document.createElement('script');
        calendarScript.src = 'calendar-integration.js';
        document.body.appendChild(calendarScript);
    }

    // Add celebration container for rewards
    const celebrationContainer = document.createElement('div');
    celebrationContainer.id = 'celebration-container';
    document.body.appendChild(celebrationContainer);

    console.log('Additional scripts and elements loaded');
});
