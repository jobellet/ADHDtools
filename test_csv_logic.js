
const fs = require('fs');

// Mock DOM
const document = {
    createElement: (tag) => {
        return {
            tagName: tag.toUpperCase(),
            style: {},
            classList: { add: () => {}, remove: () => {} },
            addEventListener: () => {},
            appendChild: () => {},
            remove: () => {},
            querySelector: () => ({ addEventListener: () => {} })
        };
    },
    body: {
        appendChild: () => {},
        removeChild: () => {}
    }
};
global.document = document;
global.window = { ConfigManager: {} };
global.URL = { createObjectURL: () => 'blob:url' };
global.Blob = class Blob { constructor(c) { this.content = c; } };

// Mock routine data
const mockRoutine = {
    id: 'r1',
    name: 'Test Routine',
    startTime: '08:00',
    weekDays: [1],
    tasks: [
        { name: 'Simple Task', duration: 10 },
        { name: 'Task, with comma', duration: 5 },
        { name: 'Task "with quotes"', duration: 15 },
        { name: 'Task with "quotes" and, comma', duration: 20 }
    ]
};

// Test Export Logic
function testExport() {
    let csvContent = "";
    mockRoutine.tasks.forEach(task => {
        let safeName = task.name.replace(/"/g, '""');
        if (safeName.includes(',') || safeName.includes('"') || safeName.includes('\n')) {
            safeName = `"${safeName}"`;
        }
        csvContent += `${safeName},${task.duration}\n`;
    });

    console.log("--- Generated CSV ---");
    console.log(csvContent);

    return csvContent;
}

// Test Import Logic
function testImport(csvText) {
    const lines = csvText.split('\n');
    console.log("\n--- Parsed Tasks ---");

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // Copied regex from routine.js
        const regex = /(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g;
        let matches = [];
        let match;

        // Note: global regex needs reset or re-instantiation if used differently, but in loop it's fine?
        // Wait, exec loop on the same string works.

        while ((match = regex.exec(line)) !== null) {
            // match[1] is quoted content, match[2] is unquoted
            let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
            // Fix: The regex matches empty string at the end of line sometimes or between commas
            if (match[0] === '' && match.index === line.length) break;
            matches.push(val);
        }

        // Filter out empty matches that might occur due to regex global flag behavior at end of string if logic isn't perfect
        // But let's see what the implementation produces.

        if (matches.length > 0) {
            console.log(`Name: ${matches[0]} | Duration: ${matches[1]}`);
        }
    });
}

const csv = testExport();
testImport(csv);
