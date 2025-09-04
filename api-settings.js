// api-settings.js - UI for managing API credentials
// Allows saving/clearing Gemini and Google Calendar keys in localStorage

document.addEventListener('DOMContentLoaded', () => {
  const aboutSection = document.getElementById('about');
  if (!aboutSection) return;

  const container = document.createElement('div');
  container.id = 'api-settings';
  container.innerHTML = `
    <h3>API Settings</h3>
    <div class="api-setting">
      <label for="gemini-api-key-input">Gemini API Key:</label>
      <input type="password" id="gemini-api-key-input" placeholder="Enter API Key" />
      <button id="save-gemini-key" class="btn btn-primary">Save</button>
      <button id="clear-gemini-key" class="btn btn-secondary">Clear</button>
      <span id="gemini-key-status" class="status"></span>
    </div>
    <div class="api-setting">
      <label for="gcal-client-id-input">Google Calendar Client ID:</label>
      <input type="text" id="gcal-client-id-input" placeholder="Enter Client ID" />
      <label for="gcal-api-key-input">Google Calendar API Key:</label>
      <input type="password" id="gcal-api-key-input" placeholder="Enter API Key" />
      <button id="save-gcal-keys" class="btn btn-primary">Save</button>
      <button id="clear-gcal-keys" class="btn btn-secondary">Clear</button>
      <span id="gcal-key-status" class="status"></span>
    </div>
  `;
  aboutSection.appendChild(container);

  // Gemini key handlers
  const geminiInput = container.querySelector('#gemini-api-key-input');
  const geminiStatus = container.querySelector('#gemini-key-status');
  if (localStorage.getItem('geminiApiKey')) {
    geminiStatus.textContent = 'Key saved';
  }

  container.querySelector('#save-gemini-key').addEventListener('click', () => {
    const key = geminiInput.value.trim();
    if (!key) {
      geminiStatus.textContent = 'No key entered';
      return;
    }
    localStorage.setItem('geminiApiKey', key);
    geminiInput.value = '';
    geminiStatus.textContent = 'Key saved';
  });

  container.querySelector('#clear-gemini-key').addEventListener('click', () => {
    localStorage.removeItem('geminiApiKey');
    geminiStatus.textContent = 'Key cleared';
  });

  // Google Calendar key handlers
  const gcalClientInput = container.querySelector('#gcal-client-id-input');
  const gcalApiInput = container.querySelector('#gcal-api-key-input');
  const gcalStatus = container.querySelector('#gcal-key-status');
  if (localStorage.getItem('gcalClientId') && localStorage.getItem('gcalApiKey')) {
    gcalStatus.textContent = 'Keys saved';
  }

  container.querySelector('#save-gcal-keys').addEventListener('click', () => {
    const clientId = gcalClientInput.value.trim();
    const apiKey = gcalApiInput.value.trim();
    if (!clientId || !apiKey) {
      gcalStatus.textContent = 'Missing fields';
      return;
    }
    localStorage.setItem('gcalClientId', clientId);
    localStorage.setItem('gcalApiKey', apiKey);
    gcalClientInput.value = '';
    gcalApiInput.value = '';
    gcalStatus.textContent = 'Keys saved';
  });

  container.querySelector('#clear-gcal-keys').addEventListener('click', () => {
    localStorage.removeItem('gcalClientId');
    localStorage.removeItem('gcalApiKey');
    gcalStatus.textContent = 'Keys cleared';
  });
});

