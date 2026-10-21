(() => {
  const LOG_KEY = 'adhd-storage-log';
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let syncTimeout = null;
  let suppressDriveNotify = false;

  function isBookkeepingKey(key) {
    return !key
      || key === LOG_KEY
      || key === 'adhd-device-id'
      || key === 'driveLastBackupAt'
      || key === 'gcalLastSyncAt'
      || key === 'last-points-check';
  }

  function scheduleSync(changedKey) {
    if (window.AttentionService?.isNative?.()) {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        if (changedKey && window.DataManager?.isNativeSecretKey?.(changedKey)) {
          window.DataManager.syncSecretsToNativeDisk?.();
        } else if (window.DataManager?.syncToNativeDisk) {
          window.DataManager.syncToNativeDisk();
        }
      }, 300);
    }
    if (!suppressDriveNotify && !isBookkeepingKey(changedKey) && !window.DataManager?.isNativeSecretKey?.(changedKey)) {
      window.DriveSync?.notifyLocalChange?.(changedKey);
    }
  }

  function updateLog(key) {
    if (suppressDriveNotify || isBookkeepingKey(key)) return;
    let log;
    try {
      log = JSON.parse(localStorage.getItem(LOG_KEY)) || {};
    } catch {
      log = {};
    }
    log[key] = new Date().toISOString();
    originalSetItem.call(localStorage, LOG_KEY, JSON.stringify(log));
  }

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage) updateLog(key);
    originalSetItem.call(this, key, value);
    if (this === localStorage) scheduleSync(key);
  };

  Storage.prototype.removeItem = function(key) {
    if (this === localStorage) updateLog(key);
    originalRemoveItem.call(this, key);
    if (this === localStorage) scheduleSync(key);
  };

  window.getStorageLog = function() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY)) || {};
    } catch {
      return {};
    }
  };
  window.getStorageLog.withCloudSyncWrite = function(fn) {
    suppressDriveNotify = true;
    try {
      return fn();
    } finally {
      suppressDriveNotify = false;
    }
  };
})();
