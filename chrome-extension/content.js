let syncInterval = null;

function collectLocal() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  return data;
}

function applyData(data) {
  if (!data) return;
  localStorage.clear();
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
}

function doSync() {
  const data = collectLocal();
  chrome.storage.sync.set({ adhdToolsData: data });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startSync') {
    chrome.storage.sync.set({ syncEnabled: true }, () => {
      doSync();
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(doSync, 10000);
      sendResponse({ status: 'Sync enabled' });
    });
    return true;
  }
  if (message.action === 'clearLocal') {
    localStorage.clear();
    sendResponse({ status: 'Local data cleared' });
  }
  if (message.action === 'clearSync') {
    chrome.storage.sync.clear(() => {
      sendResponse({ status: 'Synced data cleared' });
    });
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.adhdToolsData) {
    applyData(changes.adhdToolsData.newValue);
  }
});

chrome.storage.sync.get(['syncEnabled', 'adhdToolsData'], res => {
  if (res.adhdToolsData) {
    applyData(res.adhdToolsData);
  }
  if (typeof res.syncEnabled === 'undefined') {
    chrome.storage.sync.set({ syncEnabled: true }, () => {
      doSync();
      syncInterval = setInterval(doSync, 10000);
    });
  } else if (res.syncEnabled) {
    syncInterval = setInterval(doSync, 10000);
  }
});
