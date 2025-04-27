// day-planner.js

document.addEventListener('DOMContentLoaded', function() {
    // Prevent multiple script loads from doubling event handlers
    if (window.dayPlannerInited) return;
    window.dayPlannerInited = true;

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
    // Ensure the import dropdown exists in the modal
    let importTaskSelect = document.getElementById('import-task');
    const importRootLabel = document.getElementById('import-root-label');
    if (!importTaskSelect) {
      importTaskSelect = document.createElement('select');
      importTaskSelect.id = 'import-task';
      importTaskSelect.innerHTML = '<option value="">--Select a step--</option>';
      // Insert before the Time label in the modal
      const timeLabel = document.querySelector('#event-form label[for="event-time"]');
      timeLabel.parentNode.insertBefore(importTaskSelect, timeLabel);
    }

    // Display current date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = currentDate.toLocaleDateString('en-US', options);

    // Gray out past slots and highlight current slot
    function updateSlotStyles() {
      const now = new Date();
      document.querySelectorAll('.time-block').forEach(block => {
        const timeKey = block.querySelector('.time-label').textContent;
        // parse "H:MM AM/PM"
        const [hStr, rest] = timeKey.split(':');
        const [mStr, period] = rest.split(' ');
        let hour = parseInt(hStr);
        if (period === 'PM' && hour < 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        const minute = parseInt(mStr);
        const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
        // Past
        if (slotTime < now) {
          block.classList.add('past');
        } else {
          block.classList.remove('past');
        }
        // Current
        if (hour === now.getHours() && minute === Math.floor(now.getMinutes()/15)*15) {
          block.classList.add('current');
        } else {
          block.classList.remove('current');
        }
      });
    }

    // Generate time blocks
    function generateTimeBlocks() {
        timeBlocksContainer.innerHTML = '';
        const now = new Date();
        for (let hour = 6; hour < 22; hour++) {
            const hourRow = document.createElement('div');
            hourRow.className = 'hour-row';

            const hourLabel = document.createElement('div');
            hourLabel.className = 'hour-label';
            hourLabel.textContent = formatHourLabel(hour);
            hourRow.appendChild(hourLabel);

            const rowContainer = document.createElement('div');
            rowContainer.className = 'time-blocks-row';

            [0,15,30,45].forEach(minute => {
                const timeBlock = document.createElement('div');
                timeBlock.className = 'time-block';
                timeBlock.style.position = 'relative';

                const timeKey = `${hour}-${minute}`;

                // Icon button to import breakdown step
                const importBtn = document.createElement('button');
                importBtn.className = 'breakdown-import-btn';
                importBtn.innerHTML = '<i class="fas fa-project-diagram"></i>';
                importBtn.style.position = 'absolute';
                importBtn.style.top = '4px';
                importBtn.style.right = '4px';
                importBtn.style.background = 'transparent';
                importBtn.style.border = 'none';
                importBtn.style.color = 'var(--primary-color)';
                importBtn.style.cursor = 'pointer';
                importBtn.style.opacity = '0.6';
                importBtn.addEventListener('mouseenter', () => importBtn.style.opacity = '1');
                importBtn.addEventListener('mouseleave', () => importBtn.style.opacity = '0.6');
                importBtn.title = 'Import a breakdown step';
                importBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    openModal();
                    // Pre-select this slot’s time and focus the import dropdown
                    eventTimeSelect.value = timeKey;
                    importTaskSelect.focus();
                });
                timeBlock.appendChild(importBtn);

                const timeLabel = document.createElement('div');
                timeLabel.className = 'time-label';
                timeLabel.textContent = formatTime(hour, minute);
                timeBlock.appendChild(timeLabel);

                const eventContent = document.createElement('div');
                eventContent.className = 'event-content';
                eventContent.dataset.time = timeKey;
                eventContent.contentEditable = true;
                const saved = localStorage.getItem(`day-planner-${timeKey}`);
                if (saved) eventContent.innerHTML = saved;

                eventContent.addEventListener('blur', () => {
                    localStorage.setItem(`day-planner-${timeKey}`, eventContent.innerHTML);
                    updateSlotStyles();
                });
                timeBlock.appendChild(eventContent);

                rowContainer.appendChild(timeBlock);
            });

            hourRow.appendChild(rowContainer);
            timeBlocksContainer.appendChild(hourRow);
        }
    }

    function formatHourLabel(h) {
        const period = h >= 12 ? 'PM' : 'AM';
        let hh = h % 12; if (hh === 0) hh = 12;
        return `${hh} ${period}`;
    }
    function formatTime(h,m) {
        const period = h >= 12 ? 'PM' : 'AM';
        let hh = h % 12; if (hh === 0) hh = 12;
        return `${hh}:${m.toString().padStart(2,'0')} ${period}`;
    }

    // Populate time select
    function populateTimeOptions() {
        eventTimeSelect.innerHTML = '';
        for (let h = 6; h < 22; h++) {
            [0,15,30,45].forEach(m => {
                const opt = document.createElement('option');
                opt.value = `${h}-${m}`;
                opt.textContent = formatTime(h,m);
                eventTimeSelect.appendChild(opt);
            });
        }
    }

    // Open modal
    function openModal() {
        eventModal.classList.add('active');
        eventTitleInput.value = '';
        populateTimeOptions();
        // Populate import dropdown with leaf steps
        importTaskSelect.innerHTML = '<option value="">--Select a step--</option>';
        const breakdown = JSON.parse(localStorage.getItem('adhd-breakdown-tasks')) || [];
        (function collectLeaves(nodes, path=[]) {
            nodes.forEach((node, idx) => {
                const newPath = path.concat(idx);
                if (!node.subtasks || node.subtasks.length===0) {
                    const opt = document.createElement('option');
                    opt.value = newPath.join('.');
                    opt.textContent = node.text;
                    importTaskSelect.appendChild(opt);
                } else {
                    collectLeaves(node.subtasks, newPath);
                }
            });
        })(breakdown);
        // Show root project name in bold
        const selectedPath = importTaskSelect.value;
        if (selectedPath) {
          const rootIndex = Number(selectedPath.split('.')[0]);
          const rootProject = breakdown[rootIndex] && breakdown[rootIndex].text;
          importRootLabel.textContent = rootProject || '';
        } else {
          importRootLabel.textContent = '';
        }
    }
    function closeModal() { eventModal.classList.remove('active'); }

    addEventBtn.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', e => { if (e.target===eventModal) closeModal(); });

    // Submit form
    eventForm.addEventListener('submit', e => {
        e.preventDefault();
        // Always import a leaf step; display uses root label
        const leaf = importTaskSelect.value;
        if (!leaf) return;  // must choose a step
        // find the leaf node
        const parts = leaf.split('.').map(Number);
        let arr = JSON.parse(localStorage.getItem('adhd-breakdown-tasks'))||[];
        let node = null;
        parts.forEach(i => { node = arr[i]; arr = node.subtasks||[]; });
        const title = node ? node.text : '';
        if (!title) return;
        const key = eventTimeSelect.value;
        const contentDiv = document.querySelector(`.event-content[data-time="${key}"]`);
        if (contentDiv) {
            contentDiv.innerHTML += `<div class="event">${title}</div>`;
            localStorage.setItem(`day-planner-${key}`, contentDiv.innerHTML);
        }
        closeModal();
    });

    // Clear events
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!confirm('Clear all events?')) return;
            for (let h=6; h<22; h++) for (let m of [0,15,30,45]) {
                localStorage.removeItem(`day-planner-${h}-${m}`);
            }
            generateTimeBlocks();
        });
    }

    // Init
    generateTimeBlocks();

    // Initial gray/past and current highlight
    updateSlotStyles();
    // Refresh every 30 seconds
    setInterval(updateSlotStyles, 30000);
});
