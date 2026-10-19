(() => {
  const LOG_KEY = 'adhd-storage-log';
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let syncTimeout = null;

  function scheduleSync() {
    if (window.AttentionService?.isNative?.()) {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        if (window.DataManager?.syncToNativeDisk) {
          window.DataManager.syncToNativeDisk();
        }
      }, 300);
    }
  }

  function updateLog(key) {
    if (key === LOG_KEY) return;
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
    updateLog(key);
    originalSetItem.call(this, key, value);
    if (key.startsWith('adhd-')) scheduleSync();
  };

  Storage.prototype.removeItem = function(key) {
    updateLog(key);
    originalRemoveItem.call(this, key);
    if (key.startsWith('adhd-')) scheduleSync();
  };

  window.getStorageLog = function() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY)) || {};
    } catch {
      return {};
    }
  };
})();
