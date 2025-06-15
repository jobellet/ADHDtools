function sendAction(action) {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (!tabs.length) {
      document.getElementById('status').textContent = 'No active tab.';
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, {action}, response => {
      if (chrome.runtime.lastError) {
        document.getElementById('status').textContent = 'Error: ' + chrome.runtime.lastError.message;
      } else if (response && response.status) {
        document.getElementById('status').textContent = response.status;
      }
    });
  });
}

document.getElementById('sync-btn').addEventListener('click', () => sendAction('startSync'));
document.getElementById('clear-local-btn').addEventListener('click', () => sendAction('clearLocal'));
document.getElementById('clear-sync-btn').addEventListener('click', () => sendAction('clearSync'));
