function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getConfig() {
    return (window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG || {});
}

function parseTimeToMinutes(timeStr, fallback) {
    if (typeof timeStr !== 'string') return fallback;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;
    const hours = clamp(parseInt(match[1], 10), 0, 23);
    const minutes = clamp(parseInt(match[2], 10), 0, 59);
    return hours * 60 + minutes;
}

export function getDayBounds() {
    const cfg = getConfig();
    const startMinutes = clamp(parseTimeToMinutes(cfg.dayStart, 0), 0, 1439);
    const endCandidate = clamp(parseTimeToMinutes(cfg.dayEnd, 1440), 0, 1440);
    const endMinutes = endCandidate > startMinutes ? endCandidate : 1440;
    return { startMinutes, endMinutes };
}

export function getDefaultDurationMinutes() {
    const cfg = getConfig();
    const parsed = parseInt(cfg.defaultTaskMinutes, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export function formatTime(h, m) {
    const period = h >= 12 ? 'PM' : 'AM';
    let hh = h % 12; if (hh === 0) hh = 12;
    return `${hh}:${m.toString().padStart(2, '0')} ${period}`;
}

export function populateTimeOptions(select) {
    select.innerHTML = '';
    const { startMinutes, endMinutes } = getDayBounds();
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 5) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const opt = document.createElement('option');
        opt.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        opt.textContent = formatTime(h, m);
        select.appendChild(opt);
    }
}

export function populateTaskOptions(select) {
    select.innerHTML = '<option value="">-- New Event --</option>';
    const tasks = window.DataManager.getTasks().filter(t => !t.plannerDate);
    tasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.text;
        select.appendChild(opt);
    });
}

export function getDefaultTime() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    // Round up to the next 15 minutes for easier scheduling
    const rounded = Math.ceil(minutes / 15) * 15;
    const { startMinutes, endMinutes } = getDayBounds();
    const clamped = clamp(rounded, startMinutes, Math.max(startMinutes, endMinutes - 5));
    const h = Math.floor(clamped / 60) % 24;
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getCalendarEvents(currentDate) {
    const events = JSON.parse(localStorage.getItem('adhd-calendar-events')) || [];
    const dayStr = currentDate.toISOString().slice(0, 10);
    return events
        .filter(ev => ev.start && ev.start.startsWith(dayStr))
        .map(ev => ({
            title: ev.title || '',
            start: ev.start.slice(11, 16),
            end: ev.end ? ev.end.slice(11, 16) : null
        }));
}
