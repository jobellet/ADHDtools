document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the day planner page
    if (!document.querySelector('.day-planner-container')) return;

    const currentDate = new Date();
    const dateDisplay = document.getElementById('current-date');
    const timeBlocksContainer = document.getElementById('time-blocks');
    const addEventBtn = document.getElementById('add-event-btn');
    const clearBtn = document.getElementById('clear-events-btn');

    // Modal elements
    const eventModal = document.getElementById('event-modal');
    const closeButton = eventModal.querySelector('.close-button');
    const eventForm = document.getElementById('event-form');
    const eventTitleInput = document.getElementById('event-title');
    const eventTimeSelect = document.getElementById('event-time');

    // Format and display current date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = currentDate.toLocaleDateString('en-US', options);

    // Generate time blocks from 6 AM to 10 PM
    function generateTimeBlocks() {
        timeBlocksContainer.innerHTML = '';

        for (let hour = 6; hour < 22; hour++) {
            const timeBlock = document.createElement('div');
            timeBlock.className = 'time-block';

            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = formatTime(hour);

            const eventContent = document.createElement('div');
            eventContent.className = 'event-content';
            eventContent.contentEditable = true;
            eventContent.dataset.hour = hour;

            // Load saved content if exists
            const savedContent = localStorage.getItem(`day-planner-${hour}`);
            if (savedContent) {
                eventContent.innerHTML = savedContent;
            }

            // Save content when edited
            eventContent.addEventListener('blur', function() {
                localStorage.setItem(`day-planner-${hour}`, this.innerHTML);
            });

            timeBlock.appendChild(timeLabel);
            timeBlock.appendChild(eventContent);
            timeBlocksContainer.appendChild(timeBlock);
        }
    }

    // Format time to 12-hour format
    function formatTime(hour) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${displayHour}:00 ${period}`;
    }

    // Populate the event time select dropdown
    function populateTimeOptions() {
        eventTimeSelect.innerHTML = '';
        for (let hour = 6; hour < 22; hour++) {
            const option = document.createElement('option');
            option.value = hour;
            option.textContent = formatTime(hour);
            eventTimeSelect.appendChild(option);
        }
    }

    // Open the modal
    function openModal() {
        eventModal.classList.add('active');
        eventTitleInput.value = '';
        populateTimeOptions();
    }

    // Close the modal
    function closeModal() {
        eventModal.classList.remove('active');
    }

    // Add new event functionality using the modal
    addEventBtn.addEventListener('click', openModal);

    // Close modal when clicking on the close button
    closeButton.addEventListener('click', closeModal);

    // Close modal when clicking outside the modal content
    window.addEventListener('click', function(e) {
        if (e.target === eventModal) {
            closeModal();
        }
    });

    // Handle form submission
    eventForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const eventTitle = eventTitleInput.value.trim();
        const hour = parseInt(eventTimeSelect.value);

        if (!eventTitle) return;

        const eventContent = document.querySelector(`.event-content[data-hour="${hour}"]`);
        if (eventContent) {
            // Append a new event div
            eventContent.innerHTML += `<div class="event">${eventTitle}</div>`;
            localStorage.setItem(`day-planner-${hour}`, eventContent.innerHTML);
        }
        closeModal();
    });

    // Clear all events functionality
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all events?')) {
                for (let hour = 6; hour < 22; hour++) {
                    localStorage.removeItem(`day-planner-${hour}`);
                }
                generateTimeBlocks();
            }
        });
    }

    // Initialize time blocks
    generateTimeBlocks();

    // Highlight current hour
    function highlightCurrentHour() {
        const currentHour = new Date().getHours();
        const currentBlock = document.querySelector(`.event-content[data-hour="${currentHour}"]`);

        // Remove highlight from all blocks
        document.querySelectorAll('.event-content').forEach(block => {
            block.classList.remove('current-hour');
        });

        // Add highlight to current block if within our time range
        if (currentBlock && currentHour >= 6 && currentHour < 22) {
            currentBlock.classList.add('current-hour');
        }
    }

    // Initial highlight and set interval to update every minute
    highlightCurrentHour();
    setInterval(highlightCurrentHour, 60000);
});
