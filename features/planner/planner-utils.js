import { buildSchedule } from '../../core/scheduler.js';

export function localDateString(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const pad = num => String(num).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getConfig() {
    return (window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG || {});
}

function getUnifiedTasks() {
    if (window.TaskStore?.getAllTasks) return window.TaskStore.getAllTasks();
    if (window.DataManager?.getTasks) return window.DataManager.getTasks();
    return [];
}

function getTagConfig() {
    const cfg = getConfig();
    return {
        fixedTag: cfg.fixedTag || '',
        flexibleTag: cfg.flexibleTag || '',
    };
}

function stripTagsFromTitle(title, tags = []) {
    let cleaned = title || '';
    tags.forEach(tag => {
        if (!tag) return;
        cleaned = cleaned.split(tag).join('');
    });
    return cleaned.trim();
}

function minutesToTimeStr(minutes) {
    const clamped = Math.max(0, Math.min(1439, Math.round(minutes)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

export function getPlannerTasksForDay(currentDate) {
    const cfg = getConfig();
    const plannerDateStr = localDateString(currentDate);
    const tasks = getUnifiedTasks();
    const defaultDuration = getDefaultDurationMinutes();

    const todaysTasks = tasks.filter(task => task.plannerDate && task.plannerDate.startsWith(plannerDateStr));

    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 1);
    const prevDateStr = localDateString(prevDate);
    tasks.filter(task => task.plannerDate && task.plannerDate.startsWith(prevDateStr)).forEach(task => {
        const startMins = parseInt(task.plannerDate.slice(11, 13)) * 60 + parseInt(task.plannerDate.slice(14, 16));
        const dur = task.duration || defaultDuration;
        if (startMins + dur > 1440) {
            const remainder = startMins + dur - 1440;
            todaysTasks.push({
                ...task,
                plannerDate: `${plannerDateStr}T00:00`,
                duration: remainder,
                _continuation: true
            });
        }
    });

    const schedulerTasks = [];
    todaysTasks.forEach(task => {
        schedulerTasks.push({
            ...task,
            startTime: task.plannerDate.slice(11, 16),
            durationMinutes: task.duration || task.durationMinutes || defaultDuration,
        });
    });

    tasks.filter(task => !task.plannerDate).forEach(task => {
        const priorityScore = task.priority === 'high' ? 8 : task.priority === 'low' ? 4 : 6;
        schedulerTasks.push({
            ...task,
            durationMinutes: task.duration || task.durationMinutes || defaultDuration,
            importance: task.importance ?? priorityScore,
            urgency: task.urgency ?? priorityScore,
        });
    });

    // Plan from "now" for today; other days are planned from the start of the day.
    const now = new Date();
    const isToday = localDateString(now) === plannerDateStr;
    const planFrom = isToday ? now : new Date(`${plannerDateStr}T00:00`);
    const schedule = buildSchedule({
        tasks: schedulerTasks,
        now: planFrom,
        config: cfg,
    }) || [];

    return schedule.map(slot => {
        const startStr = minutesToTimeStr(slot.scheduledStart);
        return {
            ...slot.task,
            plannerDate: `${plannerDateStr}T${startStr}`,
            duration: Math.max(5, slot.scheduledEnd - slot.scheduledStart),
        };
    });
}

export function populateTaskOptions(select) {
    select.innerHTML = '<option value="">-- New Event --</option>';
    const tasks = getUnifiedTasks().filter(t => !t.plannerDate && !t.completed);
    tasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.hash || t.id;
        opt.textContent = t.name || t.text;
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
    const dayStr = localDateString(currentDate);
    return events
        .filter(ev => ev.start && ev.start.startsWith(dayStr))
        .map(ev => normalizeCalendarEvent(ev))
        .map(ev => ({
            title: ev.title || '',
            start: ev.start ? ev.start.slice(11, 16) : null,
            end: ev.end ? ev.end.slice(11, 16) : null,
            isFixed: ev.isFixed !== false,
        }));
}

function normalizeCalendarEvent(rawEvent) {
    const { fixedTag, flexibleTag } = getTagConfig();
    const ev = { ...rawEvent };
    ev.rawTitle = ev.rawTitle || ev.title || '';
    const hasFixedTag = fixedTag && ev.rawTitle.includes(fixedTag);
    const hasFlexibleTag = flexibleTag && ev.rawTitle.includes(flexibleTag);
    if (hasFixedTag) ev.isFixed = true;
    else if (hasFlexibleTag) ev.isFixed = false;
    ev.title = stripTagsFromTitle(ev.rawTitle, [fixedTag, flexibleTag]) || ev.title || '';
    if (!ev.calendarUid && ev.uid) ev.calendarUid = ev.uid;
    if (!ev.instanceStart && ev.start) ev.instanceStart = ev.start;
    if (!ev.calendarInstanceId && ev.calendarUid && ev.instanceStart) {
        ev.calendarInstanceId = `${ev.calendarUid}:${ev.instanceStart}`;
    }
    return ev;
}
