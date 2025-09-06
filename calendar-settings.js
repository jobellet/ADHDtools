// calendar-settings.js - Manage Google Calendar API credentials on the calendar page

document.addEventListener('DOMContentLoaded', () => {
  const calendarSection = document.getElementById('calendar');
  if (!calendarSection) return;

  const container = document.createElement('div');
  container.id = 'gcal-settings';
  container.innerHTML = `
    <h3>Google Calendar API</h3>
    <p>Enter your Google Calendar Client ID and API Key to enable calendar sync.</p>
    <div class="api-setting">
      <label for="gcal-client-id-input">Client ID:</label>
      <input type="text" id="gcal-client-id-input" placeholder="Enter Client ID" />
    </div>
    <div class="api-setting">
      <label for="gcal-api-key-input">API Key:</label>
      <input type="password" id="gcal-api-key-input" placeholder="Enter API Key" />
    </div>
    <button id="save-gcal-keys" class="btn btn-primary">Save</button>
    <button id="clear-gcal-keys" class="btn btn-secondary">Clear</button>
    <span id="gcal-key-status" class="status"></span>
  `;

  const firstChild = calendarSection.querySelector('.calendar-container');
  calendarSection.insertBefore(container, firstChild);

  const clientInput = container.querySelector('#gcal-client-id-input');
  const apiInput = container.querySelector('#gcal-api-key-input');
  const status = container.querySelector('#gcal-key-status');

  if (localStorage.getItem('gcalClientId') && localStorage.getItem('gcalApiKey')) {
    status.textContent = 'Keys saved';
  }

  container.querySelector('#save-gcal-keys').addEventListener('click', () => {
    const clientId = clientInput.value.trim();
    const apiKey = apiInput.value.trim();
    if (!clientId || !apiKey) {
      status.textContent = 'Missing fields';
      return;
    }
    localStorage.setItem('gcalClientId', clientId);
    localStorage.setItem('gcalApiKey', apiKey);
    clientInput.value = '';
    apiInput.value = '';
    status.textContent = 'Keys saved';
    setTimeout(() => location.reload(), 500);
  });

  container.querySelector('#clear-gcal-keys').addEventListener('click', () => {
    localStorage.removeItem('gcalClientId');
    localStorage.removeItem('gcalApiKey');
    status.textContent = 'Keys cleared';
  });
});
