// features/planner/ai-plan.js — "AI Plan" (magic wand) for the Day Planner.
// Asks the configured AI provider to place the day's loose tasks around
// fixed events, routines and already-planned tasks. The prompt is written so
// even a weak model produces usable output, and every item is validated and
// conflict-repaired locally before it touches the task store, so a bad model
// can never double-book the day or invent tasks.
import { localDateString } from './planner-utils.js';
import { ensureGeocoded, getTravelMatrix } from './routing.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Accepts "09:30", "9:30", "09:30 AM", "2026-02-14T09:30", 930, "0930".
function parseClock(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const rounded = Math.round(value);
        const h = Math.floor(rounded / 100);
        const m = rounded % 100;
        if (h >= 0 && h <= 23 && m >= 0 && m < 60) return h * 60 + m;
        if (rounded >= 0 && rounded < 1440) return rounded;
        return null;
    }
    if (typeof value !== 'string') return null;
    let s = value.trim().toUpperCase();
    let ampm = null;
    const ampmMatch = s.match(/\b(AM|PM)\b/);
    if (ampmMatch) {
        ampm = ampmMatch[1];
        s = s.replace(/\b(AM|PM)\b/g, '').trim();
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
    const m = iso || s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    let hours = parseInt(iso ? m[4] : m[1], 10);
    const minutes = parseInt(iso ? m[5] : m[2], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    if (hours < 0 || hours > 23) return null;
    return hours * 60 + minutes;
}

// Accepts 45, "45", "45 minutes", "1h30", "1.5 hours", "90 min".
export function parseDurationMinutes(raw, fallback = 0) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp(Math.round(raw), 5, 480);
    if (typeof raw !== 'string') return fallback;
    const s = raw.toLowerCase();
    let total = 0;
    const hMatch = s.match(/([\d.]+)\s*h(?:rs?|ours?)?(?![a-z])/);
    const mMatch = s.match(/(\d+)\s*m(?:ins?|utes?)?(?![a-z])/);
    if (hMatch) total += Math.round(parseFloat(hMatch[1]) * 60);
    if (mMatch) total += parseInt(mMatch[1], 10);
    if (hMatch && !mMatch) {
        const tight = s.match(/h(?:rs?|ours?)?\s*(\d+)$/);
        if (tight) total += parseInt(tight[1], 10);
    }
    if (!total && !hMatch && !mMatch) {
        const bare = parseInt(s, 10);
        if (Number.isFinite(bare) && bare > 0) total = bare;
    }
    return total > 0 ? clamp(total, 5, 480) : fallback;
}

// Accepts a JSON array, or an object wrapping one under a common key, so a
// model that wraps the payload still works.
function extractPlanArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
        for (const key of ['plan', 'schedule', 'tasks', 'items', 'events']) {
            if (Array.isArray(raw[key])) return raw[key];
        }
    }
    return null;
}

// Last-resort salvage for a model that broke the JSON anyway: pull every
// object-like chunk that has a time and a text out of the raw response.
function salvageItems(text) {
    if (!text || typeof text !== 'string') return [];
    const cleaned = text.replace(/```(?:json)?/gi, '');
    const items = [];
    const re = /\{[^{}]*\}/g;
    let m;
    while ((m = re.exec(cleaned)) !== null) {
        try {
            const obj = JSON.parse(m[0]);
            if (obj && typeof obj === 'object') items.push(obj);
        } catch { /* skip malformed chunk */ }
    }
    return items;
}

function firstString(...values) {
    for (const v of values) {
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
    return null;
}

export function normalizePlanItems(raw, rawText = '') {
    let entries = extractPlanArray(raw);
    let salvaged = false;
    if (!entries) {
        const viaExtract = typeof raw === 'string' ? (typeof window !== 'undefined' ? window.AIAssistant?.extractJSON?.(raw) : null) : null;
        entries = extractPlanArray(viaExtract);
    }
    if (!entries) {
        entries = salvageItems(typeof raw === 'string' ? raw : rawText);
        salvaged = entries.length > 0;
    }
    const items = [];
    for (const entry of entries || []) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const time = parseClock(entry.time ?? entry.startTime ?? entry.start ?? entry.start_time ?? entry.at ?? entry.when);
        const text = firstString(entry.text, entry.name, entry.title, entry.task, entry.label, entry.summary);
        if (time === null || !text) continue;
        const duration = parseDurationMinutes(
            entry.duration ?? entry.durationMinutes ?? entry.minutes ?? entry.estimatedMinutes,
            0
        );
        items.push({ time, text, duration });
    }
    return { items, salvaged };
}

function normalizeBlocks(blocks) {
    return (blocks || [])
        .map(b => ({ kind: b.kind, id: b.id, name: b.name || 'busy', location: b.location || '', start: Math.round(b.start), end: Math.round(b.end) }))
        .filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
        .sort((a, b) => a.start - b.start);
}

function mergeRanges(ranges) {
    const merged = [];
    [...ranges].sort((a, b) => a.start - b.start).forEach(r => {
        const last = merged[merged.length - 1];
        if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
        else merged.push({ ...r });
    });
    return merged;
}

// Free gaps in [fromMinutes, dayEndMinutes) given merged busy ranges.
function findFreeStart(busy, fromMinutes, minutes, dayEndMinutes) {
    let cursor = Math.ceil(fromMinutes / 5) * 5;
    for (const b of busy) {
        if (b.end <= cursor) continue;
        if (b.start - cursor >= minutes) return cursor;
        cursor = Math.max(cursor, b.end);
    }
    return cursor + minutes <= dayEndMinutes ? cursor : null;
}

function overlaps(ranges, start, end) {
    return ranges.some(r => start < r.end && end > r.start);
}

export function buildPlanPrompt({ dateStr, weekday, windowStartMinutes, dayEndMinutes, tasks, busyBlocks, travelMatrix }) {
    const lines = [];
    lines.push('You are a strict scheduling assistant. You place tasks on a timeline.');
    lines.push(`Today: ${dateStr} (${weekday}). All times are today, 24-hour HH:MM.`);
    lines.push(`Planning window: ${minutesToTime(windowStartMinutes)} to ${minutesToTime(dayEndMinutes)}.`);
    lines.push('Busy blocks (already taken — NEVER schedule inside or overlapping them):');
    lines.push(busyBlocks.length
        ? '[' + busyBlocks.map(b => `{"start":"${minutesToTime(b.start)}","end":"${minutesToTime(b.end)}","name":${JSON.stringify(b.name)},"location":${JSON.stringify(b.location || '')}}`).join(',') + ']'
        : '[] (nothing is busy yet)');
    lines.push('Tasks to schedule (keep each "text" EXACTLY as given):');
    lines.push('[' + tasks.map(t => JSON.stringify({ text: t.name, minutes: t.minutes, location: t.location || '' })).join(',') + ']');

    if (travelMatrix && travelMatrix.size > 0) {
        lines.push('Travel matrix (minutes between locations):');
        const matrixLines = [];
        for (const [key, val] of travelMatrix.entries()) {
            const [loc1, loc2] = key.split('|');
            matrixLines.push(`- ${loc1} to ${loc2}: ${val.minutes} min (${val.mode})`);
        }
        lines.push(matrixLines.join('\n'));
    }

    lines.push('Rules:');
    lines.push('1. Schedule EVERY task exactly once. Do not skip tasks. Do not invent extra tasks.');
    lines.push(`2. Every start time must be free: not inside a busy block, not overlapping another task, not before ${minutesToTime(windowStartMinutes)}, not after ${minutesToTime(dayEndMinutes)}.`);
    lines.push('3. One task at a time. Tasks may follow each other back to back.');
    lines.push('4. A task that does not fit anywhere goes last, at the first free time after the last busy block or task.');
    lines.push('5. Order the output by start time.');
    lines.push('6. Output ONLY a JSON array — no prose, no markdown, no code fences, no comments, no trailing commas.');
    lines.push('7. If consecutive tasks/blocks have DIFFERENT locations, you MUST insert a travel task between them named "Travel to [location name]" with duration from the travel matrix. Do not include travel tasks if locations are empty or identical. Output these extra travel tasks in the final JSON array.');
    lines.push('Format of each element, with exactly these keys:');
    lines.push('{"time":"HH:MM","text":"the task text exactly as given","duration":<minutes as a plain number>,"isTravel":<true if this is a travel task, else omit>}');
    return lines.join('\n');
}

// Turns raw model items into a safe plan: only known task texts, one slot per
// task, no overlap with busy blocks, all inside the planning window.
export function validatePlan(items, { tasks, windowStartMinutes, dayEndMinutes, defaultDurationMinutes, busyBlocks }) {
    const desired = new Map(tasks.map(t => [t.name, t.minutes]));
    const report = { accepted: [], moved: [], dropped: [], duplicates: [], unknown: [] };
    const busy = mergeRanges(normalizeBlocks(busyBlocks));
    const placed = [];
    const placedByName = new Set();

    [...items]
        .sort((a, b) => a.time - b.time)
        .forEach(item => {
            const isTravel = item.text.startsWith('Travel to ') || item.isTravel;
            if (!desired.has(item.text) && !isTravel) {
                report.unknown.push(item.text);
                return;
            }
            if (placedByName.has(item.text)) {
                report.duplicates.push(item.text);
                return;
            }
            const minutes = item.duration || desired.get(item.text) || defaultDurationMinutes;
            let start = item.time;
            let relocated = false;
            if (start < windowStartMinutes || start + minutes > dayEndMinutes || overlaps(busy, start, start + minutes) || overlaps(placed, start, start + minutes)) {
                const busyAll = mergeRanges([...busy, ...placed.map(p => ({ start: p.start, end: p.end }))]);
                let free = findFreeStart(busyAll, Math.max(windowStartMinutes, start), minutes, dayEndMinutes);
                if (free === null) free = findFreeStart(busyAll, windowStartMinutes, minutes, dayEndMinutes);
                if (free === null) {
                    report.dropped.push(item.text);
                    return;
                }
                start = free;
                relocated = true;
            }
            placed.push({ name: item.text, start, end: start + minutes });
            placedByName.add(item.text);
            if (relocated) report.moved.push({ name: item.text, from: item.time, to: start });
            report.accepted.push({ text: item.text, start, duration: minutes });
        });

    return report;
}

export async function planDayWithAI(currentDate, options = {}) {
    const scheduler = window.UnifiedScheduler;
    if (!scheduler?.getBusyBlocks) throw new Error('Scheduler not available yet.');
    const tr = options.tr || (key => key);
    const dateStr = localDateString(currentDate);
    const bounds = options.dayBounds || { startMinutes: 0, endMinutes: 1440 };
    const dayStartMinutes = options.dayStartMinutes ?? bounds.startMinutes;
    const dayEndMinutes = options.dayEndMinutes ?? bounds.endMinutes;
    const isToday = dateStr === localDateString(new Date());
    const now = new Date();
    const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;
    const windowStartMinutes = Math.max(dayStartMinutes, nowMinutes);
    const defaultDurationMinutes = options.defaultDurationMinutes || 25;

    const pending = (window.TaskStore?.getPendingTasks?.() || [])
        .filter(t => !t.completed && !t.plannerDate && (t.name || t.text));
    const seen = new Set();
    const tasks = pending
        .filter(t => {
            const name = (t.name || t.text).trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
        })
        .map(t => ({
            id: t.hash || t.id,
            name: (t.name || t.text).trim(),
            minutes: clamp(Math.round(Number(t.durationMinutes || t.duration || t.estimatedMinutes) || defaultDurationMinutes), 5, 480),
            location: t.location || '',
        }));
    if (tasks.length === 0) return { ok: false, reason: 'noTasks', message: tr('plan.aiNoTasks') };

    if (!window.AIAssistant?.isEnabled?.()) {
        return { ok: false, reason: 'noProvider', message: tr('plan.aiNeedsProvider') };
    }

    const busyBlocks = normalizeBlocks(scheduler.getBusyBlocks(dateStr));

    // Get coordinates for all unique locations
    const allLocations = new Set([
        ...tasks.map(t => t.location).filter(Boolean),
        ...busyBlocks.map(b => b.location).filter(Boolean)
    ]);
    const coordsMap = await ensureGeocoded(Array.from(allLocations));
    const travelMatrix = await getTravelMatrix(coordsMap);

    const prompt = buildPlanPrompt({
        dateStr,
        weekday: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        windowStartMinutes,
        dayEndMinutes,
        tasks,
        busyBlocks,
        travelMatrix,
    });

    let rawText = '';
    let parsed = null;
    try {
        rawText = await window.AIAssistant.complete(prompt, {
            system: 'You are a scheduling assistant. Respond with a valid JSON array only. No prose, no markdown fences, no comments.',
            maxTokens: 2000,
            temperature: 0.1,
        });
        parsed = window.AIAssistant.extractJSON?.(rawText);
    } catch (err) {
        return { ok: false, reason: 'requestFailed', message: tr('plan.aiFailed', { error: err?.message || 'unknown error' }) };
    }

    const { items, salvaged } = normalizePlanItems(parsed, rawText);
    if (!items.length) {
        return { ok: false, reason: 'unparsable', message: tr('plan.aiUnparsable') };
    }

    const report = validatePlan(items, {
        tasks,
        windowStartMinutes,
        dayEndMinutes,
        defaultDurationMinutes,
        busyBlocks,
    });
    if (!report.accepted.length) {
        return { ok: false, reason: 'noRoom', message: tr('plan.aiNoRoom') };
    }

    const addTaskToStore = window.TaskStore?.addTask
        ? window.TaskStore.addTask.bind(window.TaskStore)
        : window.DataManager?.addTask
            ? window.DataManager.addTask.bind(window.DataManager)
            : null;
    const saved = [];
    report.accepted.forEach(item => {
        const plannerDateTime = `${dateStr}T${minutesToTime(item.start)}`;
        const created = addTaskToStore
            ? addTaskToStore({
                text: item.text,
                name: item.text,
                plannerDate: plannerDateTime,
                deadline: null,
                duration: item.duration,
                durationMinutes: item.duration,
                isFixed: true,
                originalTool: 'AI',
                travelMode: item.text.startsWith('Travel to ') ? 'walk' : null, // AI tasks are saved as walk initially if they are travel, user can change later
            })
            : null;
        saved.push(created || { text: item.text, plannerDate: plannerDateTime, duration: item.duration });
    });
    window.EventBus?.dispatchEvent(new Event('dataChanged'));

    return {
        ok: true,
        planned: saved.length,
        moved: report.moved.length,
        dropped: report.dropped.length,
        duplicates: report.duplicates.length,
        unknown: report.unknown.length,
        salvaged,
        message: tr('plan.aiPlanned', { n: saved.length }),
    };
}
