import { getCalendarEvents, getDayBounds, getPlannerTasksForDay, localDateString } from './planner-utils.js';

// One continuous timeline: y = (minute - dayStart) × --minute-height.
// Positions use calc(… * var(--minute-height)), so zooming only changes that
// variable; relabelTimeline() then re-picks which time labels fit.
//
//   .timeline
//     .timeline-grid     faint hour lines
//     .timeline-gutter   time labels: start/end of every item first, then hours
//     .timeline-lane     the items (overlapping items share the width)
//     .current-time-indicator

const LABEL_MIN_GAP_PX = 18;   // two labels never closer than this
const TIME_IN_BLOCK_MIN_PX = 38; // show "08:35–08:50" inside a block when it is at least this tall

let lastRender = null; // { dayStart, dayEnd, items, timeline }

const locale = () => document.documentElement.lang || undefined;

function clockLabel(minutes) {
    const d = new Date(2000, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60);
    return d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
}

function toMinutes(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export function getMinuteHeight() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--minute-height')) || 2;
}

// Side-by-side columns for overlapping items (greedy, per overlapping cluster).
function assignColumns(items) {
    const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
        const columns = [];
        cluster.forEach(item => {
            let col = columns.findIndex(end => end <= item.start);
            if (col === -1) { col = columns.length; columns.push(0); }
            columns[col] = item.end;
            item.col = col;
        });
        cluster.forEach(item => { item.cols = columns.length; });
    };
    sorted.forEach(item => {
        if (cluster.length && item.start >= clusterEnd) {
            flush();
            cluster = [];
            clusterEnd = -1;
        }
        cluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.end);
    });
    if (cluster.length) flush();
    return sorted;
}

function collectItems(currentDate, dayStart, dayEnd) {
    const items = [];
    getCalendarEvents(currentDate).forEach(ev => {
        const start = toMinutes(ev.start);
        if (start === null) return;
        const end = toMinutes(ev.end) ?? start + 60;
        items.push({ kind: 'calendar', title: ev.title, start, end: Math.max(end, start + 5) });
    });
    // Calendar events come from above; the schedule adds tasks and routines.
    getPlannerTasksForDay(currentDate)
        .filter(task => task.source !== 'calendar')
        .forEach(task => {
            const start = toMinutes(task.plannerDate?.slice(11, 16));
            if (start === null) return;
            const duration = task.duration || task.durationMinutes || 60;
            const kind = task.source === 'routine' ? 'routine' : (task.autoPinned || !task.isFixed ? 'flexible' : 'fixed');
            items.push({ kind, title: task.text || task.name || '', start, end: start + duration, task });
        });
    return items
        .map(item => ({ ...item, start: Math.max(item.start, dayStart), end: Math.min(item.end, dayEnd) }))
        .filter(item => item.end > item.start);
}

export function renderDayPlanner({ currentDate, dateDisplay, timeBlocksContainer, openModal, startResize }) {
    if (!window.DataManager) return;

    dateDisplay.textContent = currentDate.toLocaleDateString(locale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const { startMinutes: dayStart, endMinutes: dayEnd } = getDayBounds();
    const at = minutes => `calc(${minutes - dayStart} * var(--minute-height))`;
    const span = minutes => `calc(${minutes} * var(--minute-height))`;

    timeBlocksContainer.innerHTML = '';
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    timeline.style.height = span(dayEnd - dayStart);
    timeline.dataset.date = localDateString(currentDate);
    const grid = document.createElement('div');
    grid.className = 'timeline-grid';
    const gutter = document.createElement('div');
    gutter.className = 'timeline-gutter';
    const lane = document.createElement('div');
    lane.className = 'timeline-lane';
    timeline.append(grid, gutter, lane);

    for (let m = Math.ceil(dayStart / 60) * 60; m < dayEnd; m += 60) {
        const line = document.createElement('div');
        line.className = 'timeline-hour-line';
        line.style.top = at(m);
        grid.appendChild(line);
    }

    const items = assignColumns(collectItems(currentDate, dayStart, dayEnd));
    items.forEach(item => {
        const el = document.createElement('div');
        el.className = {
            calendar: 'event calendar-event',
            routine: 'event routine-event',
            flexible: 'event flexible-event',
            fixed: 'event fixed-event',
        }[item.kind];
        el.style.top = at(item.start);
        el.style.height = span(item.end - item.start);
        el.style.left = `calc(${(100 / item.cols) * item.col}% + 2px)`;
        el.style.width = `calc(${100 / item.cols}% - 4px)`;
        el.dataset.start = String(item.start);
        el.dataset.end = String(item.end);
        el.dataset.title = item.title;

        const title = document.createElement('span');
        title.className = 'event-title';
        title.textContent = item.kind === 'routine' ? `↻ ${item.title}` : item.title;
        const time = document.createElement('span');
        time.className = 'event-time';
        time.textContent = `${clockLabel(item.start)} – ${clockLabel(item.end)}`;
        el.append(title, time);
        el.title = `${item.title} · ${time.textContent}`;

        if (item.kind === 'routine') {
            el.addEventListener('click', () => window.switchTool?.('routine'));
        } else if (item.task) {
            el.classList.add('task-event');
            el.addEventListener('click', () => openModal(item.task));
            if (!item.task._continuation) {
                const resizer = document.createElement('div');
                resizer.className = 'event-resizer';
                resizer.addEventListener('pointerdown', e => {
                    e.stopPropagation();
                    startResize(e, item.task, el);
                });
                el.appendChild(resizer);
            }
        }
        lane.appendChild(el);
    });

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = now.toDateString() === currentDate.toDateString();
    if (isToday && nowMinutes >= dayStart && nowMinutes < dayEnd) {
        const indicator = document.createElement('div');
        indicator.className = 'current-time-indicator';
        indicator.style.top = at(nowMinutes);
        timeline.appendChild(indicator);
    }

    timeBlocksContainer.appendChild(timeline);
    lastRender = { dayStart, dayEnd, items, gutter, nowMinutes: isToday ? nowMinutes : null };
    relabelTimeline();
}

// Pick the time labels that fit at the current zoom: item starts first, then
// item ends, then whole hours; never closer than LABEL_MIN_GAP_PX.
export function relabelTimeline() {
    if (!lastRender) return;
    const { dayStart, dayEnd, items, gutter, nowMinutes } = lastRender;
    const mh = getMinuteHeight();
    // Priority: item starts, then item ends, then whole hours.
    const candidates = [];
    const seen = new Set();
    const add = (m, strong, rank) => {
        if (seen.has(m)) return;
        seen.add(m);
        candidates.push({ m, strong, rank });
    };
    items.forEach(item => add(item.start, true, 0));
    items.forEach(item => add(item.end, true, 1));
    // Hours: fewer when zoomed out (every 1, 2, 3 or 6 hours).
    const hourStep = [1, 2, 3, 6].find(step => step * 60 * mh >= 44) || 6;
    for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) {
        if ((m / 60) % hourStep === 0) add(m, false, 2);
    }
    const taken = nowMinutes === null ? [] : [nowMinutes];
    const placed = [];
    candidates.sort((a, b) => a.rank - b.rank).forEach(c => {
        if (taken.some(m => Math.abs(m - c.m) * mh < LABEL_MIN_GAP_PX)) return;
        taken.push(c.m);
        placed.push(c);
    });

    gutter.innerHTML = '';
    placed.sort((a, b) => a.m - b.m).forEach(({ m, strong }) => {
        const label = document.createElement('span');
        label.className = `timeline-label${strong ? ' is-event' : ''}`;
        label.style.top = `calc(${m - dayStart} * var(--minute-height))`;
        label.textContent = clockLabel(m);
        gutter.appendChild(label);
    });
    if (nowMinutes !== null) {
        const now = document.createElement('span');
        now.className = 'timeline-label is-now';
        now.style.top = `calc(${nowMinutes - dayStart} * var(--minute-height))`;
        now.textContent = clockLabel(nowMinutes);
        gutter.appendChild(now);
    }

    // Short blocks show only their title.
    gutter.parentElement?.querySelectorAll('.timeline-lane .event').forEach(el => {
        const minutes = Number(el.dataset.end) - Number(el.dataset.start);
        el.classList.toggle('is-compact', minutes * mh < TIME_IN_BLOCK_MIN_PX);
    });
}

