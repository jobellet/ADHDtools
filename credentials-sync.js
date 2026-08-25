/**
 * credentials-sync.js
 * Cross-device credential sync using AES-256-GCM + PBKDF2.
 *
 * Collects all sensitive keys from localStorage (API keys, OAuth Client ID, etc.),
 * encrypts them with a user-supplied passphrase, and lets the user:
 *   1. Download the encrypted JSON file.
 *   2. Send it to themselves via a pre-filled mailto: link.
 *   3. Import & decrypt on a new device.
 */
(function () {
  'use strict';

  // ── Sensitive key detection (mirrors data-manager.js) ──────────────────────
  function isSensitiveKey(key) {
    if (!key) return false;
    const lk = key.toLowerCase();
    return (
      lk.includes('apikey') ||
      lk.includes('clientid') ||
      lk.startsWith('api-settings') ||
      lk.startsWith('adhd-ai-') ||
      lk === 'geminiapikey' ||
      lk === 'gcalclientid'
    );
  }

  function getSensitiveKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isSensitiveKey(k)) keys.push(k);
    }
    return keys;
  }

  function collectCredentials() {
    const creds = {};
    getSensitiveKeys().forEach(k => { creds[k] = localStorage.getItem(k); });
    return creds;
  }

  function applyCredentials(creds) {
    let count = 0;
    Object.entries(creds).forEach(([k, v]) => {
      if (isSensitiveKey(k) && v != null) { localStorage.setItem(k, v); count++; }
    });
    return count;
  }

  // ── AES-256-GCM + PBKDF2 ───────────────────────────────────────────────────
  const ITER = 310000;

  async function deriveKey(passphrase, salt) {
    const raw = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
      raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  async function encryptPayload(plain, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await deriveKey(pass, salt);
    const buf  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
    const b64  = u => btoa(String.fromCharCode(...new Uint8Array(u)));
    return { alg: 'AES-256-GCM+PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(buf) };
  }

  async function decryptPayload(p, pass) {
    const frB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const key   = await deriveKey(pass, frB64(p.salt));
    const buf   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: frB64(p.iv) }, key, frB64(p.data));
    return new TextDecoder().decode(buf);
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  function renderUI(container) {
    container.innerHTML = `
      <div class="creds-sync-wrap">
        <div class="creds-section">
          <h4><i class="fas fa-lock"></i> Export &amp; Send Credentials</h4>
          <p class="creds-hint">Encrypts your API keys &amp; OAuth Client ID with a passphrase so you can restore them on any device.</p>
          <div class="setting-group">
            <label for="creds-export-pw">Passphrase</label>
            <div class="creds-pw-row">
              <input type="password" id="creds-export-pw" placeholder="Choose a strong passphrase…" autocomplete="new-password">
              <button type="button" id="creds-toggle-exp" class="btn btn-icon" title="Show/hide"><i class="fas fa-eye"></i></button>
            </div>
            <div class="creds-strength-bar"><div id="creds-str-fill"></div></div>
            <span id="creds-str-lbl" class="creds-strength-label"></span>
          </div>
          <div id="creds-key-preview" class="creds-key-preview"></div>
          <div class="creds-export-actions">
            <button type="button" id="creds-dl-btn" class="btn btn-primary" disabled><i class="fas fa-download"></i> Download .adhdkeys</button>
            <button type="button" id="creds-mail-btn" class="btn btn-secondary" disabled><i class="fas fa-envelope"></i> Send via Email</button>
          </div>
          <span id="creds-exp-status" class="creds-status" aria-live="polite"></span>
        </div>

        <hr class="creds-divider">

        <div class="creds-section">
          <h4><i class="fas fa-unlock"></i> Import Credentials</h4>
          <p class="creds-hint">Paste the encrypted JSON from the email or upload the .adhdkeys file.</p>
          <div class="setting-group">
            <label for="creds-import-pw">Passphrase used during export</label>
            <div class="creds-pw-row">
              <input type="password" id="creds-import-pw" placeholder="Your passphrase…" autocomplete="current-password">
              <button type="button" id="creds-toggle-imp" class="btn btn-icon" title="Show/hide"><i class="fas fa-eye"></i></button>
            </div>
          </div>
          <div class="setting-group">
            <label for="creds-import-ta">Encrypted payload (JSON)</label>
            <textarea id="creds-import-ta" rows="5" placeholder='{"app":"ADHDtools","payload":{…}}'></textarea>
          </div>
          <div class="setting-group">
            <label for="creds-import-file">Or upload .adhdkeys file</label>
            <input type="file" id="creds-import-file" accept=".adhdkeys,.json">
          </div>
          <button type="button" id="creds-imp-btn" class="btn btn-primary"><i class="fas fa-key"></i> Decrypt &amp; Restore</button>
          <span id="creds-imp-status" class="creds-status" aria-live="polite"></span>
        </div>
      </div>`;

    bindEvents(container);
    refreshPreview(container);
  }

  function refreshPreview(container) {
    const el = container.querySelector('#creds-key-preview');
    if (!el) return;
    const keys = getSensitiveKeys();
    el.innerHTML = keys.length
      ? `<p class="creds-preview-label">Will export ${keys.length} credential${keys.length !== 1 ? 's' : ''}:</p><ul>${keys.map(k => `<li><i class="fas fa-key"></i> <code>${escHtml(k)}</code></li>`).join('')}</ul>`
      : `<span class="creds-empty">No credentials found yet. Add AI/Google keys in Settings first.</span>`;
  }

  function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function pwScore(pw) {
    if (pw.length < 8)  return 0;
    if (pw.length < 12) return 1;
    let s = 1;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = `creds-status creds-status--${type}`;
    if (type === 'ok' || type === 'warn') setTimeout(() => { el.textContent = ''; el.className = 'creds-status'; }, 5000);
  }

  function togglePw(btn, input) {
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
  }

  function bindEvents(container) {
    const expPw   = container.querySelector('#creds-export-pw');
    const impPw   = container.querySelector('#creds-import-pw');
    const dlBtn   = container.querySelector('#creds-dl-btn');
    const mailBtn = container.querySelector('#creds-mail-btn');
    const impBtn  = container.querySelector('#creds-imp-btn');
    const expSt   = container.querySelector('#creds-exp-status');
    const impSt   = container.querySelector('#creds-imp-status');
    const impTA   = container.querySelector('#creds-import-ta');
    const impFile = container.querySelector('#creds-import-file');
    const strFill = container.querySelector('#creds-str-fill');
    const strLbl  = container.querySelector('#creds-str-lbl');

    togglePw(container.querySelector('#creds-toggle-exp'), expPw);
    togglePw(container.querySelector('#creds-toggle-imp'), impPw);

    expPw.addEventListener('input', () => {
      const s = pwScore(expPw.value);
      const c = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#27ae60'][s];
      strFill.style.cssText = `width:${s*25}%;background:${c}`;
      strLbl.textContent = expPw.value.length ? ['Too short','Weak','Fair','Good','Strong'][s] : '';
      dlBtn.disabled = mailBtn.disabled = expPw.value.length < 8;
    });

    impFile.addEventListener('change', () => {
      const f = impFile.files[0];
      if (f) { const r = new FileReader(); r.onload = e => { impTA.value = e.target.result; }; r.readAsText(f); }
    });

    async function doEncrypt() {
      const creds = collectCredentials();
      if (!Object.keys(creds).length) throw new Error('No credentials to export.');
      const payload = await encryptPayload(JSON.stringify(creds), expPw.value);
      return JSON.stringify({ app: 'ADHDtools', version: '1', createdAt: new Date().toISOString(), payload }, null, 2);
    }

    dlBtn.addEventListener('click', async () => {
      try {
        dlBtn.disabled = true;
        setStatus(expSt, '⏳ Encrypting…', 'info');
        const json = await doEncrypt();
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: `adhd-keys-${new Date().toISOString().slice(0,10)}.adhdkeys` });
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
        setStatus(expSt, '✅ File downloaded!', 'ok');
      } catch (e) { setStatus(expSt, '❌ ' + e.message, 'err'); }
      finally { dlBtn.disabled = expPw.value.length < 8; }
    });

    mailBtn.addEventListener('click', async () => {
      try {
        mailBtn.disabled = true;
        setStatus(expSt, '⏳ Encrypting…', 'info');
        const json = await doEncrypt();
        const subj = encodeURIComponent('ADHD Tools – Encrypted Keys Backup');
        const body = encodeURIComponent(
          'Here are my encrypted ADHD Tools credentials.\n\n' +
          'To restore:\n' +
          '1. Open Settings → Credentials Sync → Import\n' +
          '2. Paste the JSON below\n' +
          '3. Enter your passphrase\n\n' +
          '──────────────────────────────\n' +
          json +
          '\n──────────────────────────────\n'
        );
        window.open(`mailto:?subject=${subj}&body=${body}`, '_self');
        setStatus(expSt, '✅ Email client opened!', 'ok');
      } catch (e) { setStatus(expSt, '❌ ' + e.message, 'err'); }
      finally { mailBtn.disabled = expPw.value.length < 8; }
    });

    impBtn.addEventListener('click', async () => {
      const raw = impTA.value.trim();
      const pw  = impPw.value;
      if (!raw || !pw) { setStatus(impSt, '⚠️ Paste JSON and enter passphrase.', 'warn'); return; }
      try {
        impBtn.disabled = true;
        setStatus(impSt, '⏳ Decrypting…', 'info');
        const bundle = JSON.parse(raw);
        if (bundle.app !== 'ADHDtools' || !bundle.payload) throw new Error('Invalid file format.');
        const plain = await decryptPayload(bundle.payload, pw);
        const count = applyCredentials(JSON.parse(plain));
        setStatus(impSt, `✅ ${count} credential${count !== 1 ? 's' : ''} restored! Reload to apply.`, 'ok');
        refreshPreview(container);
      } catch (e) {
        setStatus(impSt, e.name === 'OperationError' ? '❌ Wrong passphrase or corrupted data.' : '❌ ' + e.message, 'err');
      } finally { impBtn.disabled = false; }
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function init() {
    const c = document.getElementById('credentials-sync-container');
    if (c) renderUI(c);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

  window.CredentialsSync = {
    refresh() { const c = document.getElementById('credentials-sync-container'); if (c) refreshPreview(c); }
  };
})();
