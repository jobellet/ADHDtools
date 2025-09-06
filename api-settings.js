// api-settings.js - UI for managing API credentials
// Allows saving/clearing Gemini API key in localStorage

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
});

