// Google Calendar Integration — private OAuth sync (no public link, no API key).
// Requires only an OAuth Client ID (saved via calendar-settings.js / GoogleAuth).
// Events are fetched with the Calendar REST API and fed through the same
// pipeline as ICS imports (window.CalendarTool.ingestExternalEvents), so they
// appear in the Calendar tool, Day Planner and the unified scheduler.
document.addEventListener('DOMContentLoaded', function () {
    const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
    const SCOPE_LIST = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
    const SCOPES = `${SCOPE} ${SCOPE_LIST}`;
    const API_BASE = 'https://www.googleapis.com/calendar/v3';
    const SELECTED_CALENDARS_KEY = 'gcalSelectedCalendars';
    const CONNECTED_FLAG_KEY = 'gcalConnected';
    const LAST_SYNC_KEY = 'gcalLastSyncAt';

    const container = document.getElementById('gcal-sync-container');

    function getConfig() {
        return (window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG || {});
    }

    function getSelectedCalendarIds() {
        try {
            const stored = JSON.parse(localStorage.getItem(SELECTED_CALENDARS_KEY));
            if (Array.isArray(stored) && stored.length) return stored;
        } catch { /* fall through */ }
        return ['primary'];
    }

    function saveSelectedCalendarIds(ids) {
        localStorage.setItem(SELECTED_CALENDARS_KEY, JSON.stringify(ids));
    }

    // ---- UI -------------------------------------------------------------

    let statusEl, syncBtn, disconnectBtn, calendarListEl;

    function buildUI() {
        if (!container) return;
        container.innerHTML = `
            <h4>Google Calendar Sync (private)</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Sync events directly from your Google account — nothing is made public.
            </p>
            <div class="integration-buttons" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button id="gcal-sync-btn" class="btn btn-primary btn-sm">
                    <i class="fas fa-sync"></i> <span>Connect &amp; Sync</span>
                </button>
                <button id="gcal-disconnect-btn" class="btn btn-secondary btn-sm" style="display:none;">
                    <i class="fas fa-sign-out-alt"></i> Disconnect
                </button>
            </div>
            <div id="gcal-calendar-list" style="margin-top:0.5rem;"></div>
            <div style="display:flex; gap:0.75rem; margin-top:0.5rem; font-size:0.85rem; flex-wrap:wrap;">
                <label>Days back <input type="number" id="gcal-past-days" min="0" max="365" style="width:4.5rem; padding:0.2rem;"></label>
                <label>Days ahead <input type="number" id="gcal-future-days" min="0" max="365" style="width:4.5rem; padding:0.2rem;"></label>
            </div>
            <span id="gcal-sync-status" class="status" style="display:block; margin-top:0.5rem; font-size:0.85rem;"></span>
        `;
        statusEl = container.querySelector('#gcal-sync-status');
        syncBtn = container.querySelector('#gcal-sync-btn');
        disconnectBtn = container.querySelector('#gcal-disconnect-btn');
        calendarListEl = container.querySelector('#gcal-calendar-list');

        syncBtn.addEventListener('click', () => syncNow({ interactive: true }));
        disconnectBtn.addEventListener('click', disconnect);

        const cfg = getConfig();
        const pastInput = container.querySelector('#gcal-past-days');
        const futureInput = container.querySelector('#gcal-future-days');
        pastInput.value = parseInt(cfg.gcalPastDays, 10) || 7;
        futureInput.value = parseInt(cfg.gcalFutureDays, 10) || 30;
        pastInput.addEventListener('change', () => {
            window.ConfigManager?.updateConfig({ gcalPastDays: Math.max(0, parseInt(pastInput.value, 10) || 7) });
        });
        futureInput.addEventListener('change', () => {
            window.ConfigManager?.updateConfig({ gcalFutureDays: Math.max(0, parseInt(futureInput.value, 10) || 30) });
        });

        refreshUIState();
    }

    function setStatus(message, isError) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.color = isError ? 'var(--danger-color)' : 'var(--text-muted)';
    }

    function refreshUIState() {
        if (!syncBtn) return;
        const connected = localStorage.getItem(CONNECTED_FLAG_KEY) === 'true';
        syncBtn.querySelector('span').innerHTML = connected ? 'Sync now' : 'Connect &amp; Sync';
        disconnectBtn.style.display = connected ? '' : 'none';
        if (!window.GoogleAuth?.getClientId()) {
            setStatus('Save a Google Client ID above to enable private sync.');
        } else if (connected) {
            const last = localStorage.getItem(LAST_SYNC_KEY);
            setStatus(last ? `Connected — last sync ${new Date(last).toLocaleString()}` : 'Connected');
        } else {
            setStatus('Not connected yet.');
        }
    }

    function renderCalendarChoices(calendars) {
        if (!calendarListEl || !calendars.length) return;
        const selected = new Set(getSelectedCalendarIds());
        calendarListEl.innerHTML = '<label style="font-size:0.85rem; font-weight:600;">Calendars to sync:</label>';
        calendars.forEach(cal => {
            const id = cal.primary ? 'primary' : cal.id;
            const row = document.createElement('label');
            row.style.cssText = 'display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; margin-top:0.2rem;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = selected.has(id) || (cal.primary && selected.has('primary'));
            cb.addEventListener('change', () => {
                const ids = new Set(getSelectedCalendarIds());
                if (cb.checked) ids.add(id); else ids.delete(id);
                saveSelectedCalendarIds([...ids]);
            });
            row.appendChild(cb);
            row.appendChild(document.createTextNode(cal.summaryOverride || cal.summary || id));
            calendarListEl.appendChild(row);
        });
    }

    // ---- Google API calls ------------------------------------------------

    async function apiGet(token, path, params) {
        const url = new URL(API_BASE + path);
        Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error(`Google API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
        return resp.json();
    }

    // Convert an RFC3339/date value from the Google API into the local naive
    // "YYYY-MM-DDTHH:MM:SS" format the ICS pipeline uses.
    function toLocalNaive(gDate) {
        if (!gDate) return null;
        if (gDate.date) return gDate.date; // all-day event
        const d = new Date(gDate.dateTime);
        if (isNaN(d)) return null;
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    async function fetchEventsForCalendar(token, calendarId, timeMin, timeMax) {
        const items = [];
        let pageToken;
        do {
            const params = {
                timeMin, timeMax,
                singleEvents: 'true',
                orderBy: 'startTime',
                maxResults: '250',
                showDeleted: 'false',
            };
            if (pageToken) params.pageToken = pageToken;
            const data = await apiGet(token, `/calendars/${encodeURIComponent(calendarId)}/events`, params);
            items.push(...(data.items || []));
            pageToken = data.nextPageToken;
        } while (pageToken);
        return items;
    }

    async function syncNow({ interactive } = { interactive: true }) {
        try {
            setStatus('Syncing…');
            const token = await window.GoogleAuth.getAccessToken(SCOPES, { interactive });
            if (!token) { refreshUIState(); return; } // silent mode, no session

            // Offer the list of calendars (best effort — primary works regardless)
            try {
                const list = await apiGet(token, '/users/me/calendarList', { minAccessRole: 'reader' });
                renderCalendarChoices(list.items || []);
            } catch (err) {
                console.warn('Could not fetch calendar list, syncing primary only:', err);
            }

            const cfg = getConfig();
            const pastDays = parseInt(cfg.gcalPastDays, 10) || 7;
            const futureDays = parseInt(cfg.gcalFutureDays, 10) || 30;
            const timeMin = new Date(Date.now() - pastDays * 86400000).toISOString();
            const timeMax = new Date(Date.now() + futureDays * 86400000).toISOString();

            let total = 0;
            for (const calId of getSelectedCalendarIds()) {
                const items = await fetchEventsForCalendar(token, calId, timeMin, timeMax);
                const mapped = items
                    .filter(ev => ev.status !== 'cancelled' && (ev.start?.dateTime || ev.start?.date))
                    .map(ev => ({
                        uid: ev.iCalUID || ev.id,
                        title: ev.summary || '(no title)',
                        description: ev.description || '',
                        location: ev.location || '',
                        start: toLocalNaive(ev.start),
                        end: toLocalNaive(ev.end),
                    }));
                if (window.CalendarTool?.ingestExternalEvents) {
                    total += window.CalendarTool.ingestExternalEvents(mapped);
                }
            }

            localStorage.setItem(CONNECTED_FLAG_KEY, 'true');
            localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
            refreshUIState();
            setStatus(`Synced ${total} events (${pastDays} days back, ${futureDays} ahead) at ${new Date().toLocaleTimeString()}.`);
        } catch (err) {
            console.error('Google Calendar sync failed:', err);
            setStatus('Sync failed: ' + err.message, true);
        }
    }

    async function disconnect() {
        await window.GoogleAuth.revoke(SCOPES);
        localStorage.removeItem(CONNECTED_FLAG_KEY);
        localStorage.removeItem(LAST_SYNC_KEY);
        refreshUIState();
        setStatus('Disconnected. Synced events stay until you clear them.');
    }

    // ---- Export events/tasks to Google Calendar --------------------------

    async function exportEventToCalendar(summary, startTime, endTime, description) {
        try {
            const token = await window.GoogleAuth.getAccessToken(SCOPES, { interactive: true });
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const resp = await fetch(`${API_BASE}/calendars/primary/events`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary,
                    description: description || 'Added from ADHD Tools Hub',
                    start: { dateTime: startTime.toISOString(), timeZone: tz },
                    end: { dateTime: endTime.toISOString(), timeZone: tz },
                }),
            });
            if (!resp.ok) throw new Error(`Google API ${resp.status}`);
            alert('Event added to Google Calendar');
        } catch (err) {
            console.error('Error creating calendar event:', err);
            alert('Error creating calendar event: ' + err.message);
        }
    }

    // Add export buttons to day planner events
    function addExportButtonsToDayPlanner() {
        const timeBlocks = document.querySelectorAll('.time-block');
        timeBlocks.forEach(block => {
            if (block.querySelector('.export-to-calendar-btn')) return;
            const timeLabelEl = block.querySelector('.time-label');
            if (!timeLabelEl) return;
            const timeLabel = timeLabelEl.textContent;
            const exportBtn = document.createElement('button');
            exportBtn.className = 'export-to-calendar-btn';
            exportBtn.innerHTML = '<i class="fas fa-calendar-plus"></i>';
            exportBtn.title = 'Export to Google Calendar';

            exportBtn.addEventListener('click', function () {
                const eventContent = block.querySelector('.event-content');
                if (eventContent && eventContent.textContent.trim()) {
                    const hourMatch = timeLabel.match(/(\d+):00/);
                    if (hourMatch) {
                        const hour = parseInt(hourMatch[1]);
                        const isPM = timeLabel.includes('PM');
                        let hour24 = hour;
                        if (isPM && hour !== 12) hour24 += 12;
                        if (!isPM && hour === 12) hour24 = 0;

                        const today = new Date();
                        const startTime = new Date(today.setHours(hour24, 0, 0, 0));
                        const endTime = new Date(today.setHours(hour24 + 1, 0, 0, 0));
                        exportEventToCalendar(eventContent.textContent.trim(), startTime, endTime);
                    }
                } else {
                    alert('Please add content to this time block first');
                }
            });

            block.appendChild(exportBtn);
        });
    }

    // Add export buttons to tasks
    function addExportButtonsToTasks() {
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach(task => {
            if (!task.querySelector('.export-to-calendar-btn')) {
                const taskActions = task.querySelector('.task-actions');
                if (taskActions) {
                    const exportBtn = document.createElement('button');
                    exportBtn.className = 'export-to-calendar-btn';
                    exportBtn.innerHTML = '<i class="fas fa-calendar-plus"></i>';
                    exportBtn.title = 'Export to Google Calendar';

                    exportBtn.addEventListener('click', function () {
                        const taskText = task.querySelector('.task-text').textContent;
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(9, 0, 0, 0);
                        const endTime = new Date(tomorrow);
                        endTime.setHours(10, 0, 0, 0);
                        exportEventToCalendar(taskText, tomorrow, endTime, 'Task from ADHD Tools Hub');
                    });

                    taskActions.appendChild(exportBtn);
                }
            }
        });
    }

    function initObservers() {
        const timeBlocksContainer = document.getElementById('time-blocks');
        if (timeBlocksContainer) {
            const dayPlannerObserver = new MutationObserver(() => {
                if (document.querySelector('.time-block')) {
                    addExportButtonsToDayPlanner();
                    dayPlannerObserver.disconnect();
                }
            });
            dayPlannerObserver.observe(timeBlocksContainer, { childList: true, subtree: true });
        }

        const taskList = document.getElementById('task-list');
        if (taskList) {
            const taskListObserver = new MutationObserver(() => addExportButtonsToTasks());
            taskListObserver.observe(taskList, { childList: true, subtree: true });
        }
    }

    // ---- Init -------------------------------------------------------------

    buildUI();
    initObservers();

    // Silent auto-sync when a session token from this browser session is still valid
    if (localStorage.getItem(CONNECTED_FLAG_KEY) === 'true' && window.GoogleAuth?.hasSession(SCOPES)) {
        syncNow({ interactive: false });
    }
});
