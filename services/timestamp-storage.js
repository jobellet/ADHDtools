(() => {
  const LOG_KEY = 'adhd-storage-log';
  const originalSetItem = Storage.prototype.setItem;

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
  };

  window.getStorageLog = function() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY)) || {};
    } catch {
      return {};
    }
  };
})();
