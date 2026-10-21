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
// Device-local keys that must never overwrite another device's local watermarks or identity.
const DEVICE_LOCAL_KEYS = new Set([
  'adhd-device-id',
  'driveLastBackupAt',
  'gcalLastSyncAt',
  'last-points-check',
]);
// Keys where the entire array represents an ordered/hierarchical user list (breakdowns, routines,
// habits, rewards): when one device edited or deleted items more recently, its key timestamp wins cleanly.
const WHOLE_COLLECTION_ARRAY_KEYS = new Set([
  'adhd-breakdown-tasks',
  'adhd-tool-routines',
  'adhd-habits',
  'adhd-rewards',
]);

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

function parseObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
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
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? 0 : t;
}

function itemTimestamp(item) {
  if (!item || typeof item !== 'object') return 0;
  return Math.max(
    parseTs(item.updatedAt),
    parseTs(item.completedAt),
    parseTs(item.modifiedAt),
    parseTs(item.deletedAt)
  );
}

function itemIdentity(key, item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    if (item.id) return `id:${item.id}`;
    if (item.hash) return `id:${item.hash}`;
    if (key === 'adhd-calendar-events' && (item.calendarInstanceId || item.uid)) {
      return `cal:${item.calendarInstanceId || item.uid}:${item.start || ''}`;
    }
    if (item.text) return `text:${item.text}`;
    if (item.name) return `name:${item.name}`;
  }
  return null;
}

export function mergeArrayKey(key, importedVal, existingVal, context = {}) {
  const existingKeyTs = parseTs(context.storageLog?.[key]);
  const importedKeyTs = parseTs(context.importedStorageLog?.[key]);
  const result = {
    merged: [...existingVal],
    added: 0,
    updated: 0,
    conflicts: [],
  };

  if (isSameContent(existingVal, importedVal)) {
    return result;
  }

  // For whole-collection keys (like breakdown trees, routines, habits, rewards) where the user may
  // reorder or delete items, if one side's storageLog timestamp is strictly newer and no item-level
  // timestamp contradicts it, take the newer collection cleanly so deletions and edits propagate.
  if (WHOLE_COLLECTION_ARRAY_KEYS.has(key) && importedKeyTs > 0 && existingKeyTs > 0 && importedKeyTs !== existingKeyTs) {
    if (importedKeyTs > existingKeyTs) {
      result.merged = [...importedVal];
      result.updated = Math.max(1, Math.abs(importedVal.length - existingVal.length));
    }
    return result;
  }

  importedVal.forEach(importedItem => {
    const importedTs = itemTimestamp(importedItem);
    let conflict = null;

    if (importedItem && (importedItem.id || importedItem.hash)) {
      const targetId = importedItem.id || importedItem.hash;
      conflict = existingVal.find(e => e && (e.id === targetId || e.hash === targetId));
    } else if (key === 'adhd-habits' && typeof importedItem === 'string') {
      conflict = existingVal.includes(importedItem) ? importedItem : null;
    } else if (importedItem && importedItem.text) {
      conflict = existingVal.find(e => e && e.text === importedItem.text && !e.id);
    } else if (importedItem && importedItem.name) {
      conflict = existingVal.find(e => e && e.name === importedItem.name && !e.id);
    }

    if (conflict === null || conflict === undefined) {
      // If this is a whole-collection key where local is strictly newer than imported, an item
      // present only in imported was deleted locally — do not resurrect it.
      if (WHOLE_COLLECTION_ARRAY_KEYS.has(key) && existingKeyTs > importedKeyTs && existingKeyTs > 0) {
        return;
      }
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
          (i && (i.id || i.hash) && (i.id === (conflict.id || conflict.hash) || i.hash === (conflict.id || conflict.hash))) || i === conflict);
        if (idx !== -1) {
          result.merged[idx] = importedItem;
          result.updated += 1;
        }
      }
      return;
    }

    // Tie-breaker using per-key storage log timestamps when items have no per-item updatedAt.
    if (importedKeyTs > 0 && existingKeyTs > 0 && importedKeyTs !== existingKeyTs) {
      if (importedKeyTs > existingKeyTs) {
        const idx = result.merged.findIndex(i =>
          (i && (i.id || i.hash) && (i.id === (conflict.id || conflict.hash) || i.hash === (conflict.id || conflict.hash))) || i === conflict);
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
      id: importedItem?.id || importedItem?.text || importedItem?.name || 'unknown',
      existing: conflict,
      imported: importedItem,
      label: importedItem?.text || importedItem?.name || importedItem?.title || importedItem?.id || 'Item',
    });
  });

  // If imported is strictly newer for a whole-collection key (e.g. existingKeyTs was 0), remove items deleted remotely.
  if (WHOLE_COLLECTION_ARRAY_KEYS.has(key) && importedKeyTs > existingKeyTs && importedKeyTs > 0) {
    const importedIds = new Set(importedVal.map(item => itemIdentity(key, item)).filter(Boolean));
    const beforeLen = result.merged.length;
    result.merged = result.merged.filter(item => {
      const id = itemIdentity(key, item);
      return !id || importedIds.has(id);
    });
    if (result.merged.length !== beforeLen) result.updated += 1;
  }

  return result;
}

function mergeObjectMapKey(key, importedVal, existingVal, existingKeyTs, importedKeyTs) {
  if (key === 'adhd-routine-runs') {
    const merged = { ...existingVal };
    let changed = 0;
    for (const [k, v] of Object.entries(importedVal)) {
      if (k === '_active') {
        const impActive = v && typeof v === 'object' ? v : null;
        const exActive = existingVal._active && typeof existingVal._active === 'object' ? existingVal._active : null;
        const impTs = parseTs(impActive?.updatedAt) || importedKeyTs;
        const exTs = parseTs(exActive?.updatedAt) || existingKeyTs;
        if (impTs > exTs && !isSameContent(exActive, impActive)) {
          merged._active = impActive;
          changed += 1;
        }
        continue;
      }
      if (typeof v === 'string' && (!merged[k] || v > merged[k])) {
        merged[k] = v;
        changed += 1;
      }
    }
    // If existing had _active and imported explicitly cleared it (_active: null) with a newer timestamp
    if ( '_active' in importedVal && importedVal._active === null && existingVal._active) {
      const exTs = parseTs(existingVal._active?.updatedAt) || existingKeyTs;
      if (importedKeyTs > exTs) {
        merged._active = null;
        changed += 1;
      }
    }
    return { merged, changed };
  }

  if (key === 'adhd-habit-logs') {
    const merged = { ...existingVal };
    let changed = 0;
    const newerIsImported = importedKeyTs >= existingKeyTs;
    for (const [habitId, dates] of Object.entries(importedVal)) {
      if (!dates || typeof dates !== 'object') continue;
      if (!merged[habitId] || typeof merged[habitId] !== 'object') {
        merged[habitId] = { ...dates };
        changed += 1;
        continue;
      }
      const nextDates = newerIsImported ? { ...merged[habitId], ...dates } : { ...dates, ...merged[habitId] };
      if (!isSameContent(nextDates, merged[habitId])) {
        merged[habitId] = nextDates;
        changed += 1;
      }
    }
    return { merged, changed };
  }

  return null;
}

export function mergeBackup(imported, existingRaw, context = {}) {
  const storageLog = {
    ...parseObject(existingRaw[STORAGE_LOG_KEY]),
    ...(context.storageLog || {}),
  };
  const importedStorageLog = {
    ...parseObject(imported?.[STORAGE_LOG_KEY]),
    ...(context.importedStorageLog || {}),
  };
  const result = {
    updates: {},
    added: 0,
    updated: 0,
    conflicts: [],
  };
  const deletedIds = new Set([
    ...parseList(existingRaw[DELETED_TASKS_KEY]),
    ...parseList(imported[DELETED_TASKS_KEY]),
  ].map(x => x?.id).filter(Boolean));

  Object.keys(imported).forEach(key => {
    if (key === 'metadata' || DEVICE_LOCAL_KEYS.has(key)) return;
    if (context.isSensitiveKey?.(key)) return;

    if (key === STORAGE_LOG_KEY) {
      const mergedLog = { ...storageLog };
      let logChanged = false;
      for (const [k, ts] of Object.entries(importedStorageLog)) {
        if (DEVICE_LOCAL_KEYS.has(k) || context.isSensitiveKey?.(k)) continue;
        if (parseTs(ts) > parseTs(mergedLog[k])) {
          mergedLog[k] = ts;
          logChanged = true;
        }
      }
      if (logChanged) result.updates[STORAGE_LOG_KEY] = mergedLog;
      return;
    }

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
      const merged = mergeArrayKey(key, importedVal, existingVal, { storageLog, importedStorageLog });
      if (TASK_KEYS.has(key)) {
        // Tasks deleted on the other device are removed here too.
        const before = merged.merged.length;
        merged.merged = merged.merged.filter(item => !isDeleted(item, deletedIds));
        if (merged.merged.length !== before) merged.updated += 1;
      }
      result.updates[key] = merged.merged;
      result.added += merged.added;
      result.updated += merged.updated;
      merged.conflicts.forEach(c => result.conflicts.push(c));
      return;
    }

    if (isSameContent(existingVal, importedVal)) return;

    const existingTs = parseTs(storageLog[key]);
    const importedTs = parseTs(importedStorageLog[key]) || parseTs(imported?.metadata?.exportedAt);

    if (existingVal && typeof existingVal === 'object' && !Array.isArray(existingVal)
      && importedVal && typeof importedVal === 'object' && !Array.isArray(importedVal)) {
      const mapMerge = mergeObjectMapKey(key, importedVal, existingVal, existingTs, importedTs);
      if (mapMerge) {
        if (mapMerge.changed > 0) {
          result.updates[key] = mapMerge.merged;
          result.updated += mapMerge.changed;
        }
        return;
      }
    }

    if ((importedTs > 0 || existingTs > 0) && importedTs !== existingTs) {
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

  return result;
}
