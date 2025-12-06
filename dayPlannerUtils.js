import { buildSchedule } from './core/scheduler.js';
import { createTask as createTaskModel } from './core/task-model.js';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getConfig() {
    return (window.ConfigManager?.getConfig?.() || window.ConfigManager?.DEFAULT_CONFIG || {});
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
    if (!window.DataManager) return [];

    const cfg = getConfig();
    const plannerDateStr = currentDate.toISOString().slice(0, 10);
    const tasks = window.DataManager.getTasks();
    const defaultDuration = getDefaultDurationMinutes();

    const todaysTasks = tasks.filter(task => task.plannerDate && task.plannerDate.startsWith(plannerDateStr));

    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);
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

    if (!cfg.enableUnifiedScheduler) {
        return todaysTasks;
    }

    const schedulerTasks = [];
    todaysTasks.forEach(task => {
        schedulerTasks.push({
            ...task,
            startTime: task.plannerDate.slice(11, 16),
            durationMinutes: task.duration || defaultDuration,
            isFixed: true,
        });
    });

    tasks.filter(task => !task.plannerDate || task.plannerDate.startsWith(plannerDateStr)).forEach(task => {
        if (todaysTasks.includes(task)) return;
        const priorityScore = task.priority === 'high' ? 8 : task.priority === 'low' ? 4 : 6;
        schedulerTasks.push({
            ...task,
            durationMinutes: task.duration || defaultDuration,
            importance: task.importance ?? priorityScore,
            urgency: task.urgency ?? priorityScore,
        });
    });

    if (cfg.includeCalendarInSchedule) {
        const calendarTasks = getCalendarTasksForDay(currentDate, defaultDuration);
        schedulerTasks.push(...calendarTasks);
    }

    const schedule = buildSchedule({
        tasks: schedulerTasks,
        now: currentDate,
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

function getCalendarTasksForDay(currentDate, defaultDuration) {
    const events = JSON.parse(localStorage.getItem('adhd-calendar-events')) || [];
    const dayStr = currentDate.toISOString().slice(0, 10);
    return events
        .filter(ev => ev.start && ev.start.startsWith(dayStr))
        .map(ev => normalizeCalendarEvent(ev))
        .map(ev => {
            const startTimeStr = ev.start ? ev.start.slice(11, 16) : null;
            let durationMinutes = defaultDuration;
            if (ev.start && ev.end) {
                const startDate = new Date(ev.start);
                const endDate = new Date(ev.end);
                const diff = Math.round((endDate - startDate) / 60000);
                if (Number.isFinite(diff) && diff > 0) {
                    durationMinutes = diff;
                }
            }
            const isFixed = ev.isFixed !== undefined ? ev.isFixed : true;
            const taskBase = {
                id: ev.id || ev.calendarInstanceId || ev.calendarUid || `calendar-${Date.now()}`,
                title: ev.title || '',
                text: ev.title || '',
                source: 'calendar',
                calendarUid: ev.calendarUid || null,
                calendarInstanceId: ev.calendarInstanceId || null,
                isFixed,
                startTime: isFixed ? startTimeStr : null,
                durationMinutes,
                importance: 10,
                urgency: 10,
            };
            return createTaskModel ? createTaskModel(taskBase, taskBase) : taskBase;
        })
        .filter(task => task && (!task.isFixed || task.startTime));
}
