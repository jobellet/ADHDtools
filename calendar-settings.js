// calendar-settings.js - Manage the Google OAuth Client ID on the calendar page.
// Only a Client ID is needed (no API key): sync uses OAuth tokens directly.

document.addEventListener('DOMContentLoaded', () => {
  const settingsContainer = document.getElementById('gcal-settings-container');
  if (!settingsContainer) return;

  settingsContainer.innerHTML = `
    <h4>Google Calendar API</h4>
    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
      Paste your OAuth Client ID to enable private sync.
      <a href="https://github.com/jobellet/ADHDtools/blob/main/docs/google-calendar-sync.md" target="_blank" rel="noopener">How do I get one?</a>
    </p>
    <div class="api-setting" style="margin-bottom: 0.5rem;">
      <label for="gcal-client-id-input" style="display:block; font-size: 0.85rem;">Client ID:</label>
      <input type="text" id="gcal-client-id-input" placeholder="xxxx.apps.googleusercontent.com — or paste JSON" style="width: 100%; padding: 0.4rem;" />
    </div>
    <div class="api-actions" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button id="save-gcal-keys" class="btn btn-primary btn-sm">Save</button>
        <button id="clear-gcal-keys" class="btn btn-secondary btn-sm">Clear</button>
    </div>
    <span id="gcal-key-status" class="status" style="display: block; margin-top: 0.5rem; font-size: 0.85rem;"></span>
  `;

  const clientInput = settingsContainer.querySelector('#gcal-client-id-input');
  const status = settingsContainer.querySelector('#gcal-key-status');

  // The old integration also stored an API key; it is no longer needed.
  localStorage.removeItem('gcalApiKey');

  if (localStorage.getItem('gcalClientId')) {
    status.textContent = 'Client ID saved';
    status.style.color = 'var(--success-color)';
  }

  // Smart paste: accept a raw Client ID or a JSON blob (e.g. the credentials
  // file downloaded from Google Cloud Console) and extract client_id from it.
  clientInput.addEventListener('paste', (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    if (!pastedText.trim().startsWith('{')) return;
    try {
      const data = JSON.parse(pastedText);
      const clientId = data.client_id || data.clientId || data.CLIENT_ID
        || data.web?.client_id || data.installed?.client_id;
      if (clientId) {
        e.preventDefault();
        clientInput.value = clientId;
        status.textContent = 'Client ID extracted from JSON — click Save';
        status.style.color = 'var(--success-color)';
      }
    } catch { /* not JSON, let the normal paste happen */ }
  });

  settingsContainer.querySelector('#save-gcal-keys').addEventListener('click', () => {
    const clientId = clientInput.value.trim();
    if (!clientId) {
      status.textContent = 'Client ID is empty';
      status.style.color = 'var(--danger-color)';
      return;
    }
    window.GoogleAuth ? window.GoogleAuth.setClientId(clientId) : localStorage.setItem('gcalClientId', clientId);
    clientInput.value = '';
    status.textContent = 'Client ID saved';
    status.style.color = 'var(--success-color)';
    setTimeout(() => location.reload(), 500);
  });

  settingsContainer.querySelector('#clear-gcal-keys').addEventListener('click', () => {
    localStorage.removeItem('gcalClientId');
    localStorage.removeItem('gcalApiKey');
    window.GoogleAuth?.clearTokens();
    status.textContent = 'Client ID cleared';
    status.style.color = 'var(--text-muted)';
  });
});
