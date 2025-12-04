// routine.test.js

// --- Mockups & Helpers ---
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="routine">
        <select id="routine-select"></select>
        <div id="current-routine-name"></div>
        <ul id="current-routine-tasks"></ul>
        <span id="manage-total-duration"></span>
        <div id="player-current-routine-name"></div>
        <ul id="player-routine-tasks"></ul>
        <div id="expected-finish-time"></div>
        <input id="routine-name" type="text" />
        <input id="task-name" type="text" />
        <input id="task-duration" type="number" />
        <input id="task-break-duration" type="number" />
        <input id="routine-start-time" type="time" />
        <button id="create-routine-btn"></button>
        <!-- Button removed in DOM but defined in JS to avoid error, so we mock it here if needed, or let it be null -->
        <button id="add-task-to-routine-btn"></button> 
        <button id="set-start-time-btn"></button>
        <button id="start-selected-routine-btn"></button>
        <div class="routine-controls"></div>
        <div id="active-routine-display"></div>
        <div id="current-task-name"></div>
        <div id="current-task-time-left"></div>
        <div id="current-task-display"></div>
        <canvas id="routine-pie-chart"></canvas>
    </div>
</body></html>`);
global.window = dom.window;
global.document = dom.window.document;
global.window.EventBus = { addEventListener: () => { } };
global.alert = () => { };

// Mock localStorage and canvas context before loading script
const mockLocalStorage = (() => {
    let store = {};
    return {
        getItem: key => store[key] || null,
        setItem: (key, value) => store[key] = value.toString(),
        clear: () => store = {},
        removeItem: key => delete store[key]
    };
})();
global.localStorage = mockLocalStorage;
dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => { },
    beginPath: () => { },
    arc: () => { },
    moveTo: () => { },
    closePath: () => { },
    fill: () => { },
    stroke: () => { },
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: ''
});

require('./routine.js');
document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
Object.assign(global, {
    initializeRoutines: window.initializeRoutines,
    createRoutineHandler: window.createRoutineHandler,
    addTaskAt: window.addTaskAt, // Updated from addTaskToRoutineHandler
    activateRoutine: window.activateRoutine,
    manualAdvanceTask: window.manualAdvanceTask,
    editTaskInRoutine: window.editTaskInRoutine,
    deleteTaskFromRoutine: window.deleteTaskFromRoutine,
});

// Simple assertion helper
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion Failed: ${message}`);
    }
    console.log(`Assertion Passed: ${message}`);
}

// --- Test Suite ---
function runRoutineTests() {
    console.log("--- Running Routine Tool Unit Tests ---");

    window.__SKIP_DEFAULT_ROUTINES__ = true;

    // Test 1: Create a new routine
    try {
        localStorage.clear();
        initializeRoutines();
        if (typeof initializeRoutines !== 'function' || typeof createRoutineHandler !== 'function') {
            console.error("Routine functions not available for testing. Load routine.js first or structure for testability.");
            return;
        }

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Morning Routine";
        createRoutineHandler();

        const routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        assert(routines.length === 1, "Routine created and saved.");
        assert(routines[0].name === "Morning Routine", "Routine has correct name.");
        assert(routines[0].tasks.length === 0, "New routine has no tasks.");
        console.log("Test 1 Passed: Create Routine");
    } catch (e) {
        console.error("Test 1 Failed: Create Routine - ", e);
    }

    // Test 2: Add a task to a routine
    try {
        localStorage.clear();
        initializeRoutines();

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Evening Routine";
        createRoutineHandler();

        // Use new addTaskAt function
        // addTaskAt(index, name, duration)
        addTaskAt(0, "Read Book", 30);

        const routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        assert(routines[0].tasks.length === 1, "Task added to routine.");
        assert(routines[0].tasks[0].name === "Read Book", "Task has correct name.");
        assert(routines[0].tasks[0].duration === 30, "Task has correct duration.");
        assert(routines[0].totalDuration === 30, "Routine total duration updated.");
        console.log("Test 2 Passed: Add Task");
    } catch (e) {
        console.error("Test 2 Failed: Add Task - ", e);
    }

    // Test 2b: Reject invalid task input
    try {
        console.log("--- Running Test 2b: Reject Invalid Task ---");
        localStorage.clear();
        initializeRoutines();

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Validation Routine";
        createRoutineHandler();

        // Attempt to add an invalid task (negative duration)
        addTaskAt(0, " ", -5);

        const routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        assert(routines[0].tasks.length === 0, "Invalid task data is ignored.");
        console.log("Test 2b Passed: Reject Invalid Task");
    } catch (e) {
        console.error("Test 2b Failed: Reject Invalid Task - ", e);
    }

    // Test 3: Start a routine and first task (basic check)
    try {
        localStorage.clear();
        initializeRoutines();

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Work Sprint";
        createRoutineHandler();

        addTaskAt(0, "Code Review", 25);
        addTaskAt(1, "Documentation", 15);

        const routineToStart = JSON.parse(localStorage.getItem('adhd-tool-routines'))[0];
        activateRoutine(routineToStart.id);

        const currentTaskDisplay = document.getElementById('current-task-name').textContent;
        assert(currentTaskDisplay === "Code Review", "First task name displayed correctly.");
        console.log("Test 3 Passed: Start Routine and First Task");
    } catch (e) {
        console.error("Test 3 Failed: Start Routine - ", e);
    }

    // Test 3b: Prevent starting an empty routine
    try {
        console.log("--- Running Test 3b: Prevent Empty Routine Start ---");
        localStorage.clear();
        initializeRoutines();

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Empty Routine";
        createRoutineHandler();

        const routineToStart = JSON.parse(localStorage.getItem('adhd-tool-routines'))[0];
        const startButton = document.getElementById('start-selected-routine-btn');
        activateRoutine(routineToStart.id);

        assert(startButton.disabled === false, "Start button remains enabled when routine activation is rejected.");
        assert(document.getElementById('current-task-name').textContent === "", "No task is started for empty routines.");
        console.log("Test 3b Passed: Prevent Empty Routine Start");
    } catch (e) {
        console.error("Test 3b Failed: Prevent Empty Routine Start - ", e);
    }

    // Test 4: Manual task advance (basic check)
    try {
        // Assumes state from Test 3
        manualAdvanceTask();
        const currentTaskDisplay = document.getElementById('current-task-name').textContent;
        assert(currentTaskDisplay === "Documentation", "Second task name displayed after manual advance.");
        manualAdvanceTask();
        const routineFinishedDisplay = document.getElementById('current-task-name').textContent;
        assert(routineFinishedDisplay === "Routine Finished!", "Routine finishes after all tasks advanced.");
        console.log("Test 4 Passed: Manual Task Advance");

    } catch (e) {
        console.error("Test 4 Failed: Manual Task Advance - ", e);
    }

    // Test 5: Edit a task in a routine
    try {
        console.log("--- Running Test 5: Edit Task ---");
        localStorage.clear();
        initializeRoutines();

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Test Routine For Edit";
        createRoutineHandler();

        let routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        const routine1 = routines[0];

        addTaskAt(0, "Original Task", 20);

        routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        const updatedRoutine1 = routines.find(r => r.id === routine1.id);
        const task1_id = updatedRoutine1.tasks[0].id;

        editTaskInRoutine(task1_id, "Updated Task Name", 30);

        routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        const finalRoutine1 = routines.find(r => r.id === routine1.id);
        const editedTask = finalRoutine1.tasks.find(t => t.id === task1_id);

        assert(editedTask.name === "Updated Task Name", "Task name updated correctly.");
        assert(editedTask.duration === 30, "Task duration updated correctly.");
        assert(finalRoutine1.totalDuration === 30, "Routine totalDuration recalculated correctly after edit.");
        console.log("Test 5 Passed: Edit Task");
    } catch (e) {
        console.error("Test 5 Failed: Edit Task - ", e);
    }

    // Test 6: Delete a task from a routine
    try {
        console.log("--- Running Test 6: Delete Task ---");
        localStorage.clear();
        initializeRoutines();

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Test Routine For Delete";
        createRoutineHandler();

        let routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        const routine2 = routines[0];

        addTaskAt(0, "Task A", 10);
        addTaskAt(1, "Task B", 15);

        routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        const initialRoutine2 = routines.find(r => r.id === routine2.id);
        const taskA_id = initialRoutine2.tasks.find(t => t.name === "Task A").id;
        const taskB_id = initialRoutine2.tasks.find(t => t.name === "Task B").id;
        assert(initialRoutine2.totalDuration === 25, "Initial totalDuration is correct (25).");

        deleteTaskFromRoutine(taskA_id);

        routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        const finalRoutine2 = routines.find(r => r.id === routine2.id);

        assert(finalRoutine2.tasks.length === 1, "Routine tasks length is 1 after delete.");
        assert(finalRoutine2.tasks[0].id === taskB_id, "Remaining task is Task B.");
        assert(finalRoutine2.tasks[0].name === "Task B", "Remaining task name is correct.");
        assert(finalRoutine2.totalDuration === 15, "Routine totalDuration recalculated correctly after delete (15).");
        console.log("Test 6 Passed: Delete Task");
    } catch (e) {
        console.error("Test 6 Failed: Delete Task - ", e);
    }

    // Test 7: Tap to advance task
    try {
        console.log("--- Running Test 7: Tap Advance ---");
        localStorage.clear();
        initializeRoutines();

        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Tap Routine";
        createRoutineHandler();

        addTaskAt(0, "Task One", 5);
        addTaskAt(1, "Task Two", 5);

        const routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        activateRoutine(routines[0].id);

        // Simulate tap on pie chart canvas if possible, or just check manualAdvanceTask logic which is covered by Test 4.
        // But here we want to test the event listener if possible.
        // The event listener is attached to routinePieChartCanvas.
        const canvas = document.getElementById('routine-pie-chart');
        if (canvas) {
            canvas.dispatchEvent(new dom.window.Event('click'));
            const curName = document.getElementById('current-task-name').textContent;
            assert(curName === "Task Two", "Tap event advances to next task.");
            console.log("Test 7 Passed: Tap Advance");
        } else {
            console.warn("Test 7 Skipped: Canvas not found (mocking issue?)");
        }

    } catch (e) {
        console.error("Test 7 Failed: Tap Advance - ", e);
    }

    console.log("--- Routine Tool Unit Tests Finished ---");
}

runRoutineTests();
