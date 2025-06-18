// Update index.html to include the new JavaScript files
document.addEventListener('DOMContentLoaded', function() {
    // Add script tags for calendar integration and cross-tool interaction
    const calendarScript = document.createElement('script');
    calendarScript.src = 'calendar-integration.js';
    document.body.appendChild(calendarScript);
    
    // Avoid loading cross-tool-interaction.js twice. If it's already
    // present in the document (e.g., included in the page head), don't
    // inject it again as re-running the script would recreate the
    // EventBus and break existing listeners.
    if (!document.querySelector('script[src="cross-tool-interaction.js"]')) {
        const crossToolScript = document.createElement('script');
        crossToolScript.src = 'cross-tool-interaction.js';
        document.body.appendChild(crossToolScript);
    }
    
    // Add celebration container for rewards
    const celebrationContainer = document.createElement('div');
    celebrationContainer.id = 'celebration-container';
    document.body.appendChild(celebrationContainer);
    
    console.log('Additional scripts and elements loaded');
});
