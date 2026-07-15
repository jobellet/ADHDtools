// api-settings.js - UI for configuring the optional AI provider.
// The app works fully without AI ("None"); this panel lets users plug in any
// provider (OpenAI/ChatGPT, Gemini, Claude, Mistral, Groq, OpenRouter, or a
// custom OpenAI-compatible endpoint such as Ollama). Keys stay in localStorage.

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('api-settings');
  if (!container || !window.AIAssistant) return;

  const { PROVIDERS } = window.AIAssistant;

  container.innerHTML = `
    <div class="ai-settings">
      <p class="small-note">
        AI assistance is <strong>optional</strong>: every tool works without it.
        With a provider configured you get smarter natural-language task capture,
        AI task breakdown, AI day planning, and encouragement summaries.
        Your key is stored only in this browser and requests go directly to the provider.
      </p>
      <div class="setting-group">
        <label for="ai-provider-select">AI provider</label>
        <select id="ai-provider-select"></select>
      </div>
      <div class="setting-group" id="ai-key-group">
        <label for="ai-api-key-input">API key <span id="ai-key-hint" class="small-note"></span></label>
        <input type="password" id="ai-api-key-input" placeholder="Paste API key" autocomplete="off" />
      </div>
      <div class="setting-group" id="ai-model-group">
        <label for="ai-model-input">Model (leave empty for default)</label>
        <input type="text" id="ai-model-input" />
      </div>
      <div class="setting-group" id="ai-baseurl-group" style="display:none">
        <label for="ai-baseurl-input">Endpoint base URL (OpenAI-compatible)</label>
        <input type="text" id="ai-baseurl-input" placeholder="http://localhost:11434/v1" />
      </div>
      <div class="ai-settings-actions">
        <button id="ai-save-btn" class="btn btn-primary" type="button">Save</button>
        <button id="ai-test-btn" class="btn btn-secondary" type="button">Test connection</button>
        <button id="ai-clear-btn" class="btn btn-outline" type="button">Clear</button>
      </div>
      <p id="ai-settings-status" class="status" aria-live="polite"></p>
    </div>
  `;

  const providerSelect = container.querySelector('#ai-provider-select');
  const keyGroup = container.querySelector('#ai-key-group');
  const keyInput = container.querySelector('#ai-api-key-input');
  const keyHint = container.querySelector('#ai-key-hint');
  const modelGroup = container.querySelector('#ai-model-group');
  const modelInput = container.querySelector('#ai-model-input');
  const baseUrlGroup = container.querySelector('#ai-baseurl-group');
  const baseUrlInput = container.querySelector('#ai-baseurl-input');
  const status = container.querySelector('#ai-settings-status');

  Object.entries(PROVIDERS).forEach(([id, def]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = def.label;
    providerSelect.appendChild(option);
  });

  function showStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', Boolean(isError));
  }

  function refreshVisibility() {
    const def = PROVIDERS[providerSelect.value] || PROVIDERS.none;
    const isNone = providerSelect.value === 'none';
    keyGroup.style.display = isNone ? 'none' : '';
    modelGroup.style.display = isNone ? 'none' : '';
    baseUrlGroup.style.display = providerSelect.value === 'custom' ? '' : 'none';
    keyHint.textContent = def.keyHint ? `(get one at ${def.keyHint})` : '';
    modelInput.placeholder = def.defaultModel || '';
    if (!isNone && !def.requiresKey) {
      keyInput.placeholder = 'Optional for local servers';
    } else {
      keyInput.placeholder = 'Paste API key';
    }
  }

  function loadIntoForm() {
    const settings = window.AIAssistant.getSettings();
    providerSelect.value = PROVIDERS[settings.provider] ? settings.provider : 'none';
    keyInput.value = settings.apiKey || '';
    modelInput.value = settings.model || '';
    baseUrlInput.value = settings.baseUrl || '';
    refreshVisibility();
    if (window.AIAssistant.isEnabled()) {
      showStatus(`Active: ${window.AIAssistant.getActiveLabel()}`);
    } else {
      showStatus('AI assistance is off — the app runs fully offline.');
    }
  }

  providerSelect.addEventListener('change', refreshVisibility);

  container.querySelector('#ai-save-btn').addEventListener('click', () => {
    window.AIAssistant.saveSettings({
      provider: providerSelect.value,
      apiKey: keyInput.value.trim(),
      model: modelInput.value.trim(),
      baseUrl: baseUrlInput.value.trim(),
    });
    if (window.AIAssistant.isEnabled()) {
      showStatus(`Saved. Active: ${window.AIAssistant.getActiveLabel()}`);
    } else if (providerSelect.value !== 'none') {
      showStatus('Saved, but a key is required for this provider.', true);
    } else {
      showStatus('Saved. AI assistance is off.');
    }
  });

  container.querySelector('#ai-test-btn').addEventListener('click', async () => {
    showStatus('Testing…');
    try {
      await window.AIAssistant.testConnection({
        provider: providerSelect.value,
        apiKey: keyInput.value.trim(),
        model: modelInput.value.trim(),
        baseUrl: baseUrlInput.value.trim(),
      });
      showStatus('Connection works ✔');
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  container.querySelector('#ai-clear-btn').addEventListener('click', () => {
    window.AIAssistant.clearSettings();
    loadIntoForm();
    showStatus('AI settings cleared.');
  });

  loadIntoForm();
});
