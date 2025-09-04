// Update index.html to include the new JavaScript files
document.addEventListener('DOMContentLoaded', function() {
    // Load Google Calendar integration only if credentials are provided
    const clientId = localStorage.getItem('gcalClientId');
    const apiKey = localStorage.getItem('gcalApiKey');
    if (clientId && apiKey) {
        const calendarScript = document.createElement('script');
        calendarScript.src = 'calendar-integration.js';
        document.body.appendChild(calendarScript);
    }

    // Avoid loading data-manager.js twice. If it's already
    // present in the document (e.g., included in the page head), don't
    // inject it again as re-running the script would recreate the
    // EventBus and break existing listeners.
    if (!document.querySelector('script[src="data-manager.js"]')) {
        const dataManagerScript = document.createElement('script');
        dataManagerScript.src = 'data-manager.js';
        document.body.appendChild(dataManagerScript);
    }

    // Add celebration container for rewards
    const celebrationContainer = document.createElement('div');
    celebrationContainer.id = 'celebration-container';
    document.body.appendChild(celebrationContainer);

    console.log('Additional scripts and elements loaded');
});
