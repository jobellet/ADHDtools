const STORAGE_KEY = 'adhd-duration-learning';

function loadDurations() {
    if (typeof localStorage === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (err) {
        console.warn('Failed to parse duration data', err);
        return {};
    }
}

function saveDurations(data) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
        console.warn('Failed to save duration data', err);
    }
}

function normalizeName(name) {
    return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

export function recordTaskDuration(taskName, minutes) {
    const normalized = normalizeName(taskName);
    const duration = Number(minutes);
    if (!normalized || !Number.isFinite(duration) || duration <= 0) return;

    const data = loadDurations();
    const existing = data[normalized] || { total: 0, count: 0 };
    const updated = {
        total: existing.total + duration,
        count: existing.count + 1,
    };

    data[normalized] = updated;
    saveDurations(data);
}

export function getEstimatedDuration(taskName) {
    const normalized = normalizeName(taskName);
    if (!normalized) return null;

    const data = loadDurations();
    const entry = data[normalized];
    if (!entry || !entry.count) return null;

    return Math.round(entry.total / entry.count);
}

if (typeof window !== 'undefined') {
    window.DurationLearning = {
        recordTaskDuration,
        getEstimatedDuration,
    };
}

export default { recordTaskDuration, getEstimatedDuration };
