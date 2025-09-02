// routine.test.js

// --- Mockups & Helpers ---
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.window.EventBus = { addEventListener: () => {} };

require('./routine.js');
document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
Object.assign(global, {
    initializeRoutines: window.initializeRoutines,
    createRoutineHandler: window.createRoutineHandler,
    addTaskToRoutineHandler: window.addTaskToRoutineHandler,
    activateRoutine: window.activateRoutine,
    manualAdvanceTask: window.manualAdvanceTask,
    editTaskInRoutine: window.editTaskInRoutine,
    deleteTaskFromRoutine: window.deleteTaskFromRoutine,
});
const mockLocalStorage = (() => {
    let store = {};
    return {
        getItem: key => store[key] || null,
        setItem: (key, value) => store[key] = value.toString(),
        clear: () => store = {},
        removeItem: key => delete store[key]
    };
})();
global.localStorage = mockLocalStorage; // Use 'global' for a Node-like environment if tests were run there, or 'window' for browser.
                                        // Assuming a context where 'global' or 'window' can be assigned.

// Mock necessary DOM elements if functions directly manipulate them outside of event handlers
// For now, we'll focus on functions that can be tested with less direct DOM manipulation
// or assume DOM elements are minimal for these tests.

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

    // Mock DOM elements that are directly accessed by functions being tested
    // (even if event handlers are not directly triggered)
    document.body.innerHTML = `
        <select id="routine-select"></select>
        <div id="current-routine-name"></div>
        <ul id="current-routine-tasks"></ul>
        <div id="expected-finish-time"></div>
        <input id="routine-name" type="text" /> 
        <input id="task-name" type="text" />
        <input id="task-duration" type="number" />
        <input id="task-break-duration" type="number" />
        <div id="current-task-name"></div>
        <div id="current-task-time-left"></div>
        <canvas id="routine-pie-chart"></canvas>
    `;

    window.__SKIP_DEFAULT_ROUTINES__ = true;
    
    // Re-initialize parts of routine.js or expose functions for testing
    // This is tricky without a proper test runner or module system.
    // For this subtask, assume we can call the functions if routine.js was loaded.
    // In a real scenario, routine.js would need to be structured to allow this.
    // We will assume `initializeRoutines` also makes other functions available globally for tests for now.
    
    // Test 1: Create a new routine
    try {
        localStorage.clear(); // Start fresh
        if (typeof initializeRoutines !== 'function' || typeof createRoutineHandler !== 'function') {
            console.error("Routine functions not available for testing. Load routine.js first or structure for testability.");
            return;
        }

        // Simulate input for creating a routine
        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Morning Routine";
        createRoutineHandler(); // global function
        
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
        initializeRoutines(); // Resets selectedRoutineId, routines array etc.

        const routineNameInput = document.getElementById('routine-name'); // Re-fetch after innerHTML change potentially
        routineNameInput.value = "Evening Routine";
        createRoutineHandler(); // Creates a routine and selects it

        const taskNameInput = document.getElementById('task-name');
        const taskDurationInput = document.getElementById('task-duration');
        taskNameInput.value = "Read Book";
        taskDurationInput.value = "30";
        addTaskToRoutineHandler(); // global function

        const routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        assert(routines[0].tasks.length === 1, "Task added to routine.");
        assert(routines[0].tasks[0].name === "Read Book", "Task has correct name.");
        assert(routines[0].tasks[0].duration === 30, "Task has correct duration.");
        assert(routines[0].totalDuration === 30, "Routine total duration updated.");
        console.log("Test 2 Passed: Add Task");
    } catch (e) {
        console.error("Test 2 Failed: Add Task - ", e);
    }

    // Test 3: Start a routine and first task (basic check)
    try {
        localStorage.clear();
        initializeRoutines(); 
        
        const routineNameInput = document.getElementById('routine-name');
        routineNameInput.value = "Work Sprint";
        createRoutineHandler();

        const taskNameInput = document.getElementById('task-name');
        const taskDurationInput = document.getElementById('task-duration');
        taskNameInput.value = "Code Review";
        taskDurationInput.value = "25";
        addTaskToRoutineHandler();
        taskNameInput.value = "Documentation";
        taskDurationInput.value = "15";
        addTaskToRoutineHandler();

        // Directly call activateRoutine with the ID of the created routine
        const routineToStart = JSON.parse(localStorage.getItem('adhd-tool-routines'))[0];
        activateRoutine(routineToStart.id); // global function

        const currentTaskDisplay = document.getElementById('current-task-name').textContent;
        assert(currentTaskDisplay === "Code Review", "First task name displayed correctly.");
        // Further checks on timer starting etc. would need more advanced mocking of setInterval
        console.log("Test 3 Passed: Start Routine and First Task");
    } catch (e) {
        console.error("Test 3 Failed: Start Routine - ", e);
    }
    
    // Test 4: Manual task advance (basic check)
    try {
        // Assumes state from Test 3 is somewhat active (activeRoutine is set, currentTaskIndex is 0)
        // This tight coupling is a limitation of this simple test setup.
        // In a better setup, each test would be independent.

        if (typeof activeRoutine === 'undefined' || !activeRoutine) { // Check if activeRoutine was set by previous test.
             console.warn("Skipping Test 4 as activeRoutine is not set from previous test. Requires better test isolation.");
        } else {
            manualAdvanceTask(); // global function
            const currentTaskDisplay = document.getElementById('current-task-name').textContent;
            assert(currentTaskDisplay === "Documentation", "Second task name displayed after manual advance.");
            manualAdvanceTask(); // Advance past the last task
            const routineFinishedDisplay = document.getElementById('current-task-name').textContent;
            assert(routineFinishedDisplay === "Routine Finished!", "Routine finishes after all tasks advanced.");
             console.log("Test 4 Passed: Manual Task Advance");
        }

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
        // selectedRoutineId should be routine1.id after createRoutineHandler

        const taskNameInput = document.getElementById('task-name');
        const taskDurationInput = document.getElementById('task-duration');
        taskNameInput.value = "Original Task";
        taskDurationInput.value = "20";
        addTaskToRoutineHandler();

        // Refetch routines to get the task and its ID
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
        // selectedRoutineId should be routine2.id

        const taskNameInput = document.getElementById('task-name');
        const taskDurationInput = document.getElementById('task-duration');
        
        taskNameInput.value = "Task A";
        taskDurationInput.value = "10";
        addTaskToRoutineHandler();

        taskNameInput.value = "Task B";
        taskDurationInput.value = "15";
        addTaskToRoutineHandler();
        
        // Refetch routines to get task IDs and verify initial state
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

        const taskNameInput = document.getElementById('task-name');
        const taskDurationInput = document.getElementById('task-duration');
        taskNameInput.value = "Task One";
        taskDurationInput.value = "5";
        addTaskToRoutineHandler();
        taskNameInput.value = "Task Two";
        taskDurationInput.value = "5";
        addTaskToRoutineHandler();

        const routines = JSON.parse(localStorage.getItem('adhd-tool-routines'));
        activateRoutine(routines[0].id);

        const display = document.getElementById('current-task-display');
        display.dispatchEvent(new Event('click'));

        const curName = document.getElementById('current-task-name').textContent;
        assert(curName === "Task Two", "Tap event advances to next task.");
        console.log("Test 7 Passed: Tap Advance");
    } catch (e) {
        console.error("Test 7 Failed: Tap Advance - ", e);
    }


    console.log("--- Routine Tool Unit Tests Finished ---");
}

runRoutineTests();
