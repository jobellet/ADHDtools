const STORAGE_KEY = 'adhd-duration-learning';

function normalizeName(taskName) {
    return (taskName || '').trim().toLowerCase();
}

function readStore() {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Unable to read duration learning store', error);
        return {};
    }
}

function writeStore(store) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        }
    } catch (error) {
        console.warn('Unable to write duration learning store', error);
    }
}

export function recordTaskDuration(taskName, minutes) {
    const normalized = normalizeName(taskName);
    const duration = Number(minutes);

    if (!normalized || !Number.isFinite(duration) || duration <= 0) {
        return null;
    }

    const store = readStore();
    const existing = store[normalized] || { average: 0, count: 0 };
    const newCount = (existing.count || 0) + 1;
    const newAverage = ((existing.average || 0) * (existing.count || 0) + duration) / newCount;

    store[normalized] = { average: newAverage, count: newCount, last: duration };
    writeStore(store);
    return newAverage;
}

export function getEstimatedDuration(taskName) {
    const normalized = normalizeName(taskName);
    if (!normalized) return null;

    const store = readStore();
    const entry = store[normalized];

    if (!entry || !Number.isFinite(entry.average) || entry.average <= 0) {
        return null;
    }

    return entry.average;
}

if (typeof window !== 'undefined') {
    window.DurationLearning = {
        recordTaskDuration,
        getEstimatedDuration,
    };
}

export default { recordTaskDuration, getEstimatedDuration };
