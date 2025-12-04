// calendar-settings.js - Manage Google Calendar API credentials on the calendar page

document.addEventListener('DOMContentLoaded', () => {
  const settingsContainer = document.getElementById('gcal-settings-container');
  if (!settingsContainer) return;

  settingsContainer.innerHTML = `
    <h4>Google Calendar API</h4>
    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Enter your Client ID and API Key to enable sync.</p>
    <div class="api-setting" style="margin-bottom: 0.5rem;">
      <label for="gcal-client-id-input" style="display:block; font-size: 0.85rem;">Client ID:</label>
      <input type="text" id="gcal-client-id-input" placeholder="Enter Client ID or paste JSON" style="width: 100%; padding: 0.4rem;" />
    </div>
    <div class="api-setting" style="margin-bottom: 0.5rem;">
      <label for="gcal-api-key-input" style="display:block; font-size: 0.85rem;">API Key:</label>
      <input type="password" id="gcal-api-key-input" placeholder="Enter API Key or paste JSON" style="width: 100%; padding: 0.4rem;" />
    </div>
    <div class="api-actions" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button id="save-gcal-keys" class="btn btn-primary btn-sm">Save</button>
        <button id="clear-gcal-keys" class="btn btn-secondary btn-sm">Clear</button>
    </div>
    <span id="gcal-key-status" class="status" style="display: block; margin-top: 0.5rem; font-size: 0.85rem;"></span>
  `;

  const clientInput = settingsContainer.querySelector('#gcal-client-id-input');
  const apiInput = settingsContainer.querySelector('#gcal-api-key-input');
  const status = settingsContainer.querySelector('#gcal-key-status');

  if (localStorage.getItem('gcalClientId') && localStorage.getItem('gcalApiKey')) {
    status.textContent = 'Keys saved';
    status.style.color = 'var(--success-color)';
  }

  // Smart paste handler for JSON credentials
  function handleSmartPaste(e) {
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');

    // Try to detect and parse JSON
    if (pastedText.trim().startsWith('{')) {
      try {
        const data = JSON.parse(pastedText);

        // Try multiple possible field names for credentials
        const clientId = data.client_id || data.clientId || data.CLIENT_ID;
        const apiKey = data.api_key || data.apiKey || data.API_KEY || data.key;

        if (clientId || apiKey) {
          e.preventDefault(); // Prevent default paste

          if (clientId) {
            clientInput.value = clientId;
          }
          if (apiKey) {
            apiInput.value = apiKey;
          }

          status.textContent = 'Credentials extracted from JSON';
          status.style.color = 'var(--success-color)';

          // Optionally auto-save if both fields are filled
          if (clientId && apiKey) {
            setTimeout(() => {
              if (confirm('Auto-save extracted credentials?')) {
                localStorage.setItem('gcalClientId', clientId);
                localStorage.setItem('gcalApiKey', apiKey);
                status.textContent = 'Keys saved';
                setTimeout(() => location.reload(), 500);
              }
            }, 100);
          }
        }
      } catch (err) {
        // Not valid JSON, continue with normal paste
      }
    }
  }

  // Add paste listeners to both inputs
  clientInput.addEventListener('paste', handleSmartPaste);
  apiInput.addEventListener('paste', handleSmartPaste);

  settingsContainer.querySelector('#save-gcal-keys').addEventListener('click', () => {
    const clientId = clientInput.value.trim();
    const apiKey = apiInput.value.trim();
    if (!clientId || !apiKey) {
      status.textContent = 'Missing fields';
      status.style.color = 'var(--danger-color)';
      return;
    }
    localStorage.setItem('gcalClientId', clientId);
    localStorage.setItem('gcalApiKey', apiKey);
    clientInput.value = '';
    apiInput.value = '';
    status.textContent = 'Keys saved';
    status.style.color = 'var(--success-color)';
    setTimeout(() => location.reload(), 500);
  });

  settingsContainer.querySelector('#clear-gcal-keys').addEventListener('click', () => {
    localStorage.removeItem('gcalClientId');
    localStorage.removeItem('gcalApiKey');
    status.textContent = 'Keys cleared';
    status.style.color = 'var(--text-muted)';
  });
});
