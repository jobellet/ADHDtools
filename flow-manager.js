// flow-manager.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('Flow Manager Loaded');

    const flowToggleButton = document.getElementById('flow-mode-toggle');
    const flowContainer = document.getElementById('flow-container');
    const mainContainer = document.querySelector('main');
    const navContainer = document.querySelector('nav');

    let isFlowModeActive = false;

    const flowStates = {
        MORNING_ROUTINE: 'morning_routine',
        DAY_PLANNER: 'day_planner',
        FOCUS_SESSION: 'focus_session',
        BREAK: 'break',
        EVENING_ROUTINE: 'evening_routine',
        IDLE: 'idle'
    };

    let currentState = flowStates.IDLE;

    function initFlowManager() {
        console.log('Flow Manager Initialized');
        setCurrentStateByTime();
    }

    function setCurrentStateByTime() {
        const now = new Date();
        const hour = now.getHours();

        if (hour >= 5 && hour < 9) {
            setState(flowStates.MORNING_ROUTINE);
        } else if (hour >= 9 && hour < 18) {
            setState(flowStates.DAY_PLANNER);
        } else if (hour >= 18 && hour < 22) {
            setState(flowStates.EVENING_ROUTINE);
        } else {
            setState(flowStates.IDLE);
        }
    }

    function setState(newState) {
        if (currentState === newState) {
            return;
        }

        console.log(`Transitioning from ${currentState} to ${newState}`);
        currentState = newState;
        renderCurrentState();
    }

    function renderCurrentState() {
        flowContainer.innerHTML = ''; // Clear previous tool

        switch (currentState) {
            case flowStates.MORNING_ROUTINE:
                const routineTool = document.getElementById('routine');
                if (routineTool) {
                    flowContainer.appendChild(routineTool);
                }
                break;
            case flowStates.DAY_PLANNER:
                const plannerTool = document.getElementById('planner');
                if (plannerTool) {
                    flowContainer.appendChild(plannerTool);
                }
                break;
            case flowStates.FOCUS_SESSION:
                const pomodoroTool = document.getElementById('pomodoro');
                if (pomodoroTool) {
                    flowContainer.appendChild(pomodoroTool);
                    // Automatically enter focus mode
                    document.getElementById('enter-focus-mode').click();
                }
                break;
            case flowStates.BREAK:
                // For now, just show the pomodoro timer, which will be in break mode
                const pomodoroToolBreak = document.getElementById('pomodoro');
                if (pomodoroToolBreak) {
                    flowContainer.appendChild(pomodoroToolBreak);
                }
                break;
            case flowStates.EVENING_ROUTINE:
                const eveningRoutineTool = document.getElementById('routine');
                if (eveningRoutineTool) {
                    flowContainer.appendChild(eveningRoutineTool);
                }
                break;
            // Add other cases here as they are implemented
            default:
                break;
        }
    }

    function toggleFlowMode() {
        isFlowModeActive = !isFlowModeActive;
        if (isFlowModeActive) {
            mainContainer.classList.add('hidden');
            navContainer.classList.add('hidden');
            flowContainer.classList.remove('hidden');
            initFlowManager();
        } else {
            // Move tools back to main container if necessary
            const routineTool = document.getElementById('routine');
            if(routineTool) {
                mainContainer.querySelector('.container').appendChild(routineTool);
            }
            const plannerTool = document.getElementById('planner');
            if(plannerTool) {
                mainContainer.querySelector('.container').appendChild(plannerTool);
            }
            const pomodoroTool = document.getElementById('pomodoro');
            if(pomodoroTool) {
                mainContainer.querySelector('.container').appendChild(pomodoroTool);
            }
            mainContainer.classList.remove('hidden');
            navContainer.classList.remove('hidden');
            flowContainer.classList.add('hidden');
        }
    }

    flowToggleButton.addEventListener('click', toggleFlowMode);

    document.getElementById('start-focus-session-btn').addEventListener('click', () => {
        if (isFlowModeActive) {
            setState(flowStates.FOCUS_SESSION);
        }
    });

    document.addEventListener('routineComplete', (e) => {
        if (isFlowModeActive && currentState === flowStates.MORNING_ROUTINE) {
            console.log('Morning routine complete, transitioning to day planner.');
            setState(flowStates.DAY_PLANNER);
        }
    });

    document.addEventListener('focusSessionComplete', () => {
        if (isFlowModeActive) {
            setState(flowStates.BREAK);
        }
    });

    document.addEventListener('breakComplete', () => {
        if (isFlowModeActive) {
            setState(flowStates.FOCUS_SESSION);
        }
    });

    function checkTaskCompletion() {
        if (!isFlowModeActive || !window.DataManager) {
            return;
        }

        const tasks = window.DataManager.getTasks();
        const today = new Date().toISOString().slice(0, 10);
        const todaysTasks = tasks.filter(task => task.plannerDate && task.plannerDate.startsWith(today));

        if (todaysTasks.length > 0 && todaysTasks.every(task => task.isCompleted)) {
            setState(flowStates.EVENING_ROUTINE);
        }
    }

    window.EventBus.addEventListener('dataChanged', checkTaskCompletion);

    window.FlowManager = {
        init: initFlowManager,
        setState: setState,
        states: flowStates
    };
});
