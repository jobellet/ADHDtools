// Update index.html to include the new JavaScript files
document.addEventListener('DOMContentLoaded', function() {
    // Add script tags for calendar integration and cross-tool interaction
    const calendarScript = document.createElement('script');
    calendarScript.src = 'calendar-integration.js';
    document.body.appendChild(calendarScript);
    
    const crossToolScript = document.createElement('script');
    crossToolScript.src = 'cross-tool-interaction.js';
    document.body.appendChild(crossToolScript);
    
    // Add celebration container for rewards
    const celebrationContainer = document.createElement('div');
    celebrationContainer.id = 'celebration-container';
    document.body.appendChild(celebrationContainer);
    
    console.log('Additional scripts and elements loaded');
});
