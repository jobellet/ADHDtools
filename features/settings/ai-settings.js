// features/settings/ai-settings.js - UI for configuring the optional AI provider.
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
        For your privacy and security, API keys are automatically excluded from data exports and Drive backups.
      </p>

      <details class="settings-toggle" style="margin-bottom: 1rem; border: 1px solid #ddd; padding: 0.5rem; border-radius: 4px;">
        <summary style="font-weight: 500; cursor: pointer;">How to get an API Key</summary>
        <div class="settings-content" style="padding-top: 0.5rem; font-size: 0.9em;">
          <p><strong>Google Gemini (Recommended, has Free Tier):</strong></p>
          <ol style="margin-top: 0.25rem; margin-bottom: 0.5rem; padding-left: 1.5rem;">
            <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a> and sign in.</li>
            <li>Click "Create API key".</li>
            <li>Copy the key and paste it below. (The free tier is generous but rate-limited).</li>
          </ol>

          <p><strong>OpenAI (ChatGPT):</strong></p>
          <ol style="margin-top: 0.25rem; margin-bottom: 0.5rem; padding-left: 1.5rem;">
            <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI API keys</a> (requires a funded developer account).</li>
            <li>Click "Create new secret key".</li>
            <li>Copy the key and paste it below.</li>
          </ol>

          <p><strong>Anthropic (Claude):</strong></p>
          <ol style="margin-top: 0.25rem; margin-bottom: 0.5rem; padding-left: 1.5rem;">
            <li>Go to <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">Anthropic Console</a> (requires a funded developer account).</li>
            <li>Click "Create Key".</li>
            <li>Copy the key and paste it below.</li>
          </ol>

          <p><strong>Mistral AI:</strong></p>
          <ol style="margin-top: 0.25rem; margin-bottom: 0.5rem; padding-left: 1.5rem;">
            <li>Go to <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener noreferrer">Mistral Console</a>.</li>
            <li>Click "Create new key".</li>
            <li>Copy the key and paste it below.</li>
          </ol>

          <p><strong>Groq (Fast, limited free tier):</strong></p>
          <ol style="margin-top: 0.25rem; margin-bottom: 0.5rem; padding-left: 1.5rem;">
            <li>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Groq Console</a>.</li>
            <li>Click "Create API Key".</li>
            <li>Copy the key and paste it below.</li>
          </ol>

          <p><strong>Local AI (LFM3 / llama.cpp / Ollama — 100% Offline & Private):</strong></p>
          <p style="margin-top: 0.25rem; margin-bottom: 0.5rem;">
            Run a lightweight ~1 GB open model directly on your PC with zero cloud dependency.
            See the step-by-step setup guide: <a href="docs/local-ai.md" target="_blank" rel="noopener noreferrer">docs/local-ai.md</a>.
          </p>
        </div>
      </details>

      <div id="local-ai-desktop-card" class="local-ai-card hidden">
        <div class="local-ai-card-header">
          <strong><i class="fas fa-microchip"></i> <span data-i18n="settings.localAi.title">Local AI</span></strong>
          <span id="local-ai-settings-badge" class="local-ai-badge stopped">Stopped</span>
        </div>
        <p class="small-note" data-i18n="settings.localAi.desc">
          Run an AI model directly on your computer (100% offline, private, and free).
        </p>
        <div class="local-ai-actions">
          <button id="local-ai-settings-toggle-btn" class="btn btn-secondary btn-sm" type="button">Start Local AI</button>
          <button id="local-ai-settings-use-btn" class="btn btn-outline btn-sm" type="button" data-i18n="settings.localAi.useAsProvider">Use as active provider</button>
        </div>
      </div>

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
    // Refresh the Credentials Sync panel so the new key appears in the export list
    window.CredentialsSync?.refresh();
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

  async function setupLocalAi() {
    const headerBtn = document.getElementById('local-ai-header-btn');
    const card = document.getElementById('local-ai-desktop-card');
    const badge = document.getElementById('local-ai-settings-badge');
    const toggleBtn = document.getElementById('local-ai-settings-toggle-btn');
    const useBtn = document.getElementById('local-ai-settings-use-btn');

    if (!window.AttentionService?.isNative?.()) {
      if (headerBtn) headerBtn.classList.add('hidden');
      if (card) card.classList.add('hidden');
      return;
    }

    function updateUi(status) {
      if (!status || !status.available) {
        if (headerBtn) headerBtn.classList.add('hidden');
        if (card) card.classList.add('hidden');
        return;
      }

      // Local AI is present! Show the controls
      if (headerBtn) headerBtn.classList.remove('hidden');
      if (card) card.classList.remove('hidden');

      const isRunning = Boolean(status.running);
      const port = status.port || 11434;

      if (headerBtn) {
        headerBtn.classList.toggle('running', isRunning);
        const titleStr = isRunning
          ? `${window.I18n?.t ? window.I18n.t('local-ai-btn') : 'Local AI'} : ${window.I18n?.t ? window.I18n.t('settings.localAi.running', { port }) : 'Running'}`
          : `${window.I18n?.t ? window.I18n.t('local-ai-btn') : 'Local AI'} : ${window.I18n?.t ? window.I18n.t('settings.localAi.stopped') : 'Stopped'}`;
        headerBtn.title = titleStr;
        headerBtn.setAttribute('aria-label', titleStr);
      }

      if (badge) {
        badge.className = `local-ai-badge ${isRunning ? 'running' : 'stopped'}`;
        badge.textContent = isRunning
          ? (window.I18n?.t ? window.I18n.t('settings.localAi.running', { port }) : `Active on port ${port}`)
          : (window.I18n?.t ? window.I18n.t('settings.localAi.stopped') : 'Stopped');
      }

      if (toggleBtn) {
        toggleBtn.textContent = isRunning
          ? (window.I18n?.t ? window.I18n.t('settings.localAi.stop') : 'Stop Local AI Server')
          : (window.I18n?.t ? window.I18n.t('settings.localAi.start') : 'Start Local AI Server');
        toggleBtn.className = `btn ${isRunning ? 'btn-danger' : 'btn-secondary'} btn-sm`;
      }
    }

    async function refreshStatus() {
      try {
        const status = await window.AttentionService.getLocalAiStatus();
        updateUi(status);
        return status;
      } catch (err) {
        updateUi({ available: false, running: false });
        return { available: false, running: false };
      }
    }

    async function handleToggle() {
      const current = await refreshStatus();
      if (!current.available) return;

      if (headerBtn) headerBtn.classList.add(current.running ? 'stopping' : 'starting');
      if (toggleBtn) toggleBtn.disabled = true;

      try {
        const next = current.running
          ? await window.AttentionService.stopLocalAi()
          : await window.AttentionService.startLocalAi();
        updateUi(next);
      } catch (err) {
        console.warn('Failed to toggle local AI:', err);
      } finally {
        if (headerBtn) headerBtn.classList.remove('starting', 'stopping');
        if (toggleBtn) toggleBtn.disabled = false;
        refreshStatus();
      }
    }

    if (headerBtn) {
      headerBtn.addEventListener('click', handleToggle);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', handleToggle);
    }

    if (useBtn) {
      useBtn.addEventListener('click', () => {
        providerSelect.value = 'custom';
        baseUrlInput.value = 'http://localhost:11434/v1';
        modelInput.value = 'lfm3';
        keyInput.value = '';
        refreshVisibility();
        window.AIAssistant.saveSettings({
          provider: 'custom',
          apiKey: '',
          model: 'lfm3',
          baseUrl: 'http://localhost:11434/v1',
        });
        showStatus(`Saved. Active: ${window.AIAssistant.getActiveLabel()}`);
        window.CredentialsSync?.refresh();
      });
    }

    refreshStatus();
  }

  loadIntoForm();
  setupLocalAi();
});
