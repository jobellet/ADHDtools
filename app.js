// Main application JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Navigation functionality
    const navLinks = document.querySelectorAll('nav a');
    const toolSections = document.querySelectorAll('.tool-section');
    const toolCards = document.querySelectorAll('.tool-card');
    
    // Function to show a specific tool section
    function showToolSection(toolId) {
        // Hide all tool sections
        toolSections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Show the selected tool section
        const selectedSection = document.getElementById(toolId);
        if (selectedSection) {
            selectedSection.classList.add('active');
        }
        
        // Update active nav link
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-tool') === toolId) {
                link.classList.add('active');
            }
        });
        
        // Close mobile menu when a link is clicked
        const mainNavLinks = document.getElementById('main-nav-links');
        if (mainNavLinks && mainNavLinks.classList.contains('nav-open')) {
            mainNavLinks.classList.remove('nav-open');
            const hamburgerBtn = document.querySelector('.hamburger-menu');
            if (hamburgerBtn) {
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        }
        
        // Save the current tool to localStorage
        localStorage.setItem('currentTool', toolId);
    }
    
    // Add click event listeners to nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const toolId = this.getAttribute('data-tool');
            showToolSection(toolId);
        });
    });
    
    // Add click event listeners to tool cards
    toolCards.forEach(card => {
        card.addEventListener('click', function() {
            const toolId = this.getAttribute('data-tool');
            showToolSection(toolId);
        });
        
        // Make the button in the card also trigger the tool
        const button = card.querySelector('button');
        if (button) {
            button.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent the card click event
                const toolId = card.getAttribute('data-tool');
                showToolSection(toolId);
            });
        }
    });
    
    // Load the last active tool from localStorage, or default to home
    const currentTool = localStorage.getItem('currentTool') || 'home';
    showToolSection(currentTool);

    // Hamburger Menu Functionality
    const hamburgerBtn = document.querySelector('.hamburger-menu');
    const mainNavLinks = document.getElementById('main-nav-links');

    if (hamburgerBtn && mainNavLinks) {
        hamburgerBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent default behavior
            e.stopPropagation(); // Prevent event bubbling
            
            mainNavLinks.classList.toggle('nav-open');
            const isExpanded = mainNavLinks.classList.contains('nav-open');
            this.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (mainNavLinks.classList.contains('nav-open') && 
                !mainNavLinks.contains(e.target) && 
                e.target !== hamburgerBtn) {
                mainNavLinks.classList.remove('nav-open');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    
    // Initialize local storage for all tools if not already set
    if (!localStorage.getItem('pomodoroSettings')) {
        localStorage.setItem('pomodoroSettings', JSON.stringify({
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            sessionsBeforeLongBreak: 4,
            audioNotification: 'bell'
        }));
    }
    
    if (!localStorage.getItem('eisenhowerTasks')) {
        localStorage.setItem('eisenhowerTasks', JSON.stringify({
            q1: [], // Important & Urgent
            q2: [], // Important & Not Urgent
            q3: [], // Not Important & Urgent
            q4: []  // Not Important & Not Urgent
        }));
    }

    // Current Time Display in Header
    const timeDisplayElement = document.getElementById('current-time-display');

    if (timeDisplayElement) {
        function formatTwoDigits(num) {
            return num < 10 ? '0' + num : String(num);
        }

        function updateCurrentTime() {
            const now = new Date();
            const hours = formatTwoDigits(now.getHours());
            const minutes = formatTwoDigits(now.getMinutes());
            timeDisplayElement.textContent = `🕒 ${hours}:${minutes}`;
        }

        updateCurrentTime(); // Initial call
        setInterval(updateCurrentTime, 60000); // Update every minute
    }
});
