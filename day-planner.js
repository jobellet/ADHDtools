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

    // Generate time blocks grouped into hour rows (each row contains 4 columns)
    function generateTimeBlocks() {
        timeBlocksContainer.innerHTML = '';
        // Loop through each hour from 6 AM to 9 PM (10 PM is not included)
        for (let hour = 6; hour < 22; hour++) {
            // Create a container for the hour row
            const hourRow = document.createElement('div');
            hourRow.className = 'hour-row';

            // Create an hour label element (e.g. "6 AM")
            const hourLabel = document.createElement('div');
            hourLabel.className = 'hour-label';
            hourLabel.textContent = formatHourLabel(hour);
            hourRow.appendChild(hourLabel);

            // Create a container for the four 15-minute columns
            const timeBlocksRowContainer = document.createElement('div');
            timeBlocksRowContainer.className = 'time-blocks-row';

            // Create each 15-minute time block
            for (let minute of [0, 15, 30, 45]) {
                const timeBlock = document.createElement('div');
                timeBlock.className = 'time-block';

                const timeLabel = document.createElement('div');
                timeLabel.className = 'time-label';
                timeLabel.textContent = formatTime(hour, minute);

                const eventContent = document.createElement('div');
                eventContent.className = 'event-content';
                eventContent.contentEditable = true;
                // Use composite time key e.g. "6-15"
                const timeKey = `${hour}-${minute}`;
                eventContent.dataset.time = timeKey;

                // Load saved content if exists
                const savedContent = localStorage.getItem(`day-planner-${timeKey}`);
                if (savedContent) {
                    eventContent.textContent = savedContent;
                }

                // Save content when edited
                eventContent.addEventListener('blur', function() {
                    localStorage.setItem(`day-planner-${timeKey}`, this.textContent);
                    updateSlotStyles(); // Refresh styling immediately
                });

                timeBlock.appendChild(timeLabel);
                timeBlock.appendChild(eventContent);
                timeBlocksRowContainer.appendChild(timeBlock);
            }

            hourRow.appendChild(timeBlocksRowContainer);
            timeBlocksContainer.appendChild(hourRow);
        }
    }

    // Format time for each 15-minute slot (e.g. "6:15 AM")
    function formatTime(hour, minute = 0) {
        const period = hour >= 12 ? 'PM' : 'AM';
        let displayHour = hour % 12;
        if (displayHour === 0) displayHour = 12;
        const minuteStr = minute.toString().padStart(2, '0');
        return `${displayHour}:${minuteStr} ${period}`;
    }

    // Format the hour label (e.g. "6 AM")
    function formatHourLabel(hour) {
        const period = hour >= 12 ? 'PM' : 'AM';
        let displayHour = hour % 12;
        if (displayHour === 0) displayHour = 12;
        return `${displayHour} ${period}`;
    }

    // Populate the event time select dropdown with 15-minute intervals
    function populateTimeOptions() {
        eventTimeSelect.innerHTML = '';
        for (let hour = 6; hour < 22; hour++) {
            for (let minute of [0, 15, 30, 45]) {
                const option = document.createElement('option');
                const timeKey = `${hour}-${minute}`;
                option.value = timeKey;
                option.textContent = formatTime(hour, minute);
                eventTimeSelect.appendChild(option);
            }
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

    addEventBtn.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);

    // Close modal when clicking outside the modal content
    window.addEventListener('click', function(e) {
        if (e.target === eventModal) {
            closeModal();
        }
    });

    // Handle form submission to add an event to a specific 15-minute slot
    eventForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const eventTitle = eventTitleInput.value.trim();
        const timeKey = eventTimeSelect.value;

        if (!eventTitle) return;

        const eventContent = document.querySelector(`.event-content[data-time="${timeKey}"]`);
        if (eventContent) {
            // Append a new event div
            eventContent.innerHTML += `<div class="event">${eventTitle}</div>`;
            localStorage.setItem(`day-planner-${timeKey}`, eventContent.innerHTML);
        }
        closeModal();
    });

    // Clear all events functionality
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all events?')) {
                for (let hour = 6; hour < 22; hour++) {
                    for (let minute of [0, 15, 30, 45]) {
                        const key = `day-planner-${hour}-${minute}`;
                        localStorage.removeItem(key);
                    }
                }
                generateTimeBlocks();
            }
        });
    }

    // Initialize time blocks
    generateTimeBlocks();

    // Highlight current time slot (15-minute block) within the hour rows

    function updateSlotStyles() {
      const now = new Date();
      document.querySelectorAll('.event-content').forEach(el => {
        // Remove any previously set classes and progress bar elements
        el.classList.remove('past-slot', 'current-slot');
        const existingProgress = el.querySelector('.progress-bar-container');
        if (existingProgress) {
          existingProgress.remove();
        }
        // Get the slot hour and minute from the element's dataset (e.g. "6-15")
        const timeKey = el.dataset.time; 
        const [hourStr, minuteStr] = timeKey.split('-');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        // Construct slot start and end times for today
        const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
        const slotEnd = new Date(slotStart.getTime() + 15 * 60000);

        if (now >= slotEnd) {
          // Slot is in the past: add a class to gray it out
          el.classList.add('past-slot');
        } else if (now >= slotStart && now < slotEnd) {
          // Current slot: add class and update progress bar
          el.classList.add('current-slot');
          const progress = ((now - slotStart) / (slotEnd - slotStart)) * 100;

          // Create a progress bar container
          const progressContainer = document.createElement('div');
          progressContainer.className = 'progress-bar-container';
          // Create the progress bar element
          const progressBar = document.createElement('div');
          progressBar.className = 'progress-bar';
          progressBar.style.width = progress + '%';
          progressContainer.appendChild(progressBar);
          el.appendChild(progressContainer);
        }
        // Future slots require no additional styling
      });
    }

    // Call updateSlotStyles initially and then update periodically (e.g. every 30 seconds)
    updateSlotStyles();
    setInterval(updateSlotStyles, 30000);

    // (Removed highlightCurrentTimeSlot calls—using updateSlotStyles interval above)

});
