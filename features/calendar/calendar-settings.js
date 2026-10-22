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
    <div class="api-setting" id="gcal-client-secret-row" style="margin-bottom: 0.5rem; display: none;">
      <label for="gcal-client-secret-input" style="display:block; font-size: 0.85rem;">Client secret (Desktop & Android app):</label>
      <input type="password" id="gcal-client-secret-input" placeholder="GOCSPX-…" autocomplete="off" style="width: 100%; padding: 0.4rem;" />
    </div>
    <div class="api-actions" style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
        <button type="button" id="save-gcal-keys" class="btn btn-primary btn-sm">Save</button>
        <button type="button" id="copy-gcal-json" class="btn btn-secondary btn-sm" style="display: none;" title="Copy credentials as JSON to transfer to Android"><i class="fas fa-copy"></i> Copy for Android</button>
        <button type="button" id="clear-gcal-keys" class="btn btn-secondary btn-sm">Clear</button>
    </div>
    <span id="gcal-key-status" class="status" style="display: block; margin-top: 0.5rem; font-size: 0.85rem;"></span>
  `;

  const clientInput = settingsContainer.querySelector('#gcal-client-id-input');
  const status = settingsContainer.querySelector('#gcal-key-status');
  const secretInput = settingsContainer.querySelector('#gcal-client-secret-input');
  const copyBtn = settingsContainer.querySelector('#copy-gcal-json');

  // The old integration also stored an API key; it is no longer needed.
  localStorage.removeItem('gcalApiKey');

  function refreshUI() {
    const isNative = Boolean(window.AttentionService?.isNative?.());
    if (isNative) {
      const secretRow = settingsContainer.querySelector('#gcal-client-secret-row');
      if (secretRow) secretRow.style.display = '';
    }

    const currentId = window.GoogleAuth?.getClientId?.() || localStorage.getItem('gcalClientId') || '';
    const currentSecret = window.GoogleAuth?.getClientSecret?.() || localStorage.getItem('gcalClientSecret') || '';

    if (currentId && !clientInput.value) {
      clientInput.value = currentId;
    }
    if (currentSecret) {
      secretInput.placeholder = '•••••••• (saved)';
    }

    if (copyBtn) {
      copyBtn.style.display = (currentId && currentSecret) ? '' : 'none';
    }

    if (currentId) {
      if (isNative) {
        if (currentSecret) {
          status.textContent = 'Client ID and Secret configured ✓';
          status.style.color = 'var(--success-color)';
        } else {
          status.textContent = 'Client ID saved, but Client Secret is missing (required on Android & Desktop)';
          status.style.color = 'var(--warning-color, #e67e22)';
        }
      } else {
        status.textContent = 'Client ID saved ✓';
        status.style.color = 'var(--success-color)';
      }
    }
  }

  // Smart extraction: accept raw strings, JSON blob (e.g. credentials.json), markdown, or labeled text
  function extractCredentials(text) {
    if (!text || typeof text !== 'string') return null;
    let raw = text.trim();
    // Strip markdown code fences if present
    raw = raw.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();

    // Try parsing as JSON first
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const data = JSON.parse(raw);
        const clientId = data.client_id || data.clientId || data.CLIENT_ID
          || data.installed?.client_id || data.web?.client_id;
        const clientSecret = data.client_secret || data.clientSecret || data.CLIENT_SECRET
          || data.installed?.client_secret || data.web?.client_secret;
        if (clientId) {
          return { clientId: String(clientId).trim(), clientSecret: clientSecret ? String(clientSecret).trim() : '' };
        }
      } catch { /* not JSON */ }
    }

    // Try regex extraction
    const idMatch = raw.match(/([0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com)/i);
    const secretMatch = raw.match(/(GOCSPX-[a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return {
        clientId: idMatch[1].trim(),
        clientSecret: secretMatch ? secretMatch[1].trim() : '',
      };
    }
    return null;
  }

  function handleSmartPaste(e) {
    const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
    if (!pastedText) return;
    const extracted = extractCredentials(pastedText);
    if (extracted && extracted.clientId) {
      e.preventDefault();
      clientInput.value = extracted.clientId;
      if (extracted.clientSecret) {
        secretInput.value = extracted.clientSecret;
      }
      status.textContent = extracted.clientSecret
        ? 'Client ID and Secret extracted from paste — click Save'
        : 'Client ID extracted from paste — click Save';
      status.style.color = 'var(--success-color)';
    }
  }

  clientInput.addEventListener('paste', handleSmartPaste);
  secretInput.addEventListener('paste', handleSmartPaste);

  settingsContainer.querySelector('#save-gcal-keys').addEventListener('click', (e) => {
    e.preventDefault();
    let clientId = clientInput.value.trim();
    let secret = secretInput.value.trim();

    // Check if the input contains a pasted blob that wasn't caught by smart paste
    const extracted = extractCredentials(clientId) || (secret ? extractCredentials(secret) : null);
    if (extracted && extracted.clientId) {
      clientId = extracted.clientId;
      clientInput.value = clientId;
      if (extracted.clientSecret && !secret) {
        secret = extracted.clientSecret;
      }
    }

    // Clean zero-width chars and invisible unicode
    clientId = clientId.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    secret = secret.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

    if (!clientId) {
      status.textContent = 'Client ID is empty';
      status.style.color = 'var(--danger-color)';
      return;
    }

    if (!clientId.includes('.apps.googleusercontent.com')) {
      status.textContent = 'Invalid Client ID: must end with .apps.googleusercontent.com';
      status.style.color = 'var(--danger-color)';
      return;
    }

    const isNative = Boolean(window.AttentionService?.isNative?.());
    const existingSecret = window.GoogleAuth?.getClientSecret?.() || localStorage.getItem('gcalClientSecret') || '';
    const finalSecret = secret || existingSecret;

    window.GoogleAuth ? window.GoogleAuth.setClientId(clientId) : localStorage.setItem('gcalClientId', clientId);
    if (secret) {
      window.GoogleAuth ? window.GoogleAuth.setClientSecret(secret) : localStorage.setItem('gcalClientSecret', secret);
      secretInput.value = '';
      secretInput.placeholder = '•••••••• (saved)';
    }

    if (isNative && !finalSecret) {
      status.textContent = 'Warning: Android & Desktop require a Client Secret (Desktop app OAuth client).';
      status.style.color = 'var(--warning-color, #e67e22)';
    } else {
      status.textContent = isNative ? 'Client ID and Secret saved ✓' : 'Client ID saved ✓';
      status.style.color = 'var(--success-color)';
    }

    refreshUI();
    window.dispatchEvent(new CustomEvent('capabilitiesChanged'));
  });

  copyBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = window.GoogleAuth?.getClientId?.() || localStorage.getItem('gcalClientId') || '';
    const secret = window.GoogleAuth?.getClientSecret?.() || localStorage.getItem('gcalClientSecret') || '';
    if (!id) return;
    const payload = JSON.stringify({ client_id: id, client_secret: secret || '' }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      status.textContent = 'Copied credentials JSON to clipboard! Paste it into ADHD Tools on your phone.';
      status.style.color = 'var(--success-color)';
    } catch {
      prompt('Copy this credentials JSON to paste into ADHD Tools on your phone:', payload);
    }
  });

  settingsContainer.querySelector('#clear-gcal-keys').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('gcalClientId');
    localStorage.removeItem('gcalApiKey');
    localStorage.removeItem('gcalClientSecret');
    window.GoogleAuth?.clearTokens();
    clientInput.value = '';
    secretInput.value = '';
    secretInput.placeholder = 'GOCSPX-…';
    status.textContent = 'Client ID cleared';
    status.style.color = 'var(--text-muted)';
    refreshUI();
    window.dispatchEvent(new CustomEvent('capabilitiesChanged'));
  });

  refreshUI();
  window.addEventListener('capabilitiesChanged', refreshUI);
  window.addEventListener('nativeSecretsRestored', refreshUI);
});
