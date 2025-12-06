const STORAGE_KEY = 'adhd-duration-learning';

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function loadDurations() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to load duration data', err);
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

export function recordTaskDuration(taskName, minutes) {
  const name = normalizeName(taskName);
  const duration = Number(minutes);

  if (!name || !Number.isFinite(duration) || duration <= 0) return null;

  const durations = loadDurations();
  const entry = durations[name] || { totalMinutes: 0, count: 0 };

  entry.totalMinutes += duration;
  entry.count += 1;
  entry.averageMinutes = entry.totalMinutes / entry.count;

  durations[name] = entry;
  saveDurations(durations);

  return entry.averageMinutes;
}

export function getEstimatedDuration(taskName) {
  const name = normalizeName(taskName);
  if (!name) return null;

  const durations = loadDurations();
  const entry = durations[name];
  if (!entry || !entry.count) return null;

  return entry.averageMinutes ?? entry.totalMinutes / entry.count;
}

if (typeof window !== 'undefined') {
  window.DurationLearning = { recordTaskDuration, getEstimatedDuration };
}

export default { recordTaskDuration, getEstimatedDuration };
