// sync-merge.js — pure merge logic for syncing a Drive backup with local data.
// Three conflict levels, from most common to rarest:
//   1. identical items        → skipped silently
//   2. same id, both changed  → most recent updatedAt wins automatically
//   3. true simultaneous edit → surfaced as a collision for manual resolution
// Key-level timestamps (from timestamp-storage.js storage log) break ties
// when items carry no usable updatedAt field.
export const STORAGE_LOG_KEY = 'adhd-storage-log';
// Deleted task ids ({ id, deletedAt }), written by TaskStore.deleteTasks.
export const DELETED_TASKS_KEY = 'adhd-deleted-tasks';
const TASK_KEYS = new Set(['adhd-unified-tasks']);

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// A task deleted on either device stays deleted after the merge.
function isDeleted(item, deletedIds) {
  return Boolean(item && typeof item === 'object' && (deletedIds.has(item.id) || deletedIds.has(item.hash)));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function isSameContent(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function parseTs(ts) {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? 0 : t;
}

function itemTimestamp(item) {
  if (!item || typeof item !== 'object') return 0;
  return Math.max(
    parseTs(item.updatedAt),
    parseTs(item.completedAt),
    parseTs(item.modifiedAt)
  );
}

function itemSignature(item) {
  if (!item || typeof item !== 'object') return null;
  const { updatedAt, completedAt, modifiedAt, ...rest } = item;
  return stableStringify(rest);
}

export function mergeArrayKey(key, importedVal, existingVal, context = {}) {
  const keyTs = parseTs(context.storageLog?.[key]);
  const result = {
    merged: [...existingVal],
    added: 0,
    updated: 0,
    conflicts: [],
  };

  importedVal.forEach(importedItem => {
    const importedTs = itemTimestamp(importedItem);
    let conflict = null;

    if (importedItem && importedItem.id) {
      conflict = existingVal.find(e => e.id === importedItem.id);
    } else if (key === 'adhd-habits' && typeof importedItem === 'string') {
      conflict = existingVal.includes(importedItem) ? importedItem : null;
    } else if (importedItem && importedItem.text) {
      conflict = existingVal.find(e => e.text === importedItem.text && !e.id);
    }

    if (conflict === null || conflict === undefined) {
      result.merged.push(importedItem);
      result.added += 1;
      return;
    }

    if (typeof conflict === 'string' || isSameContent(conflict, importedItem)) {
      return;
    }

    const existingTs = itemTimestamp(conflict);
    const canAutoResolve =
      (importedTs > 0 || existingTs > 0) &&
      importedTs !== existingTs;

    if (canAutoResolve) {
      if (importedTs > existingTs) {
        const idx = result.merged.findIndex(i =>
          (i && i.id && i.id === conflict.id) || i === conflict);
        if (idx !== -1) {
          result.merged[idx] = importedItem;
          result.updated += 1;
        }
      }
      return;
    }

    result.conflicts.push({
      key,
      type: 'array-item',
      id: importedItem?.id || importedItem?.text || 'unknown',
      existing: conflict,
      imported: importedItem,
      label: importedItem?.text || importedItem?.name || importedItem?.title || importedItem?.id || 'Item',
    });
  });

  return result;
}

export function mergeBackup(imported, existingRaw, context = {}) {
  const storageLog = context.storageLog || {};
  const result = {
    updates: {},
    added: 0,
    updated: 0,
    conflicts: [],
  };
  const ignoredKeys = new Set(['metadata', ...Object.keys(result.updates)]);
  const deletedIds = new Set([
    ...parseList(existingRaw[DELETED_TASKS_KEY]),
    ...parseList(imported[DELETED_TASKS_KEY]),
  ].map(x => x?.id).filter(Boolean));

  Object.keys(imported).forEach(key => {
    if (key === 'metadata') return;
    if (context.isSensitiveKey?.(key)) return;

    let importedVal = imported[key];
    const existingStr = existingRaw[key];
    if (TASK_KEYS.has(key) && Array.isArray(importedVal)) {
      importedVal = importedVal.filter(item => !isDeleted(item, deletedIds));
    }

    if (existingStr === undefined || existingStr === null || existingStr === '') {
      result.updates[key] = importedVal;
      result.added += Array.isArray(importedVal) ? importedVal.length : 1;
      return;
    }

    let existingVal;
    try {
      existingVal = JSON.parse(existingStr);
    } catch {
      existingVal = existingStr;
    }

    if (Array.isArray(importedVal) && Array.isArray(existingVal)) {
      const merged = mergeArrayKey(key, importedVal, existingVal, { storageLog });
      if (TASK_KEYS.has(key)) {
        // Tasks deleted on the other device are removed here too.
        merged.merged = merged.merged.filter(item => !isDeleted(item, deletedIds));
      }
      result.updates[key] = merged.merged;
      result.added += merged.added;
      result.updated += merged.updated;
      merged.conflicts.forEach(c => result.conflicts.push(c));
      return;
    }

    if (isSameContent(existingVal, importedVal)) return;

    const keyTs = parseTs(storageLog[key]);
    const importedTs = parseTs(imported?.metadata?.exportedAt) || keyTs;
    const existingTs = keyTs;
    if (importedTs > 0 && importedTs !== existingTs) {
      if (importedTs > existingTs) {
        result.updates[key] = importedVal;
        result.updated += 1;
      }
      return;
    }

    result.conflicts.push({
      key,
      type: 'value',
      existing: existingVal,
      imported: importedVal,
      label: key,
    });
  });

  ignoredKeys.clear();
  return result;
}
