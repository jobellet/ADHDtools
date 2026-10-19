import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const pomodoroScript = fs.readFileSync('features/pomodoro/pomodoro.js', 'utf8');

test('Pomodoro Timer catches up accurately after tab backgrounding', async (t) => {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
            <body>
                <div id="minutes"></div>
                <div id="seconds"></div>
                <div id="timer-label"></div>
                <button id="start-timer"></button>
                <button id="pause-timer"></button>
                <button id="reset-timer"></button>
                <div id="session-count"></div>
                <div id="sessions-until-long"></div>
                <div id="mode-change-message"></div>
                <div id="pomodoro-progress-bar"></div>

                <input id="focus-duration" value="25" />
                <input id="short-break-duration" value="5" />
                <input id="long-break-duration" value="15" />
                <input id="sessions-before-long-break" value="4" />
                <select id="audio-notification">
                    <option value="bell">Bell</option>
                </select>
                <button id="save-settings"></button>
                <button id="test-sound"></button>

                <div class="timer-controls"></div>
                <div class="timer-circle"></div>
            </body>
        </html>
    `, { runScripts: "dangerously", url: "http://localhost" });

    const window = dom.window;
    const document = window.document;

    // Mock localStorage
    const storage = {};
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: (key) => storage[key] || null,
            setItem: (key, val) => { storage[key] = String(val); },
            removeItem: (key) => { delete storage[key]; }
        },
        configurable: true
    });

    // Mock AttentionService
    const notifyCalls = [];
    const releaseCalls = [];
    window.AttentionService = {
        notify: (title, body, opts) => notifyCalls.push({ title, body, opts }),
        releaseWakeLock: (label) => releaseCalls.push(label),
        requestNotificationPermission: () => {},
        acquireWakeLock: () => {},
        setCountdownStatus: () => {},
        clearCountdownStatus: () => {},
        playNativeSound: () => {}
    };

    // Mock AudioContext to prevent errors in playSound
    window.AudioContext = class {
        constructor() {
            this.state = 'running';
            this.currentTime = 0;
            this.destination = {};
        }
        createGain() {
            return {
                gain: {
                    setValueAtTime: () => {},
                    linearRampToValueAtTime: () => {},
                    exponentialRampToValueAtTime: () => {},
                    value: 0
                },
                connect: () => ({ connect: () => {} })
            };
        }
        createOscillator() {
            return {
                frequency: { setValueAtTime: () => {}, value: 0 },
                connect: () => ({ connect: () => {} }),
                start: () => {},
                stop: () => {}
            };
        }
        resume() {}
    };
    window.webkitAudioContext = window.AudioContext;

    // Timer mocks
    const intervals = [];
    window.setInterval = (cb, time) => {
        intervals.push(cb);
        return 1;
    };
    window.clearInterval = () => {};

    // Mock Date.now() to control time
    let currentTimeMs = 1000000000;
    const originalDateNow = Date.now;
    window.Date.now = () => currentTimeMs;
    global.Date.now = () => currentTimeMs;

    try {
        // Run the script
        const scriptEl = document.createElement('script');
        scriptEl.textContent = pomodoroScript;
        document.body.appendChild(scriptEl);

        // Wait for DOMContentLoaded listener inside script to execute
        document.dispatchEvent(new window.Event('DOMContentLoaded'));

        // Start timer (focus duration defaults to 25 mins = 1500 secs)
        document.getElementById('start-timer').click();

        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        assert.strictEqual(minutesEl.textContent, '25', 'Should start at 25 minutes');

        // Allow interval to fire once
        intervals[0]();

        // Simulate advancing time by 60 seconds (1 minute)
        currentTimeMs += 60000;

        // Trigger one interval tick to update UI
        intervals[0]();

        assert.strictEqual(minutesEl.textContent, '24', 'Should jump down 1 minute');
        assert.strictEqual(secondsEl.textContent, '00', 'Seconds should be 00');

        // Simulate jumping right to the end (it goes to the short break 5:00)
        currentTimeMs += 24 * 60 * 1000; // + 24 mins

        intervals[0]();

        // At 00:00, the focus session completes and the UI switches to SHORT BREAK (05:00)
        assert.strictEqual(minutesEl.textContent, '05');
        assert.strictEqual(secondsEl.textContent, '00');

        // Assert notifications and wake lock were triggered
        assert.strictEqual(notifyCalls.length, 1, 'Should have called notify');
        assert.strictEqual(notifyCalls[0].title, 'Focus Session Complete!');
        assert.strictEqual(notifyCalls[0].opts.tag, 'pomodoro-complete');

        assert.ok(releaseCalls.includes('pomodoro'), 'Should have released wake lock on completion');

    } finally {
        global.Date.now = originalDateNow;
    }
});
